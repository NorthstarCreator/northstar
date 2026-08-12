"use strict";

class CreatorAuthorizationContractError extends Error {
  constructor(code) {
    super(code);
    this.name = "CreatorAuthorizationContractError";
    this.code = code;
  }
}

function deepFreeze(value) {
  if (Array.isArray(value)) value.forEach(deepFreeze);
  else if (value && typeof value === "object") Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

const CREATOR_AUTHORIZATION_CONTRACT = deepFreeze({
  authority: Object.freeze([
    "Creator authorization guide.md",
    "Generate a test access token.md",
    "Affiliate Creator API overview.md",
    "Overview.md"
  ]),
  sourceMetadata: {
    officialMarkdownReviewedOutsideWorkspace: true,
    contractFactsSuppliedToWorkspace: true,
    localSourceFilesAvailable: false
  },
  negativeBoundaryEvidence: Object.freeze([
    "Authorization via App Store.md",
    "Partner authorization guide.md"
  ]),
  separateAuthorizationDomains: Object.freeze([
    "seller",
    "partner",
    "local_sellers",
    "tiktok_for_developers",
    "tiktok_display_api"
  ]),
  authorization: {
    endpoint: "https://shop.tiktok.com/alliance/creator/auth",
    requiredInputs: ["appKey", "state"],
    stateRequirements: ["mandatory", "nonempty", "server_generated", "unpredictable", "session_bound", "single_use", "no_credentials_or_tokens"],
    callerProhibitedInputs: ["service_id", "creatorAccountId", "dashboardSelection", "scopes", "tokens", "seller", "partner"]
  },
  callback: {
    acceptedFields: ["code", "state", "error"],
    tokenExchange: false
  },
  token: {
    exchange: {
      method: "GET",
      endpoint: "https://auth.tiktok-shops.com/api/v2/token/get",
      requiredParameters: ["app_key", "app_secret", "auth_code", "grant_type"],
      grantType: "authorized_code",
      authorizationCodeValidityMinutes: 30
    },
    refresh: {
      method: "GET",
      endpoint: "https://auth.tiktok-shops.com/api/v2/token/refresh",
      requiredParameters: ["app_key", "app_secret", "refresh_token", "grant_type"],
      grantType: "refresh_token",
      refreshTokenValidity: null,
      refreshTokenRotation: null
    },
    accessTokenDefaultValidityDays: 7,
    runtimeAllowed: false
  },
  requiredScope: "creator.affiliate.info",
  creatorScopePrefix: "creator.",
  creatorUserType: 1,
  runtimeAllowed: false
});

function fail(code) {
  throw new CreatorAuthorizationContractError(code);
}

function plainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function safeText(value) {
  return typeof value === "string" && value.length > 0 && value === value.trim() && !/[\u0000-\u001f\u007f]/.test(value);
}

function exactKeys(value, keys) {
  return plainObject(value) && Object.keys(value).every((key) => keys.includes(key));
}

function frozenContext(fields) {
  return Object.freeze(Object.assign(Object.create(null), fields));
}

function validateCreatorAuthorizationRequest(input) {
  if (!exactKeys(input, CREATOR_AUTHORIZATION_CONTRACT.authorization.requiredInputs)) fail("invalid_creator_authorization_request");
  if (!safeText(input.appKey) || !safeText(input.state)) fail("invalid_creator_authorization_request");
  return frozenContext({
    endpoint: CREATOR_AUTHORIZATION_CONTRACT.authorization.endpoint,
    appKey: input.appKey,
    state: input.state
  });
}

function normalizeCreatorAuthorizationCallback(input, { verifyState } = {}) {
  if (!exactKeys(input, CREATOR_AUTHORIZATION_CONTRACT.callback.acceptedFields) || typeof verifyState !== "function") {
    fail("invalid_creator_authorization_callback");
  }
  if (!safeText(input.state)) fail("creator_authorization_state_invalid");
  let stateAccepted = false;
  try {
    stateAccepted = verifyState(input.state) === true;
  } catch {
    stateAccepted = false;
  }
  if (!stateAccepted) fail("creator_authorization_state_invalid");
  if (input.error !== undefined && input.error !== null) {
    if (!safeText(input.error) || input.code !== undefined) fail("invalid_creator_authorization_callback");
    fail("creator_authorization_denied");
  }
  if (!safeText(input.code)) fail("invalid_creator_authorization_callback");
  return frozenContext({ code: input.code });
}

function validUnixExpiration(value, nowSeconds) {
  return Number.isSafeInteger(value) && value > nowSeconds;
}

function normalizeGrantedScopes(value) {
  if (!Array.isArray(value)) fail("invalid_creator_token_response");
  const seen = new Set();
  for (const scope of value) {
    if (!safeText(scope) || !scope.startsWith(CREATOR_AUTHORIZATION_CONTRACT.creatorScopePrefix) || seen.has(scope)) {
      fail("invalid_creator_token_response");
    }
    seen.add(scope);
  }
  if (!seen.has(CREATOR_AUTHORIZATION_CONTRACT.requiredScope)) fail("creator_scope_required");
  return Object.freeze([...seen]);
}

function normalizeCreatorTokenResponse(response, { now = Date.now() } = {}) {
  if (!plainObject(response) || !Number.isSafeInteger(response.code)) fail("invalid_creator_token_response");
  if (response.code !== 0) fail("creator_token_api_error");
  if (!plainObject(response.data)) fail("invalid_creator_token_response");
  const data = response.data;
  if (data.user_type !== CREATOR_AUTHORIZATION_CONTRACT.creatorUserType) fail("invalid_creator_token_response");
  if (!safeText(data.access_token) || !safeText(data.refresh_token)) fail("invalid_creator_token_response");
  if (!safeText(data.open_id)) fail("creator_identity_required");
  const nowSeconds = Math.floor(Number(now) / 1000);
  if (!Number.isSafeInteger(nowSeconds) || !validUnixExpiration(data.access_token_expire_in, nowSeconds) || !validUnixExpiration(data.refresh_token_expire_in, nowSeconds)) {
    fail("invalid_creator_token_response");
  }
  return frozenContext({
    accessToken: data.access_token,
    accessTokenExpiresAt: data.access_token_expire_in,
    refreshToken: data.refresh_token,
    refreshTokenExpiresAt: data.refresh_token_expire_in,
    openId: data.open_id,
    userType: data.user_type,
    grantedScopes: normalizeGrantedScopes(data.granted_scopes)
  });
}

module.exports = {
  CreatorAuthorizationContractError,
  CREATOR_AUTHORIZATION_CONTRACT,
  validateCreatorAuthorizationRequest,
  normalizeCreatorAuthorizationCallback,
  normalizeCreatorTokenResponse
};
