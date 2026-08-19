"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const migrationPath = path.join(
  __dirname,
  "../db/migrations/008_affiliate_creator_runtime_privileges.sql"
);
const migration = fs.readFileSync(migrationPath, "utf8");
const compact = migration.replace(/--.*$/gm, "").replace(/\s+/g, " ").trim().toLowerCase();
const roleName = "northstar_affiliate_creator_runtime";
const functionNames = [
  "persist_affiliate_creator_authorization",
  "replace_affiliate_creator_credentials_after_refresh",
  "mark_affiliate_creator_refresh_invalid",
  "deauthorize_affiliate_creator_connection"
];
const physicalSafeguards = [
  "affiliate_creator_connections_authorization_timestamp_order_che",
  "affiliate_creator_connections_authorization_state_timestamps_ch",
  "affiliate_creator_connections_authorization_lifecycle_forward_o"
];

function testTransactionAndRoleBoundary() {
  assert.match(compact, /^begin;/);
  assert.match(compact, /commit;$/);
  assert.match(compact, new RegExp(`rolname = '${roleName}'`));
  assert.match(compact, /not runtime_can_login or runtime_inherit or runtime_superuser/);
  for (const attribute of ["runtime_createdb", "runtime_createrole", "runtime_replication", "runtime_bypassrls"]) {
    assert.match(compact, new RegExp(attribute));
  }
  assert.match(compact, /membership_row\.member = runtime_role_oid/);
  assert.match(compact, /membership_row\.roleid = runtime_role_oid/);
  assert.match(compact, /class_row\.relowner = runtime_role_oid/);
  assert.match(compact, /function_row\.proowner = runtime_role_oid/);
  assert.match(compact, /namespace_row\.nspowner = runtime_role_oid/);
  assert.match(compact, /database_row\.datdba = runtime_role_oid/);
  assert.match(compact, /affiliate_creator_runtime_role_ownership_invalid/);
  assert.doesNotMatch(compact, /create role|alter role|create user|alter user|password|grant .* to public|revoke|default privileges/);
}

function testExactMinimumGrants() {
  assert.equal((migration.match(/GRANT USAGE ON SCHEMA public TO northstar_affiliate_creator_runtime;/g) || []).length, 1);
  assert.equal((migration.match(/GRANT EXECUTE ON FUNCTION public\./g) || []).length, 4);
  assert.equal((migration.match(/\) TO northstar_affiliate_creator_runtime;/g) || []).length, 4);
  for (const name of functionNames) {
    assert.match(compact, new RegExp(`grant execute on function public\\.${name}\\(`));
    assert.match(compact, new RegExp(`to_regprocedure\\('public\\.${name}\\(`));
  }
  assert.match(compact, /pg_catalog\.int8/);
  assert.match(compact, /pg_catalog\.int2/);
  assert.doesNotMatch(compact, /pg_catalog\.(integer|bigint|smallint|coalesce)/);
  assert.doesNotMatch(compact, /grant (select|insert|update|delete|truncate|references|trigger|usage) on (table|sequence)/);
  assert.doesNotMatch(compact, /grant create on schema/);
  assert.doesNotMatch(compact, /erase_affiliate_creator_control_data[^)]*\)[^;]*to northstar_affiliate_creator_runtime/);
  assert.match(compact, /affiliate_creator_runtime_privilege_postcheck_failed/);
}

function testPrerequisiteAndAclGuards() {
  assert.match(compact, /prosecdef/);
  assert.match(compact, /search_path=pg_catalog, public, pg_temp/);
  assert.match(compact, /pg_catalog\.aclexplode\(/);
  assert.match(compact, /pg_catalog\.acldefault\(/);
  assert.match(compact, /function_acl\.grantee = 0/);
  assert.doesNotMatch(compact, /has_function_privilege\('public'/);
  assert.doesNotMatch(compact, /pg_has_role\('public'/);
  assert.doesNotMatch(compact, /to_regrole\('public'/);
  for (const safeguard of physicalSafeguards) assert.match(compact, new RegExp(safeguard));
  assert.match(compact, /convalidated/);
  assert.match(compact, /affiliate_creator_runtime_empty_baseline_required/);
  assert.match(compact, /affiliate_creator_runtime_display_boundary_required/);
  assert.match(compact, /sync_runs_cutoff_not_before_live_start/);
  assert.match(compact, /videos_published_after_live_cutoff/);
}

function testPostcheckAndDormancy() {
  assert.match(compact, /relation_acl\.grantee = runtime_role_oid/);
  assert.match(compact, /namespace_acl\.privilege_type = 'usage'/);
  assert.match(compact, /namespace_acl\.privilege_type = 'create'/);
  assert.match(compact, /function_acl\.privilege_type = 'execute'/);
  assert.match(compact, /affiliate_creator_runtime_existing_privileges_invalid/);
  assert.doesNotMatch(compact, /process\.env|require\(|import\s|fetch\s*\(|https?:\/\/|oauth|token|logger|cache|retry|route|flag/);
  for (const identifier of [...functionNames, ...physicalSafeguards, roleName]) {
    assert.ok(Buffer.byteLength(identifier, "utf8") <= 63, `identifier exceeds PostgreSQL limit: ${identifier}`);
  }
}

[
  testTransactionAndRoleBoundary,
  testExactMinimumGrants,
  testPrerequisiteAndAclGuards,
  testPostcheckAndDormancy
].forEach((test) => test());

console.log("Affiliate Creator runtime-privileges schema tests passed.");
