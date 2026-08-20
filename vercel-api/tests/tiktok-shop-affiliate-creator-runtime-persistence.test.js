"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createAffiliateCreatorCredentialCryptographer, KEY_BYTES } = require("../lib/tiktok-shop-affiliate-creator-credential-envelope-crypto");
const { create: createPreparation, AffiliateCreatorRuntimePersistenceError } = require("../lib/tiktok-shop-affiliate-creator-runtime-persistence");
const { create: createDatabase } = require("../lib/tiktok-shop-affiliate-creator-runtime-db");

const root = path.join(__dirname, "..");
const preparationPath = path.join(root, "lib", "tiktok-shop-affiliate-creator-runtime-persistence.js");
const databasePath = path.join(root, "lib", "tiktok-shop-affiliate-creator-runtime-db.js");
const accountId = "a1111111-1111-4111-8111-111111111111";
const connectionId = "b2222222-2222-4222-8222-222222222222";
const keyReference = "affiliate-creator-sandbox-v1";
const accessSecret = "synthetic-access-secret";
const refreshSecret = "synthetic-refresh-secret";

function cryptographer(key = Buffer.alloc(KEY_BYTES, 7)) {
  return createAffiliateCreatorCredentialCryptographer({ keyring: { getAffiliateCreatorCredentialKey(reference) { if (reference !== keyReference) throw new Error("not available"); return key; } } });
}
function preparation() { return createPreparation({ cryptographer: cryptographer(), keyReference }); }
function input(overrides = {}) { return { creatorAccountId: accountId, connectionId, expectedAuthorizationRevision: 2, expectedCredentialRevision: 3, authorizationState: "callback_received", providerCreatorOpenId: "validated-provider-identity", userType: 1, grantedScopes: ["creator.affiliate.info"], authorizedAt: "2026-08-20T00:00:00.000Z", accessExpiresAt: "2026-08-20T01:00:00.000Z", refreshExpiresAt: "2026-09-20T00:00:00.000Z", accessToken: accessSecret, refreshToken: refreshSecret, ...overrides }; }
function unavailable(action) { assert.throws(action, (error) => error instanceof AffiliateCreatorRuntimePersistenceError && error.message === "affiliate_creator_runtime_persistence_unavailable"); }

async function testExactMappingAndOpacity() {
  const command = preparation().prepare(input());
  assert.equal(JSON.stringify(command), "{}"); assert.deepEqual(Object.keys(command), []); assert.equal(Object.getPrototypeOf(command), null);
  assert.equal(JSON.stringify(command).includes(accessSecret), false); assert.equal(JSON.stringify(command).includes(accountId), false);
  let statement; let parameters;
  const db = createDatabase({ execute: async (sql, values) => { statement = sql; parameters = values; return [{ completed: null }]; } });
  await db.complete(command);
  assert.match(statement, /^select public\.complete_affiliate_creator_runtime_authorization\(/); assert.equal(parameters.length, 24);
  assert.deepEqual(parameters.slice(0, 10), [connectionId, 2, 3, "callback_received", "validated-provider-identity", 1, ["creator.affiliate.info"], "2026-08-20T00:00:00.000Z", "2026-08-20T01:00:00.000Z", "2026-09-20T00:00:00.000Z"]);
  assert.deepEqual(parameters.filter((value) => typeof value === "string" && (value.includes(accessSecret) || value.includes(refreshSecret))), []);
  assert.equal(parameters[10], 1); assert.equal(parameters[11], "A256GCM"); assert.equal(parameters[12], keyReference); assert.equal(parameters[13], 1);
  assert.equal(parameters[17], 1); assert.equal(parameters[18], "A256GCM"); assert.equal(parameters[19], keyReference); assert.equal(parameters[20], 1);
  assert.notEqual(parameters[14], parameters[21]); assert.notEqual(parameters[15], parameters[22]);
  assert.equal(/persist_affiliate_creator_authorization\(/.test(statement), false);
}

function testInputAndKeyBoundaries() {
  for (const broken of [
    { creatorAccountId: "bad" }, { connectionId: "bad" }, { expectedAuthorizationRevision: 0 }, { expectedCredentialRevision: 0 }, { userType: 2 }, { grantedScopes: [] }, { accessToken: "" }, { refreshToken: "" }, { unexpected: true }
  ]) unavailable(() => preparation().prepare(input(broken)));
  unavailable(() => createPreparation({ cryptographer: cryptographer(Buffer.alloc(KEY_BYTES - 1)), keyReference }).prepare(input()));
}

async function testAdapterContainment() {
  const command = preparation().prepare(input());
  const db = createDatabase({ execute: async () => [{ completed: "unexpected" }] });
  await assert.rejects(() => db.complete(command), { message: "runtime_database_unavailable" });
  const throwing = createDatabase({ execute: async () => { throw new Error(accessSecret); } });
  await assert.rejects(() => throwing.complete(command), (error) => error.message === "runtime_database_unavailable" && !error.message.includes(accessSecret));
  await assert.rejects(() => createDatabase({ execute: async () => [{ completed: null }] }).complete({}), { message: "runtime_database_unavailable" });
}

function testSourceBoundaries() {
  const source = fs.readFileSync(preparationPath, "utf8"); const db = fs.readFileSync(databasePath, "utf8");
  assert.doesNotMatch(source, /process\.env|fetch\(|https?:\/\/|console\.|logger|cache|retry|redis|upstash|token-store|session|display|seller|partner/i);
  assert.doesNotMatch(db, /from\s+public\.(?:affiliate_creator_connections|affiliate_creator_credentials)|insert\s+into|update\s+public\.|delete\s+from/i);
  assert.match(db, /complete_affiliate_creator_runtime_authorization/); assert.doesNotMatch(db, /public\.persist_affiliate_creator_authorization\(/);
  assert.equal((db.match(/\$24::text/g) || []).length, 1);
}

(async () => { await testExactMappingAndOpacity(); testInputAndKeyBoundaries(); await testAdapterContainment(); testSourceBoundaries(); console.log("Affiliate Creator runtime persistence tests passed."); })().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
