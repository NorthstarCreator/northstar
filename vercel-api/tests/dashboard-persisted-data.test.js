const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const dashboardDir = path.join(__dirname, "../../dashboard/sandbox/dashboard");
const period = require(path.join(dashboardDir, "live-period.js"));
const { readPersistedTikTokDashboard } = require("../lib/dashboard-read-model");
const {
  buildTikTokLiveOverlay,
  coalesceLiveOverlay,
  safeOverlayError
} = require("../lib/tiktok-live-overlay");

function julyFixture() {
  const videos = [];
  for (let day = 1; day <= 16; day += 1) {
    const count = day === 16 ? 2 : 2 + (day % 2);
    for (let index = 0; index < count; index += 1) {
      videos.push({ id: `early-${day}-${index}`, publishedAt: `2026-07-${String(day).padStart(2, "0")}T14:00:00Z` });
    }
  }
  while (videos.length < 40) videos.push({ id: `early-fill-${videos.length}`, publishedAt: "2026-07-16T15:00:00Z" });
  for (let index = 0; index < 17; index += 1) {
    const day = 17 + (index % 9);
    videos.push({ id: `recent-${index}`, publishedAt: `2026-07-${String(day).padStart(2, "0")}T${String(12 + (index % 8)).padStart(2, "0")}:00:00Z` });
  }
  videos[videos.length - 1] = { id: "newest", publishedAt: "2026-07-25T12:46:22Z" };
  return videos;
}

function testEasternMonthAndNewest() {
  const fixture = julyFixture();
  const options = { kind: "month", now: "2026-07-25T16:00:00Z" };
  const visible = fixture.filter((video) => period.inRange(video.publishedAt, options));
  assert.equal(visible.length, 57);
  assert.equal(period.newest(visible)[0].id, "newest");
  assert.equal(visible.filter((video) => period.dateKey(video.publishedAt) >= "2026-07-17").length, 17);

  const fullJuly = { kind: "custom", customStart: "2026-07-01", customEnd: "2026-07-31" };
  assert.equal(period.inRange("2026-08-01T03:59:59Z", fullJuly), true);
  assert.equal(period.inRange("2026-08-01T04:00:00Z", fullJuly), false);
}

function testEasternTodayWeekAndCustomRanges() {
  const now = "2026-07-26T02:30:00Z"; // July 25 at 10:30 PM Eastern.
  assert.deepEqual(period.range({ kind: "today", now }), { start: "2026-07-25", end: "2026-07-25" });
  assert.deepEqual(period.range({ kind: "week", now }), { start: "2026-07-19", end: "2026-07-25" });
  assert.deepEqual(
    period.range({ kind: "custom", customStart: "2025-10-01", customEnd: "2026-01-31", now }),
    { start: "2025-10-01", end: "2026-01-31" }
  );
  assert.equal(period.inRange("2026-07-26T01:59:59Z", { kind: "today", now }), true);
  assert.equal(period.inRange("2026-07-26T04:00:00Z", { kind: "today", now }), false);
}

function testFollowerSummaryIgnoresFailedRuns() {
  const snapshots = [
    { snapshotAt: "2026-07-24T19:13:00Z", followerCount: 123156, syncStatus: "succeeded" },
    { snapshotAt: "2026-07-24T20:08:00Z", followerCount: 123156, syncStatus: "failed" },
    { snapshotAt: "2026-07-24T23:54:00Z", followerCount: 123158, syncStatus: "failed" },
    { snapshotAt: "2026-07-26T01:18:48Z", followerCount: 123300, syncStatus: "succeeded" }
  ];
  const summary = period.followerSummary(snapshots, { kind: "month", now: "2026-07-26T02:00:00Z" });
  assert.deepEqual(summary, { total: 123300, change: 144, baseline: 123156 });
}

function testLiveFollowerSummaryUsesFreshCurrentAndSuccessfulBaseline() {
  const snapshots = [
    { snapshotAt: "2026-07-24T19:13:00Z", followerCount: 123156, syncStatus: "succeeded" },
    { snapshotAt: "2026-07-24T20:08:00Z", followerCount: 900000, syncStatus: "failed" },
    { snapshotAt: "2026-07-26T01:18:48Z", followerCount: 123300, syncStatus: "succeeded" }
  ];
  assert.deepEqual(
    period.liveFollowerSummary(snapshots, 123359, { kind: "month", now: "2026-07-26T14:00:00Z" }),
    { total: 123359, change: 203, baseline: 123156 }
  );
}

async function testLiveOverlayBatchesMergesAndPreservesHistory() {
  const persisted = Array.from({ length: 45 }, (_, index) => ({
    id: `known-${index}`,
    title: `Persisted ${index}`,
    published_at: `2026-07-${String(1 + (index % 25)).padStart(2, "0")}T15:00:00Z`,
    view_count: index,
    cover_image_url: index === 0 ? "persisted-cover" : ""
  }));
  const querySizes = [];
  const result = await buildTikTokLiveOverlay({
    accessToken: "fixture-token",
    persistedVideos: persisted,
    lastSuccessfulSyncAt: "2026-07-25T01:00:00Z",
    range: { start: "2026-07-01", end: "2026-07-31" },
    now: new Date("2026-07-26T14:00:00Z"),
    listPage: async () => ({
      videos: [{ id: "new-live", title: "New live", create_time: Math.floor(Date.parse("2026-07-26T12:00:00Z") / 1000), view_count: 77 }],
      cursor: 1,
      has_more: false
    }),
    queryBatch: async (_token, ids) => {
      querySizes.push(ids.length);
      return { videos: ids.map((id) => ({ id, view_count: 1000 + Number(id.split("-")[1]) })) };
    },
    sleep: async () => {}
  });
  assert.deepEqual(querySizes, [20, 20, 5]);
  assert.equal(result.videos.length, 46);
  assert.equal(new Set(result.videos.map((video) => video.id)).size, 46);
  assert.equal(result.videos.find((video) => video.id === "known-0").view_count, 1000);
  assert.equal(result.videos.find((video) => video.id === "known-0").cover_image_url, "persisted-cover");
  assert.equal(result.videos.find((video) => video.id === "new-live").live_status, "not_yet_synced");
  assert.equal(result.overlay.requestCount, 4);
  assert.equal(result.overlay.newCount, 1);
}

async function testLiveOverlayDiscoversMultiplePagesUntilLastSync() {
  const cursors = [];
  const pages = new Map([
    ["0", {
      videos: [{ id: "newest-live", create_time: Math.floor(Date.parse("2026-07-26T12:00:00Z") / 1000) }],
      cursor: 20,
      has_more: true
    }],
    ["20", {
      videos: [{ id: "second-live", create_time: Math.floor(Date.parse("2026-07-25T12:00:00Z") / 1000) }],
      cursor: 40,
      has_more: true
    }],
    ["40", {
      videos: [{ id: "at-last-sync", create_time: Math.floor(Date.parse("2026-07-24T12:00:00Z") / 1000) }],
      cursor: 60,
      has_more: true
    }]
  ]);
  const result = await buildTikTokLiveOverlay({
    accessToken: "fixture-token",
    persistedVideos: [],
    lastSuccessfulSyncAt: "2026-07-24T12:00:00Z",
    range: { start: "2026-07-01", end: "2026-07-31" },
    listPage: async (_token, cursor) => {
      cursors.push(cursor);
      return pages.get(String(cursor));
    },
    queryBatch: async () => ({ videos: [] }),
    sleep: async () => {}
  });
  assert.deepEqual(cursors, [0, 20, 40]);
  assert.deepEqual(result.videos.map((video) => video.id), ["newest-live", "second-live"]);
  assert.equal(result.overlay.requestCount, 3);
  assert.equal(result.overlay.truncated, false);
}

async function testLiveOverlayRejectsRepeatedDiscoveryCursor() {
  let calls = 0;
  await assert.rejects(
    buildTikTokLiveOverlay({
      accessToken: "fixture-token",
      persistedVideos: [],
      lastSuccessfulSyncAt: "2026-07-01T00:00:00Z",
      range: { start: "2026-07-01", end: "2026-07-31" },
      listPage: async () => {
        calls += 1;
        return {
          videos: [{ id: `page-${calls}`, create_time: Math.floor(Date.parse("2026-07-26T12:00:00Z") / 1000) }],
          cursor: 0,
          has_more: true
        };
      },
      queryBatch: async () => ({ videos: [] }),
      sleep: async () => {}
    }),
    (error) => error?.code === "tiktok_video_pagination_stalled"
  );
  assert.equal(calls, 1);
}

async function testLiveOverlayCeilingKeepsUnrefreshedHistory() {
  const persisted = Array.from({ length: 1100 }, (_, index) => ({
    id: `history-${index}`,
    published_at: "2026-07-15T12:00:00Z",
    view_count: index
  }));
  const result = await buildTikTokLiveOverlay({
    accessToken: "fixture-token",
    persistedVideos: persisted,
    lastSuccessfulSyncAt: "2026-07-20T00:00:00Z",
    range: { start: "2025-10-01", end: "2026-07-31" },
    listPage: async () => ({ videos: [], cursor: 0, has_more: false }),
    queryBatch: async (_token, ids) => ({ videos: ids.map((id) => ({ id, view_count: 9999 })) }),
    sleep: async () => {}
  });
  assert.equal(result.videos.length, 1100);
  assert.equal(result.overlay.requestCount, 50);
  assert.equal(result.overlay.status, "partial");
  assert.equal(result.overlay.safeCode, "live_request_ceiling");
  assert.ok(result.videos.some((video) => video.live_status === "persisted"));
}

async function testLiveOverlayCoalescesIdenticalRequests() {
  let calls = 0;
  const factory = async () => {
    calls += 1;
    await new Promise((resolve) => setImmediate(resolve));
    return { ok: true };
  };
  const [first, second] = await Promise.all([
    coalesceLiveOverlay("same-session:month", factory),
    coalesceLiveOverlay("same-session:month", factory)
  ]);
  assert.equal(calls, 1);
  assert.deepEqual(first, second);
}

async function testProviderFailureUsesSafeFallbackClassification() {
  const error = Object.assign(new Error("raw provider detail must not escape"), {
    code: "tiktok_api_rate_limited",
    retryable: false
  });
  await assert.rejects(
    buildTikTokLiveOverlay({
      accessToken: "fixture-token",
      persistedVideos: [],
      lastSuccessfulSyncAt: "2026-07-25T00:00:00Z",
      range: { start: "2026-07-01", end: "2026-07-31" },
      listPage: async () => { throw error; },
      sleep: async () => {}
    }),
    (caught) => safeOverlayError(caught).safeCode === "live_rate_limited"
  );
  assert.doesNotMatch(JSON.stringify(safeOverlayError(error)), /raw provider detail/);
}

function testLiveOverlayRouteIsReadOnly() {
  const routeSource = fs.readFileSync(path.join(__dirname, "../api/tiktok/videos.js"), "utf8");
  const overlaySource = fs.readFileSync(path.join(__dirname, "../lib/tiktok-live-overlay.js"), "utf8");
  const readModelSource = fs.readFileSync(path.join(__dirname, "../lib/dashboard-read-model.js"), "utf8");
  const combined = `${routeSource}\n${overlaySource}`;
  assert.doesNotMatch(combined, /\b(?:INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|UPSERT)\b/i);
  assert.doesNotMatch(combined, /createSyncRun|persistTikTokSync|sync_runs|video_metric_snapshots/);
  assert.match(routeSource, /readPersistedTikTokDashboard/);
  assert.match(routeSource, /buildTikTokLiveOverlay/);
  assert.match(routeSource, /requireSession\(req\)/);
  assert.match(routeSource, /activeConnection\(session\.id\)/);
  assert.match(routeSource, /readPersistedTikTokDashboard\(sql, connection\.openId\)/);
  assert.match(readModelSource, /cta\.tiktok_open_id = \$\{openId\}/);
  assert.match(readModelSource, /v\.account_id = \$\{account\.id\}::uuid/);
  assert.match(readModelSource, /ams\.account_id = \$\{account\.id\}::uuid/);
  assert.match(readModelSource, /sr\.account_id = \$\{account\.id\}::uuid/);
}

async function testPersistedReadIsCompleteAndSuccessfulOnly() {
  const rows = [
    [{ id: "account-uuid", display_name: "Fixture Creator" }],
    Array.from({ length: 806 }, (_, index) => ({
      id: `video-${index}`,
      published_at: new Date(Date.UTC(2026, 6, 25, 12, 46, 22) - index * 60000).toISOString()
    })),
    [
      { snapshot_at: "2026-07-24T19:13:00Z", follower_count: 123156, sync_status: "succeeded" },
      { snapshot_at: "2026-07-26T01:18:48Z", follower_count: 123300, sync_status: "succeeded" }
    ],
    [{ finished_at: "2026-07-26T01:18:48Z" }]
  ];
  const queries = [];
  async function sql(strings) {
    queries.push(strings.join("?"));
    return rows.shift();
  }
  const result = await readPersistedTikTokDashboard(sql, "fixture-open-id");
  assert.equal(result.videos.length, 806);
  assert.equal(result.videos[0].id, "video-0");
  assert.equal(result.accountMetricSnapshots.length, 2);
  assert.equal(result.lastSuccessfulSyncAt, "2026-07-26T01:18:48Z");
  assert.match(queries[1], /sr\.status = 'succeeded'/);
  assert.match(queries[1], /v\.published_at >= TIMESTAMPTZ '2025-10-01 00:00:00\+00'/);
  assert.match(queries[1], /ORDER BY v\.published_at DESC/);
  assert.match(queries[2], /sr\.status = 'succeeded'/);
  assert.match(queries[3], /sr\.status = 'succeeded'/);
  assert.match(queries[3], /sr\.platform = 'tiktok'/);
  assert.match(queries[3], /initial_display_api/);
  assert.match(queries[3], /ORDER BY sr\.finished_at DESC/);
  assert.doesNotMatch(queries.join("\n"), /LIMIT 100/);
}

function testAdapterPreservesAllPersistedRows() {
  const adapterSource = fs.readFileSync(path.join(dashboardDir, "live-data-adapter.js"), "utf8");
  const context = { window: { NORTHSTAR_LIVE_PERIOD: period } };
  vm.runInNewContext(adapterSource, context);
  const videos = Array.from({ length: 806 }, (_, index) => ({
    id: `video-${index}`,
    published_at: new Date(Date.UTC(2026, 6, 25, 12, 46, 22) - index * 60000).toISOString(),
    view_count: index
  }));
  const snapshot = context.window.NORTHSTAR_LIVE_ADAPTER.buildLiveSnapshot({
    mePayload: { profile: { open_id: "fixture-open-id", display_name: "Fixture Creator", follower_count: 123359 } },
    videosPayload: {
      source: "northstar_postgres",
      videos,
      accountMetricSnapshots: [
        { snapshot_at: "2026-07-24T19:13:00Z", follower_count: 123156, sync_status: "succeeded" },
        { snapshot_at: "2026-07-26T01:18:48Z", follower_count: 123300, sync_status: "succeeded" }
      ],
      lastSuccessfulSyncAt: "2026-07-26T01:18:48Z"
    },
    syncedAt: "2026-07-26T01:18:48Z"
  });
  assert.equal(snapshot.videos.length, 806);
  assert.equal(snapshot.account.followers, 123359);
  assert.equal(snapshot.account.followerSnapshots.length, 2);
  assert.equal(snapshot.videos[0].publishedAt, videos[0].published_at);
  assert.equal(snapshot.syncedAt, "2026-07-26T01:18:48Z");
}

function testPersistedSnapshotOmitsBrowserTimeFallback() {
  const adapterSource = fs.readFileSync(path.join(dashboardDir, "live-data-adapter.js"), "utf8");
  const context = { window: { NORTHSTAR_LIVE_PERIOD: period } };
  vm.runInNewContext(adapterSource, context);
  const snapshot = context.window.NORTHSTAR_LIVE_ADAPTER.buildLiveSnapshot({
    mePayload: { profile: { open_id: "fixture-open-id", follower_count: 123359 } },
    videosPayload: {
      source: "northstar_postgres",
      videos: [],
      accountMetricSnapshots: []
    },
    syncedAt: null
  });
  assert.equal(snapshot.syncedAt, null);
}

function response(payload) {
  return {
    ok: true,
    status: 200,
    json: async () => payload
  };
}

function createElement(id) {
  return {
    id,
    innerHTML: "",
    textContent: "",
    className: "",
    value: "",
    hidden: false,
    dataset: {},
    addEventListener() {},
    setAttribute() {},
    focus() {},
    querySelector(selector) {
      if (id === "dateMenu" && selector === ".date-options") return createElement("dateOptions");
      return null;
    }
  };
}

function persistedVideoFixture() {
  const july = julyFixture().map((video, index) => ({
    id: video.id,
    published_at: video.publishedAt,
    title: video.id === "newest"
      ? "July 25 persisted newest"
      : index === 1
        ? '<img src=x onerror="provider-content-must-not-execute">'
        : `Persisted July video ${index + 1}`,
    view_count: 1000 + index,
    like_count: 100 + index,
    comment_count: index,
    share_count: index
  }));
  const older = Array.from({ length: 749 }, (_, index) => ({
    id: `older-${index}`,
    published_at: new Date(Date.UTC(2026, 5, 30, 23, 59) - index * 60000).toISOString(),
    title: `Persisted older video ${index + 1}`,
    view_count: 500 + index,
    like_count: 50,
    comment_count: 5,
    share_count: 2
  }));
  return [...july, ...older];
}

function legacyCachedFixture(freshVideos) {
  return [...freshVideos.slice(0, 38), ...freshVideos.slice(57, 119)].map((video) => ({
    id: `tt-${video.id}`,
    tiktokVideoId: video.id,
    accountId: "tiktok-fixture-open-id",
    title: `LEGACY CACHED: ${video.title}`,
    date: period.dateKey(video.published_at),
    publishedAt: video.published_at,
    time: "8:00 AM",
    views: video.view_count,
    likes: video.like_count,
    comments: video.comment_count,
    shares: video.share_count,
    units: 0,
    gmv: 0,
    earnings: 0,
    sourceIds: ["tiktok-display"]
  }));
}

async function flushPromises(times = 12) {
  for (let index = 0; index < times; index += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

async function runActualEntrypoint({
  sessionConnected = true,
  omitClient = false,
  failProfile = false,
  lastSuccessfulSyncAt = "2026-07-26T01:18:48Z",
  holdSession = false,
  videoRequestHandler = null
} = {}) {
  const indexSource = fs.readFileSync(path.join(dashboardDir, "index.html"), "utf8");
  const scripts = [...indexSource.matchAll(/<script\s+src="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(scripts, [
    "config.js",
    "mock-data.js",
    "data-mode.js",
    "live-period.js",
    "live-data-adapter.js",
    "northstar-live-client.js",
    "app.js"
  ]);

  const ids = [
    "sidebarNav", "pageTitle", "content", "accountButton", "accountMenu", "accountAvatar",
    "accountLabel", "dateButton", "dateMenu", "dateLabel", "customDatePanel", "customStart",
    "customEnd", "syncStrip", "modalRoot", "addAccountButton"
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, createElement(id)]));
  const documentListeners = {};
  const document = {
    getElementById(id) {
      if (!elements[id]) elements[id] = createElement(id);
      return elements[id];
    },
    addEventListener(type, listener) {
      documentListeners[type] = listener;
    }
  };
  const freshVideos = persistedVideoFixture();
  const requests = [];
  const sessionGate = holdSession ? deferred() : null;
  let videoRequestCount = 0;
  const videoPayload = () => ({
    source: "northstar_postgres_live_overlay",
    videos: freshVideos.map((video) => ({ ...video, live_status: "refreshed", live_read_at: "2026-07-26T14:00:00Z" })),
    accountMetricSnapshots: [
      { snapshot_at: "2026-07-24T19:13:00Z", follower_count: 123156, sync_status: "succeeded" },
      { snapshot_at: "2026-07-24T23:54:00Z", follower_count: 123158, sync_status: "failed" },
      { snapshot_at: "2026-07-26T01:18:48Z", follower_count: 123300, sync_status: "succeeded" }
    ],
    lastSuccessfulSyncAt,
    overlay: { status: "live", readAt: "2026-07-26T14:00:00Z", requestCount: 4 }
  });
  const window = {
    location: { search: "", href: "https://northstar-dashboard-sandbox.vercel.app/" }
  };
  window.window = window;
  const context = vm.createContext({
    window,
    document,
    console,
    Intl,
    Date,
    URL,
    URLSearchParams,
    navigator: {},
    alert() {},
    setTimeout,
    clearTimeout,
    fetch: async (url, options = {}) => {
      requests.push({ url, options });
      if (url.endsWith("/session")) {
        if (sessionGate) return sessionGate.promise;
        return response({ connected: sessionConnected, csrfToken: "fixture-csrf", session: { authenticated: sessionConnected } });
      }
      if (url.endsWith("/tiktok/me")) {
        if (failProfile) throw new Error("fixture_api_failure");
        return response({
          connected: true,
          profile: {
            open_id: "fixture-open-id",
            display_name: "Fixture Creator",
            follower_count: 123359,
            following_count: 500,
            likes_count: 900000,
            video_count: 2062
          }
        });
      }
      if (new URL(url).pathname === "/tiktok/videos") {
        videoRequestCount += 1;
        const payload = videoPayload();
        return videoRequestHandler
          ? videoRequestHandler({ count: videoRequestCount, payload, url })
          : response(payload);
      }
      throw new Error(`Unexpected request: ${url}`);
    }
  });

  let adapterCalls = 0;
  for (const script of scripts) {
    if (omitClient && script === "northstar-live-client.js") continue;
    vm.runInContext(fs.readFileSync(path.join(dashboardDir, script), "utf8"), context, { filename: script });
    if (script === "live-data-adapter.js") {
      const original = window.NORTHSTAR_LIVE_ADAPTER.buildLiveSnapshot;
      window.NORTHSTAR_LIVE_ADAPTER.buildLiveSnapshot = (payload) => {
        adapterCalls += 1;
        return original(payload);
      };
    }
    if (script === "northstar-live-client.js") {
      window.NORTHSTAR_SANDBOX_DATA.videos = legacyCachedFixture(freshVideos);
    }
  }
  await flushPromises(holdSession ? 4 : 12);

  return {
    adapterCalls,
    documentListeners,
    elements,
    freshVideos,
    requests,
    flush: flushPromises,
    resolveSession(payload = { connected: sessionConnected, csrfToken: "fixture-csrf", session: { authenticated: sessionConnected } }) {
      sessionGate?.resolve(response(payload));
    },
    rejectSession(error = new Error("fixture_session_failure")) {
      sessionGate?.reject(error);
    }
  };
}

async function testActualEntrypointUsesFreshPersistedData() {
  const { adapterCalls, documentListeners, elements, requests } = await runActualEntrypoint();

  assert.deepEqual(requests.map(({ url }) => new URL(url).pathname), ["/session", "/tiktok/me", "/tiktok/videos"]);
  assert.equal(new URL(requests[2].url).searchParams.get("start"), "2026-07-01");
  assert.equal(new URL(requests[2].url).searchParams.get("end"), "2026-07-26");
  assert.ok(requests.every(({ options }) => options.credentials === "include"));
  assert.ok(requests.every(({ options }) => options.cache === "no-store"));
  assert.equal(adapterCalls, 1);
  assert.match(elements.content.innerHTML, /123,359/);
  assert.match(elements.content.innerHTML, /\+203 this month · Live/);
  assert.match(elements.syncStrip.innerHTML, /Last Sync: 7\/25\/2026, 9:18:48 PM/);

  documentListeners.click({
    target: {
      closest(selector) {
        if (selector === "[data-page]") return { dataset: { page: "videos" } };
        return null;
      }
    }
  });

  assert.match(elements.content.innerHTML, /57 videos/);
  assert.match(elements.content.innerHTML, /July 25 persisted newest/);
  assert.match(elements.content.innerHTML, /&lt;img src=x onerror=&quot;provider-content-must-not-execute&quot;&gt;/);
  assert.doesNotMatch(elements.content.innerHTML, /<img src=x onerror="provider-content-must-not-execute">/);
  assert.equal((elements.content.innerHTML.match(/class="video-row"/g) || []).length, 57);
  assert.equal(elements.content.innerHTML.includes("LEGACY CACHED:"), false);
  const newestIndex = elements.content.innerHTML.indexOf("July 25 persisted newest");
  const olderJulyIndex = elements.content.innerHTML.indexOf("Persisted July video 1");
  assert.ok(newestIndex >= 0 && olderJulyIndex >= 0 && newestIndex < olderJulyIndex);
}

async function testMissingPersistedSyncTimeStaysNotSynced() {
  const { elements } = await runActualEntrypoint({ lastSuccessfulSyncAt: null });
  assert.match(elements.syncStrip.innerHTML, /Last Sync: Not synced/);
}

async function testFirefoxDisconnectedSessionStaysInDemoMode() {
  const { elements, requests } = await runActualEntrypoint({ sessionConnected: false });
  assert.deepEqual(requests.map(({ url }) => new URL(url).pathname), ["/session"]);
  assert.match(elements.syncStrip.innerHTML, /Demo Prototype/);
  assert.match(elements.syncStrip.innerHTML, /Last Sync: Not synced/);
  assert.match(elements.content.innerHTML, /145,650/);
  assert.doesNotMatch(elements.content.innerHTML, /· Live/);
  assert.doesNotMatch(elements.syncStrip.innerHTML, /TikTok Sandbox Connected/);
}

async function testStartupDoesNotRenderDemoBeforeSessionResolves() {
  const runtime = await runActualEntrypoint({ holdSession: true });
  assert.deepEqual(runtime.requests.map(({ url }) => new URL(url).pathname), ["/session"]);
  assert.match(runtime.elements.syncStrip.innerHTML, /Checking live connection/);
  assert.match(runtime.elements.content.innerHTML, /Checking live connection/);
  assert.match(runtime.elements.accountLabel.textContent, /Checking account/);
  assert.doesNotMatch(runtime.elements.syncStrip.innerHTML, /Demo Prototype/);
  assert.doesNotMatch(runtime.elements.content.innerHTML, /145,650|644,700|\$1,387/);
  assert.doesNotMatch(runtime.elements.accountLabel.textContent, /All Accounts/);

  runtime.resolveSession({ connected: false, csrfToken: "fixture-csrf", session: { authenticated: false } });
  await runtime.flush();
  assert.match(runtime.elements.syncStrip.innerHTML, /Demo Prototype/);
  assert.match(runtime.elements.content.innerHTML, /145,650/);
  assert.doesNotMatch(runtime.elements.content.innerHTML, /· Live/);
}

function dispatchDateRange(listener, id) {
  listener({
    target: {
      closest(selector) {
        if (selector === "[data-page]") return null;
        if (selector === "[data-action]") return { dataset: { action: "date-range", id } };
        return null;
      }
    }
  });
}

async function testLateOverlayFailureCannotReplaceAuthenticatedStateWithDemo() {
  const delayedSecondVideos = deferred();
  const runtime = await runActualEntrypoint({
    videoRequestHandler({ count, payload }) {
      if (count === 2) return delayedSecondVideos.promise;
      return response(payload);
    }
  });
  assert.match(runtime.elements.content.innerHTML, /123,359/);
  assert.match(runtime.elements.syncStrip.innerHTML, /<strong>TikTok Sandbox<\/strong>/);

  dispatchDateRange(runtime.documentListeners.click, "week");
  await runtime.flush(4);
  assert.match(runtime.elements.syncStrip.innerHTML, /Refreshing live data/);
  assert.match(runtime.elements.content.innerHTML, /123,359/);
  assert.doesNotMatch(runtime.elements.syncStrip.innerHTML, /Demo Prototype/);

  dispatchDateRange(runtime.documentListeners.click, "month");
  delayedSecondVideos.reject(new Error("fixture_obsolete_overlay_failure"));
  await runtime.flush(16);

  assert.match(runtime.elements.syncStrip.innerHTML, /<strong>TikTok Sandbox<\/strong>/);
  assert.match(runtime.elements.content.innerHTML, /123,359/);
  assert.match(runtime.elements.accountLabel.textContent, /Fixture Creator/);
  assert.doesNotMatch(runtime.elements.syncStrip.innerHTML, /Demo Prototype/);
  assert.doesNotMatch(runtime.elements.content.innerHTML, /145,650|644,700|\$1,387/);
  assert.equal(runtime.requests.filter(({ url }) => new URL(url).pathname === "/tiktok/sync").length, 0);
}

async function testOverlayFailureRetainsAuthenticatedSnapshotAsStale() {
  const runtime = await runActualEntrypoint({
    videoRequestHandler({ count, payload }) {
      if (count === 2) throw new Error("fixture_overlay_failure");
      return response(payload);
    }
  });
  dispatchDateRange(runtime.documentListeners.click, "week");
  await runtime.flush();
  assert.match(runtime.elements.syncStrip.innerHTML, /TikTok Sandbox · Stale/);
  assert.match(runtime.elements.syncStrip.innerHTML, /Existing authenticated information remains available/);
  assert.match(runtime.elements.content.innerHTML, /123,359/);
  assert.doesNotMatch(runtime.elements.syncStrip.innerHTML, /Demo Prototype/);
  assert.doesNotMatch(runtime.elements.syncStrip.innerHTML, /data-action="sync-tiktok" disabled/);
  assert.doesNotMatch(runtime.elements.syncStrip.innerHTML, /data-action="disconnect-tiktok" disabled/);
}

async function testSafariBlockedClientFailsVisiblyWithoutRequests() {
  const { elements, requests } = await runActualEntrypoint({ omitClient: true });
  assert.equal(requests.length, 0);
  assert.match(elements.syncStrip.innerHTML, /Live connection unavailable/);
  assert.match(elements.syncStrip.innerHTML, /client_unavailable/);
  assert.doesNotMatch(elements.syncStrip.innerHTML, /TikTok Sandbox Connected/);
  assert.match(elements.syncStrip.innerHTML, /data-action="sync-tiktok" disabled/);
  assert.match(elements.syncStrip.innerHTML, /data-action="disconnect-tiktok" disabled/);
}

async function testAuthenticatedBootstrapFailureIsNotShownAsLive() {
  const { elements, requests } = await runActualEntrypoint({ failProfile: true });
  assert.deepEqual(requests.map(({ url }) => new URL(url).pathname), ["/session", "/tiktok/me"]);
  assert.match(elements.syncStrip.innerHTML, /Live data unavailable/);
  assert.match(elements.syncStrip.innerHTML, /Account information is unavailable/);
  assert.doesNotMatch(elements.syncStrip.innerHTML, /TikTok Sandbox Connected/);
  assert.match(elements.syncStrip.innerHTML, /data-action="sync-tiktok" disabled/);
}

(async () => {
  testEasternMonthAndNewest();
  testEasternTodayWeekAndCustomRanges();
  testFollowerSummaryIgnoresFailedRuns();
  testLiveFollowerSummaryUsesFreshCurrentAndSuccessfulBaseline();
  testPersistedSnapshotOmitsBrowserTimeFallback();
  await testLiveOverlayBatchesMergesAndPreservesHistory();
  await testLiveOverlayDiscoversMultiplePagesUntilLastSync();
  await testLiveOverlayRejectsRepeatedDiscoveryCursor();
  await testLiveOverlayCeilingKeepsUnrefreshedHistory();
  await testLiveOverlayCoalescesIdenticalRequests();
  await testProviderFailureUsesSafeFallbackClassification();
  testLiveOverlayRouteIsReadOnly();
  await testPersistedReadIsCompleteAndSuccessfulOnly();
  testAdapterPreservesAllPersistedRows();
  await testActualEntrypointUsesFreshPersistedData();
  await testMissingPersistedSyncTimeStaysNotSynced();
  await testFirefoxDisconnectedSessionStaysInDemoMode();
  await testStartupDoesNotRenderDemoBeforeSessionResolves();
  await testLateOverlayFailureCannotReplaceAuthenticatedStateWithDemo();
  await testOverlayFailureRetainsAuthenticatedSnapshotAsStale();
  await testSafariBlockedClientFailsVisiblyWithoutRequests();
  await testAuthenticatedBootstrapFailureIsNotShownAsLive();
  console.log("Dashboard persisted-data tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
