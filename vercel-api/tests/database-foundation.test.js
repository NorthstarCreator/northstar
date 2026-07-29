const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const migration = fs.readFileSync(
  path.join(__dirname, "../db/migrations/001_foundation.sql"),
  "utf8"
);
const firstImportMigration = fs.readFileSync(
  path.join(__dirname, "../db/migrations/002_first_import_control.sql"),
  "utf8"
);
const sourcePolicyMigration = fs.readFileSync(
  path.join(__dirname, "../db/migrations/003_source_import_policies.sql"),
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

function loadSourcePolicy() {
  clearModule("../lib/source-import-policy");
  return require("../lib/source-import-policy");
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
  const sql = compactSql(firstImportMigration);
  assert.match(sql, /create table first_import_controls/);
  assert.match(sql, /tiktok_open_id text not null unique/);
  assert.match(sql, /sync_run_id uuid not null unique references sync_runs\(id\) on delete restrict/);
  assert.match(sql, /check \(status in \('pending_review', 'approved', 'rolled_back'\)\)/);
  assert.match(sql, /create or replace function rollback_first_import\(p_sync_run_id uuid\)/);
  assert.match(sql, /where sync_run_id = p_sync_run_id and status = 'pending_review'/);
  assert.match(sql, /delete from video_metric_snapshots where sync_run_id = p_sync_run_id/);
  assert.match(sql, /delete from account_metric_snapshots where sync_run_id = p_sync_run_id/);
  assert.match(sql, /where first_seen_sync_run_id = p_sync_run_id and last_seen_sync_run_id = p_sync_run_id/);
  assert.match(sql, /update sync_runs set status = 'rolled_back'/);
  assert.match(sql, /update first_import_controls set status = 'rolled_back'/);
}

function testFirstImportApprovalFunction() {
  const sql = compactSql(firstImportMigration);
  assert.match(sql, /create or replace function approve_first_import\(p_sync_run_id uuid\)/);
  assert.match(sql, /set status = 'approved'/);
  assert.match(sql, /fic.sync_run_id = p_sync_run_id/);
  assert.match(sql, /fic.status = 'pending_review'/);
  assert.match(sql, /sr.status in \('succeeded', 'partial'\)/);
  assert.match(sql, /raise exception 'first_import_not_pending_or_reviewable'/);
}

function testSourceImportPolicySchema() {
  const sql = compactSql(sourcePolicyMigration);
  assert.match(sql, /create table source_import_policies/);
  assert.match(sql, /account_id uuid not null references creator_accounts\(id\) on delete cascade/);
  assert.match(sql, /source_code text not null check \(source_code in \( 'tiktok_display_api', 'tiktok_shop', 'creator_rewards', 'tiktok_go' \)\)/);
  assert.match(sql, /constraint source_import_policies_account_source_unique unique \(account_id, source_code\)/);
  assert.match(sql, /import_range_mode <> 'specific_date' or requested_start_at is not null/);
  assert.match(sql, /status not in \('approved', 'active'\) or approved_at is not null/);
  assert.match(sql, /first_import_status <> 'approved' or first_import_completed_at is not null/);
  assert.doesNotMatch(sql, /\b(insert into|update|delete from)\b/);
  assert.doesNotMatch(sql, /2025-10-01/);
}

function testSourceImportPolicyValidation() {
  const policy = loadSourcePolicy();
  const normalized = policy.normalizeSourceImportPolicy({
    accountId: "00000000-0000-4000-8000-000000000001",
    sourceCode: "tiktok_display_api",
    importRangeMode: "specific_date",
    requestedStartAt: "2025-10-01T00:00:00-04:00",
    effectiveStartAt: "2025-10-01T04:00:00Z",
    reportingTimezone: "America/New_York",
    status: "approved",
    approvedAt: "2026-07-23T12:00:00Z",
    firstImportStatus: "approved",
    firstImportCompletedAt: "2026-07-23T12:30:00Z"
  });
  assert.equal(normalized.sourceCode, "tiktok_display_api");
  assert.equal(normalized.requestedStartAt, "2025-10-01T04:00:00.000Z");
  assert.equal(normalized.reportingTimezone, "America/New_York");
  assert.throws(
    () => policy.normalizeSourceImportPolicy({
      accountId: "00000000-0000-4000-8000-000000000001",
      sourceCode: "tiktok_shop",
      importRangeMode: "specific_date",
      reportingTimezone: "America/New_York"
    }),
    /requires requested_start_at/
  );
  assert.throws(
    () => policy.normalizeSourceImportPolicy({
      accountId: "00000000-0000-4000-8000-000000000001",
      sourceCode: "demo",
      importRangeMode: "all_available",
      reportingTimezone: "America/New_York"
    }),
    /Invalid source_code/
  );
  assert.throws(
    () => policy.normalizeSourceImportPolicy({
      accountId: "all-accounts",
      sourceCode: "tiktok_shop",
      importRangeMode: "all_available",
      reportingTimezone: "America\/New_York"
    }),
    /exact creator account/
  );
}

function testEnvironmentMappingAndMismatchProtection() {
  const db = loadDb();
  assert.equal(
    db.expectedDatabaseEnvironment({ NORTHSTAR_ENV: "tiktok_sandbox", NORTHSTAR_DATABASE_ENV: "sandbox" }),
    "sandbox"
  );
  assert.equal(
    db.expectedDatabaseEnvironment({ NORTHSTAR_ENV: "production", NORTHSTAR_DATABASE_ENV: "production" }),
    "production"
  );
  assert.equal(
    db.expectedDatabaseEnvironment({ NORTHSTAR_ENV: "development", NORTHSTAR_DATABASE_ENV: "development" }),
    "development"
  );
  assert.throws(
    () => db.expectedDatabaseEnvironment({ NORTHSTAR_ENV: "tiktok_sandbox", NORTHSTAR_DATABASE_ENV: "production" }),
    /do not match/
  );
  assert.throws(
    () => db.expectedDatabaseEnvironment({ NORTHSTAR_ENV: "unexpected", NORTHSTAR_DATABASE_ENV: "sandbox" }),
    /application environment/
  );
  assert.throws(
    () => db.expectedDatabaseEnvironment({ NORTHSTAR_ENV: "sandbox", NORTHSTAR_DATABASE_ENV: "unexpected" }),
    /database environment/
  );
  assert.throws(
    () => db.expectedDatabaseEnvironment({ NORTHSTAR_DATABASE_ENV: "development" }),
    /application environment/
  );
  assert.throws(
    () => db.expectedDatabaseEnvironment({ NORTHSTAR_ENV: "development" }),
    /database environment/
  );
}

function testDatabaseUrlIsolationAndAmbiguity() {
  const db = loadDb();
  assert.deepEqual(
    db.databaseUrl({
      NORTHSTAR_ENV: "production",
      NORTHSTAR_DATABASE_ENV: "production",
      DATABASE_URL: " postgres://production "
    }),
    { name: "DATABASE_URL", value: "postgres://production", environment: "production" }
  );
  assert.deepEqual(
    db.databaseUrl({
      NORTHSTAR_ENV: "tiktok_sandbox",
      NORTHSTAR_DATABASE_ENV: "sandbox",
      DATABASE_URL_SANDBOX: "postgres://sandbox"
    }),
    { name: "DATABASE_URL_SANDBOX", value: "postgres://sandbox", environment: "sandbox" }
  );
  assert.deepEqual(
    db.databaseUrl({
      NORTHSTAR_ENV: "development",
      NORTHSTAR_DATABASE_ENV: "development",
      POSTGRES_URL_DEVELOPMENT: "postgres://development"
    }),
    { name: "POSTGRES_URL_DEVELOPMENT", value: "postgres://development", environment: "development" }
  );
  assert.throws(
    () => db.databaseUrl({
      NORTHSTAR_ENV: "tiktok_sandbox",
      NORTHSTAR_DATABASE_ENV: "sandbox",
      DATABASE_URL_SANDBOX: "postgres://one",
      POSTGRES_URL_SANDBOX: "postgres://two"
    }),
    /Ambiguous/
  );
  assert.throws(
    () => db.databaseUrl({
      NORTHSTAR_ENV: "development",
      NORTHSTAR_DATABASE_ENV: "development",
      DATABASE_URL: "postgres://production"
    }),
    /not configured for development/
  );
  assert.throws(
    () => db.databaseUrl({
      NORTHSTAR_ENV: "tiktok_sandbox",
      NORTHSTAR_DATABASE_ENV: "sandbox",
      DATABASE_URL: "postgres://production"
    }),
    /not configured for sandbox/
  );
  assert.throws(
    () => db.databaseUrl({
      NORTHSTAR_ENV: "production",
      NORTHSTAR_DATABASE_ENV: "production",
      DATABASE_URL_SANDBOX: "postgres://sandbox"
    }),
    /not configured for production/
  );
  assert.throws(
    () => db.createSqlClient({
      NORTHSTAR_ENV: "production",
      NORTHSTAR_DATABASE_ENV: "sandbox",
      DATABASE_URL: "postgres://must-not-open"
    }),
    /do not match/
  );
}

async function testDatabaseEnvironmentFailsClosed() {
  const db = loadDb();
  await assert.rejects(
    () => db.assertDatabaseEnvironment(async () => [], {
      NORTHSTAR_ENV: "tiktok_sandbox",
      NORTHSTAR_DATABASE_ENV: "sandbox"
    }),
    /not initialized/
  );
  await assert.rejects(
    () => db.assertDatabaseEnvironment(async () => [{ environment: "production" }], {
      NORTHSTAR_ENV: "tiktok_sandbox",
      NORTHSTAR_DATABASE_ENV: "sandbox"
    }),
    /mismatch/
  );
  const result = await db.assertDatabaseEnvironment(
    async () => [{ environment: "sandbox" }],
    { NORTHSTAR_ENV: "tiktok_sandbox", NORTHSTAR_DATABASE_ENV: "sandbox" }
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
    testFirstImportApprovalFunction,
    testSourceImportPolicySchema,
    testSourceImportPolicyValidation,
    testEnvironmentMappingAndMismatchProtection,
    testDatabaseUrlIsolationAndAmbiguity,
    testHistoricalCutoffServiceLayer,
    testRepositoryProvenanceAndCutoff
  ].forEach((test) => test());

  await testDatabaseEnvironmentFailsClosed();

  console.log("Database foundation tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
