"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const migrationPath = path.join(__dirname, "../db/migrations/009_affiliate_creator_authorization_start_callback.sql");
const migration = fs.readFileSync(migrationPath, "utf8");
const compact = migration.replace(/--.*$/gm, "").replace(/\s+/g, " ").trim().toLowerCase();
const runtimeRole = "northstar_affiliate_creator_runtime";

function testTransactionAndBindingBoundary() {
  assert.match(compact, /^begin;/);
  assert.match(compact, /commit;$/);
  assert.match(compact, /create table public\.affiliate_creator_runtime_account_bindings/);
  assert.match(compact, /runtime_role_oid pg_catalog\.oid primary key/);
  assert.match(compact, /account_id pg_catalog\.uuid not null references public\.creator_accounts\(id\) on delete cascade/);
  assert.match(compact, /unique \(account_id, provider_code\)/);
  assert.match(compact, /create table public\.affiliate_creator_authorization_states/);
  assert.match(compact, /state_digest pg_catalog\.text not null unique check \(state_digest ~ '\^\[0-9a-f\]\{64\}\$'\)/);
  assert.match(compact, /references public\.affiliate_creator_connections \(id, account_id, provider_code\) on delete cascade/);
  assert.doesNotMatch(compact, /authorization_code|access_token|refresh_token|client_secret|app_secret|open_id|redirect_url|provider_payload/);
}

function testSessionUserBoundary() {
  assert.equal((migration.match(/SESSION_USER::pg_catalog\.regrole::pg_catalog\.oid/g) || []).length, 3);
  assert.doesNotMatch(migration, /CURRENT_USER\s*::\s*pg_catalog\.regrole/i);
  const runtimeDefinitions = migration.match(/CREATE FUNCTION public\.(?:begin_affiliate_creator_authorization|accept_affiliate_creator_authorization_callback)[\s\S]*?\$[a-z_]+\$;/g) || [];
  assert.equal(runtimeDefinitions.length, 2);
  for (const definition of runtimeDefinitions) {
    assert.match(definition, /SESSION_USER::pg_catalog\.regrole::pg_catalog\.oid/);
    assert.doesNotMatch(definition, /p_account_id|account_id\s+pg_catalog\.uuid\s*[,)\n]/i);
    assert.match(definition, /SECURITY DEFINER/);
    assert.match(definition, /search_path = pg_catalog, public, pg_temp/);
  }
}

function testBinderRoleSecurity() {
  assert.match(compact, /create function public\.bind_affiliate_creator_runtime_account\(p_account_id pg_catalog\.uuid\)/);
  assert.match(compact, /from pg_catalog\.pg_authid as role_auth/);
  assert.match(compact, /role_auth\.rolpassword is null/);
  assert.match(compact, /not role_row\.rolsuper/);
  assert.match(compact, /not role_row\.rolinherit/);
  assert.match(compact, /membership_row\.roleid = runtime_oid\) <> 1/);
  assert.match(compact, /membership_row\.member = runtime_oid/);
  assert.match(compact, /membership_row\.member <> provisioner_oid/);
  assert.match(compact, /not membership_row\.admin_option/);
  assert.match(compact, /membership_row\.inherit_option/);
  assert.match(compact, /membership_row\.set_option/);
  assert.match(compact, /exists \(select 1 from public\.affiliate_creator_runtime_account_bindings\)/);
  assert.doesNotMatch(compact, /has_function_privilege\('public'/);
  assert.doesNotMatch(compact, /pg_has_role\('public'/);
  assert.doesNotMatch(compact, /to_regrole\('public'/);
}

function testLifecycleAndReplayBoundary() {
  assert.match(compact, /authorization_state = 'authorization_pending'/);
  assert.match(compact, /authorization_state = 'callback_received'/);
  assert.match(compact, /authorization_revision = current_revision \+ 1/);
  assert.match(compact, /'authorization_started', 'authorization_pending', 0/);
  assert.match(compact, /'callback_accepted', 'callback_received', 0/);
  assert.match(compact, /delete from public\.affiliate_creator_authorization_states[\s\S]*?state_digest = p_state_digest/);
  assert.match(compact, /expires_at > p_occurred_at/);
  assert.match(compact, /affiliate_creator_callback_compare_and_swap_failed/);
  assert.match(compact, /affiliate_creator_callback_state_invalid/);
  assert.match(compact, /for update/);
}

function testMinimumPrivilegesAndDormancy() {
  assert.equal((migration.match(/REVOKE ALL ON FUNCTION public\./g) || []).length, 3);
  assert.equal((migration.match(/GRANT EXECUTE ON FUNCTION public\./g) || []).length, 2);
  assert.equal((migration.match(/TO northstar_affiliate_creator_runtime;/g) || []).length, 2);
  assert.match(compact, /revoke all on table public\.affiliate_creator_runtime_account_bindings, public\.affiliate_creator_authorization_states from public/);
  assert.doesNotMatch(compact, /grant .*bind_affiliate_creator_runtime_account.*to northstar_affiliate_creator_runtime/);
  assert.doesNotMatch(compact, /grant (select|insert|update|delete|truncate|references|trigger|usage) on (table|sequence)/);
  assert.doesNotMatch(compact, /create role|alter role|grant .* to public|default privileges|process\.env|require\(|fetch\s*\(|https?:\/\/|redis|upstash|token-store|route|logger|cache|retry/);
  for (const identifier of [runtimeRole, "bind_affiliate_creator_runtime_account", "begin_affiliate_creator_authorization", "accept_affiliate_creator_authorization_callback", "affiliate_creator_runtime_binding_account_unique", "affiliate_creator_state_connection_unique"]) {
    assert.ok(Buffer.byteLength(identifier, "utf8") <= 63, `identifier exceeds PostgreSQL limit: ${identifier}`);
  }
}

[
  testTransactionAndBindingBoundary,
  testSessionUserBoundary,
  testBinderRoleSecurity,
  testLifecycleAndReplayBoundary,
  testMinimumPrivilegesAndDormancy
].forEach((test) => test());

console.log("Affiliate Creator authorization start/callback schema tests passed.");
