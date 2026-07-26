const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const dashboardDir = path.join(__dirname, "../../dashboard/sandbox/dashboard");
const period = require(path.join(dashboardDir, "live-period.js"));
const { readPersistedTikTokDashboard } = require("../lib/dashboard-read-model");

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
  assert.equal(snapshot.account.followers, 123300);
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
    title: video.id === "newest" ? "July 25 persisted newest" : `Persisted July video ${index + 1}`,
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

async function runActualEntrypoint({
  sessionConnected = true,
  omitClient = false,
  failProfile = false,
  lastSuccessfulSyncAt = "2026-07-26T01:18:48Z"
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
      if (url.endsWith("/tiktok/videos")) {
        return response({
          source: "northstar_postgres",
          videos: freshVideos,
          accountMetricSnapshots: [
            { snapshot_at: "2026-07-24T19:13:00Z", follower_count: 123156, sync_status: "succeeded" },
            { snapshot_at: "2026-07-24T23:54:00Z", follower_count: 123158, sync_status: "failed" },
            { snapshot_at: "2026-07-26T01:18:48Z", follower_count: 123300, sync_status: "succeeded" }
          ],
          lastSuccessfulSyncAt
        });
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
  await flushPromises();

  return { adapterCalls, documentListeners, elements, freshVideos, requests };
}

async function testActualEntrypointUsesFreshPersistedData() {
  const { adapterCalls, documentListeners, elements, requests } = await runActualEntrypoint();

  assert.deepEqual(requests.map(({ url }) => new URL(url).pathname), ["/session", "/tiktok/me", "/tiktok/videos"]);
  assert.ok(requests.every(({ options }) => options.credentials === "include"));
  assert.ok(requests.every(({ options }) => options.cache === "no-store"));
  assert.equal(adapterCalls, 1);
  assert.match(elements.content.innerHTML, /123,300/);
  assert.match(elements.content.innerHTML, /\+144 this month/);
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
  assert.doesNotMatch(elements.syncStrip.innerHTML, /TikTok Sandbox Connected/);
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
  testFollowerSummaryIgnoresFailedRuns();
  testPersistedSnapshotOmitsBrowserTimeFallback();
  await testPersistedReadIsCompleteAndSuccessfulOnly();
  testAdapterPreservesAllPersistedRows();
  await testActualEntrypointUsesFreshPersistedData();
  await testMissingPersistedSyncTimeStaysNotSynced();
  await testFirefoxDisconnectedSessionStaysInDemoMode();
  await testSafariBlockedClientFailsVisiblyWithoutRequests();
  await testAuthenticatedBootstrapFailureIsNotShownAsLive();
  console.log("Dashboard persisted-data tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
