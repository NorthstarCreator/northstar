"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const migrationPath = path.join(
  __dirname,
  "../db/migrations/006_repair_affiliate_creator_authorization_safeguards.sql"
);
const migration = fs.readFileSync(migrationPath, "utf8");
const compact = migration.replace(/--.*$/gm, "").replace(/\s+/g, " ").trim().toLowerCase();

function testValidationOnlyCompatibilityScope() {
  assert.match(compact, /^begin;/);
  assert.match(compact, /commit;$/);
  assert.match(compact, /do \$validation\$/);
  assert.doesNotMatch(compact, /\b(add constraint|create trigger|alter table|lock table|execute '\s*create|insert|update|delete|merge|grant|revoke|create role|alter role)\b/);
}

function testPhysicalIdentifierAndExactStructureGuards() {
  for (const physicalName of [
    "affiliate_creator_connections_authorization_timestamp_order_che",
    "affiliate_creator_connections_authorization_state_timestamps_ch",
    "affiliate_creator_connections_authorization_lifecycle_forward_o"
  ]) assert.match(migration, new RegExp(physicalName));
  assert.match(compact, /migration_006_timestamp_order_constraint_not_exact/);
  assert.match(compact, /migration_006_state_timestamps_constraint_not_exact/);
  assert.match(compact, /migration_006_lifecycle_trigger_not_exact/);
  assert.match(compact, /constraint_row\.convalidated/);
  assert.match(compact, /pg_catalog\.pg_get_constraintdef/);
  assert.match(compact, /trigger_row\.tgtype = 19/);
  assert.match(compact, /not trigger_row\.tgisinternal/);
  assert.match(compact, /trigger_row\.tgenabled in \('o', 'a', 'r'\)/);
  assert.match(compact, /public\.validate_affiliate_creator_authorization_transition\(\)'::pg_catalog\.regprocedure/);
}

function testNoDisplayOrRuntimeExpansion() {
  assert.doesNotMatch(compact, /2025-10-01|\bvideos\b|\bsync_runs\b|tiktok_display_api/);
  assert.doesNotMatch(compact, /access_token|refresh_token|authorization_code|client_secret|app_secret|https?:\/\/|\bfetch\s*\(/);
}

[
  testValidationOnlyCompatibilityScope,
  testPhysicalIdentifierAndExactStructureGuards,
  testNoDisplayOrRuntimeExpansion
].forEach((test) => test());

console.log("Affiliate Creator authorization safeguard compatibility tests passed.");
