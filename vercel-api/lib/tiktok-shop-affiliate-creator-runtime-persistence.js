"use strict";

const {
  CREDENTIAL_ENVELOPE_VERSION,
  AFFILIATE_CREATOR_PROVIDER,
  createAffiliateCreatorCredentialAad
} = require("./tiktok-shop-affiliate-creator-credential-envelope-contract");
const {
  createAffiliateCreatorTrustedRuntimeAccountContext,
  mapAffiliateCreatorCredentialEnvelopePersistenceMaterial,
  getAffiliateCreatorCredentialEnvelopePersistenceRows
} = require("./tiktok-shop-affiliate-creator-credential-envelope-persistence-contract");

const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const commands = new WeakMap();

class AffiliateCreatorRuntimePersistenceError extends Error {
  constructor() {
    super("affiliate_creator_runtime_persistence_unavailable");
    this.name = "AffiliateCreatorRuntimePersistenceError";
  }
}

function fail() { throw new AffiliateCreatorRuntimePersistenceError(); }
function record(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null); }
function exact(value, keys) { return record(value) && Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key)); }
function uuid(value) { if (typeof value !== "string" || value !== value.trim() || !UUID.test(value)) fail(); return value.toLowerCase(); }
function revision(value) { if (!Number.isSafeInteger(value) || value <= 0) fail(); return value; }
function text(value) { if (typeof value !== "string" || value.length === 0 || value !== value.trim()) fail(); return value; }
function timestamp(value) { const candidate = text(value); if (Number.isNaN(Date.parse(candidate))) fail(); return candidate; }
function scopes(value) { if (!Array.isArray(value) || value.length === 0 || value.some((scope) => typeof scope !== "string" || scope.length === 0 || scope !== scope.trim())) fail(); return Object.freeze([...value]); }
function opaque() { return Object.freeze(Object.create(null)); }

function create({ cryptographer, keyReference } = {}) {
  if (!exact({ cryptographer, keyReference }, ["cryptographer", "keyReference"])
    || !cryptographer || typeof cryptographer.encrypt !== "function"
    || typeof keyReference !== "string" || keyReference.length === 0) fail();

  function prepare(input = {}) {
    const keys = ["creatorAccountId", "connectionId", "expectedAuthorizationRevision", "expectedCredentialRevision", "authorizationState", "providerCreatorOpenId", "userType", "grantedScopes", "authorizedAt", "accessExpiresAt", "refreshExpiresAt", "accessToken", "refreshToken"];
    if (!exact(input, keys)) fail();
    const creatorAccountId = uuid(input.creatorAccountId);
    const connectionId = uuid(input.connectionId);
    const expectedAuthorizationRevision = revision(input.expectedAuthorizationRevision);
    const expectedCredentialRevision = revision(input.expectedCredentialRevision);
    if (!Number.isSafeInteger(input.userType) || input.userType !== 1) fail();
    const authorizationState = text(input.authorizationState);
    const providerCreatorOpenId = text(input.providerCreatorOpenId);
    const grantedScopes = scopes(input.grantedScopes);
    const authorizedAt = timestamp(input.authorizedAt);
    const accessExpiresAt = timestamp(input.accessExpiresAt);
    const refreshExpiresAt = timestamp(input.refreshExpiresAt);
    const accessToken = text(input.accessToken);
    const refreshToken = text(input.refreshToken);
    const credentialRevision = expectedCredentialRevision + 1;
    if (!Number.isSafeInteger(credentialRevision)) fail();

    try {
      const authorizationContext = createAffiliateCreatorTrustedRuntimeAccountContext(creatorAccountId);
      const aad = (purpose) => createAffiliateCreatorCredentialAad({ environment: "sandbox", provider: AFFILIATE_CREATOR_PROVIDER, creatorAccountId, connectionId, purpose, credentialRevision, envelopeVersion: CREDENTIAL_ENVELOPE_VERSION, keyReference });
      const expectedAccessAad = aad("access");
      const expectedRefreshAad = aad("refresh");
      const material = mapAffiliateCreatorCredentialEnvelopePersistenceMaterial({
        authorizationContext,
        connectionId,
        credentialRevision,
        accessEnvelope: cryptographer.encrypt({ plaintext: accessToken, aad: expectedAccessAad }),
        refreshEnvelope: cryptographer.encrypt({ plaintext: refreshToken, aad: expectedRefreshAad }),
        expectedAccessAad,
        expectedRefreshAad
      });
      const command = opaque();
      commands.set(command, Object.freeze({
        connectionId, expectedAuthorizationRevision, expectedCredentialRevision, authorizationState,
        providerCreatorOpenId, userType: 1, grantedScopes, authorizedAt, accessExpiresAt,
        refreshExpiresAt, material
      }));
      return command;
    } catch {
      fail();
    }
  }

  return Object.freeze({ prepare });
}

function getAffiliateCreatorRuntimePersistenceCommand(command) {
  const commandData = commands.get(command);
  if (!commandData) fail();
  let rows;
  try { rows = getAffiliateCreatorCredentialEnvelopePersistenceRows(commandData.material); } catch { fail(); }
  return Object.freeze({
    ...commandData,
    access: rows.access,
    refresh: rows.refresh
  });
}

module.exports = { AffiliateCreatorRuntimePersistenceError, create, getAffiliateCreatorRuntimePersistenceCommand };
