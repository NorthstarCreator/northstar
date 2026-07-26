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
    ]
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
  assert.match(queries[1], /sr\.status = 'succeeded'/);
  assert.match(queries[1], /v\.published_at >= TIMESTAMPTZ '2025-10-01 00:00:00\+00'/);
  assert.match(queries[1], /ORDER BY v\.published_at DESC/);
  assert.match(queries[2], /sr\.status = 'succeeded'/);
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
    mePayload: { profile: { open_id: "fixture-open-id", display_name: "Fixture Creator", follower_count: 123300 } },
    videosPayload: {
      source: "northstar_postgres",
      videos,
      accountMetricSnapshots: [
        { snapshot_at: "2026-07-24T19:13:00Z", follower_count: 123156, sync_status: "succeeded" },
        { snapshot_at: "2026-07-26T01:18:48Z", follower_count: 123300, sync_status: "succeeded" }
      ]
    }
  });
  assert.equal(snapshot.videos.length, 806);
  assert.equal(snapshot.account.followers, 123300);
  assert.equal(snapshot.account.followerSnapshots.length, 2);
  assert.equal(snapshot.videos[0].publishedAt, videos[0].published_at);
}

(async () => {
  testEasternMonthAndNewest();
  testFollowerSummaryIgnoresFailedRuns();
  await testPersistedReadIsCompleteAndSuccessfulOnly();
  testAdapterPreservesAllPersistedRows();
  console.log("Dashboard persisted-data tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
