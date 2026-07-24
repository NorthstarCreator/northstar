const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const migration = fs.readFileSync(
  path.join(__dirname, "../db/migrations/001_foundation.sql"),
  "utf8"
);

function clearModule(modulePath) {
  delete require.cache[require.resolve(modulePath)];
}

function compactSql(sql) {
  return sql.replace(/\s+/g, " ").toLowerCase();
}

function loadDb() {
  clearModule("../lib/db");
  return require("../lib/db");
}

function loadPolicy() {
  clearModule("../lib/live-import-policy");
  return require("../lib/live-import-policy");
}

function loadRepository() {
  clearModule("../lib/sync-repository");
  return require("../lib/sync-repository");
}

function testSchemaTablesExist() {
  [
    "application_environment",
    "creator_accounts",
    "connected_tiktok_accounts",
    "sync_runs",
    "sync_run_errors",
    "videos",
    "account_metric_snapshots",
    "video_metric_snapshots",
    "revenue_sources"
  ].forEach((table) => {
    assert.match(migration, new RegExp(`CREATE TABLE ${table}`, "i"));
  });
}

function testDuplicatePreventionConstraints() {
  const sql = compactSql(migration);
  assert.match(sql, /constraint creator_accounts_slug_unique unique \(platform, slug\)/);
  assert.match(sql, /constraint connected_tiktok_accounts_open_id_unique unique \(tiktok_open_id\)/);
  assert.match(sql, /constraint videos_tiktok_video_unique unique \(platform, tiktok_video_id\)/);
  assert.match(sql, /constraint account_metric_snapshots_once_per_sync unique \(sync_run_id, account_id\)/);
  assert.match(sql, /constraint video_metric_snapshots_once_per_sync unique \(sync_run_id, video_id\)/);
}

function testAllAccountsIsNotStored() {
  const sql = compactSql(migration);
  assert.match(sql, /creator_accounts_no_all_accounts/);
  assert.match(sql, /lower\(slug\) not in \('all-accounts', 'all_accounts', 'all accounts'\)/);
}

function testHistoricalCutoffDatabaseBoundary() {
  const sql = compactSql(migration);
  assert.match(sql, /sync_runs_cutoff_not_before_live_start check \(cutoff_start_at >= timestamptz '2025-10-01 00:00:00\+00'\)/);
  assert.match(sql, /videos_published_after_live_cutoff check \(published_at >= timestamptz '2025-10-01 00:00:00\+00'\)/);
}

function testSyncProvenanceColumns() {
  const sql = compactSql(migration);
  assert.match(sql, /first_seen_sync_run_id uuid/);
  assert.match(sql, /last_seen_sync_run_id uuid/);
  assert.match(sql, /sync_run_id uuid not null references sync_runs\(id\)/);
}

function testFirstImportRollbackFunction() {
  const sql = compactSql(migration);
  assert.match(sql, /create or replace function rollback_first_import\(p_sync_run_id uuid\)/);
  assert.match(sql, /delete from video_metric_snapshots where sync_run_id = p_sync_run_id/);
  assert.match(sql, /delete from account_metric_snapshots where sync_run_id = p_sync_run_id/);
  assert.match(sql, /where first_seen_sync_run_id = p_sync_run_id and last_seen_sync_run_id = p_sync_run_id/);
  assert.match(sql, /set status = 'rolled_back'/);
}

function testEnvironmentMappingAndMismatchProtection() {
  const db = loadDb();
  assert.equal(db.expectedDatabaseEnvironment({ NORTHSTAR_ENV: "tiktok_sandbox" }), "sandbox");
  assert.equal(db.expectedDatabaseEnvironment({ NORTHSTAR_ENV: "production" }), "production");
  assert.equal(db.expectedDatabaseEnvironment({ NODE_ENV: "test" }), "development");
  assert.throws(
    () => db.expectedDatabaseEnvironment({ NORTHSTAR_ENV: "unexpected" }),
    /not configured/
  );
}

async function testDatabaseEnvironmentFailsClosed() {
  const db = loadDb();
  await assert.rejects(
    () => db.assertDatabaseEnvironment(async () => [], { NORTHSTAR_ENV: "tiktok_sandbox" }),
    /not initialized/
  );
  await assert.rejects(
    () => db.assertDatabaseEnvironment(async () => [{ environment: "production" }], { NORTHSTAR_ENV: "tiktok_sandbox" }),
    /mismatch/
  );
  const result = await db.assertDatabaseEnvironment(
    async () => [{ environment: "sandbox" }],
    { NORTHSTAR_ENV: "tiktok_sandbox" }
  );
  assert.deepEqual(result, { expected: "sandbox", actual: "sandbox" });
}

function testHistoricalCutoffServiceLayer() {
  const policy = loadPolicy();
  assert.equal(policy.LIVE_IMPORT_CUTOFF, "2025-10-01");
  assert.equal(policy.isOnOrAfterLiveImportCutoff({ create_time: "1759276799" }), false);
  assert.equal(policy.isOnOrAfterLiveImportCutoff({ create_time: "1759276800" }), true);
  assert.throws(
    () => policy.assertOnOrAfterLiveImportCutoff({ create_time: "1759276799" }),
    /before/
  );
}

function testRepositoryProvenanceAndCutoff() {
  const repository = loadRepository();
  const normalized = repository.normalizeTikTokVideoForDatabase(
    {
      id: "video_123",
      create_time: "1759276800",
      share_url: "https://example.invalid/video",
      view_count: "10"
    },
    "00000000-0000-0000-0000-000000000001",
    "00000000-0000-0000-0000-000000000002"
  );
  assert.equal(normalized.tiktokVideoId, "video_123");
  assert.equal(normalized.syncRunId, "00000000-0000-0000-0000-000000000001");
  assert.equal(normalized.accountId, "00000000-0000-0000-0000-000000000002");
  assert.equal(normalized.publishedAt, "2025-10-01T00:00:00.000Z");
  assert.equal(normalized.metrics.viewCount, 10);
  assert.throws(
    () => repository.normalizeTikTokVideoForDatabase({ id: "old", create_time: "1759276799" }, "run", "account"),
    /before/
  );
}

(async () => {
  [
    testSchemaTablesExist,
    testDuplicatePreventionConstraints,
    testAllAccountsIsNotStored,
    testHistoricalCutoffDatabaseBoundary,
    testSyncProvenanceColumns,
    testFirstImportRollbackFunction,
    testEnvironmentMappingAndMismatchProtection,
    testHistoricalCutoffServiceLayer,
    testRepositoryProvenanceAndCutoff
  ].forEach((test) => test());

  await testDatabaseEnvironmentFailsClosed();

  console.log("Database foundation tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
