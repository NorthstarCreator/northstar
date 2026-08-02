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
  assert.match(compact, /to_regclass\('public\.source_import_policies'\) is null/);
  assert.match(compact, /migration_003_source_import_policies_required/);
  assert.match(compact, /migration_003_constraints_required/);
  assert.match(compact, /migration_004_legacy_all_accounts_aliases_present/);
  assert.match(compact, /select 1 from public\.creator_accounts where lower\(btrim\(slug\)\) in/);
  assert.match(compact, /source_import_policies_source_code_check/);
  assert.match(compact, /source_import_policies_import_range_mode_check/);
  assert.equal((compact.match(/and contype = 'c'/g) || []).length, 2);
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
    "affiliate_creator_import_run_events",
    "affiliate_creator_account_erasure_authorizations",
    "affiliate_creator_account_erasure_receipts"
  ]) assert.match(migration, new RegExp(`CREATE TABLE public\\.${table}`, "i"));
  for (const table of [
    "affiliate_creator_products",
    "affiliate_creator_collaborations",
    "affiliate_creator_samples",
    "affiliate_creator_orders",
    "affiliate_creator_order_items",
    "affiliate_creator_revenue_events"
  ]) assert.doesNotMatch(migration, new RegExp(`CREATE TABLE (?:public\\.)?${table}`, "i"));
}

function testExactAccountAndCrossAccountConstraints() {
  assert.match(compact, /account_id uuid not null references public\.creator_accounts\(id\)/);
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
  assert.match(compact, /before update or delete on public\.affiliate_creator_import_run_events/);
  assert.match(compact, /safe_status_code.*\^\[a-z\]\[a-z0-9_\]\{0,99\}\$/s);
  assert.doesNotMatch(compactDdl, /safe_error_message|provider_message|payload|response_body/);
}

function testForwardOnlyLifecycleTransitions() {
  assert.match(compact, /validate_affiliate_creator_import_run_transition/);
  assert.match(compact, /affiliate_creator_import_runs_lifecycle_forward_only/);
  assert.match(compact, /old\.status = 'planned'.*new\.status in \( 'blocked', 'awaiting_approval', 'ready', 'cancelled' \)/s);
  assert.match(compact, /old\.status = 'running'.*new\.status in \( 'succeeded', 'partial', 'failed', 'cancelled' \)/s);
  assert.match(compact, /affiliate_creator_import_run_transition_invalid/);
  assert.match(compact, /affiliate_creator_first_import_transition_invalid/);
  assert.match(compact, /validate_affiliate_creator_import_page_transition/);
  assert.match(compact, /affiliate_creator_import_pages_lifecycle_forward_only/);
  assert.match(compact, /old\.status = 'planned'.*new\.status in \('running', 'failed'\)/s);
  assert.match(compact, /affiliate_creator_import_page_transition_invalid/);
}

function testControlledAccountErasure() {
  const receiptDefinition = compact.match(
    /create table public\.affiliate_creator_account_erasure_receipts \((.*?)\);/s
  );
  assert.ok(receiptDefinition);
  assert.match(compact, /create table public\.affiliate_creator_account_erasure_authorizations/);
  assert.match(compact, /revoke all on table public\.affiliate_creator_account_erasure_authorizations from public/);
  assert.match(compact, /create table public\.affiliate_creator_account_erasure_receipts/);
  assert.match(compact, /prevent_affiliate_creator_erasure_receipt_change/);
  assert.match(compact, /affiliate_creator_account_erasure_receipts_append_only/);
  assert.match(compact, /create or replace function public\.erase_affiliate_creator_control_data/);
  assert.match(compact, /security definer set search_path = pg_catalog, public, pg_temp/);
  assert.match(compact, /affiliate_creator_erasure_account_mismatch/);
  assert.match(compact, /affiliate_creator_erasure_exact_account_required/);
  assert.match(compact, /erasure_gate\.transaction_id = txid_current\(\)/);
  assert.match(compact, /delete from public\.affiliate_creator_import_run_events where account_id = p_account_id/);
  assert.match(compact, /source_code = 'tiktok_shop_affiliate_creator'/);
  assert.match(compact, /revoke all on function public\.erase_affiliate_creator_control_data/);
  assert.doesNotMatch(receiptDefinition[1], /account_id|slug|open_id/);
}

function testFunctionSearchPathsQualificationAndPrivileges() {
  const functions = [
    "validate_affiliate_creator_import_run_policy",
    "prevent_affiliate_creator_import_identity_update",
    "validate_affiliate_creator_import_run_transition",
    "validate_affiliate_creator_import_page_transition",
    "prevent_affiliate_creator_import_event_change",
    "prevent_affiliate_creator_erasure_receipt_change",
    "erase_affiliate_creator_control_data"
  ];

  assert.equal((compact.match(/set search_path = pg_catalog, public, pg_temp/g) || []).length, 7);
  assert.equal((compact.match(/revoke all on function public\./g) || []).length, 7);
  assert.doesNotMatch(compact, /\bgrant\b/);

  for (const name of functions) {
    assert.match(compact, new RegExp(`create or replace function public\\.${name}\\(`));
    assert.match(compact, new RegExp(`revoke all on function public\\.${name}\\(`));
  }

  for (const relation of [
    "creator_accounts",
    "source_import_policies",
    "affiliate_creator_connections",
    "affiliate_creator_import_runs",
    "affiliate_creator_import_pages",
    "affiliate_creator_import_run_events",
    "affiliate_creator_account_erasure_authorizations",
    "affiliate_creator_account_erasure_receipts"
  ]) {
    assert.doesNotMatch(
      compactDdl,
      new RegExp(`(?:from|into|update|delete from|alter table|create table|references|on) ${relation}\\b`)
    );
  }
}

function testNoSecretsPersonalDataOrActions() {
  assert.doesNotMatch(compactDdl, /\b(access_token|refresh_token|auth_code|authorization_code|app_secret|client_secret|private_key)\b/);
  assert.doesNotMatch(compactDdl, /\b(email|phone|telephone|address|buyer_name|shopper|payment|shipping|message|direct_message)\b/);
  assert.doesNotMatch(compactDdl, /https?:\/\/|\bfetch\s*\(|axios|x-tts-access-token/);
  assert.doesNotMatch(compactDdl, /\b(upsert|merge into)\b/);
  assert.doesNotMatch(compactDdl, /insert into public\.(?!affiliate_creator_account_erasure_)/);
  assert.doesNotMatch(compactDdl, /delete from public\.(?!affiliate_creator_|source_import_policies)/);
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
  testForwardOnlyLifecycleTransitions,
  testControlledAccountErasure,
  testFunctionSearchPathsQualificationAndPrivileges,
  testNoSecretsPersonalDataOrActions
].forEach((test) => test());

console.log("Affiliate Creator persistence schema tests passed.");
