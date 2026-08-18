"use strict";

const CREDENTIAL_ENVELOPE_VERSION = 1;
const CREDENTIAL_ENVELOPE_ALGORITHM = "A256GCM";
const CREDENTIAL_ENVELOPE_AAD_VERSION = 1;
const AFFILIATE_CREATOR_PROVIDER = "tiktok_shop_affiliate_creator";
const MAX_SERIALIZED_ENVELOPE_LENGTH = 16_384;
const MAX_KEY_REFERENCE_LENGTH = 96;
const UUID_PATTERN = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const KEY_REFERENCE_PATTERN = /^affiliate-creator-(sandbox|production)-v[1-9][0-9]*$/;
const ENVELOPE_KEYS = Object.freeze(["v", "alg", "kid", "aad_v", "iv", "ct", "tag"]);
const AAD_KEYS = Object.freeze([
  "environment",
  "provider",
  "creatorAccountId",
  "connectionId",
  "purpose",
  "credentialRevision",
  "envelopeVersion",
  "keyReference"
]);

const envelopes = new WeakMap();
const aadContexts = new WeakMap();
const credentialContexts = new WeakMap();

class AffiliateCreatorCredentialEnvelopeContractError extends Error {
  constructor(code) {
    super(code);
    this.name = "AffiliateCreatorCredentialEnvelopeContractError";
    this.code = code;
  }
}

function fail(code) {
  throw new AffiliateCreatorCredentialEnvelopeContractError(code);
}

function record(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactOwnDataKeys(value, keys) {
  if (!record(value)) return false;
  const names = Object.getOwnPropertyNames(value);
  if (names.length !== keys.length || Object.getOwnPropertySymbols(value).length !== 0) return false;
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) return false;
  }
  return names.every((key) => keys.includes(key));
}

function opaque() {
  return Object.freeze(Object.create(null));
}

function frozenRecord(value) {
  return Object.freeze(Object.assign(Object.create(null), value));
}

function text(value) {
  return typeof value === "string" ? value : "";
}

function safeKeyReference(value, code) {
  const candidate = text(value);
  if (candidate.length === 0
    || candidate.length > MAX_KEY_REFERENCE_LENGTH
    || candidate !== candidate.trim()
    || /[\u0000-\u001f\u007f]/.test(candidate)
    || !KEY_REFERENCE_PATTERN.test(candidate)) {
    fail(code);
  }
  return candidate;
}

function canonicalBase64url(value, expectedLength, code) {
  const candidate = text(value);
  if (candidate.length === 0 || !BASE64URL_PATTERN.test(candidate)) fail(code);
  let decoded;
  try {
    decoded = Buffer.from(candidate, "base64url");
  } catch {
    fail(code);
  }
  if (decoded.length === 0
    || decoded.toString("base64url") !== candidate
    || (expectedLength !== null && decoded.length !== expectedLength)) {
    fail(code);
  }
  return candidate;
}

function normalizedUuid(value, code) {
  const candidate = text(value).trim();
  if (candidate !== text(value) || !UUID_PATTERN.test(candidate)) fail(code);
  return candidate.toLowerCase();
}

function byteField(name, value) {
  return `${name}=${Buffer.byteLength(value, "utf8")}:${value}`;
}

function environmentForKeyReference(keyReference) {
  return KEY_REFERENCE_PATTERN.exec(keyReference)[1];
}

function normalizeAffiliateCreatorCredentialEnvelope(input) {
  if (input === null || input === undefined) fail("credential_envelope_required");
  if (!hasExactOwnDataKeys(input, ENVELOPE_KEYS)) fail("invalid_credential_envelope");
  if (input.v !== CREDENTIAL_ENVELOPE_VERSION
    || input.alg !== CREDENTIAL_ENVELOPE_ALGORITHM
    || input.aad_v !== CREDENTIAL_ENVELOPE_AAD_VERSION) {
    fail("unsupported_credential_envelope");
  }

  const normalized = frozenRecord({
    v: input.v,
    alg: input.alg,
    kid: safeKeyReference(input.kid, "unsupported_credential_envelope"),
    aad_v: input.aad_v,
    iv: canonicalBase64url(input.iv, 12, "invalid_credential_envelope"),
    ct: canonicalBase64url(input.ct, null, "invalid_credential_envelope"),
    tag: canonicalBase64url(input.tag, 16, "invalid_credential_envelope")
  });
  if (JSON.stringify(normalized).length > MAX_SERIALIZED_ENVELOPE_LENGTH) {
    fail("credential_envelope_too_large");
  }

  const context = opaque();
  envelopes.set(context, normalized);
  return context;
}

function createAffiliateCreatorCredentialAad(input) {
  if (!hasExactOwnDataKeys(input, AAD_KEYS)) fail("invalid_credential_aad");
  const environment = input.environment;
  const provider = input.provider;
  const purpose = input.purpose;
  if ((environment !== "sandbox" && environment !== "production")
    || provider !== AFFILIATE_CREATOR_PROVIDER
    || (purpose !== "access" && purpose !== "refresh")
    || input.envelopeVersion !== CREDENTIAL_ENVELOPE_VERSION
    || !Number.isSafeInteger(input.credentialRevision)
    || input.credentialRevision <= 0) {
    fail("invalid_credential_aad");
  }
  const keyReference = safeKeyReference(input.keyReference, "invalid_credential_aad");
  if (environmentForKeyReference(keyReference) !== environment) fail("credential_key_reference_mismatch");
  const normalized = frozenRecord({
    environment,
    provider,
    creatorAccountId: normalizedUuid(input.creatorAccountId, "invalid_credential_aad"),
    connectionId: normalizedUuid(input.connectionId, "invalid_credential_aad"),
    purpose,
    credentialRevision: input.credentialRevision,
    envelopeVersion: input.envelopeVersion,
    keyReference
  });
  const canonical = [
    "northstar-affiliate-credential-aad",
    String(CREDENTIAL_ENVELOPE_AAD_VERSION),
    byteField("env", normalized.environment),
    byteField("provider", normalized.provider),
    byteField("account", normalized.creatorAccountId),
    byteField("connection", normalized.connectionId),
    byteField("purpose", normalized.purpose),
    byteField("revision", String(normalized.credentialRevision)),
    byteField("envelope", String(normalized.envelopeVersion)),
    byteField("keyref", normalized.keyReference)
  ].join("|");
  const context = opaque();
  aadContexts.set(context, frozenRecord({ normalized, canonical }));
  return context;
}

function createAffiliateCreatorCredentialEnvelopeContext({ envelope, aad } = {}) {
  const normalizedEnvelope = envelopes.get(envelope);
  const normalizedAad = aadContexts.get(aad);
  if (!normalizedEnvelope || !normalizedAad) fail("invalid_credential_aad");
  if (normalizedEnvelope.kid !== normalizedAad.normalized.keyReference) {
    fail("credential_key_reference_mismatch");
  }
  const context = opaque();
  credentialContexts.set(context, frozenRecord({ envelope: normalizedEnvelope, aad: normalizedAad }));
  return context;
}

function getAffiliateCreatorCredentialAadMaterial(context) {
  const material = aadContexts.get(context);
  if (!material) fail("invalid_credential_aad");
  return frozenRecord({
    aad: material.canonical,
    keyReference: material.normalized.keyReference
  });
}

function getAffiliateCreatorCredentialEnvelopeMaterial(context) {
  const material = credentialContexts.get(context);
  if (!material) fail("invalid_credential_aad");
  return frozenRecord({ envelope: material.envelope, aad: material.aad.canonical });
}

module.exports = {
  CREDENTIAL_ENVELOPE_VERSION,
  CREDENTIAL_ENVELOPE_ALGORITHM,
  CREDENTIAL_ENVELOPE_AAD_VERSION,
  AFFILIATE_CREATOR_PROVIDER,
  MAX_SERIALIZED_ENVELOPE_LENGTH,
  AffiliateCreatorCredentialEnvelopeContractError,
  normalizeAffiliateCreatorCredentialEnvelope,
  createAffiliateCreatorCredentialAad,
  createAffiliateCreatorCredentialEnvelopeContext,
  getAffiliateCreatorCredentialAadMaterial,
  getAffiliateCreatorCredentialEnvelopeMaterial
};
