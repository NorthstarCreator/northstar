"use strict";

const {
  getValidatedCreatorAuthorizationIdentity,
  getValidatedCreatorAuthorizationCredentialMaterial
} = require("./tiktok-shop-affiliate-creator-authorization-contract");
const { createAffiliateCreatorCredentialCryptographer } = require("./tiktok-shop-affiliate-creator-credential-envelope-crypto");

const STATE_TTL_MS = 10 * 60 * 1000;
const KEY_REFERENCE = "affiliate-creator-sandbox-v1";
const INITIAL_AUTHORIZATION_REVISION = 1;

class AffiliateCreatorRuntimeServiceError extends Error {
  constructor(code = "affiliate_creator_runtime_unavailable") {
    super(code);
    this.name = "AffiliateCreatorRuntimeServiceError";
    this.code = code;
  }
}

function fail(code) { throw new AffiliateCreatorRuntimeServiceError(code); }
function integer(value) { const number = typeof value === "number" ? value : Number(value); if (!Number.isSafeInteger(number) || number < 0) fail(); return number; }
function iso(value) { const date = new Date(value); if (Number.isNaN(date.valueOf())) fail(); return date.toISOString(); }
function safeProfile(value) { const keys = ["creatorUserId", "selectionRegion", "registerRegion", "sellerType", "permissions", "userType"]; if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== keys.length || !keys.every((key) => Object.hasOwn(value, key))) fail(); return value; }
function keyring(value) {
  if (typeof value !== "string" || value.length === 0) fail();
  let key;
  try { key = Buffer.from(value, "base64url"); } catch { fail(); }
  if (key.length !== 32 || key.toString("base64url") !== value) fail();
  return Object.freeze({ getAffiliateCreatorCredentialKey(reference) { if (reference !== KEY_REFERENCE) fail(); return key; } });
}

function create({ config, state, createDatabase, createTikTokClient, createPersistence, createCryptographer = createAffiliateCreatorCredentialCryptographer, clock = () => Date.now(), createKeyring = keyring, onStage = () => {}, onDatabaseDiagnostic } = {}) {
  if (!config || typeof config.read !== "function" || !state || typeof state.create !== "function" || typeof state.digest !== "function" || typeof state.connectionId !== "function" || typeof createDatabase !== "function" || typeof createTikTokClient !== "function" || typeof createPersistence !== "function" || typeof createCryptographer !== "function" || typeof clock !== "function" || typeof createKeyring !== "function" || typeof onStage !== "function" || (onDatabaseDiagnostic !== undefined && typeof onDatabaseDiagnostic !== "function")) fail();

  function dependencies() {
    let values;
    try { values = config.read(); } catch { fail(); }
    if (!values || values.environment !== "sandbox") fail();
    try {
      onStage("database_initialization");
      const database = createDatabase(onDatabaseDiagnostic ? { databaseUrl: values.databaseUrl, onDiagnostic: onDatabaseDiagnostic } : { databaseUrl: values.databaseUrl });
      const client = createTikTokClient({ appKey: values.appKey, appSecret: values.appSecret });
      const persistence = createPersistence({ cryptographer: createCryptographer({ keyring: createKeyring(values.keyring) }), keyReference: KEY_REFERENCE });
      if (!database || typeof database.begin !== "function" || typeof database.accept !== "function" || typeof database.account !== "function" || typeof database.complete !== "function" || !client || typeof client.authorizationUrl !== "function" || typeof client.exchange !== "function" || typeof client.profile !== "function" || !persistence || typeof persistence.prepare !== "function") fail();
      return { database, client, persistence };
    } catch { fail(); }
  }

  async function start() {
    const { database, client } = dependencies();
    const now = integer(clock());
    const rawState = state.create();
    const connectionId = state.connectionId(rawState);
    const stateDigest = state.digest(rawState);
    let begun;
    onStage("authorization_start_database_call");
    try { begun = await database.begin({ connectionId, stateDigest, expiresAt: iso(now + STATE_TTL_MS), occurredAt: iso(now) }); } catch { fail(); }
    if (!begun || begun.connection_id !== connectionId || integer(begun.authorization_revision) < INITIAL_AUTHORIZATION_REVISION) fail();
    let redirect;
    try { redirect = client.authorizationUrl(rawState); } catch { fail(); }
    if (typeof redirect !== "string" || !redirect.startsWith("https://shop.tiktok.com/")) fail();
    return Object.freeze({ redirect });
  }

  async function callback({ code, state: rawState, error } = {}) {
    if (error !== undefined) {
      if (typeof rawState !== "string" || rawState.length === 0 || code !== undefined) fail("affiliate_creator_authorization_denied");
    } else if (typeof code !== "string" || code.length === 0 || typeof rawState !== "string" || rawState.length === 0) fail();
    const { database, client, persistence } = dependencies();
    const now = integer(clock());
    const connectionId = state.connectionId(rawState);
    const stateDigest = state.digest(rawState);
    let accepted;
    onStage("callback_state_consumption");
    try { accepted = await database.accept({ connectionId, stateDigest, occurredAt: iso(now) }); } catch { fail(); }
    if (!accepted || accepted.connection_id !== connectionId || integer(accepted.authorization_revision) < INITIAL_AUTHORIZATION_REVISION + 1 || integer(accepted.credential_revision) < 0) fail();
    if (error !== undefined) fail("affiliate_creator_authorization_denied");
    let tokenResult;
    onStage("callback_token_exchange");
    try { tokenResult = await client.exchange(code); } catch { fail(); }
    let identity; let credentials;
    try { identity = getValidatedCreatorAuthorizationIdentity(tokenResult); credentials = getValidatedCreatorAuthorizationCredentialMaterial(tokenResult); } catch { fail(); }
    if (identity.userType !== 1 || !identity.grantedScopes.includes("creator.affiliate.info")) fail();
    let creatorAccountId; let profile;
    onStage("callback_account_context");
    try { creatorAccountId = (await database.account()).account_id; } catch { fail(); }
    onStage("callback_profile_request");
    try { profile = safeProfile(await client.profile(credentials.accessToken)); } catch { fail(); }
    let command;
    try {
      command = persistence.prepare({ creatorAccountId, connectionId, expectedAuthorizationRevision: integer(accepted.authorization_revision), expectedCredentialRevision: integer(accepted.credential_revision), authorizationState: "authorized_ready", providerCreatorOpenId: identity.openId, userType: identity.userType, grantedScopes: identity.grantedScopes, authorizedAt: iso(now), accessExpiresAt: iso(identity.accessTokenExpiresAt * 1000), refreshExpiresAt: iso(identity.refreshTokenExpiresAt * 1000), accessToken: credentials.accessToken, refreshToken: credentials.refreshToken });
      onStage("callback_persistence");
      await database.complete(command);
    } catch { fail(); }
    return Object.freeze({ creatorUserId: profile.creatorUserId, selectionRegion: profile.selectionRegion, registerRegion: profile.registerRegion, sellerType: profile.sellerType, permissions: profile.permissions, userType: profile.userType });
  }

  return Object.freeze({ start, callback });
}

module.exports = { STATE_TTL_MS, KEY_REFERENCE, AffiliateCreatorRuntimeServiceError, create };
