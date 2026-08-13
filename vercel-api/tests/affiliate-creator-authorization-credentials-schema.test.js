"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const migrationPath = path.join(__dirname, "../db/migrations/005_affiliate_creator_authorization_credentials.sql");
const migration = fs.readFileSync(migrationPath, "utf8");
const compact = migration.replace(/--.*$/gm, "").replace(/\s+/g, " ").trim().toLowerCase();

function testDependencyAndUnexecutedGuard() {
  assert.match(compact, /^begin;/);
  assert.match(compact, /migration_004_affiliate_creator_control_required/);
  assert.match(compact, /migration_005_existing_connections_require_review/);
  assert.match(compact, /migration_005_objects_already_present/);
  assert.match(compact, /commit;$/);
  assert.doesNotMatch(compact, /\bgrant\b/);
}

function testExactLifecycleAndAuthorizationFacts() {
  const states = [
    "not_authorized", "authorization_pending", "callback_received", "authorized_limited",
    "authorized_ready", "refresh_required", "reauthorization_required", "deauthorized"
  ];
  for (const state of states) assert.match(compact, new RegExp(`'${state}'`));
  assert.match(compact, /authorization_revision bigint not null default 0/);
  assert.match(compact, /credential_revision bigint not null default 0/);
  assert.match(compact, /provider_creator_open_id is not null/);
  assert.match(compact, /user_type = 1/);
  assert.match(compact, /granted_scopes @> array\['creator\.affiliate\.info'\]::text\[\]/);
  assert.match(compact, /affiliate_creator_connections_authorization_lifecycle_forward_only/);
  assert.match(compact, /affiliate_creator_authorization_transition_invalid/);
  assert.match(compact, /new\.authorization_revision > old\.authorization_revision \+ 1/);
  assert.match(compact, /new\.credential_revision > old\.credential_revision \+ 1/);
  assert.match(compact, /new\.authorization_state is distinct from old\.authorization_state.*new\.authorization_revision <> old\.authorization_revision \+ 1/s);
  assert.match(compact, /affiliate_creator_connections_authorization_timestamp_order_check/);
  assert.match(compact, /authorization_started_at <= callback_received_at/);
  assert.match(compact, /callback_received_at <= token_validated_at/);
  assert.match(compact, /token_validated_at <= last_refresh_attempted_at/);
  assert.match(compact, /last_refresh_attempted_at <= last_refresh_succeeded_at/);
  assert.match(compact, /authorization_started_at <= reauthorization_required_at/);
  assert.match(compact, /authorization_started_at <= authorized_at/);
  assert.match(compact, /authorization_started_at <= revoked_at/);
  assert.match(compact, /last_refresh_succeeded_at is null or last_refresh_attempted_at is not null/);
  assert.match(compact, /affiliate_creator_connections_authorization_state_timestamps_check/);
  for (const state of ["authorization_pending", "callback_received", "refresh_required", "reauthorization_required", "deauthorized"]) {
    assert.match(compact, new RegExp(`authorization_state <> '${state}'`));
  }
  assert.match(compact, /authorization_state not in \('authorized_limited', 'authorized_ready'\)/);
}

function testCiphertextOnlyCredentialEnvelope() {
  assert.match(compact, /create table public\.affiliate_creator_connection_credentials/);
  for (const field of [
    "envelope_version", "envelope_algorithm", "envelope_key_reference", "envelope_aad_version",
    "envelope_initialization_vector", "envelope_ciphertext", "envelope_authentication_tag"
  ]) assert.match(compact, new RegExp(`${field} `));
  assert.match(compact, /envelope_algorithm = 'a256gcm'/);
  assert.match(compact, /affiliate-creator-\(sandbox\|production\)-v\[1-9\]\[0-9\]\*/);
  assert.match(compact, /foreign key \(connection_id, account_id, provider_code\)/);
  assert.match(compact, /references public\.affiliate_creator_connections \(id, account_id, provider_code\)/);
  assert.doesNotMatch(compact, /\b(access_token|refresh_token|authorization_code|auth_code|client_secret|app_secret|plaintext)\b/);
}

function testCredentialImmutabilityAndConnectionCoherence() {
  assert.match(compact, /create or replace function public\.validate_affiliate_creator_credential_mutation\(\)/);
  assert.match(compact, /affiliate_creator_connection_credentials_identity_immutable/);
  for (const field of ["connection_id", "account_id", "provider_code", "purpose", "created_at"]) {
    assert.match(compact, new RegExp(`new\\.${field} is distinct from old\\.${field}`));
  }
  assert.match(compact, /affiliate_creator_credential_identity_immutable/);
  assert.match(compact, /new\.credential_revision < old\.credential_revision/);
  assert.match(compact, /new\.credential_revision > old\.credential_revision \+ 1/);
  assert.match(compact, /affiliate_creator_credential_revision_required/);
  assert.match(compact, /affiliate_creator_credential_revision_invalid/);
  assert.match(compact, /create or replace function public\.validate_affiliate_creator_connection_credential_coherence\(\)/);
  assert.match(compact, /credential_revision <> current_credential_revision/);
  assert.match(compact, /affiliate_creator_credential_revision_stale/);
  assert.match(compact, /current_state in \('authorized_limited', 'authorized_ready', 'refresh_required'\)/);
  assert.match(compact, /elsif credential_count <> 0 then raise exception 'affiliate_creator_credentials_state_forbidden'/);
  assert.match(compact, /credential_count <> 2/);
  assert.match(compact, /access_credential_count <> 1/);
  assert.match(compact, /refresh_credential_count <> 1/);
  assert.match(compact, /affiliate_creator_credential_pair_required/);
  assert.match(compact, /affiliate_creator_credentials_state_forbidden/);
  assert.match(compact, /after update on public\.affiliate_creator_connections deferrable initially deferred/);
  assert.match(compact, /after insert or update or delete on public\.affiliate_creator_connection_credentials deferrable initially deferred/);
}

function testSanitizedAppendOnlyEventsAndErasure() {
  assert.match(compact, /create table public\.affiliate_creator_authorization_events/);
  assert.match(compact, /affiliate_creator_authorization_events_append_only/);
  assert.match(compact, /before update or delete on public\.affiliate_creator_authorization_events/);
  assert.match(compact, /safe_status_code text check/);
  assert.match(compact, /authorization_events_deleted bigint not null default 0/);
  assert.match(compact, /credentials_deleted bigint not null default 0/);
  assert.match(compact, /delete from public\.affiliate_creator_authorization_events where account_id = p_account_id/);
  assert.match(compact, /delete from public\.affiliate_creator_connection_credentials where account_id = p_account_id/);
  assert.match(compact, /create or replace function public\.erase_affiliate_creator_control_data/);
}

function testEventCoherenceAndDeterministicSequencing() {
  assert.match(compact, /event_sequence bigint not null default 0 check \(event_sequence > 0\)/);
  assert.match(compact, /unique \(connection_id, event_sequence\)/);
  assert.match(compact, /create or replace function public\.prepare_affiliate_creator_authorization_event\(\)/);
  assert.match(compact, /for update/);
  assert.match(compact, /affiliate_creator_authorization_event_connection_mismatch/);
  assert.match(compact, /new\.authorization_revision <> current_authorization_revision/);
  assert.match(compact, /affiliate_creator_authorization_event_revision_stale/);
  assert.match(compact, /new\.authorization_state <> current_authorization_state/);
  assert.match(compact, /affiliate_creator_authorization_event_state_invalid/);
  assert.match(compact, /new\.event_sequence <> 0/);
  assert.match(compact, /affiliate_creator_authorization_event_sequence_invalid/);
  assert.match(compact, /unique \(connection_id, event_sequence\)/);
  assert.match(compact, /coalesce\(max\(event_sequence\), 0\) \+ 1/);
  assert.match(compact, /new\.event_sequence := expected_sequence/);
  assert.match(compact, /affiliate_creator_authorization_events_sequence_enforced/);
  assert.match(compact, /before insert on public\.affiliate_creator_authorization_events/);
  assert.match(compact, /affiliate_creator_authorization_events_append_only/);
  assert.match(compact, /before update or delete on public\.affiliate_creator_authorization_events/);
}

function testPrivilegesSearchPathsAndBoundaries() {
  const transitionDefinition = compact.match(
    /create or replace function public\.validate_affiliate_creator_authorization_transition\(\)(.*?)\$\$;/s
  );
  assert.ok(transitionDefinition);
  assert.equal((compact.match(/set search_path = pg_catalog, public, pg_temp/g) || []).length, 6);
  assert.equal((compact.match(/revoke all on function public\./g) || []).length, 6);
  assert.match(compact, /revoke all on table public\.affiliate_creator_connection_credentials from public/);
  assert.match(compact, /revoke all on table public\.affiliate_creator_authorization_events from public/);
  assert.match(compact, /revoke all on function public\.validate_affiliate_creator_credential_mutation\(\) from public/);
  assert.match(compact, /revoke all on function public\.validate_affiliate_creator_connection_credential_coherence\(\) from public/);
  assert.match(compact, /revoke all on function public\.prepare_affiliate_creator_authorization_event\(\) from public/);
  assert.doesNotMatch(transitionDefinition[1], /security definer/);
  assert.doesNotMatch(compact, /https?:\/\/|\bfetch\s*\(|axios|upstash|neon\s*\(/);
  assert.doesNotMatch(compact, /\b(create role|alter role|create user|alter user)\b/);
  assert.doesNotMatch(compact, /2025-10-01|\bvideos\b|\bsync_runs\b/);
  assert.doesNotMatch(compact, /\b(create extension|concurrently|alter default privileges)\b/);
}

[
  testDependencyAndUnexecutedGuard,
  testExactLifecycleAndAuthorizationFacts,
  testCiphertextOnlyCredentialEnvelope,
  testCredentialImmutabilityAndConnectionCoherence,
  testSanitizedAppendOnlyEventsAndErasure,
  testEventCoherenceAndDeterministicSequencing,
  testPrivilegesSearchPathsAndBoundaries
].forEach((test) => test());

console.log("Affiliate Creator authorization-credential schema tests passed.");
