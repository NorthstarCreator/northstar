"use strict";

const {
  AFFILIATE_CREATOR_PROVIDER,
  getAffiliateCreatorCredentialAadMaterial,
  getAffiliateCreatorCredentialEnvelopeMaterial
} = require("./tiktok-shop-affiliate-creator-credential-envelope-contract");
const {
  getAuthorizedCreatorAccountId
} = require("./session-creator-account-authorization");

const UUID_PATTERN = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const ACCESS_PURPOSE_SEGMENT = "|purpose=6:access|";
const REFRESH_PURPOSE_SEGMENT = "|purpose=7:refresh|";
const SANDBOX_SEGMENT = "|env=7:sandbox|";
const PROVIDER_SEGMENT = `|provider=${Buffer.byteLength(AFFILIATE_CREATOR_PROVIDER, "utf8")}:${AFFILIATE_CREATOR_PROVIDER}|`;
const materials = new WeakMap();
const trustedRuntimeAccounts = new WeakMap();

class AffiliateCreatorCredentialEnvelopePersistenceContractError extends Error {
  constructor(code) {
    super(code);
    this.name = "AffiliateCreatorCredentialEnvelopePersistenceContractError";
    this.code = code;
  }
}

function fail(code) {
  throw new AffiliateCreatorCredentialEnvelopePersistenceContractError(code);
}

function record(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, keys) {
  if (!record(value)) return false;
  const names = Object.keys(value);
  return names.length === keys.length && names.every((name) => keys.includes(name));
}

function opaque() {
  return Object.freeze(Object.create(null));
}

function frozenRecord(value) {
  return Object.freeze(Object.assign(Object.create(null), value));
}

function uuid(value) {
  if (typeof value !== "string" || value !== value.trim() || !UUID_PATTERN.test(value)) {
    fail("invalid_credential_persistence_input");
  }
  return value.toLowerCase();
}

function positiveRevision(value) {
  if (!Number.isSafeInteger(value) || value <= 0) fail("invalid_authorization_revision");
  return value;
}

function accountIdFor(context) {
  const runtimeAccountId = trustedRuntimeAccounts.get(context);
  if (runtimeAccountId) return runtimeAccountId;
  try {
    return uuid(getAuthorizedCreatorAccountId(context));
  } catch {
    fail("authorization_context_required");
  }
}

function createAffiliateCreatorTrustedRuntimeAccountContext(creatorAccountId) {
  const context = opaque();
  trustedRuntimeAccounts.set(context, uuid(creatorAccountId));
  return context;
}

function aadInfo(context) {
  try {
    return getAffiliateCreatorCredentialAadMaterial(context);
  } catch {
    fail("invalid_credential_aad");
  }
}

function envelopeInfo(context) {
  try {
    return getAffiliateCreatorCredentialEnvelopeMaterial(context);
  } catch {
    fail("invalid_credential_envelope");
  }
}

function segment(name, value) {
  return `|${name}=${Buffer.byteLength(value, "utf8")}:${value}|`;
}

function requireCanonicalFacts(canonical, { accountId, connectionId, credentialRevision, purpose }) {
  const purposeSegment = purpose === "access" ? ACCESS_PURPOSE_SEGMENT : REFRESH_PURPOSE_SEGMENT;
  if (typeof canonical !== "string"
    || !canonical.includes(SANDBOX_SEGMENT)
    || !canonical.includes(PROVIDER_SEGMENT)
    || !canonical.includes(segment("account", accountId))
    || !canonical.includes(segment("connection", connectionId))
    || !canonical.includes(purposeSegment)
    || !canonical.includes(segment("revision", String(credentialRevision)))
    || !canonical.includes("|envelope=1:1|")) {
    fail("credential_envelope_aad_mismatch");
  }
}

function rowFor({ envelopeContext, expectedAad, accountId, connectionId, credentialRevision, purpose }) {
  const expected = aadInfo(expectedAad);
  const envelope = envelopeInfo(envelopeContext);
  if (envelope.aad !== expected.aad || envelope.envelope.kid !== expected.keyReference) {
    fail("credential_envelope_aad_mismatch");
  }
  requireCanonicalFacts(expected.aad, { accountId, connectionId, credentialRevision, purpose });
  return frozenRecord({
    connection_id: connectionId,
    account_id: accountId,
    provider_code: AFFILIATE_CREATOR_PROVIDER,
    purpose,
    credential_revision: credentialRevision,
    envelope_version: envelope.envelope.v,
    envelope_algorithm: envelope.envelope.alg,
    envelope_key_reference: envelope.envelope.kid,
    envelope_aad_version: envelope.envelope.aad_v,
    envelope_initialization_vector: envelope.envelope.iv,
    envelope_ciphertext: envelope.envelope.ct,
    envelope_authentication_tag: envelope.envelope.tag
  });
}

function mapAffiliateCreatorCredentialEnvelopePersistenceMaterial(input = {}) {
  const keys = ["authorizationContext", "connectionId", "credentialRevision", "accessEnvelope", "refreshEnvelope", "expectedAccessAad", "expectedRefreshAad"];
  if (!exactKeys(input, keys)) fail("invalid_credential_persistence_input");
  const accountId = accountIdFor(input.authorizationContext);
  const connectionId = uuid(input.connectionId);
  const credentialRevision = positiveRevision(input.credentialRevision);
  const access = rowFor({ envelopeContext: input.accessEnvelope, expectedAad: input.expectedAccessAad, accountId, connectionId, credentialRevision, purpose: "access" });
  const refresh = rowFor({ envelopeContext: input.refreshEnvelope, expectedAad: input.expectedRefreshAad, accountId, connectionId, credentialRevision, purpose: "refresh" });
  const accessExpected = aadInfo(input.expectedAccessAad);
  const refreshExpected = aadInfo(input.expectedRefreshAad);
  if (accessExpected.aad.replace(ACCESS_PURPOSE_SEGMENT, REFRESH_PURPOSE_SEGMENT) !== refreshExpected.aad) {
    fail("credential_envelope_aad_mismatch");
  }
  const context = opaque();
  materials.set(context, frozenRecord({ access, refresh }));
  return context;
}

function getAffiliateCreatorCredentialEnvelopePersistenceRows(context) {
  const rows = materials.get(context);
  if (!rows) fail("encrypted_credentials_not_allowed");
  return rows;
}

module.exports = {
  AffiliateCreatorCredentialEnvelopePersistenceContractError,
  createAffiliateCreatorTrustedRuntimeAccountContext,
  mapAffiliateCreatorCredentialEnvelopePersistenceMaterial,
  getAffiliateCreatorCredentialEnvelopePersistenceRows
};
