"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  AffiliateCreatorAuthorizationPersistenceContractError,
  APPROVED_CREATOR_SCOPES,
  REQUIRED_SCOPE,
  MAX_CIPHERTEXT_LENGTH,
  normalizeInitialAuthorizationPersistenceCommand: initial,
  normalizeReauthorizationPersistenceCommand: reauthorize,
  normalizeRefreshRotationPersistenceCommand: refresh,
  normalizeScopeLifecycleStateUpdateCommand: reduce,
  normalizeInvalidRefreshPersistenceCommand: invalidRefresh,
  normalizeDeauthorizationPersistenceCommand: deauthorize,
  getAuthorizedCreatorAccountIdFromPersistenceCommand: accountIdFor,
  getEncryptedCredentialPersistenceMaterial: credentialsFor,
  getAffiliateCreatorIdentityFromPersistenceCommand: identityFor
} = require("../lib/tiktok-shop-affiliate-creator-authorization-persistence-contract");
const {
  normalizeCreatorTokenResponse
} = require("../lib/tiktok-shop-affiliate-creator-authorization-contract");
const {
  DISPLAY_BINDING_PROVIDER,
  resolveSessionCreatorAccountAuthorization
} = require("../lib/session-creator-account-authorization");
const { AFFILIATE_CREATOR_AUTHORIZATION_STATES } = require("../lib/tiktok-shop-affiliate-creator-authorization-lifecycle");

const ACCOUNT_ID = "00000000-0000-4000-8000-000000000001";
const OPEN_ID = "private-open-id";
const CIPHERTEXT = "opaque-encrypted-material";
const NOW = 1760000000;

function context() {
  return resolveSessionCreatorAccountAuthorization({
    session: { id: "private-session", expired: false },
    displayConnection: { displayIdentity: OPEN_ID, bindingProvider: DISPLAY_BINDING_PROVIDER, disconnectedAt: null },
    bindingCandidates: [{ creatorAccountId: ACCOUNT_ID, displayIdentity: OPEN_ID, bindingProvider: DISPLAY_BINDING_PROVIDER, connectionDisconnectedAt: null, accountStatus: "active", accountSlug: "creator" }],
    expectedBindingProvider: DISPLAY_BINDING_PROVIDER
  });
}

function authorizationResult(overrides = {}) {
  return normalizeCreatorTokenResponse({
    code: 0, message: "", request_id: "", data: {
      access_token: "private-access-token", refresh_token: "private-refresh-token", open_id: "private-affiliate-open-id", user_type: 1,
      access_token_expire_in: NOW + 60, refresh_token_expire_in: NOW + 120, granted_scopes: [REQUIRED_SCOPE], ...overrides
    }
  }, { now: NOW * 1000 });
}

function base(overrides = {}) {
  return {
    authorizationContext: context(), expectedRevision: 0, nextRevision: 1,
    authorizationResult: authorizationResult(), state: "authorized_ready",
    accessTokenCiphertext: CIPHERTEXT, refreshTokenCiphertext: `${CIPHERTEXT}-refresh`,
    authorizedAt: NOW, validatedAt: NOW, optionalCapabilitiesComplete: true,
    encryptionFormat: "opaque-v1", encryptionKeyReference: "affiliate-creator-v1",
    ...overrides
  };
}

function refreshInput(overrides = {}) {
  return {
    authorizationContext: context(), expectedRevision: 0, nextRevision: 1,
    state: "authorized_ready", grantedScopes: [REQUIRED_SCOPE],
    accessTokenCiphertext: CIPHERTEXT, refreshTokenCiphertext: `${CIPHERTEXT}-refresh`,
    accessTokenExpiresAt: NOW + 60, refreshTokenExpiresAt: NOW + 120,
    validatedAt: NOW, refreshedAt: NOW + 1, optionalCapabilitiesComplete: true,
    encryptionFormat: "opaque-v1", encryptionKeyReference: "affiliate-creator-v1", ...overrides
  };
}

function code(action, expected) {
  assert.throws(action, (error) => error instanceof AffiliateCreatorAuthorizationPersistenceContractError
    && error.code === expected && error.message === expected);
}

function testValidCommandsAndPrivacy() {
  const created = initial(base());
  const rotated = refresh(refreshInput({ validatedAt: NOW, refreshedAt: NOW + 1 }));
  const reduced = reduce({ authorizationContext: context(), expectedRevision: 1, nextRevision: 2, state: "authorized_limited", previousGrantedScopes: [REQUIRED_SCOPE, "creator.showcase.read"], grantedScopes: [REQUIRED_SCOPE], accessTokenExpiresAt: NOW + 60, refreshTokenExpiresAt: NOW + 120, validatedAt: NOW, optionalCapabilitiesComplete: false });
  const reauth = invalidRefresh({ authorizationContext: context(), expectedRevision: 2, nextRevision: 3, state: "reauthorization_required", occurredAt: NOW + 2 });
  const revoked = deauthorize({ authorizationContext: context(), expectedRevision: 3, nextRevision: 4, state: "deauthorized", revokedAt: NOW + 3 });
  for (const value of [created, rotated, reduced, reauth, revoked]) {
    assert.ok(Object.isFrozen(value)); assert.equal(Object.getPrototypeOf(value), null);
    const json = JSON.stringify(value); const spread = JSON.stringify({ ...value });
    for (const secret of [ACCOUNT_ID, OPEN_ID, CIPHERTEXT, "affiliate-creator-v1", REQUIRED_SCOPE, DISPLAY_BINDING_PROVIDER]) {
      assert.equal(json.includes(secret), false); assert.equal(spread.includes(secret), false);
    }
  }
  assert.equal(accountIdFor(created), ACCOUNT_ID);
  const identity = identityFor(created); assert.equal(identity.providerCreatorOpenId, "private-affiliate-open-id"); assert.equal(identity.userType, 1); assert.ok(Object.isFrozen(identity));
  const credentials = credentialsFor(created);
  assert.ok(Object.isFrozen(credentials)); assert.equal(credentials.accessTokenCiphertext, CIPHERTEXT);
  code(() => credentialsFor(revoked), "encrypted_credentials_not_allowed");
  code(() => identityFor(revoked), "creator_authorization_result_required");
  const reauthorizationInput = base({ expectedRevision: 4, nextRevision: 5, reauthorizedAt: NOW + 4, validatedAt: NOW + 4 }); delete reauthorizationInput.authorizedAt;
  const reauthorized = reauthorize(reauthorizationInput);
  assert.equal(reauthorized.operation, "reauthorization"); assert.equal(identityFor(reauthorized).providerCreatorOpenId, "private-affiliate-open-id");
}

function testLifecycleScopeAndTimeRules() {
  assert.deepEqual(APPROVED_CREATOR_SCOPES, ["creator.affiliate.info", "creator.affiliate.share_link.read", "creator.affiliate_collaboration.read", "creator.data.live.read.public", "creator.showcase.read"]);
  for (const scope of APPROVED_CREATOR_SCOPES) initial(base({ authorizationResult: authorizationResult({ granted_scopes: [...new Set([REQUIRED_SCOPE, scope])] }) }));
  for (const state of AFFILIATE_CREATOR_AUTHORIZATION_STATES.filter((state) => !["authorized_ready", "authorized_limited"].includes(state))) code(() => initial(base({ state })), "invalid_authorization_state");
  for (const state of AFFILIATE_CREATOR_AUTHORIZATION_STATES.filter((state) => !["authorized_ready", "authorized_limited"].includes(state))) code(() => refresh(refreshInput({ state, refreshedAt: NOW + 1 })), "invalid_authorization_state");
  for (const state of AFFILIATE_CREATOR_AUTHORIZATION_STATES.filter((state) => !["authorized_ready", "authorized_limited"].includes(state))) code(() => reduce({ authorizationContext: context(), expectedRevision: 1, nextRevision: 2, state, previousGrantedScopes: [REQUIRED_SCOPE, "creator.showcase.read"], grantedScopes: [REQUIRED_SCOPE], accessTokenExpiresAt: NOW + 60, refreshTokenExpiresAt: NOW + 120, validatedAt: NOW, optionalCapabilitiesComplete: false }), "invalid_authorization_state");
  for (const state of AFFILIATE_CREATOR_AUTHORIZATION_STATES.filter((state) => state !== "reauthorization_required")) code(() => invalidRefresh({ authorizationContext: context(), expectedRevision: 0, nextRevision: 1, state, occurredAt: NOW }), "invalid_persistence_input");
  for (const state of AFFILIATE_CREATOR_AUTHORIZATION_STATES.filter((state) => state !== "deauthorized")) code(() => deauthorize({ authorizationContext: context(), expectedRevision: 0, nextRevision: 1, state, revokedAt: NOW }), "invalid_persistence_input");
  code(() => initial(base({ state: "authorized_limited", optionalCapabilitiesComplete: true })), "invalid_authorization_state");
  for (const value of [String(NOW), NOW * 1000, NOW + 0.5, -1, Number.MAX_SAFE_INTEGER + 1, new Date()]) code(() => initial(base({ authorizedAt: value })), "invalid_persistence_input");
  code(() => refresh(refreshInput({ refreshedAt: NOW - 1 })), "invalid_persistence_input");
  code(() => reduce({ authorizationContext: context(), expectedRevision: 1, nextRevision: 2, state: "authorized_ready", previousGrantedScopes: [REQUIRED_SCOPE], grantedScopes: [REQUIRED_SCOPE], accessTokenExpiresAt: NOW + 60, refreshTokenExpiresAt: NOW + 120, validatedAt: NOW, optionalCapabilitiesComplete: true }), "invalid_authorization_scopes");
}

function testRevisionAndCredentialBoundaries() {
  for (const pair of [[-1, 0], [0, 0], [0, 2], ["0", 1], [0, 1.5], [0, Number.MAX_SAFE_INTEGER + 1]]) code(() => initial(base({ expectedRevision: pair[0], nextRevision: pair[1] })), "invalid_authorization_revision");
  for (const name of ["access_token", "refresh_token", "authorization_code", "code", "oauth_state", "app_secret", "client_secret", "sign", "signature", "raw_response", "provider_response", "request_id", "message", "providerCreatorOpenId", "openId", "open_id", "userType", "user_type", "creatorUserId", "displayIdentity", "sellerId", "partnerId", "accountId", "creatorAccountId", "grantedScopes", "accessTokenExpiresAt", "refreshTokenExpiresAt"]) code(() => initial({ ...base(), [name]: "private-value" }), "invalid_persistence_input");
  code(() => initial(base({ state: "private-oauth-state" })), "invalid_authorization_state");
  code(() => initial(base({ accessTokenCiphertext: "   " })), "encrypted_credentials_required");
  code(() => initial(base({ accessTokenCiphertext: "x".repeat(MAX_CIPHERTEXT_LENGTH + 1) })), "encrypted_credentials_required");
  code(() => initial(base({ encryptionFormat: "" })), "invalid_encryption_metadata");
  code(() => initial(base({ providerApiVersion: "unconfirmed" })), "unsupported_provider_provenance");
  for (const value of ["", " ", "x".repeat(129), {}, []]) code(() => initial(base({ encryptionKeyReference: value })), "invalid_encryption_metadata");
  for (const key of ["accessTokenCiphertext", "refreshTokenCiphertext", "authorizationResult", "providerCreatorOpenId", "openId", "userType", "creatorUserId"]) code(() => invalidRefresh({ authorizationContext: context(), expectedRevision: 0, nextRevision: 1, state: "reauthorization_required", occurredAt: NOW, [key]: "private" }), "invalid_persistence_input");
  for (const normalize of [refresh, reduce, invalidRefresh, deauthorize]) {
    const input = normalize === refresh ? refreshInput() : normalize === reduce
      ? { authorizationContext: context(), expectedRevision: 1, nextRevision: 2, state: "authorized_limited", previousGrantedScopes: [REQUIRED_SCOPE, "creator.showcase.read"], grantedScopes: [REQUIRED_SCOPE], accessTokenExpiresAt: NOW + 60, refreshTokenExpiresAt: NOW + 120, validatedAt: NOW, optionalCapabilitiesComplete: false }
      : normalize === invalidRefresh
        ? { authorizationContext: context(), expectedRevision: 0, nextRevision: 1, state: "reauthorization_required", occurredAt: NOW }
        : { authorizationContext: context(), expectedRevision: 0, nextRevision: 1, state: "deauthorized", revokedAt: NOW };
    for (const key of ["authorizationResult", "providerCreatorOpenId", "openId", "open_id", "userType", "user_type", "displayIdentity", "sellerId", "partnerId", "creatorUserId"]) {
      code(() => normalize({ ...input, [key]: "sensitive-identity" }), "invalid_persistence_input");
    }
  }
}

function testContextAndUnknownInputBoundaries() {
  for (const value of [null, {}, Object.freeze(Object.create(null)), ACCOUNT_ID]) code(() => initial(base({ authorizationContext: value })), "authorization_context_required");
  for (const value of [ACCOUNT_ID, "all", "all-accounts", "all_accounts", "all accounts", "allaccounts", OPEN_ID, { request: true }, { query: true }, { env: true }, { logger: true }, { cache: true }, { retry: true }]) code(() => initial({ ...base(), dashboardSelection: value }), "invalid_persistence_input");
  for (const key of ["creatorAccountId", "affiliateIdentity", "displayIdentity", "sellerIdentity", "partnerIdentity", "request", "response", "database", "query", "environment", "logger", "cache", "retry"]) code(() => initial({ ...base(), [key]: "sensitive-value" }), "invalid_persistence_input");
  for (const result of [null, {}, Object.freeze(Object.create(null)), JSON.parse(JSON.stringify(authorizationResult()))]) code(() => initial(base({ authorizationResult: result })), "creator_authorization_result_required");
  const valid = initial(base());
  for (const foreign of [{ ...valid }, JSON.parse(JSON.stringify(valid)), Object.freeze(Object.create(null))]) code(() => accountIdFor(foreign), "authorization_context_required");
  let error; try { initial(base({ accessTokenCiphertext: "sensitive-ciphertext-value", providerApiVersion: "sensitive-provider" })); } catch (caught) { error = caught; }
  assert.ok(error); const visible = JSON.stringify(error); for (const secret of [ACCOUNT_ID, OPEN_ID, CIPHERTEXT, "sensitive-ciphertext-value", "sensitive-provider"]) assert.equal(visible.includes(secret), false);
}

function testStaticDormancyAndNoRuntimeConsumers() {
  const root = path.join(__dirname, ".."); const name = "tiktok-shop-affiliate-creator-authorization-persistence-contract"; const target = path.join(root, `lib/${name}.js`); const source = fs.readFileSync(target, "utf8");
  assert.doesNotMatch(source, /process\.env|fetch\s*\(|https?:\/\/|withDatabase|redis|upstash|oauth|console\.|logger|cache|retry|\bsql`|encryptJson|decryptJson/i);
  assert.doesNotMatch(source, /\b(?:SELECT|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|ALTER\s+TABLE|CREATE\s+TABLE|DROP\s+TABLE|GRANT|REVOKE|CALL)\b/i);
  assert.doesNotMatch(source, /2025-10-01|sync_runs|videos|connected_tiktok_accounts|seller|partner|tiktok_display_api/i);
  const consumers = []; for (const dir of [path.join(root, "api"), path.join(root, "lib")]) for (const item of fs.readdirSync(dir, { withFileTypes: true })) { const candidate = path.join(dir, item.name); if (item.name.endsWith(".js") && candidate !== target && fs.readFileSync(candidate, "utf8").includes(name)) consumers.push(candidate); } assert.deepEqual(consumers, []);
}

[testValidCommandsAndPrivacy, testLifecycleScopeAndTimeRules, testRevisionAndCredentialBoundaries, testContextAndUnknownInputBoundaries, testStaticDormancyAndNoRuntimeConsumers].forEach((test) => test());
console.log("TikTok Shop Affiliate Creator authorization persistence contract tests passed.");
