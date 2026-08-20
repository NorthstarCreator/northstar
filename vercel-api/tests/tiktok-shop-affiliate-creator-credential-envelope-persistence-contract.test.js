"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  AFFILIATE_CREATOR_PROVIDER,
  createAffiliateCreatorCredentialAad,
  createAffiliateCreatorCredentialEnvelopeContext,
  normalizeAffiliateCreatorCredentialEnvelope
} = require("../lib/tiktok-shop-affiliate-creator-credential-envelope-contract");
const {
  DISPLAY_BINDING_PROVIDER,
  resolveSessionCreatorAccountAuthorization
} = require("../lib/session-creator-account-authorization");
const {
  AffiliateCreatorCredentialEnvelopePersistenceContractError,
  createAffiliateCreatorTrustedRuntimeAccountContext,
  mapAffiliateCreatorCredentialEnvelopePersistenceMaterial,
  getAffiliateCreatorCredentialEnvelopePersistenceRows
} = require("../lib/tiktok-shop-affiliate-creator-credential-envelope-persistence-contract");

const root = path.join(__dirname, "..");
const target = path.join(root, "lib", "tiktok-shop-affiliate-creator-credential-envelope-persistence-contract.js");
const ACCOUNT_ID = "a1111111-1111-4111-8111-111111111111";
const CONNECTION_ID = "b2222222-2222-4222-8222-222222222222";
const OTHER_ACCOUNT_ID = "c3333333-3333-4333-8333-333333333333";
const OPEN_ID = "private-display-identity";
const KEY_REFERENCE = "affiliate-creator-sandbox-v1";

function authorizationContext(accountId = ACCOUNT_ID) {
  return resolveSessionCreatorAccountAuthorization({
    session: { id: "private-session", expired: false },
    displayConnection: { displayIdentity: OPEN_ID, bindingProvider: DISPLAY_BINDING_PROVIDER, disconnectedAt: null },
    bindingCandidates: [{ creatorAccountId: accountId, displayIdentity: OPEN_ID, bindingProvider: DISPLAY_BINDING_PROVIDER, connectionDisconnectedAt: null, accountStatus: "active", accountSlug: "private-account" }],
    expectedBindingProvider: DISPLAY_BINDING_PROVIDER
  });
}

function aad(purpose, overrides = {}) {
  return createAffiliateCreatorCredentialAad({
    environment: "sandbox", provider: AFFILIATE_CREATOR_PROVIDER, creatorAccountId: ACCOUNT_ID, connectionId: CONNECTION_ID,
    purpose, credentialRevision: 1, envelopeVersion: 1, keyReference: KEY_REFERENCE, ...overrides
  });
}

function envelope(binding, seed, overrides = {}) {
  return createAffiliateCreatorCredentialEnvelopeContext({
    envelope: normalizeAffiliateCreatorCredentialEnvelope({
      v: 1, alg: "A256GCM", kid: KEY_REFERENCE, aad_v: 1,
      iv: Buffer.alloc(12, seed).toString("base64url"), ct: Buffer.from(`synthetic-${seed}`).toString("base64url"), tag: Buffer.alloc(16, seed).toString("base64url"), ...overrides
    }),
    aad: binding
  });
}

function input(overrides = {}) {
  const expectedAccessAad = aad("access");
  const expectedRefreshAad = aad("refresh");
  return {
    authorizationContext: authorizationContext(), connectionId: CONNECTION_ID, credentialRevision: 1,
    accessEnvelope: envelope(expectedAccessAad, 1), refreshEnvelope: envelope(expectedRefreshAad, 2),
    expectedAccessAad, expectedRefreshAad, ...overrides
  };
}

function code(action, expected, privateValue = "") {
  assert.throws(action, (error) => {
    assert(error instanceof AffiliateCreatorCredentialEnvelopePersistenceContractError);
    assert.equal(error.code, expected); assert.equal(error.message, expected); assert.equal(error.cause, undefined);
    if (privateValue) assert.equal(error.message.includes(privateValue), false);
    return true;
  });
}

function testExactMappingAndOpacity() {
  const material = mapAffiliateCreatorCredentialEnvelopePersistenceMaterial(input());
  assert(Object.isFrozen(material)); assert.equal(Object.getPrototypeOf(material), null); assert.equal(JSON.stringify(material), "{}"); assert.deepEqual(Object.keys(material), []);
  const rows = getAffiliateCreatorCredentialEnvelopePersistenceRows(material);
  assert(Object.isFrozen(rows)); assert.equal(Object.getPrototypeOf(rows), null);
  for (const [purpose, row] of [["access", rows.access], ["refresh", rows.refresh]]) {
    assert(Object.isFrozen(row)); assert.equal(Object.getPrototypeOf(row), null);
    assert.deepEqual(Object.keys(row).sort(), ["account_id", "connection_id", "credential_revision", "envelope_aad_version", "envelope_algorithm", "envelope_authentication_tag", "envelope_ciphertext", "envelope_initialization_vector", "envelope_key_reference", "envelope_version", "provider_code", "purpose"].sort());
    assert.equal(row.connection_id, CONNECTION_ID); assert.equal(row.account_id, ACCOUNT_ID); assert.equal(row.provider_code, AFFILIATE_CREATOR_PROVIDER); assert.equal(row.purpose, purpose); assert.equal(row.credential_revision, 1);
    assert.equal(row.envelope_version, 1); assert.equal(row.envelope_algorithm, "A256GCM"); assert.equal(row.envelope_key_reference, KEY_REFERENCE); assert.equal(row.envelope_aad_version, 1);
    assert.equal(Buffer.from(row.envelope_initialization_vector, "base64url").length, 12); assert.equal(Buffer.from(row.envelope_authentication_tag, "base64url").length, 16); assert.ok(row.envelope_ciphertext.length > 0);
  }
  for (const foreign of [{}, { ...material }, Object.freeze(Object.create(null)), JSON.parse(JSON.stringify(material))]) code(() => getAffiliateCreatorCredentialEnvelopePersistenceRows(foreign), "encrypted_credentials_not_allowed");
}

function testContextAndAadMismatchBoundaries() {
  const valid = input();
  code(() => mapAffiliateCreatorCredentialEnvelopePersistenceMaterial({ ...valid, accessEnvelope: valid.refreshEnvelope }), "credential_envelope_aad_mismatch");
  code(() => mapAffiliateCreatorCredentialEnvelopePersistenceMaterial({ ...valid, refreshEnvelope: valid.accessEnvelope }), "credential_envelope_aad_mismatch");
  code(() => mapAffiliateCreatorCredentialEnvelopePersistenceMaterial({ ...valid, expectedAccessAad: valid.expectedRefreshAad }), "credential_envelope_aad_mismatch");
  code(() => mapAffiliateCreatorCredentialEnvelopePersistenceMaterial({ ...valid, expectedRefreshAad: valid.expectedAccessAad }), "credential_envelope_aad_mismatch");
  for (const overrides of [
    { environment: "production", keyReference: "affiliate-creator-production-v1" }, { creatorAccountId: OTHER_ACCOUNT_ID }, { connectionId: "d4444444-4444-4444-8444-444444444444" }, { credentialRevision: 2 }, { keyReference: "affiliate-creator-sandbox-v2" }
  ]) {
    const wrong = aad("access", overrides);
    code(() => mapAffiliateCreatorCredentialEnvelopePersistenceMaterial({ ...valid, accessEnvelope: envelope(wrong, 9, { kid: overrides.keyReference || KEY_REFERENCE }), expectedAccessAad: wrong }), "credential_envelope_aad_mismatch");
  }
  assert.throws(() => aad("access", { provider: "tiktok_display_api" }), { code: "invalid_credential_aad" });
  assert.throws(() => aad("access", { envelopeVersion: 2 }), { code: "invalid_credential_aad" });
  for (const key of ["authorizationContext", "connectionId", "credentialRevision", "accessEnvelope", "refreshEnvelope", "expectedAccessAad", "expectedRefreshAad"]) {
    const expected = key === "authorizationContext" ? "authorization_context_required"
      : key === "credentialRevision" ? "invalid_authorization_revision"
        : key === "connectionId" ? "invalid_credential_persistence_input"
          : key.includes("Aad") ? "invalid_credential_aad" : "invalid_credential_envelope";
    code(() => mapAffiliateCreatorCredentialEnvelopePersistenceMaterial({ ...valid, [key]: undefined }), expected);
  }
  code(() => mapAffiliateCreatorCredentialEnvelopePersistenceMaterial({ ...valid, authorizationContext: authorizationContext(OTHER_ACCOUNT_ID) }), "credential_envelope_aad_mismatch");
  code(() => mapAffiliateCreatorCredentialEnvelopePersistenceMaterial({ ...valid, connectionId: "bad" }), "invalid_credential_persistence_input");
  code(() => mapAffiliateCreatorCredentialEnvelopePersistenceMaterial({ ...valid, credentialRevision: 0 }), "invalid_authorization_revision");
  for (const value of [{}, Object.freeze(Object.create(null)), JSON.parse(JSON.stringify(valid.accessEnvelope)), valid.accessEnvelope]) {
    if (value === valid.accessEnvelope) continue;
    code(() => mapAffiliateCreatorCredentialEnvelopePersistenceMaterial({ ...valid, accessEnvelope: value }), "invalid_credential_envelope");
  }
  code(() => mapAffiliateCreatorCredentialEnvelopePersistenceMaterial({ ...valid, unexpected: true }), "invalid_credential_persistence_input");
}

function testTrustedRuntimeContext() {
  const context = createAffiliateCreatorTrustedRuntimeAccountContext(ACCOUNT_ID);
  assert.equal(JSON.stringify(context), "{}"); assert.deepEqual(Object.keys(context), []);
  const valid = input({ authorizationContext: context });
  const rows = getAffiliateCreatorCredentialEnvelopePersistenceRows(mapAffiliateCreatorCredentialEnvelopePersistenceMaterial(valid));
  assert.equal(rows.access.account_id, ACCOUNT_ID);
  code(() => createAffiliateCreatorTrustedRuntimeAccountContext("bad"), "invalid_credential_persistence_input");
  code(() => mapAffiliateCreatorCredentialEnvelopePersistenceMaterial({ ...valid, authorizationContext: {} }), "authorization_context_required");
}

function testNoUnsafeDependenciesOrRuntimeConsumers() {
  const source = fs.readFileSync(target, "utf8");
  assert.doesNotMatch(source, /process\.env|fetch\s*\(|https?:\/\/|withDatabase|redis|upstash|oauth|console\.|logger|cache|retry|\bsql`|encryptJson|decryptJson/i);
  assert.doesNotMatch(source, /\b(?:SELECT|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|ALTER\s+TABLE|CREATE\s+TABLE|DROP\s+TABLE|GRANT|REVOKE|CALL)\b/i);
  assert.doesNotMatch(source, /display|seller|partner|token-store|october\s+1/i);
  const consumers = []; for (const dir of [path.join(root, "api"), path.join(root, "lib")]) for (const item of fs.readdirSync(dir, { withFileTypes: true })) { const candidate = path.join(dir, item.name); if (item.name.endsWith(".js") && candidate !== target && !candidate.endsWith("tiktok-shop-affiliate-creator-authorization-persistence-contract.js") && !candidate.endsWith("tiktok-shop-affiliate-creator-runtime-persistence.js") && fs.readFileSync(candidate, "utf8").includes("tiktok-shop-affiliate-creator-credential-envelope-persistence-contract")) consumers.push(candidate); } assert.deepEqual(consumers, []);
}

[testExactMappingAndOpacity, testContextAndAadMismatchBoundaries, testTrustedRuntimeContext, testNoUnsafeDependenciesOrRuntimeConsumers].forEach((test) => test());
console.log("TikTok Shop Affiliate Creator credential-envelope persistence contract tests passed.");
