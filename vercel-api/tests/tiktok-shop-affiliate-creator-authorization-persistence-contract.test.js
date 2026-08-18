"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  AffiliateCreatorAuthorizationPersistenceContractError,
  APPROVED_CREATOR_SCOPES,
  REQUIRED_SCOPE,
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
  AFFILIATE_CREATOR_PROVIDER,
  createAffiliateCreatorCredentialAad,
  createAffiliateCreatorCredentialEnvelopeContext,
  normalizeAffiliateCreatorCredentialEnvelope
} = require("../lib/tiktok-shop-affiliate-creator-credential-envelope-contract");
const { normalizeCreatorTokenResponse } = require("../lib/tiktok-shop-affiliate-creator-authorization-contract");
const { DISPLAY_BINDING_PROVIDER, resolveSessionCreatorAccountAuthorization } = require("../lib/session-creator-account-authorization");

const ACCOUNT_ID = "00000000-0000-4000-8000-000000000001";
const CONNECTION_ID = "00000000-0000-4000-8000-000000000002";
const OPEN_ID = "private-open-id";
const NOW = 1760000000;
const KEY_REFERENCE = "affiliate-creator-sandbox-v1";

function context() {
  return resolveSessionCreatorAccountAuthorization({
    session: { id: "private-session", expired: false },
    displayConnection: { displayIdentity: OPEN_ID, bindingProvider: DISPLAY_BINDING_PROVIDER, disconnectedAt: null },
    bindingCandidates: [{ creatorAccountId: ACCOUNT_ID, displayIdentity: OPEN_ID, bindingProvider: DISPLAY_BINDING_PROVIDER, connectionDisconnectedAt: null, accountStatus: "active", accountSlug: "creator" }],
    expectedBindingProvider: DISPLAY_BINDING_PROVIDER
  });
}

function aad(purpose, revision = 1, overrides = {}) {
  return createAffiliateCreatorCredentialAad({
    environment: "sandbox", provider: AFFILIATE_CREATOR_PROVIDER, creatorAccountId: ACCOUNT_ID, connectionId: CONNECTION_ID,
    purpose, credentialRevision: revision, envelopeVersion: 1, keyReference: KEY_REFERENCE, ...overrides
  });
}

function envelope(binding, suffix) {
  return createAffiliateCreatorCredentialEnvelopeContext({
    envelope: normalizeAffiliateCreatorCredentialEnvelope({
      v: 1, alg: "A256GCM", kid: KEY_REFERENCE, aad_v: 1,
      iv: Buffer.alloc(12, suffix).toString("base64url"), ct: Buffer.from(`synthetic-${suffix}`).toString("base64url"), tag: Buffer.alloc(16, suffix).toString("base64url")
    }),
    aad: binding
  });
}

function credentials(revision = 1) {
  const expectedAccessAad = aad("access", revision);
  const expectedRefreshAad = aad("refresh", revision);
  return { connectionId: CONNECTION_ID, accessEnvelope: envelope(expectedAccessAad, 1), refreshEnvelope: envelope(expectedRefreshAad, 2), expectedAccessAad, expectedRefreshAad };
}

function authorizationResult(overrides = {}) {
  return normalizeCreatorTokenResponse({ code: 0, message: "", request_id: "", data: {
    access_token: "private-access-token", refresh_token: "private-refresh-token", open_id: "private-affiliate-open-id", user_type: 1,
    access_token_expire_in: NOW + 60, refresh_token_expire_in: NOW + 120, granted_scopes: [REQUIRED_SCOPE], ...overrides
  } }, { now: NOW * 1000 });
}

function base(overrides = {}) {
  return { authorizationContext: context(), expectedRevision: 0, nextRevision: 1, authorizationResult: authorizationResult(), state: "authorized_ready", ...credentials(1), authorizedAt: NOW, validatedAt: NOW, optionalCapabilitiesComplete: true, providerApiVersion: undefined, ...overrides };
}

function refreshInput(overrides = {}) {
  return { authorizationContext: context(), expectedRevision: 0, nextRevision: 1, state: "authorized_ready", grantedScopes: [REQUIRED_SCOPE], ...credentials(1), accessTokenExpiresAt: NOW + 60, refreshTokenExpiresAt: NOW + 120, validatedAt: NOW, refreshedAt: NOW + 1, optionalCapabilitiesComplete: true, providerApiVersion: undefined, ...overrides };
}

function code(action, expected) {
  assert.throws(action, (error) => error instanceof AffiliateCreatorAuthorizationPersistenceContractError && error.code === expected && error.message === expected);
}

function testValidCommandsAndPrivacy() {
  const created = initial(base());
  const rotated = refresh(refreshInput());
  const reduced = reduce({ authorizationContext: context(), expectedRevision: 1, nextRevision: 2, state: "authorized_limited", previousGrantedScopes: [REQUIRED_SCOPE, "creator.showcase.read"], grantedScopes: [REQUIRED_SCOPE], accessTokenExpiresAt: NOW + 60, refreshTokenExpiresAt: NOW + 120, validatedAt: NOW, optionalCapabilitiesComplete: false, providerApiVersion: undefined });
  const reauth = invalidRefresh({ authorizationContext: context(), expectedRevision: 2, nextRevision: 3, state: "reauthorization_required", occurredAt: NOW + 2, providerApiVersion: undefined });
  const revoked = deauthorize({ authorizationContext: context(), expectedRevision: 3, nextRevision: 4, state: "deauthorized", revokedAt: NOW + 3, providerApiVersion: undefined });
  for (const value of [created, rotated, reduced, reauth, revoked]) {
    assert(Object.isFrozen(value)); assert.equal(Object.getPrototypeOf(value), null); assert.equal(JSON.stringify(value), "{}"); assert.deepEqual({ ...value }, {});
    for (const secret of [ACCOUNT_ID, CONNECTION_ID, OPEN_ID, KEY_REFERENCE, REQUIRED_SCOPE]) assert.equal(JSON.stringify(value).includes(secret), false);
  }
  assert.equal(accountIdFor(created), ACCOUNT_ID);
  assert.equal(identityFor(created).providerCreatorOpenId, "private-affiliate-open-id");
  const credentialMaterial = credentialsFor(created);
  assert(Object.isFrozen(credentialMaterial)); assert.equal(Object.getPrototypeOf(credentialMaterial), null); assert.equal(JSON.stringify(credentialMaterial), "{}");
  code(() => credentialsFor(revoked), "encrypted_credentials_not_allowed");
  code(() => identityFor(revoked), "creator_authorization_result_required");
  const reauthorizationInput = base({ expectedRevision: 4, nextRevision: 5, ...credentials(5), reauthorizedAt: NOW + 4, validatedAt: NOW + 4 }); delete reauthorizationInput.authorizedAt;
  assert.equal(JSON.stringify(reauthorize(reauthorizationInput)), "{}");
}

function testInputAndCredentialBoundaries() {
  assert.deepEqual(APPROVED_CREATOR_SCOPES, ["creator.affiliate.info", "creator.affiliate.share_link.read", "creator.affiliate_collaboration.read", "creator.data.live.read.public", "creator.showcase.read"]);
  for (const pair of [[-1, 0], [0, 0], [0, 2], ["0", 1]]) code(() => initial(base({ expectedRevision: pair[0], nextRevision: pair[1] })), "invalid_authorization_revision");
  for (const key of ["accessTokenCiphertext", "refreshTokenCiphertext", "encryptionFormat", "encryptionKeyReference", "dashboardSelection", "creatorAccountId", "request", "database", "environment", "logger", "cache", "retry"]) code(() => initial({ ...base(), [key]: "private-value" }), "invalid_persistence_input");
  for (const key of ["accessEnvelope", "refreshEnvelope", "expectedAccessAad", "expectedRefreshAad", "connectionId"]) {
    const expected = key === "connectionId" ? "invalid_credential_persistence_input" : key.includes("Aad") ? "invalid_credential_aad" : "invalid_credential_envelope";
    code(() => initial(base({ [key]: undefined })), expected);
  }
  code(() => initial(base({ providerApiVersion: "unconfirmed" })), "unsupported_provider_provenance");
  for (const value of [null, {}, Object.freeze(Object.create(null)), ACCOUNT_ID]) code(() => initial(base({ authorizationContext: value })), "authorization_context_required");
  for (const key of ["accessEnvelope", "refreshEnvelope", "expectedAccessAad", "expectedRefreshAad", "connectionId"]) code(() => invalidRefresh({ authorizationContext: context(), expectedRevision: 0, nextRevision: 1, state: "reauthorization_required", occurredAt: NOW, providerApiVersion: undefined, [key]: "private" }), "invalid_persistence_input");
  let error; try { initial(base({ connectionId: "private-connection" })); } catch (caught) { error = caught; }
  assert(error); for (const secret of [ACCOUNT_ID, CONNECTION_ID, OPEN_ID, KEY_REFERENCE, "private-connection"]) assert.equal(JSON.stringify(error).includes(secret), false);
}

function testStaticDormancyAndNoRuntimeConsumers() {
  const root = path.join(__dirname, ".."); const name = "tiktok-shop-affiliate-creator-authorization-persistence-contract"; const target = path.join(root, `lib/${name}.js`); const source = fs.readFileSync(target, "utf8");
  assert.doesNotMatch(source, /process\.env|fetch\s*\(|https?:\/\/|withDatabase|redis|upstash|oauth|console\.|logger|cache|retry|\bsql`|encryptJson|decryptJson/i);
  assert.doesNotMatch(source, /\b(?:SELECT|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|ALTER\s+TABLE|CREATE\s+TABLE|DROP\s+TABLE|GRANT|REVOKE|CALL)\b/i);
  const consumers = []; for (const dir of [path.join(root, "api"), path.join(root, "lib")]) for (const item of fs.readdirSync(dir, { withFileTypes: true })) { const candidate = path.join(dir, item.name); if (item.name.endsWith(".js") && candidate !== target && fs.readFileSync(candidate, "utf8").includes(name)) consumers.push(candidate); } assert.deepEqual(consumers, []);
}

[testValidCommandsAndPrivacy, testInputAndCredentialBoundaries, testStaticDormancyAndNoRuntimeConsumers].forEach((test) => test());
console.log("TikTok Shop Affiliate Creator authorization persistence contract tests passed.");
