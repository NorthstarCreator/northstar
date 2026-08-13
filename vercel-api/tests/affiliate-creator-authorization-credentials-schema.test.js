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

function testPrivilegesSearchPathsAndBoundaries() {
  const transitionDefinition = compact.match(
    /create or replace function public\.validate_affiliate_creator_authorization_transition\(\)(.*?)\$\$;/s
  );
  assert.ok(transitionDefinition);
  assert.equal((compact.match(/set search_path = pg_catalog, public, pg_temp/g) || []).length, 3);
  assert.equal((compact.match(/revoke all on function public\./g) || []).length, 3);
  assert.match(compact, /revoke all on table public\.affiliate_creator_connection_credentials from public/);
  assert.match(compact, /revoke all on table public\.affiliate_creator_authorization_events from public/);
  assert.doesNotMatch(transitionDefinition[1], /security definer/);
  assert.doesNotMatch(compact, /https?:\/\/|\bfetch\s*\(|axios|upstash|neon\s*\(/);
  assert.doesNotMatch(compact, /\b(create role|alter role|create user|alter user)\b/);
  assert.doesNotMatch(compact, /2025-10-01|\bvideos\b|\bsync_runs\b/);
}

[
  testDependencyAndUnexecutedGuard,
  testExactLifecycleAndAuthorizationFacts,
  testCiphertextOnlyCredentialEnvelope,
  testSanitizedAppendOnlyEventsAndErasure,
  testPrivilegesSearchPathsAndBoundaries
].forEach((test) => test());

console.log("Affiliate Creator authorization-credential schema tests passed.");
