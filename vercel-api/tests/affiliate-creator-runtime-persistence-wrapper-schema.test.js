"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const migration = fs.readFileSync(path.join(__dirname, "../db/migrations/010_affiliate_creator_runtime_persistence_wrapper.sql"), "utf8");
const compact = migration.replace(/--.*$/gm, "").replace(/\s+/g, " ").trim().toLowerCase();
const name = "complete_affiliate_creator_runtime_authorization";

assert.match(compact, /^begin;/);
assert.match(compact, /commit;$/);
assert.match(compact, new RegExp(`create function public\\.${name}\\(`));
assert.match(compact, /returns pg_catalog\.void language plpgsql security definer set search_path = pg_catalog, public, pg_temp/);
const signature = migration.match(/CREATE FUNCTION public\.complete_affiliate_creator_runtime_authorization\(([\s\S]*?)\)\nRETURNS/i)?.[1] || "";
assert.doesNotMatch(signature, /account_id/i);
assert.match(migration, /SESSION_USER::pg_catalog\.regrole::pg_catalog\.oid/);
assert.doesNotMatch(migration, /CURRENT_USER\s*::\s*pg_catalog\.regrole/i);
assert.match(compact, /select count\(\*\) into binding_count/);
assert.match(compact, /binding_count <> 1 or bound_account_id is null/);
assert.match(compact, /connection_row\.authorization_state = 'callback_received'/);
assert.match(compact, /connection_row\.authorization_revision = p_expected_authorization_revision/);
assert.match(compact, /connection_row\.credential_revision = p_expected_credential_revision/);
assert.match(compact, /perform public\.persist_affiliate_creator_authorization\(/);
assert.match(compact, /revoke all on function public\.complete_affiliate_creator_runtime_authorization\(/);
assert.match(compact, /revoke execute on function public\.persist_affiliate_creator_authorization\(/);
assert.match(compact, /grant execute on function public\.complete_affiliate_creator_runtime_authorization\(/);
assert.match(compact, /to northstar_affiliate_creator_runtime;/);
assert.doesNotMatch(compact, /grant (select|insert|update|delete|truncate|references|trigger|usage) on (table|sequence)/);
assert.doesNotMatch(compact, /grant .* to public|create role|alter role|default privileges|erase_affiliate_creator_control_data|password|redis|upstash|fetch\s*\(|https?:\/\//);
for (const identifier of [name, "affiliate_creator_runtime_session_invalid", "affiliate_creator_runtime_persistence_state_invalid"]) {
  assert.ok(Buffer.byteLength(identifier, "utf8") <= 63, `${identifier} exceeds PostgreSQL identifier limit`);
}

console.log("Affiliate Creator runtime persistence-wrapper schema tests passed.");
