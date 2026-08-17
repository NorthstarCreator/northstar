"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const migrationPath = path.join(
  __dirname,
  "../db/migrations/006_repair_affiliate_creator_authorization_safeguards.sql"
);
const migration = fs.readFileSync(migrationPath, "utf8");
const migration005 = fs.readFileSync(
  path.join(__dirname, "../db/migrations/005_affiliate_creator_authorization_credentials.sql"),
  "utf8"
);
const compact = migration.replace(/--.*$/gm, "").replace(/\s+/g, " ").trim().toLowerCase();

function normalizedConstraintDefinition(source, name, nextName) {
  const start = source.indexOf(`ADD CONSTRAINT ${name} CHECK (`);
  assert.notEqual(start, -1, `${name} must be present`);
  const end = nextName
    ? source.indexOf(`  ADD CONSTRAINT ${nextName} CHECK (`, start + 1)
    : source.indexOf("\n  );", start) + "\n  );".length;
  assert.notEqual(end, -1, `${name} must end at its CHECK definition`);
  return source.slice(start, end).replace(/\s+/g, " ").trim().toLowerCase();
}

function testTransactionAndExactRepairScope() {
  assert.match(compact, /^begin;/);
  assert.match(compact, /commit;$/);
  assert.match(compact, /lock table public\.affiliate_creator_connections in share row exclusive mode;/);
  assert.ok(
    compact.indexOf("lock table public.affiliate_creator_connections")
      < compact.indexOf("migration_006_target_constraints_already_present"),
    "the target relation must be locked before repair-target inspection"
  );
  assert.ok(
    compact.indexOf("lock table public.affiliate_creator_connections")
      < compact.indexOf("migration_006_target_trigger_duplicate_or_mismatched"),
    "the target relation must be locked before target-trigger inspection"
  );
  assert.equal((compact.match(/\badd constraint\b/g) || []).length, 2);
  assert.equal((compact.match(/\bcreate trigger\b/g) || []).length, 1);
  assert.match(compact, /alter table public\.affiliate_creator_connections/);
  assert.match(compact, /if not exists \( select 1 from pg_catalog\.pg_trigger trigger where trigger\.tgname = 'affiliate_creator_connections_authorization_lifecycle_forward_only' \) then execute 'create trigger affiliate_creator_connections_authorization_lifecycle_forward_only before update on public\.affiliate_creator_connections for each row execute function public\.validate_affiliate_creator_authorization_transition\(\)'/);
  assert.match(compact, /execute function public\.validate_affiliate_creator_authorization_transition\(\)/);
  assert.doesNotMatch(compact, /\b(drop|rename|grant|revoke|create table|create (or replace )?function|alter default privileges)\b/);
  assert.doesNotMatch(compact, /\b(insert into|delete from|update public\.)\b/);
}

function testExactMigration005ConstraintDefinitions() {
  assert.match(compact, /affiliate_creator_connections_authorization_timestamp_order_check check \(.*authorization_started_at <= callback_received_at.*callback_received_at <= token_validated_at.*token_validated_at <= last_refresh_attempted_at.*last_refresh_attempted_at <= last_refresh_succeeded_at.*authorization_started_at <= reauthorization_required_at.*authorization_started_at <= authorized_at.*authorization_started_at <= revoked_at.*last_refresh_succeeded_at is null or last_refresh_attempted_at is not null.*\)/s);
  assert.match(compact, /affiliate_creator_connections_authorization_state_timestamps_check check \(.*authorization_state <> 'authorization_pending'.*authorization_state <> 'callback_received'.*authorization_state not in \('authorized_limited', 'authorized_ready'\).*authorization_state <> 'refresh_required'.*authorization_state <> 'reauthorization_required'.*authorization_state <> 'deauthorized'.*\)/s);
  assert.equal(
    normalizedConstraintDefinition(
      migration,
      "affiliate_creator_connections_authorization_timestamp_order_check",
      "affiliate_creator_connections_authorization_state_timestamps_check"
    ),
    normalizedConstraintDefinition(
      migration005,
      "affiliate_creator_connections_authorization_timestamp_order_check",
      "affiliate_creator_connections_authorization_state_timestamps_check"
    )
  );
  assert.equal(
    normalizedConstraintDefinition(
      migration,
      "affiliate_creator_connections_authorization_state_timestamps_check"
    ),
    normalizedConstraintDefinition(
      migration005,
      "affiliate_creator_connections_authorization_state_timestamps_check"
    )
  );
}

function testFailClosedPrerequisitesAndEmptyStateGuard() {
  assert.match(compact, /migration_005_authorization_schema_required/);
  assert.match(compact, /migration_005_authorization_columns_required/);
  assert.match(compact, /migration_005_existing_authorization_constraints_required/);
  assert.match(compact, /migration_005_existing_authorization_triggers_required/);
  assert.match(compact, /migration_005_authorization_transition_function_required/);
  assert.match(compact, /migration_005_authorization_functions_required/);
  assert.match(compact, /migration_004_erasure_function_public_execution_present/);
  assert.match(compact, /migration_006_target_constraints_already_present/);
  assert.match(compact, /migration_006_target_trigger_duplicate_or_mismatched/);
  assert.match(compact, /migration_006_nonempty_affiliate_creator_state_requires_review/);
  for (const relation of [
    "creator_accounts", "source_import_policies", "affiliate_creator_connections",
    "affiliate_creator_import_runs", "affiliate_creator_import_pages",
    "affiliate_creator_import_run_events", "affiliate_creator_account_erasure_authorizations",
    "affiliate_creator_account_erasure_receipts", "affiliate_creator_connection_credentials",
    "affiliate_creator_authorization_events"
  ]) assert.match(compact, new RegExp(`public\\.${relation}`));
  assert.match(compact, /public\.erase_affiliate_creator_control_data\(uuid,text,text\)'::pg_catalog\.regprocedure/);
  assert.match(compact, /privilege\.grantee = 0.*privilege\.privilege_type = 'execute'/s);
}

function testPostgreSQL18AwareVerificationAndNoDisplayExpansion() {
  assert.match(compact, /constraint\.contype = 'c'/);
  assert.match(compact, /constraint\.convalidated/);
  assert.doesNotMatch(compact, /contype = 'n'/);
  assert.match(compact, /migration_006_repaired_constraints_not_validated/);
  assert.match(compact, /migration_006_repaired_trigger_not_exactly_enabled/);
  assert.doesNotMatch(compact, /2025-10-01|\bvideos\b|\bsync_runs\b|tiktok_display_api/);
  assert.doesNotMatch(compact, /access_token|refresh_token|authorization_code|client_secret|app_secret|https?:\/\/|\bfetch\s*\(/);
  assert.doesNotMatch(compact, /\b(create role|alter role|create user|alter user)\b/);
}

function testCorrectExistingTriggerIsPreservedAndMismatchesFailClosed() {
  assert.match(compact, /trigger\.tgname = 'affiliate_creator_connections_authorization_lifecycle_forward_only'\) > 1/);
  assert.match(compact, /namespace\.nspname = 'public'/);
  assert.match(compact, /relation\.oid = 'public\.affiliate_creator_connections'::pg_catalog\.regclass/);
  assert.match(compact, /not trigger\.tgisinternal/);
  assert.match(compact, /trigger\.tgenabled in \('o', 'a', 'r'\)/);
  assert.match(compact, /trigger\.tgtype = 19/);
  assert.match(compact, /trigger\.tgfoid = 'public\.validate_affiliate_creator_authorization_transition\(\)'::pg_catalog\.regprocedure/);
  assert.match(compact, /trigger\.tgargs = ''::bytea/);
  assert.match(compact, /migration_006_target_trigger_duplicate_or_mismatched/);
  assert.match(compact, /migration_006_repaired_trigger_not_exactly_enabled/);
}

[
  testTransactionAndExactRepairScope,
  testExactMigration005ConstraintDefinitions,
  testFailClosedPrerequisitesAndEmptyStateGuard,
  testPostgreSQL18AwareVerificationAndNoDisplayExpansion,
  testCorrectExistingTriggerIsPreservedAndMismatchesFailClosed
].forEach((test) => test());

console.log("Affiliate Creator authorization safeguard repair schema tests passed.");
