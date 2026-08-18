"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const migrationPath = path.join(
  __dirname,
  "../db/migrations/007_affiliate_creator_authorization_persistence_functions.sql"
);
const migration = fs.readFileSync(migrationPath, "utf8");
const compact = migration.replace(/--.*$/gm, "").replace(/\s+/g, " ").trim().toLowerCase();
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

function functionDefinition(name) {
  const match = migration.match(new RegExp(
    `CREATE FUNCTION public\\.${name}\\([\\s\\S]*?\\n\\)\\nRETURNS pg_catalog\\.void[\\s\\S]*?\\n\\$[a-z_]+\\$;`,
    "i"
  ));
  assert.ok(match, `missing exact function definition for ${name}`);
  return match[0].toLowerCase();
}

function signatureTypes(signature) {
  return signature
    .split(",")
    .map((part) => part.trim().replace(/^p_[a-z0-9_]+\s+/i, ""))
    .filter(Boolean);
}

function functionSignatureTypes(name) {
  const match = migration.match(new RegExp(
    `CREATE FUNCTION public\\.${name}\\(([\\s\\S]*?)\\)\\nRETURNS`,
    "i"
  ));
  assert.ok(match, `missing CREATE signature for ${name}`);
  return signatureTypes(match[1]);
}

function revokeSignatureTypes(name) {
  const match = migration.match(new RegExp(
    `REVOKE ALL ON FUNCTION public\\.${name}\\(([\\s\\S]*?)\\) FROM PUBLIC;`,
    "i"
  ));
  assert.ok(match, `missing PUBLIC revoke signature for ${name}`);
  return signatureTypes(match[1]);
}

function testTransactionAndPrerequisiteGuards() {
  assert.match(compact, /^begin;/);
  assert.match(compact, /commit;$/);
  for (const relation of [
    "affiliate_creator_connections",
    "affiliate_creator_connection_credentials",
    "affiliate_creator_authorization_events",
    "affiliate_creator_account_erasure_authorizations",
    "affiliate_creator_account_erasure_receipts"
  ]) assert.match(compact, new RegExp(`to_regclass\\('public\\.${relation}'\\)`));
  assert.match(compact, /affiliate_creator_persistence_empty_baseline_required/);
  assert.match(compact, /exists \(select 1 from public\.affiliate_creator_connections\)/);
  assert.match(compact, /exists \(select 1 from public\.affiliate_creator_connection_credentials\)/);
  assert.match(compact, /exists \(select 1 from public\.affiliate_creator_authorization_events\)/);
  for (const identifier of physicalSafeguards) assert.match(compact, new RegExp(identifier));
  assert.match(compact, /convalidated/);
  assert.match(compact, /validate_affiliate_creator_authorization_transition\(\).*::pg_catalog\.regprocedure/);
  assert.match(compact, /erase_affiliate_creator_control_data\(uuid,text,text\)/);
  assert.match(compact, /has_function_privilege\('public'/);
}

function testFourUnrestrictedFunctionsAndPrivileges() {
  assert.equal((migration.match(/CREATE FUNCTION public\./g) || []).length, 4);
  assert.equal((migration.match(/REVOKE ALL ON FUNCTION public\./g) || []).length, 4);
  for (const name of functionNames) {
    const definition = functionDefinition(name);
    assert.match(definition, /language plpgsql/);
    assert.match(definition, /security definer/);
    assert.match(definition, /set search_path = pg_catalog, public, pg_temp/);
    assert.match(compact, new RegExp(`revoke all on function public\\.${name}\\(`));
    assert.deepEqual(
      revokeSignatureTypes(name),
      functionSignatureTypes(name),
      `PUBLIC revoke must use the exact ${name} signature`
    );
  }
  assert.doesNotMatch(compact, /\bgrant\b|create role|alter role|create user|alter default privileges/);
  assert.doesNotMatch(compact, /execute immediate|format\s*\(|\bprepare\b/);
}

function testExactCasAndLifecycleBoundaries() {
  for (const name of functionNames) {
    const definition = functionDefinition(name);
    assert.match(definition, /provider_code = 'tiktok_shop_affiliate_creator'/);
    assert.match(definition, /for update/);
    assert.match(definition, /current_authorization_revision <> p_expected_authorization_revision/);
    assert.match(definition, /current_credential_revision <> p_expected_credential_revision/);
  }
  const persist = functionDefinition(functionNames[0]);
  assert.match(persist, /current_authorization_state <> 'callback_received'/);
  assert.match(persist, /authorization_state = p_authorization_state/);
  assert.match(persist, /authorization_revision = p_expected_authorization_revision \+ 1/);
  assert.match(persist, /credential_revision = p_expected_credential_revision \+ 1/);
  assert.match(persist, /'access'.*'refresh'/s);
  assert.match(persist, /'token_validated'/);

  const refresh = functionDefinition(functionNames[1]);
  assert.match(refresh, /current_authorization_state <> 'refresh_required'/);
  assert.match(refresh, /changed_access_rows <> 1 or changed_refresh_rows <> 1/);
  assert.match(refresh, /'refresh_succeeded'/);
  assert.doesNotMatch(refresh, /insert into public\.affiliate_creator_connection_credentials/);

  const invalid = functionDefinition(functionNames[2]);
  assert.match(invalid, /current_authorization_state <> 'refresh_required'/);
  assert.match(invalid, /delete from public\.affiliate_creator_connection_credentials/);
  assert.match(invalid, /authorization_state = 'reauthorization_required'/);
  assert.match(invalid, /'refresh_failed'/);

  const deauthorize = functionDefinition(functionNames[3]);
  assert.match(deauthorize, /current_authorization_state not in \(/);
  assert.match(deauthorize, /authorization_state = 'deauthorized'/);
  assert.match(deauthorize, /state = 'revoked'/);
  assert.match(deauthorize, /'all_access_removed'/);
}

function testEnvelopeAndPrivacyBoundaries() {
  for (const field of [
    "envelope_version", "envelope_algorithm", "envelope_key_reference",
    "envelope_aad_version", "envelope_initialization_vector",
    "envelope_ciphertext", "envelope_authentication_tag"
  ]) assert.match(compact, new RegExp(field));
  assert.match(compact, /affiliate-creator-sandbox-v\[1-9\]\[0-9\]\*/);
  assert.match(compact, /\^\[a-za-z0-9_-\]\{16\}\$/i);
  assert.match(compact, /\^\[a-za-z0-9_-\]\{22\}\$/i);
  assert.match(compact, /length\(p_access_envelope_ciphertext\) > 16384/);
  assert.match(compact, /length\(p_refresh_envelope_ciphertext\) > 16384/);
  assert.doesNotMatch(compact, /access_token|refresh_token|authorization_code|auth_code|provider_response|plaintext/);
  assert.doesNotMatch(compact, /https?:\/\/|fetch\s*\(|axios|upstash|neon\s*\(|process\.env|pg_net/);
}

function testIdentifierLengthAndNoRuntimeSurface() {
  const names = [...functionNames, ...physicalSafeguards];
  for (const name of names) {
    assert.ok(Buffer.byteLength(name, "utf8") <= 63, `identifier exceeds PostgreSQL limit: ${name}`);
  }
  assert.doesNotMatch(compact, /create trigger|add constraint|alter table/);
  assert.doesNotMatch(compact, /2025-10-01|tiktok_display_api|display api|videos|sync_runs/);
}

function testNoRuntimeConsumerOrEnvironmentSurface() {
  const roots = [path.join(__dirname, "../api"), path.join(__dirname, "../lib")];
  const forbidden = [
    "affiliate_creator_authorization_persistence_functions",
    "persist_affiliate_creator_authorization",
    "replace_affiliate_creator_credentials_after_refresh",
    "mark_affiliate_creator_refresh_invalid",
    "deauthorize_affiliate_creator_connection"
  ];
  for (const root of roots) {
    for (const entry of fs.readdirSync(root, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".js")) continue;
      const file = path.join(entry.parentPath, entry.name);
      const source = fs.readFileSync(file, "utf8");
      for (const value of forbidden) assert.doesNotMatch(source, new RegExp(value));
    }
  }
  assert.doesNotMatch(migration, /process\.env|require\(|import\s|fetch\s*\(|http|oauth|logger|cache|retry/i);
}

[
  testTransactionAndPrerequisiteGuards,
  testFourUnrestrictedFunctionsAndPrivileges,
  testExactCasAndLifecycleBoundaries,
  testEnvelopeAndPrivacyBoundaries,
  testIdentifierLengthAndNoRuntimeSurface,
  testNoRuntimeConsumerOrEnvironmentSurface
].forEach((test) => test());

console.log("Affiliate Creator authorization-persistence functions schema tests passed.");
