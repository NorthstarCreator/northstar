const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const migrationPath = path.join(
  __dirname,
  "../db/migrations/004_affiliate_creator_import_control.sql"
);
const migration = fs.readFileSync(migrationPath, "utf8");
const compact = migration.replace(/\s+/g, " ").trim().toLowerCase();
const compactDdl = migration
  .replace(/--.*$/gm, "")
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase();

function testMigrationDependencyAndTransactionBoundary() {
  assert.match(compact, /^-- .* begin;/);
  assert.match(compact, /to_regclass\('source_import_policies'\) is null/);
  assert.match(compact, /migration_003_source_import_policies_required/);
  assert.match(compact, /migration_003_constraints_required/);
  assert.match(compact, /source_import_policies_source_code_check/);
  assert.match(compact, /source_import_policies_import_range_mode_check/);
  assert.match(compact, /commit;$/);
}

function testPolicyExtensionIsCreatorSpecific() {
  assert.match(compact, /'tiktok_shop_affiliate_creator'/);
  assert.match(compact, /add column requested_start_date date/);
  assert.match(compact, /import_range_mode in \('start_date', 'all_available'\)/);
  assert.match(compact, /range_mode = 'start_date'.*requested_start_date is not null/s);
  assert.match(compact, /range_mode = 'all_available'.*requested_start_date is null/s);
  assert.doesNotMatch(migration, /2025-10-01/);
  assert.doesNotMatch(migration, /DEFAULT\s+DATE|DEFAULT\s+TIMESTAMPTZ/i);
}

function testControlPlaneTablesOnly() {
  for (const table of [
    "affiliate_creator_connections",
    "affiliate_creator_import_runs",
    "affiliate_creator_import_pages",
    "affiliate_creator_import_run_events"
  ]) assert.match(migration, new RegExp(`CREATE TABLE ${table}`, "i"));
  for (const table of [
    "affiliate_creator_products",
    "affiliate_creator_collaborations",
    "affiliate_creator_samples",
    "affiliate_creator_orders",
    "affiliate_creator_order_items",
    "affiliate_creator_revenue_events"
  ]) assert.doesNotMatch(migration, new RegExp(`CREATE TABLE ${table}`, "i"));
}

function testExactAccountAndCrossAccountConstraints() {
  assert.match(compact, /account_id uuid not null references creator_accounts\(id\)/);
  assert.match(compact, /unique \(account_id, provider_code\)/);
  assert.match(compact, /foreign key \(connection_id, account_id, provider_code\)/);
  assert.match(compact, /foreign key \(policy_id, account_id, provider_code\)/);
  assert.match(compact, /foreign key \(import_run_id, account_id\)/);
  assert.match(compact, /unique \(account_id, provider_code, idempotency_key\)/);
  assert.match(compact, /creator_accounts_no_affiliate_calculated_aliases/);
  for (const alias of ["all", "all-accounts", "all_accounts", "all accounts", "allaccounts"])
    assert.match(compact, new RegExp(`'${alias}'`));
}

function testImmutableWindowAndFirstImportControls() {
  assert.match(compact, /window_end_at timestamptz not null/);
  assert.match(compact, /window_start_at < window_end_at/);
  assert.match(compact, /prevent_affiliate_creator_import_identity_update/);
  for (const field of [
    "account_id", "connection_id", "policy_id", "operation_id", "idempotency_key",
    "range_mode", "requested_start_date", "reporting_timezone", "window_start_at",
    "window_end_at", "is_first_import"
  ]) assert.match(compact, new RegExp(`new\\.${field}`));
  assert.match(compact, /first_import_status text not null default 'not_required'/);
  assert.match(compact, /first_import_status <> 'approved' or approved_at is not null/);
  assert.match(compact, /first_import_status <> 'rolled_back' or rolled_back_at is not null/);
  assert.match(compact, /first_import_status <> 'approved' or status in \('succeeded', 'partial'\)/);
  assert.match(compact, /status <> 'rolled_back' or \(is_first_import and first_import_status = 'rolled_back'\)/);
  assert.match(compact, /validate_affiliate_creator_import_run_policy/);
  assert.match(compact, /policy\.requested_start_date is not distinct from new\.requested_start_date/);
  assert.match(compact, /policy\.effective_start_at is not distinct from new\.window_start_at/);
  assert.match(compact, /policy\.status in \('approved', 'active'\)/);
}

function testHashOnlyPageProgressAndReconciliation() {
  for (const column of [
    "provider_request_id_hash",
    "input_page_token_hash",
    "next_page_token_hash"
  ]) assert.match(compact, new RegExp(`${column} text`));
  assert.match(compact, /\^\[0-9a-f\]\{64\}\$/);
  assert.doesNotMatch(compact, /\bpage_token text\b|\bcursor text\b|raw_/);
  assert.match(compact, /received_count = mapped_count \+ skipped_count/);
  assert.match(compact, /mapped_count = inserted_count \+ updated_count \+ duplicate_count/);
  assert.match(compact, /input_page_token_hash <> next_page_token_hash/);
}

function testSanitizedAppendOnlyEvents() {
  assert.match(compact, /affiliate_creator_import_run_events_append_only/);
  assert.match(compact, /before update or delete on affiliate_creator_import_run_events/);
  assert.match(compact, /safe_status_code.*\^\[a-z\]\[a-z0-9_\]\{0,99\}\$/s);
  assert.doesNotMatch(compactDdl, /safe_error_message|provider_message|payload|response_body/);
}

function testNoSecretsPersonalDataOrActions() {
  assert.doesNotMatch(compactDdl, /\b(access_token|refresh_token|auth_code|authorization_code|app_secret|client_secret|private_key)\b/);
  assert.doesNotMatch(compactDdl, /\b(email|phone|telephone|address|buyer_name|shopper|payment|shipping|message|direct_message)\b/);
  assert.doesNotMatch(compactDdl, /https?:\/\/|\bfetch\s*\(|axios|x-tts-access-token/);
  assert.doesNotMatch(compactDdl, /\b(insert into|update [a-z_][a-z0-9_]* set|delete from|upsert|merge into)\b/);
  assert.doesNotMatch(compactDdl, /create (or replace )?function .*authorize|create (or replace )?function .*import_data/);
}

[
  testMigrationDependencyAndTransactionBoundary,
  testPolicyExtensionIsCreatorSpecific,
  testControlPlaneTablesOnly,
  testExactAccountAndCrossAccountConstraints,
  testImmutableWindowAndFirstImportControls,
  testHashOnlyPageProgressAndReconciliation,
  testSanitizedAppendOnlyEvents,
  testNoSecretsPersonalDataOrActions
].forEach((test) => test());

console.log("Affiliate Creator persistence schema tests passed.");
