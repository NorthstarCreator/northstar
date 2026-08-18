"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
  AFFILIATE_CREATOR_PROVIDER,
  CREDENTIAL_ENVELOPE_ALGORITHM,
  AffiliateCreatorCredentialEnvelopeContractError,
  createAffiliateCreatorCredentialAad,
  createAffiliateCreatorCredentialEnvelopeContext,
  getAffiliateCreatorCredentialAadMaterial,
  getAffiliateCreatorCredentialEnvelopeMaterial,
  normalizeAffiliateCreatorCredentialEnvelope
} = require("../lib/tiktok-shop-affiliate-creator-credential-envelope-contract");

const root = path.join(__dirname, "..");
const contractPath = path.join(root, "lib", "tiktok-shop-affiliate-creator-credential-envelope-contract.js");
const accountId = "A1111111-1111-4111-8111-111111111111";
const connectionId = "b2222222-2222-4222-8222-222222222222";

function envelope(overrides = {}) {
  return {
    v: 1,
    alg: CREDENTIAL_ENVELOPE_ALGORITHM,
    kid: "affiliate-creator-sandbox-v1",
    aad_v: 1,
    iv: "AAECAwQFBgcICQoL",
    ct: "c2FmZS1vcGFxdWUtY3JlZGVudGlhbC1tYXRlcmlhbA",
    tag: "AAECAwQFBgcICQoLDA0ODw",
    ...overrides
  };
}

function aad(overrides = {}) {
  return {
    environment: "sandbox",
    provider: AFFILIATE_CREATOR_PROVIDER,
    creatorAccountId: accountId,
    connectionId,
    purpose: "access",
    credentialRevision: 1,
    envelopeVersion: 1,
    keyReference: "affiliate-creator-sandbox-v1",
    ...overrides
  };
}

function expectCode(action, code) {
  assert.throws(action, (error) => {
    assert(error instanceof AffiliateCreatorCredentialEnvelopeContractError);
    assert.strictEqual(error.code, code);
    assert.strictEqual(error.message, code);
    return true;
  });
}

function validContext(overrides = {}) {
  const envelopeContext = normalizeAffiliateCreatorCredentialEnvelope(envelope(overrides.envelope));
  const aadContext = createAffiliateCreatorCredentialAad(aad(overrides.aad));
  return createAffiliateCreatorCredentialEnvelopeContext({ envelope: envelopeContext, aad: aadContext });
}

function testValidAccessAndRefresh() {
  const access = validContext();
  const refresh = validContext({ aad: { purpose: "refresh" } });
  const production = validContext({
    envelope: { kid: "affiliate-creator-production-v1" },
    aad: { environment: "production", keyReference: "affiliate-creator-production-v1" }
  });
  const accessMaterial = getAffiliateCreatorCredentialEnvelopeMaterial(access);
  const refreshMaterial = getAffiliateCreatorCredentialEnvelopeMaterial(refresh);
  assert.strictEqual(accessMaterial.envelope.alg, "A256GCM");
  assert(accessMaterial.aad.includes("env=7:sandbox"));
  assert(accessMaterial.aad.includes("provider=29:tiktok_shop_affiliate_creator"));
  assert(accessMaterial.aad.includes("account=36:a1111111-1111-4111-8111-111111111111"));
  assert(accessMaterial.aad.includes("connection=36:b2222222-2222-4222-8222-222222222222"));
  assert(accessMaterial.aad.includes("purpose=6:access"));
  assert(refreshMaterial.aad.includes("purpose=7:refresh"));
  assert(getAffiliateCreatorCredentialEnvelopeMaterial(production).aad.includes("env=10:production"));
}

function testEnvelopeShapeAndEncoding() {
  expectCode(() => normalizeAffiliateCreatorCredentialEnvelope(), "credential_envelope_required");
  expectCode(() => normalizeAffiliateCreatorCredentialEnvelope({}), "invalid_credential_envelope");
  expectCode(() => normalizeAffiliateCreatorCredentialEnvelope(envelope({ unexpected: true })), "invalid_credential_envelope");
  const inherited = Object.create({ v: 1 });
  Object.assign(inherited, envelope());
  delete inherited.v;
  expectCode(() => normalizeAffiliateCreatorCredentialEnvelope(inherited), "invalid_credential_envelope");
  expectCode(() => normalizeAffiliateCreatorCredentialEnvelope(envelope({ v: 2 })), "unsupported_credential_envelope");
  expectCode(() => normalizeAffiliateCreatorCredentialEnvelope(envelope({ alg: "other" })), "unsupported_credential_envelope");
  expectCode(() => normalizeAffiliateCreatorCredentialEnvelope(envelope({ aad_v: 2 })), "unsupported_credential_envelope");
  expectCode(() => normalizeAffiliateCreatorCredentialEnvelope(envelope({ iv: "AAECAwQFBgcICQoL=" })), "invalid_credential_envelope");
  expectCode(() => normalizeAffiliateCreatorCredentialEnvelope(envelope({ iv: "AAECAwQFBgcICQo" })), "invalid_credential_envelope");
  expectCode(() => normalizeAffiliateCreatorCredentialEnvelope(envelope({ tag: "AAECAwQFBgcICQoLDA0ODwA" })), "invalid_credential_envelope");
  expectCode(() => normalizeAffiliateCreatorCredentialEnvelope(envelope({ ct: "" })), "invalid_credential_envelope");
  expectCode(() => normalizeAffiliateCreatorCredentialEnvelope(envelope({ ct: "plain token value" })), "invalid_credential_envelope");
  expectCode(() => normalizeAffiliateCreatorCredentialEnvelope(envelope({ accessToken: "plain" })), "invalid_credential_envelope");
  expectCode(() => normalizeAffiliateCreatorCredentialEnvelope(envelope({ providerResponse: { access_token: "plain" } })), "invalid_credential_envelope");
  expectCode(() => normalizeAffiliateCreatorCredentialEnvelope(envelope({ authorizationCode: "plain" })), "invalid_credential_envelope");
  expectCode(() => normalizeAffiliateCreatorCredentialEnvelope(envelope({ kid: " affiliate-creator-sandbox-v1" })), "unsupported_credential_envelope");
  expectCode(() => normalizeAffiliateCreatorCredentialEnvelope(envelope({ kid: "affiliate-creator-sandbox-v1\n" })), "unsupported_credential_envelope");
  expectCode(() => normalizeAffiliateCreatorCredentialEnvelope(envelope({ kid: "affiliate-creator-sandbox-v1é" })), "unsupported_credential_envelope");
  expectCode(() => normalizeAffiliateCreatorCredentialEnvelope(envelope({ kid: "affiliate-creator-production-v1".repeat(8) })), "unsupported_credential_envelope");
  expectCode(() => normalizeAffiliateCreatorCredentialEnvelope(envelope({ kid: "other-sandbox-v1" })), "unsupported_credential_envelope");
  expectCode(() => normalizeAffiliateCreatorCredentialEnvelope(envelope({
    ct: Buffer.alloc(13_000, 1).toString("base64url")
  })), "credential_envelope_too_large");
}

function testAadValidation() {
  expectCode(() => createAffiliateCreatorCredentialAad(), "invalid_credential_aad");
  expectCode(() => createAffiliateCreatorCredentialAad(aad({ environment: "development" })), "invalid_credential_aad");
  expectCode(() => createAffiliateCreatorCredentialAad(aad({ provider: "tiktok" })), "invalid_credential_aad");
  expectCode(() => createAffiliateCreatorCredentialAad(aad({ creatorAccountId: "not-a-uuid" })), "invalid_credential_aad");
  expectCode(() => createAffiliateCreatorCredentialAad(aad({ connectionId: "not-a-uuid" })), "invalid_credential_aad");
  expectCode(() => createAffiliateCreatorCredentialAad(aad({ purpose: "history" })), "invalid_credential_aad");
  expectCode(() => createAffiliateCreatorCredentialAad(aad({ credentialRevision: 0 })), "invalid_credential_aad");
  expectCode(() => createAffiliateCreatorCredentialAad(aad({ credentialRevision: Number.MAX_SAFE_INTEGER + 1 })), "invalid_credential_aad");
  expectCode(() => createAffiliateCreatorCredentialAad(aad({ envelopeVersion: 2 })), "invalid_credential_aad");
  expectCode(() => createAffiliateCreatorCredentialAad(aad({ keyReference: "affiliate-creator-production-v1" })), "credential_key_reference_mismatch");
  expectCode(() => createAffiliateCreatorCredentialAad({ ...aad(), state: "raw" }), "invalid_credential_aad");
}

function testPrivacyAndPrivateAccess() {
  const envelopeContext = normalizeAffiliateCreatorCredentialEnvelope(envelope());
  const aadContext = createAffiliateCreatorCredentialAad(aad());
  const context = createAffiliateCreatorCredentialEnvelopeContext({ envelope: envelopeContext, aad: aadContext });
  assert(Object.isFrozen(context));
  assert.strictEqual(Object.getPrototypeOf(context), null);
  assert.deepStrictEqual(Object.keys(context), []);
  assert.strictEqual(JSON.stringify(context), "{}");
  const material = getAffiliateCreatorCredentialEnvelopeMaterial(context);
  assert(Object.isFrozen(material));
  assert.strictEqual(Object.getPrototypeOf(material), null);
  assert(Object.isFrozen(material.envelope));
  assert.strictEqual(Object.getPrototypeOf(material.envelope), null);
  const aadMaterial = getAffiliateCreatorCredentialAadMaterial(aadContext);
  assert(Object.isFrozen(aadMaterial));
  assert.strictEqual(Object.getPrototypeOf(aadMaterial), null);
  assert(aadMaterial.aad.includes("northstar-affiliate-credential-aad"));
  assert.strictEqual(aadMaterial.keyReference, "affiliate-creator-sandbox-v1");
  expectCode(() => getAffiliateCreatorCredentialAadMaterial({}), "invalid_credential_aad");
  expectCode(() => getAffiliateCreatorCredentialEnvelopeMaterial({}), "invalid_credential_aad");
  expectCode(() => getAffiliateCreatorCredentialEnvelopeMaterial(Object.create(context)), "invalid_credential_aad");
  expectCode(() => createAffiliateCreatorCredentialEnvelopeContext({ envelope: {}, aad: {} }), "invalid_credential_aad");
  const otherAad = createAffiliateCreatorCredentialAad(aad({ keyReference: "affiliate-creator-sandbox-v2" }));
  expectCode(() => createAffiliateCreatorCredentialEnvelopeContext({ envelope: envelopeContext, aad: otherAad }), "credential_key_reference_mismatch");
}

function testErrorContainment() {
  const secretLikeValue = "a1111111-1111-4111-8111-111111111111-not-for-errors";
  assert.throws(() => createAffiliateCreatorCredentialAad(aad({ creatorAccountId: secretLikeValue })), (error) => {
    assert.strictEqual(error.code, "invalid_credential_aad");
    assert(!error.message.includes(secretLikeValue));
    assert(!Object.values(error).some((value) => typeof value === "string" && value.includes(secretLikeValue)));
    return true;
  });
}

function testDormancyBoundaries() {
  const source = fs.readFileSync(contractPath, "utf8");
  assert.doesNotMatch(source, /require\([^)]*(?:crypto|token-store|db|upstash|redis|oauth)/i);
  assert.doesNotMatch(source, /process\.env|fetch\(|https?:\/\/|SELECT\s|INSERT\s|UPDATE\s|DELETE\s/i);
  assert.doesNotMatch(source, /createCipher|createDecipher|randomBytes|encrypt|decrypt|console\.|logger|cache|retry/i);
  assert.doesNotMatch(source, /seller|partner|local sellers|display|october\s+1/i);
  const runtimeFiles = fs.readdirSync(path.join(root, "api"), { recursive: true })
    .filter((file) => file.endsWith(".js"))
    .map((file) => fs.readFileSync(path.join(root, "api", file), "utf8"));
  assert(runtimeFiles.every((sourceText) => !sourceText.includes("tiktok-shop-affiliate-creator-credential-envelope-contract")));
}

testValidAccessAndRefresh();
testEnvelopeShapeAndEncoding();
testAadValidation();
testPrivacyAndPrivateAccess();
testErrorContainment();
testDormancyBoundaries();
console.log("tiktok-shop-affiliate-creator-credential-envelope-contract tests passed");
