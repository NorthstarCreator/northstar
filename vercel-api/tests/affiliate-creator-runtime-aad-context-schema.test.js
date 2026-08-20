"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const migration = fs.readFileSync(path.join(__dirname, "../db/migrations/011_affiliate_creator_runtime_aad_context.sql"), "utf8");
const compact = migration.replace(/--.*$/gm, "").replace(/\s+/g, " ").trim().toLowerCase();
const functionName = "get_affiliate_creator_runtime_account_id";

assert.match(compact, /^begin;/);
assert.match(compact, /commit;$/);
assert.match(compact, new RegExp(`create function public\\.${functionName}\\(\\) returns pg_catalog\\.uuid`));
assert.match(compact, /language plpgsql security definer set search_path = pg_catalog, public, pg_temp/);
assert.match(migration, /SESSION_USER::pg_catalog\.regrole::pg_catalog\.oid/);
assert.doesNotMatch(migration, /CURRENT_USER\s*::\s*pg_catalog\.regrole/i);
assert.match(compact, /binding_count <> 1 or bound_account_id is null/);
assert.match(compact, /binding_row\.runtime_role_oid = runtime_role_oid/);
assert.match(compact, /binding_row\.provider_code = 'tiktok_shop_affiliate_creator'/);
assert.match(compact, /pg_catalog\.aclexplode\(/);
assert.match(compact, /pg_catalog\.acldefault\(/);
assert.match(compact, /function_acl\.grantee = runtime_role_oid/);
assert.match(compact, /function_acl\.privilege_type = 'execute'/);
assert.match(compact, /revoke all on function public\.get_affiliate_creator_runtime_account_id\(\) from public/);
assert.match(compact, /grant execute on function public\.get_affiliate_creator_runtime_account_id\(\) to northstar_affiliate_creator_runtime/);
assert.doesNotMatch(compact, /p_account|p_connection|p_provider|p_environment|p_key|p_token|p_state|p_credential/);
assert.doesNotMatch(compact, /grant (select|insert|update|delete|truncate|references|trigger|usage) on (table|sequence)|create role|alter role|password|default privileges|erase_affiliate_creator_control_data|process\.env|require\(|fetch\s*\(|https?:\/\/|redis|upstash|logger|cache|retry|route/);
for (const identifier of [functionName, "affiliate_creator_runtime_session_invalid", "affiliate_creator_runtime_binding_invalid"]) {
  assert.ok(Buffer.byteLength(identifier, "utf8") <= 63, `${identifier} exceeds PostgreSQL identifier limit`);
}

console.log("Affiliate Creator runtime AAD-context schema tests passed.");
