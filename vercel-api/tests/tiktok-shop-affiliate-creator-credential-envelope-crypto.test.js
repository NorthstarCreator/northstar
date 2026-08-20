"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  AFFILIATE_CREATOR_PROVIDER,
  createAffiliateCreatorCredentialAad,
  createAffiliateCreatorCredentialEnvelopeContext,
  normalizeAffiliateCreatorCredentialEnvelope,
  getAffiliateCreatorCredentialEnvelopeMaterial
} = require("../lib/tiktok-shop-affiliate-creator-credential-envelope-contract");
const {
  IV_BYTES,
  TAG_BYTES,
  KEY_BYTES,
  MAX_PLAINTEXT_BYTES,
  AffiliateCreatorCredentialCryptographerError,
  createAffiliateCreatorCredentialCryptographer
} = require("../lib/tiktok-shop-affiliate-creator-credential-envelope-crypto");

const root = path.join(__dirname, "..");
const cryptoPath = path.join(root, "lib", "tiktok-shop-affiliate-creator-credential-envelope-crypto.js");
const accountId = "a1111111-1111-4111-8111-111111111111";
const connectionId = "b2222222-2222-4222-8222-222222222222";
const keyReference = "affiliate-creator-sandbox-v1";
const key = Buffer.alloc(KEY_BYTES, 7);

function aad(overrides = {}) {
  return createAffiliateCreatorCredentialAad({
    environment: "sandbox",
    provider: AFFILIATE_CREATOR_PROVIDER,
    creatorAccountId: accountId,
    connectionId,
    purpose: "access",
    credentialRevision: 1,
    envelopeVersion: 1,
    keyReference,
    ...overrides
  });
}

function cryptographer(value = key) {
  return createAffiliateCreatorCredentialCryptographer({
    keyring: {
      getAffiliateCreatorCredentialKey(reference) {
        if (reference !== keyReference) throw new Error("unavailable");
        return value;
      }
    }
  });
}

function expectCode(action, code, privateValue = "") {
  assert.throws(action, (error) => {
    assert(error instanceof AffiliateCreatorCredentialCryptographerError);
    assert.equal(error.code, code);
    assert.equal(error.message, code);
    assert.equal(error.cause, undefined);
    if (privateValue) assert.equal(error.message.includes(privateValue), false);
    return true;
  });
}

function alteredEnvelope(context, binding, changes) {
  const material = getAffiliateCreatorCredentialEnvelopeMaterial(context).envelope;
  return createAffiliateCreatorCredentialEnvelopeContext({
    envelope: normalizeAffiliateCreatorCredentialEnvelope({ ...material, ...changes }),
    aad: binding
  });
}

function testRoundTripsAndEnvelopeShape() {
  const box = cryptographer();
  for (const [purpose, value] of [["access", "synthetic-access-credential"], ["refresh", "synthetic-refresh-credential"]]) {
    const binding = aad({ purpose });
    const envelope = box.encrypt({ plaintext: value, aad: binding });
    assert(Object.isFrozen(envelope));
    assert.equal(Object.getPrototypeOf(envelope), null);
    assert.deepEqual(Object.keys(envelope), []);
    assert.equal(JSON.stringify(envelope), "{}");
    assert.equal(box.decrypt({ envelope, aad: binding }), value);
    const material = getAffiliateCreatorCredentialEnvelopeMaterial(envelope).envelope;
    assert.equal(material.iv.length, Buffer.alloc(IV_BYTES).toString("base64url").length);
    assert.equal(Buffer.from(material.iv, "base64url").length, IV_BYTES);
    assert.equal(Buffer.from(material.tag, "base64url").length, TAG_BYTES);
    assert.equal(material.iv, Buffer.from(material.iv, "base64url").toString("base64url"));
    assert.equal(material.ct, Buffer.from(material.ct, "base64url").toString("base64url"));
    assert.equal(material.tag, Buffer.from(material.tag, "base64url").toString("base64url"));
  }
  const binding = aad();
  const first = getAffiliateCreatorCredentialEnvelopeMaterial(box.encrypt({ plaintext: "repeat", aad: binding })).envelope;
  const second = getAffiliateCreatorCredentialEnvelopeMaterial(box.encrypt({ plaintext: "repeat", aad: binding })).envelope;
  assert.notEqual(first.iv, second.iv);
}

function testFailuresAndContainment() {
  const box = cryptographer();
  const binding = aad();
  const envelope = box.encrypt({ plaintext: "private-synthetic-credential", aad: binding });
  for (const broken of [
    aad({ environment: "production", keyReference: "affiliate-creator-production-v1" }),
    aad({ purpose: "refresh" }),
    aad({ credentialRevision: 2 }),
    aad({ creatorAccountId: "c3333333-3333-4333-8333-333333333333" }),
    aad({ connectionId: "d4444444-4444-4444-8444-444444444444" }),
    aad({ keyReference: "affiliate-creator-sandbox-v2" })
  ]) expectCode(() => box.decrypt({ envelope, aad: broken }), "credential_decryption_failed", accountId);
  expectCode(() => cryptographer(Buffer.alloc(KEY_BYTES, 8)).decrypt({ envelope, aad: binding }), "credential_decryption_failed", accountId);
  assert.throws(() => aad({ provider: "tiktok_display_api" }), (error) => {
    assert.equal(error.code, "invalid_credential_aad");
    assert.equal(error.message.includes("tiktok_display_api"), false);
    return true;
  });
  for (const field of ["iv", "ct", "tag"]) {
    const material = getAffiliateCreatorCredentialEnvelopeMaterial(envelope).envelope;
    const replacement = Buffer.from(material[field], "base64url");
    replacement[0] ^= 1;
    expectCode(
      () => box.decrypt({ envelope: alteredEnvelope(envelope, binding, { [field]: replacement.toString("base64url") }), aad: binding }),
      "credential_decryption_failed",
      "private-synthetic-credential"
    );
  }
  expectCode(() => cryptographer(Buffer.alloc(KEY_BYTES - 1)).encrypt({ plaintext: "x", aad: binding }), "credential_key_unavailable");
  expectCode(() => cryptographer(new Uint8Array(KEY_BYTES)).encrypt({ plaintext: "x", aad: binding }), "credential_key_unavailable");
  expectCode(() => createAffiliateCreatorCredentialCryptographer(), "invalid_credential_keyring");
  expectCode(() => createAffiliateCreatorCredentialCryptographer({ keyring: {} }), "invalid_credential_keyring");
  expectCode(() => createAffiliateCreatorCredentialCryptographer({ keyring: { getAffiliateCreatorCredentialKey() { return key; } }, unexpected: true }), "invalid_credential_keyring");
  expectCode(() => box.encrypt({ plaintext: "", aad: binding }), "invalid_credential_plaintext");
  expectCode(() => box.encrypt({ plaintext: "x".repeat(MAX_PLAINTEXT_BYTES + 1), aad: binding }), "invalid_credential_plaintext");
  expectCode(() => box.encrypt({ plaintext: "x", aad: {} }), "invalid_credential_aad");
  expectCode(() => box.encrypt({ plaintext: "x", aad: binding, unexpected: true }), "invalid_credential_input");
  expectCode(() => box.decrypt({ envelope: {}, aad: binding }), "invalid_credential_envelope");
  expectCode(() => box.decrypt({ envelope, aad: binding, unexpected: true }), "invalid_credential_input");
}

function testNoRuntimeReachabilityOrUnsafeDependencies() {
  const source = fs.readFileSync(cryptoPath, "utf8");
  assert.match(source, /require\("node:crypto"\)/);
  assert.match(source, /createCipheriv\("aes-256-gcm"/);
  assert.match(source, /createDecipheriv\("aes-256-gcm"/);
  assert.match(source, /setAAD\(/);
  assert.match(source, /setAuthTag\(/);
  assert.doesNotMatch(source, /process\.env|fetch\(|https?:\/\/|SELECT\s|INSERT\s|UPDATE\s|DELETE\s|console\.|logger|cache|retry/i);
  assert.doesNotMatch(source, /token-store|upstash|redis|oauth|seller|partner|local sellers|display|october\s+1/i);
  const runtimeConsumers = ["api", "lib"].flatMap((directory) => fs.readdirSync(path.join(root, directory), { recursive: true })
    .filter((file) => file.endsWith(".js"))
    .map((file) => path.join(directory, file))
    .filter((file) => file !== "lib/tiktok-shop-affiliate-creator-credential-envelope-crypto.js" && fs.readFileSync(path.join(root, file), "utf8").includes("tiktok-shop-affiliate-creator-credential-envelope-crypto")));
  assert.deepEqual(runtimeConsumers, ["lib/tiktok-shop-affiliate-creator-runtime-service.js"]);
}

testRoundTripsAndEnvelopeShape();
testFailuresAndContainment();
testNoRuntimeReachabilityOrUnsafeDependencies();
console.log("tiktok-shop-affiliate-creator-credential-envelope-crypto tests passed");
