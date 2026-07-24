const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const tiktok = require("../lib/tiktok");
const persistence = require("../lib/tiktok-sync-persistence");
const syncLock = require("../lib/sync-lock");

const SANDBOX_ENV = Object.freeze({
  NORTHSTAR_ENV: "tiktok_sandbox",
  NORTHSTAR_DATABASE_ENV: "sandbox",
  NORTHSTAR_PERSIST_SYNC_ENABLED: "true",
  NORTHSTAR_FIRST_IMPORT_ARMED: "true",
  NORTHSTAR_FIRST_IMPORT_OPEN_ID: "open-id-fixture",
  TIKTOK_VIDEO_SYNC_MAX_PAGES: "10"
});

function video(id, createTime, views = 10) {
  return {
    id,
    create_time: createTime,
    video_description: `Video ${id}`,
    view_count: views,
    like_count: 2,
    comment_count: 1,
    share_count: 1
  };
}

function profile() {
  return {
    open_id: "open-id-fixture",
    union_id: "union-id-fixture",
    display_name: "Creator Fixture",
    follower_count: 100,
    following_count: 50,
    likes_count: 500,
    video_count: 20
  };
}

function createRepositoryDouble(options = {}) {
  const state = {
    runs: [],
    accounts: new Map(),
    videos: new Map(),
    accountSnapshots: new Set(),
    videoSnapshots: new Set(),
    errors: [],
    controls: new Map(),
    forcedNonempty: false
  };
  let runSequence = 0;

  const repository = {
    async assertCreatorDataEmpty() {
      if (state.forcedNonempty) {
        const error = new Error("Creator database is not empty.");
        error.code = "first_import_database_not_empty";
        throw error;
      }
      return {};
    },
    async getFirstImportControl(_sql, openId) {
      return state.controls.get(openId) || null;
    },
    async createFirstImportControl(_sql, openId, syncRunId) {
      const control = { sync_run_id: syncRunId, status: "pending_review", account_id: null };
      state.controls.set(openId, control);
      return control;
    },
    async attachAccountToFirstImportControl(_sql, syncRunId, accountId) {
      const control = [...state.controls.values()].find((item) => item.sync_run_id === syncRunId);
      if (control) control.account_id = accountId;
    },
    async createSyncRun() {
      const run = { id: `run-${++runSequence}`, status: "running" };
      state.runs.push(run);
      return run;
    },
    async findConnectedAccount(_sql, openId) {
      const account = state.accounts.get(openId);
      return account ? { account_id: account.accountId } : null;
    },
    async upsertTikTokAccount(_sql, creatorProfile, syncRunId) {
      const openId = String(creatorProfile.open_id);
      const existing = state.accounts.get(openId);
      const account = existing || {
        accountId: `account-${state.accounts.size + 1}`,
        connectedTikTokAccountId: `connected-${state.accounts.size + 1}`,
        firstSeenSyncRunId: syncRunId
      };
      account.lastSeenSyncRunId = syncRunId;
      state.accounts.set(openId, account);
      return account;
    },
    async attachAccountToSyncRun(_sql, syncRunId, accountId, isInitial) {
      Object.assign(state.runs.find((run) => run.id === syncRunId), { accountId, isInitial });
    },
    async insertAccountMetricSnapshot(_sql, _profile, syncRunId, accountId) {
      const key = `${syncRunId}:${accountId}`;
      if (state.accountSnapshots.has(key)) return false;
      state.accountSnapshots.add(key);
      return true;
    },
    async upsertVideo(_sql, item, syncRunId, accountId) {
      if (options.failVideoId === item.id) {
        const error = new Error("Fixture failure");
        error.code = "fixture_video_failure";
        throw error;
      }
      const existing = state.videos.get(item.id);
      const record = existing || {
        videoId: `video-row-${state.videos.size + 1}`,
        firstSeenSyncRunId: syncRunId
      };
      record.accountId = accountId;
      record.lastSeenSyncRunId = syncRunId;
      state.videos.set(item.id, record);
      return {
        videoId: record.videoId,
        inserted: !existing,
        metrics: { viewCount: Number(item.view_count), likeCount: Number(item.like_count) }
      };
    },
    async insertVideoMetricSnapshot(_sql, videoId, syncRunId) {
      const key = `${syncRunId}:${videoId}`;
      if (state.videoSnapshots.has(key)) return false;
      state.videoSnapshots.add(key);
      return true;
    },
    async recordSyncError(_sql, syncRunId, details) {
      state.errors.push({ syncRunId, ...details });
    },
    async finishSyncRun(_sql, syncRunId, result) {
      Object.assign(state.runs.find((run) => run.id === syncRunId), result);
    }
  };

  return { repository, state };
}

function databaseDouble(counter) {
  return async (callback) => {
    counter.calls += 1;
    return callback({});
  };
}

function lockDependencies(options = {}) {
  return {
    acquireSyncLock: async () => options.reject ? null : ({ key: "fixture-lock", ownerToken: "fixture-owner" }),
    releaseSyncLock: async (lock) => {
      if (options.releases) options.releases.push(lock);
      return true;
    }
  };
}

async function testPaginationStopsAtCutoffAndDeduplicates() {
  const pages = [
    {
      videos: [video("new-a", "1761955200"), video("new-a", "1761955200")],
      cursor: 20,
      has_more: true
    },
    {
      videos: [video("new-b", "1759363200"), video("old", "1759276799")],
      cursor: 40,
      has_more: true
    }
  ];
  const calls = [];
  const result = await tiktok.listVideosSinceCutoff("not-a-real-token", {
    maxPages: 10,
    listPage: async (_token, cursor, maxCount) => {
      calls.push({ cursor, maxCount });
      return pages.shift();
    }
  });
  assert.deepEqual(result.videos.map((item) => item.id), ["new-a", "new-b"]);
  assert.equal(result.pagesFetched, 2);
  assert.equal(result.skippedBeforeCutoff, 1);
  assert.equal(result.reachedCutoff, true);
  assert.equal(result.truncated, false);
  assert.deepEqual(calls, [{ cursor: 0, maxCount: 20 }, { cursor: 20, maxCount: 20 }]);
}

async function testPaginationLimitIsReported() {
  const result = await tiktok.listVideosSinceCutoff("not-a-real-token", {
    maxPages: 1,
    listPage: async () => ({
      videos: [video("new", "1761955200")],
      cursor: 20,
      has_more: true
    })
  });
  assert.equal(result.truncated, true);
  assert.equal(result.has_more, true);
}

function testPersistenceDisabledByDefault() {
  assert.equal(persistence.persistenceEnabled({}), false);
  assert.equal(persistence.persistenceEnabled({ NORTHSTAR_PERSIST_SYNC_ENABLED: "false" }), false);
  assert.equal(persistence.persistenceEnabled({ NORTHSTAR_PERSIST_SYNC_ENABLED: "true" }), true);
  const routeSource = fs.readFileSync(path.join(__dirname, "../api/tiktok/sync.js"), "utf8");
  assert.match(routeSource, /if \(persistenceEnabled\(\)\)/);
  assert.match(routeSource, /else \{[\s\S]*getUserInfo[\s\S]*listAllVideos/);
  assert.throws(
    () => persistence.assertSandboxPersistenceEnvironment({
      NORTHSTAR_ENV: "tiktok_sandbox",
      NORTHSTAR_DATABASE_ENV: "sandbox"
    }),
    (error) => error.code === "persistence_disabled"
  );
}

function testPageLimitFailsClosed() {
  [undefined, "", "0", "101", "1.5", "many"].forEach((value) => {
    assert.throws(
      () => persistence.requiredVideoPageLimit({ TIKTOK_VIDEO_SYNC_MAX_PAGES: value }),
      (error) => error.code === "invalid_video_sync_page_limit"
    );
  });
  assert.equal(persistence.requiredVideoPageLimit({ TIKTOK_VIDEO_SYNC_MAX_PAGES: "1" }), 1);
  assert.equal(persistence.requiredVideoPageLimit({ TIKTOK_VIDEO_SYNC_MAX_PAGES: "100" }), 100);
}

async function testFirstImportAuthorizationAndEmptyDatabase() {
  const baseDeps = (repository, counter) => ({
    withDatabase: databaseDouble(counter),
    repository,
    getUserInfo: async () => profile(),
    listVideosSinceCutoff: async () => ({ videos: [], truncated: false }),
    ...lockDependencies()
  });

  for (const env of [
    { ...SANDBOX_ENV, NORTHSTAR_FIRST_IMPORT_ARMED: undefined },
    { ...SANDBOX_ENV, NORTHSTAR_FIRST_IMPORT_ARMED: "false" },
    { ...SANDBOX_ENV, NORTHSTAR_FIRST_IMPORT_OPEN_ID: undefined },
    { ...SANDBOX_ENV, NORTHSTAR_FIRST_IMPORT_OPEN_ID: "different-account" }
  ]) {
    const counter = { calls: 0 };
    const { repository, state } = createRepositoryDouble();
    await assert.rejects(
      () => persistence.runPersistentTikTokSync({ env, accessToken: "fixture", deps: baseDeps(repository, counter) }),
      (error) => ["first_import_not_armed", "first_import_account_rejected"].includes(error.code)
    );
    assert.equal(state.runs.length, 0);
  }

  const counter = { calls: 0 };
  const { repository, state } = createRepositoryDouble();
  state.forcedNonempty = true;
  await assert.rejects(
    () => persistence.runPersistentTikTokSync({
      env: SANDBOX_ENV,
      accessToken: "fixture",
      deps: baseDeps(repository, counter)
    }),
    (error) => error.code === "first_import_database_not_empty"
  );
  assert.equal(state.runs.length, 0);
}

async function testEnvironmentMismatchFailsBeforeDatabaseAccess() {
  const counter = { calls: 0 };
  await assert.rejects(
    () => persistence.runPersistentTikTokSync({
      env: {
        NORTHSTAR_ENV: "production",
        NORTHSTAR_DATABASE_ENV: "production",
        NORTHSTAR_PERSIST_SYNC_ENABLED: "true"
      },
      accessToken: "not-a-real-token",
      deps: { withDatabase: databaseDouble(counter) }
    }),
    /unavailable/
  );
  assert.equal(counter.calls, 0);

  await assert.rejects(
    () => persistence.runPersistentTikTokSync({
      env: {
        NORTHSTAR_ENV: "tiktok_sandbox",
        NORTHSTAR_DATABASE_ENV: "production",
        NORTHSTAR_PERSIST_SYNC_ENABLED: "true"
      },
      accessToken: "not-a-real-token",
      deps: { withDatabase: databaseDouble(counter) }
    }),
    /do not match/
  );
  assert.equal(counter.calls, 0);
}

async function testIdempotentEntitiesAndHistoricalSnapshots() {
  const counter = { calls: 0 };
  const { repository, state } = createRepositoryDouble();
  const deps = {
    withDatabase: databaseDouble(counter),
    repository,
    getUserInfo: async () => profile(),
    listVideosSinceCutoff: async () => ({
      videos: [video("video-1", "1761955200")],
      skippedBeforeCutoff: 2,
      truncated: false
    }),
    ...lockDependencies()
  };

  const first = await persistence.runPersistentTikTokSync({
    env: SANDBOX_ENV,
    accessToken: "not-a-real-token",
    scopes: ["user.info.basic", "user.info.stats", "video.list"],
    deps
  });
  state.controls.get("open-id-fixture").status = "approved";
  const second = await persistence.runPersistentTikTokSync({
    env: SANDBOX_ENV,
    accessToken: "not-a-real-token",
    scopes: ["user.info.basic", "user.info.stats", "video.list"],
    deps
  });

  assert.equal(state.accounts.size, 1);
  assert.equal(state.videos.size, 1);
  assert.equal(state.runs.length, 2);
  assert.equal(state.accountSnapshots.size, 2);
  assert.equal(state.videoSnapshots.size, 2);
  assert.equal(first.counts.videosInserted, 1);
  assert.equal(second.counts.videosInserted, 0);
  assert.equal(second.counts.videosUpdated, 1);
  assert.equal(first.counts.videosSkippedBeforeCutoff, 2);
  assert.equal(first.syncRunId, "run-1");
  assert.equal(first.firstImportStatus, "pending_review");
  assert.equal(state.runs[0].isInitial, true);
  assert.equal(state.runs[1].isInitial, false);
  const account = state.accounts.get("open-id-fixture");
  assert.equal(account.firstSeenSyncRunId, "run-1");
  assert.equal(account.lastSeenSyncRunId, "run-2");
  const savedVideo = state.videos.get("video-1");
  assert.equal(savedVideo.firstSeenSyncRunId, "run-1");
  assert.equal(savedVideo.lastSeenSyncRunId, "run-2");
}

async function testPartialFailureIsRecorded() {
  const counter = { calls: 0 };
  const { repository, state } = createRepositoryDouble({ failVideoId: "bad-video" });
  const result = await persistence.runPersistentTikTokSync({
    env: SANDBOX_ENV,
    accessToken: "not-a-real-token",
    deps: {
      withDatabase: databaseDouble(counter),
      repository,
      getUserInfo: async () => profile(),
      listVideosSinceCutoff: async () => ({
        videos: [video("good-video", "1761955200"), video("bad-video", "1761955200")],
        skippedBeforeCutoff: 0,
        truncated: true
      }),
      ...lockDependencies()
    }
  });
  assert.equal(result.counts.videosInserted, 1);
  assert.equal(result.counts.errorCount, 2);
  assert.equal(state.errors.length, 2);
  assert.equal(state.runs[0].status, "partial");
  assert.deepEqual(state.errors.map((error) => error.stage), ["video_persistence", "video_pagination"]);
}

async function testCatastrophicFailureMarksRunFailedWithoutSensitiveData() {
  const counter = { calls: 0 };
  const { repository, state } = createRepositoryDouble();
  await assert.rejects(
    () => persistence.runPersistentTikTokSync({
      env: SANDBOX_ENV,
      accessToken: "sensitive-token-must-not-appear",
      deps: {
        withDatabase: databaseDouble(counter),
        repository,
        getUserInfo: async () => profile(),
        listVideosSinceCutoff: async () => {
          const error = new Error("sensitive-token-must-not-appear");
          error.code = "video_fetch_failed";
          throw error;
        },
        ...lockDependencies()
      }
    }),
    (error) => {
      assert.equal(error.code, "video_fetch_failed");
      assert.doesNotMatch(error.message, /sensitive-token/);
      return true;
    }
  );
  assert.equal(state.runs[0].status, "failed");
  assert.equal(state.errors[0].code, "video_fetch_failed");
  assert.doesNotMatch(JSON.stringify(state), /sensitive-token/);
}

async function testPendingReviewAndConcurrentRequestsAreBlocked() {
  const counter = { calls: 0 };
  const { repository, state } = createRepositoryDouble();
  state.controls.set("open-id-fixture", { sync_run_id: "run-existing", status: "pending_review" });
  await assert.rejects(
    () => persistence.runPersistentTikTokSync({
      env: SANDBOX_ENV,
      accessToken: "fixture",
      deps: {
        withDatabase: databaseDouble(counter), repository,
        getUserInfo: async () => profile(), ...lockDependencies()
      }
    }),
    (error) => error.code === "first_import_pending_review"
  );
  assert.equal(state.runs.length, 0);

  const rejectedCounter = { calls: 0 };
  await assert.rejects(
    () => persistence.runPersistentTikTokSync({
      env: SANDBOX_ENV,
      accessToken: "fixture",
      deps: {
        withDatabase: databaseDouble(rejectedCounter),
        getUserInfo: async () => profile(),
        ...lockDependencies({ reject: true })
      }
    }),
    (error) => error.code === "sync_in_progress"
  );
  assert.equal(rejectedCounter.calls, 0);
}

async function testLockOwnershipAndExpiry() {
  const entries = new Map();
  const setCalls = [];
  const redisCommand = async (command, ...args) => {
    if (command === "SET") {
      const [key, owner, nx, ex, ttl] = args;
      setCalls.push({ nx, ex, ttl });
      if (entries.has(key)) return null;
      entries.set(key, owner);
      return "OK";
    }
    if (command === "EVAL") {
      const [, , key, owner] = args;
      if (entries.get(key) !== owner) return 0;
      entries.delete(key);
      return 1;
    }
    return null;
  };
  const first = await syncLock.acquireSyncLock("fixture-open-id", { redisCommand, ownerToken: "owner-a", ttlSeconds: 5 });
  assert.equal(first.ttlSeconds, 5);
  assert.deepEqual(setCalls[0], { nx: "NX", ex: "EX", ttl: "5" });
  assert.equal(await syncLock.acquireSyncLock("fixture-open-id", { redisCommand, ownerToken: "owner-b" }), null);
  assert.equal(await syncLock.releaseSyncLock({ ...first, ownerToken: "wrong-owner" }, { redisCommand }), false);
  assert.equal(await syncLock.releaseSyncLock(first, { redisCommand }), true);
  assert.ok(await syncLock.acquireSyncLock("fixture-open-id", { redisCommand, ownerToken: "owner-b" }));

  // Simulate Redis expiration: after expiry, a different owner can acquire it.
  entries.delete(first.key);
  assert.ok(await syncLock.acquireSyncLock("fixture-open-id", { redisCommand, ownerToken: "owner-c" }));
}

function testSafeSyncRunReportingAndDashboardPendingState() {
  const routeSource = fs.readFileSync(path.join(__dirname, "../api/tiktok/sync.js"), "utf8");
  const dashboardSource = fs.readFileSync(
    path.join(__dirname, "../../dashboard/sandbox/dashboard/app.js"),
    "utf8"
  );
  assert.match(routeSource, /syncRunId: persistenceResult\.syncRunId/);
  assert.match(routeSource, /firstImportStatus: persistenceResult\.firstImportStatus/);
  assert.doesNotMatch(routeSource, /NORTHSTAR_FIRST_IMPORT_OPEN_ID/);
  assert.equal((dashboardSource.match(/state\.live\.loading \? "Syncing\.\.\." : "Sync Now"/g) || []).length, 2);
  assert.match(dashboardSource, /if \(state\.live\.loading\) return;/);
}

(async () => {
  await testPaginationStopsAtCutoffAndDeduplicates();
  await testPaginationLimitIsReported();
  testPersistenceDisabledByDefault();
  testPageLimitFailsClosed();
  await testEnvironmentMismatchFailsBeforeDatabaseAccess();
  await testFirstImportAuthorizationAndEmptyDatabase();
  await testIdempotentEntitiesAndHistoricalSnapshots();
  await testPartialFailureIsRecorded();
  await testCatastrophicFailureMarksRunFailedWithoutSensitiveData();
  await testPendingReviewAndConcurrentRequestsAreBlocked();
  await testLockOwnershipAndExpiry();
  testSafeSyncRunReportingAndDashboardPendingState();
  console.log("TikTok sync persistence tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
