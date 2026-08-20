"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  CreatorAuthorizationContractError,
  CREATOR_AUTHORIZATION_CONTRACT,
  validateCreatorAuthorizationRequest,
  normalizeCreatorAuthorizationCallback,
  normalizeCreatorTokenResponse,
  getValidatedCreatorAuthorizationIdentity,
  getValidatedCreatorAuthorizationCredentialMaterial,
  MAX_CREATOR_OPEN_ID_LENGTH
} = require("../lib/tiktok-shop-affiliate-creator-authorization-contract");
const { CAPABILITY_REGISTRY } = require("../lib/tiktok-shop-affiliate-creator-capability-registry");

const TEXT = String.fromCharCode(120);
const NOW = 1760000000000;

function tokenResponse(data = {}, envelope = {}) {
  return {
    code: 0,
    message: TEXT,
    request_id: TEXT,
    data: {
      access_token: TEXT,
      refresh_token: TEXT,
      open_id: TEXT,
      user_type: 1,
      access_token_expire_in: Math.floor(NOW / 1000) + 1,
      refresh_token_expire_in: Math.floor(NOW / 1000) + 2,
      granted_scopes: ["creator.affiliate.info"],
      ...data
    },
    ...envelope
  };
}

function assertCode(callback, code) {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof CreatorAuthorizationContractError);
    assert.equal(error.code, code);
    assert.equal(error.message, code);
    assert.deepEqual(Object.keys(error).sort(), ["code", "name"]);
    return true;
  });
}

function testStaticContract() {
  const contract = CREATOR_AUTHORIZATION_CONTRACT;
  assert.deepEqual(contract.authority, ["Creator authorization guide.md", "Generate a test access token.md", "Affiliate Creator API overview.md", "Overview.md"]);
  assert.deepEqual(contract.sourceMetadata, {
    officialMarkdownReviewedOutsideWorkspace: true,
    contractFactsSuppliedToWorkspace: true,
    localSourceFilesAvailable: false
  });
  assert.deepEqual(contract.negativeBoundaryEvidence, ["Authorization via App Store.md", "Partner authorization guide.md"]);
  assert.deepEqual(contract.separateAuthorizationDomains, ["seller", "partner", "local_sellers", "tiktok_for_developers", "tiktok_display_api"]);
  assert.equal(contract.authorization.endpoint, "https://shop.tiktok.com/alliance/creator/auth");
  assert.deepEqual(contract.authorization.requiredInputs, ["appKey", "state"]);
  assert.ok(contract.authorization.stateRequirements.includes("single_use"));
  assert.ok(contract.authorization.callerProhibitedInputs.includes("service_id"));
  assert.deepEqual(contract.callback.acceptedFields, ["code", "state", "error"]);
  assert.equal(contract.token.exchange.method, "GET");
  assert.equal(contract.token.exchange.endpoint, "https://auth.tiktok-shops.com/api/v2/token/get");
  assert.deepEqual(contract.token.exchange.requiredParameters, ["app_key", "app_secret", "auth_code", "grant_type"]);
  assert.equal(contract.token.exchange.grantType, "authorized_code");
  assert.equal(contract.token.exchange.authorizationCodeValidityMinutes, 30);
  assert.equal(contract.token.refresh.method, "GET");
  assert.equal(contract.token.refresh.endpoint, "https://auth.tiktok-shops.com/api/v2/token/refresh");
  assert.deepEqual(contract.token.refresh.requiredParameters, ["app_key", "app_secret", "refresh_token", "grant_type"]);
  assert.equal(contract.token.refresh.grantType, "refresh_token");
  assert.equal(contract.token.refresh.refreshTokenValidity, null);
  assert.equal(contract.token.refresh.refreshTokenRotation, null);
  assert.equal(contract.token.accessTokenDefaultValidityDays, 7);
  assert.equal(contract.requiredScope, "creator.affiliate.info");
  assert.equal(contract.creatorUserType, 1);
  assert.equal(contract.runtimeAllowed, false);
  assert.ok(Object.isFrozen(contract));
  assert.throws(() => contract.authority.push(TEXT));
}

function testAuthorizationRequestAndCallback() {
  const request = validateCreatorAuthorizationRequest({ appKey: TEXT, state: TEXT });
  assert.equal(Object.getPrototypeOf(request), null);
  assert.deepEqual({ ...request }, { endpoint: CREATOR_AUTHORIZATION_CONTRACT.authorization.endpoint, appKey: TEXT, state: TEXT });
  assert.ok(Object.isFrozen(request));
  for (const input of [null, {}, { appKey: TEXT }, { state: TEXT }, { appKey: TEXT, state: " " }, { appKey: TEXT, state: TEXT, service_id: TEXT }, { appKey: TEXT, state: TEXT, scopes: [TEXT] }]) {
    assertCode(() => validateCreatorAuthorizationRequest(input), "invalid_creator_authorization_request");
  }
  let checked = 0;
  const callback = normalizeCreatorAuthorizationCallback({ code: TEXT, state: TEXT }, { verifyState: (state) => { checked += 1; return state === TEXT; } });
  assert.equal(checked, 1);
  assert.deepEqual({ ...callback }, { code: TEXT });
  assert.ok(Object.isFrozen(callback));
  assertCode(() => normalizeCreatorAuthorizationCallback({ code: TEXT }, { verifyState: () => true }), "creator_authorization_state_invalid");
  assertCode(() => normalizeCreatorAuthorizationCallback({ code: TEXT, state: TEXT }, { verifyState: () => false }), "creator_authorization_state_invalid");
  assertCode(() => normalizeCreatorAuthorizationCallback({ code: TEXT, state: TEXT }, { verifyState: () => { throw new Error(TEXT); } }), "creator_authorization_state_invalid");
  assertCode(() => normalizeCreatorAuthorizationCallback({ state: TEXT, error: TEXT }, { verifyState: () => true }), "creator_authorization_denied");
  assertCode(() => normalizeCreatorAuthorizationCallback({ state: TEXT, error: TEXT, code: TEXT }, { verifyState: () => true }), "invalid_creator_authorization_callback");
}

function testTokenNormalizationAndPrivacy() {
  const openId = "private-creator-open-id";
  const normalized = normalizeCreatorTokenResponse(tokenResponse({ open_id: openId, granted_scopes: ["creator.affiliate.info", "creator.showcase.read"] }), { now: NOW });
  assert.equal(Object.getPrototypeOf(normalized), null);
  assert.deepEqual(Object.keys(normalized), []);
  assert.equal(JSON.stringify(normalized), "{}");
  assert.ok(Object.isFrozen(normalized));
  const facts = getValidatedCreatorAuthorizationIdentity(normalized);
  assert.equal(Object.getPrototypeOf(facts), null);
  assert.deepEqual(Object.keys(facts), ["openId", "userType", "grantedScopes", "accessTokenExpiresAt", "refreshTokenExpiresAt"]);
  assert.equal(facts.openId, openId); assert.equal(facts.userType, 1); assert.ok(Object.isFrozen(facts)); assert.ok(Object.isFrozen(facts.grantedScopes));
  const credentials = getValidatedCreatorAuthorizationCredentialMaterial(normalized);
  assert.deepEqual(Object.keys(credentials), ["accessToken", "refreshToken"]);
  assert.equal(credentials.accessToken, TEXT); assert.equal(credentials.refreshToken, TEXT);
  assert.equal(JSON.stringify(normalized).includes(openId), false);
  assert.equal(JSON.stringify(normalized).includes(TEXT), false);
  assert.equal(JSON.stringify(credentials).includes(openId), false);
  assert.throws(() => facts.grantedScopes.push("creator.affiliate.info"));
  for (const userType of [0, 2, 3, 4, 5, "1", null, undefined]) assertCode(() => normalizeCreatorTokenResponse(tokenResponse({ user_type: userType }), { now: NOW }), "invalid_creator_token_response");
  assertCode(() => normalizeCreatorTokenResponse(tokenResponse({}, { code: 1 }), { now: NOW }), "creator_token_api_error");
  assertCode(() => normalizeCreatorTokenResponse(tokenResponse({ open_id: "" }), { now: NOW }), "creator_identity_required");
  for (const value of [" ", "\u0000id", "line\nbreak", "x".repeat(MAX_CREATOR_OPEN_ID_LENGTH + 1), 1, null, undefined]) assertCode(() => normalizeCreatorTokenResponse(tokenResponse({ open_id: value }), { now: NOW }), "creator_identity_required");
  assertCode(() => normalizeCreatorTokenResponse(tokenResponse({ granted_scopes: [] }), { now: NOW }), "creator_scope_required");
  for (const scopes of [["creator.affiliate.info", "creator.affiliate.info"], [TEXT], ["seller.order.info"], ["creator.affiliate.info", " "]]) {
    assertCode(() => normalizeCreatorTokenResponse(tokenResponse({ granted_scopes: scopes }), { now: NOW }), "invalid_creator_token_response");
  }
  for (const data of [{ access_token: "" }, { refresh_token: "" }, { access_token_expire_in: Math.floor(NOW / 1000) }, { refresh_token_expire_in: TEXT }, { granted_scopes: TEXT }, { creator_user_id: "not-an-identity" }, { username: "not-an-identity" }]) {
    assertCode(() => normalizeCreatorTokenResponse(tokenResponse(data), { now: NOW }), "invalid_creator_token_response");
  }
  for (const foreign of [{}, { ...normalized }, JSON.parse(JSON.stringify(normalized)), Object.freeze(Object.create(null))]) {
    assertCode(() => getValidatedCreatorAuthorizationIdentity(foreign), "creator_authorization_result_required");
    assertCode(() => getValidatedCreatorAuthorizationCredentialMaterial(foreign), "creator_authorization_result_required");
  }
  const sentinel = "sensitive-sentinel-open-id";
  let error; try { normalizeCreatorTokenResponse(tokenResponse({ open_id: sentinel, user_type: 0 }), { now: NOW }); } catch (caught) { error = caught; }
  assert.ok(error); assert.equal(JSON.stringify(error).includes(sentinel), false);
}

function testRegistryAndStaticDormancy() {
  for (const scope of CAPABILITY_REGISTRY) for (const endpoint of scope.endpoints) assert.equal(endpoint.runtimeAllowed, false);
  const root = path.join(__dirname, "..");
  const name = "tiktok-shop-affiliate-creator-authorization-contract";
  const target = path.join(root, `lib/${name}.js`);
  const source = fs.readFileSync(target, "utf8");
  assert.doesNotMatch(source, /fetch\s*\(|axios|https?\.request|WebSocket|process\.env|withDatabase|cache|logger|console\.|retry|\bsql`/i);
  assert.doesNotMatch(source, /\b(?:INSERT\s+INTO|UPDATE\s+[\w."]+\s+SET|DELETE\s+FROM|ALTER\s+TABLE|DROP\s+TABLE|GRANT\s+\w+\s+ON|REVOKE\s+\w+\s+ON|CALL\s+[\w."]+)\b/i);
  assert.doesNotMatch(source, /2025-10-01|sync_runs|videos|connected_tiktok_accounts/i);
  const permittedDormantConsumers = new Set([
    "lib/tiktok-shop-affiliate-creator-authorization-persistence-contract.js",
    "lib/tiktok-shop-affiliate-creator-runtime-service.js",
    "lib/tiktok-shop-affiliate-creator-runtime-tiktok-client.js"
  ]);
  const consumers = [];
  for (const directory of [path.join(root, "api"), path.join(root, "lib")]) {
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      if (!item.name.endsWith(".js")) continue;
      const candidate = path.join(directory, item.name);
      if (candidate !== target && fs.readFileSync(candidate, "utf8").includes(name)) consumers.push(path.relative(root, candidate));
    }
  }
  assert.deepEqual(consumers, [...permittedDormantConsumers]);
}

[testStaticContract, testAuthorizationRequestAndCallback, testTokenNormalizationAndPrivacy, testRegistryAndStaticDormancy].forEach((test) => test());
console.log("TikTok Shop Affiliate Creator authorization contract tests passed.");
