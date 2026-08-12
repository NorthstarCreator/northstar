"use strict";

class AffiliateCreatorAuthorizationLifecycleError extends Error {
  constructor(code) {
    super(code);
    this.name = "AffiliateCreatorAuthorizationLifecycleError";
    this.code = code;
  }
}

const AFFILIATE_CREATOR_AUTHORIZATION_STATES = Object.freeze([
  "not_authorized",
  "authorization_pending",
  "callback_received",
  "authorized_limited",
  "authorized_ready",
  "refresh_required",
  "reauthorization_required",
  "deauthorized"
]);

const AFFILIATE_CREATOR_AUTHORIZATION_EVENTS = Object.freeze([
  "authorization_started",
  "callback_accepted",
  "token_validated",
  "token_expiring",
  "token_expired",
  "refresh_succeeded",
  "refresh_failed",
  "scopes_reduced",
  "all_access_removed",
  "authorization_restarted"
]);

const DEFAULT_REQUIRED_SCOPES = Object.freeze(["creator.affiliate.info"]);
const lifecycleInstances = new WeakSet();
const scopePattern = /^creator\.[a-z0-9_.]+$/;
const lifecycleKeys = Object.freeze([
  "state",
  "revision",
  "requiredScopes",
  "grantedScopes",
  "missingRequiredScopes",
  "capabilityStatus",
  "accessTokenExpiresAt",
  "refreshTokenExpiresAt"
]);

function fail(code) {
  throw new AffiliateCreatorAuthorizationLifecycleError(code);
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, allowed) {
  return isPlainObject(value) && Object.keys(value).every((key) => allowed.includes(key));
}

function validUnixTimestamp(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function normalizeScopes(value, code) {
  if (!Array.isArray(value)) fail(code);
  const scopes = new Set();
  for (const scope of value) {
    if (typeof scope !== "string" || !scopePattern.test(scope)) fail(code);
    scopes.add(scope);
  }
  return Object.freeze([...scopes].sort());
}

function normalizeRequiredScopes(value) {
  if (value === undefined) return DEFAULT_REQUIRED_SCOPES;
  const scopes = normalizeScopes(value, "invalid_affiliate_creator_authorization_facts");
  if (scopes.length === 0) fail("creator_scope_required");
  return scopes;
}

function missingRequiredScopes(requiredScopes, grantedScopes) {
  const granted = new Set(grantedScopes);
  return Object.freeze(requiredScopes.filter((scope) => !granted.has(scope)));
}

function capabilityStatusFor(state) {
  if (state === "authorized_ready") return "ready";
  if (state === "authorized_limited") return "limited";
  if (state === "authorization_pending" || state === "callback_received") return "pending";
  if (state === "refresh_required") return "refresh_required";
  if (state === "reauthorization_required") return "reauthorization_required";
  return "unavailable";
}

function createLifecycle({ state, revision, requiredScopes, grantedScopes, accessTokenExpiresAt, refreshTokenExpiresAt }) {
  const missingScopes = missingRequiredScopes(requiredScopes, grantedScopes);
  const lifecycle = Object.freeze(Object.assign(Object.create(null), {
    state,
    revision,
    requiredScopes: Object.freeze([...requiredScopes]),
    grantedScopes: Object.freeze([...grantedScopes]),
    missingRequiredScopes: missingScopes,
    capabilityStatus: capabilityStatusFor(state),
    accessTokenExpiresAt,
    refreshTokenExpiresAt
  }));
  lifecycleInstances.add(lifecycle);
  return lifecycle;
}

function emptyLifecycle(state, revision, requiredScopes = DEFAULT_REQUIRED_SCOPES) {
  return createLifecycle({
    state,
    revision,
    requiredScopes,
    grantedScopes: Object.freeze([]),
    accessTokenExpiresAt: null,
    refreshTokenExpiresAt: null
  });
}

function validateLifecycle(lifecycle) {
  if (!lifecycleInstances.has(lifecycle)
    || Object.getPrototypeOf(lifecycle) !== null
    || !Object.isFrozen(lifecycle)
    || !Object.keys(lifecycle).every((key) => lifecycleKeys.includes(key))
    || lifecycleKeys.some((key) => !(key in lifecycle))
    || !AFFILIATE_CREATOR_AUTHORIZATION_STATES.includes(lifecycle.state)
    || !Number.isSafeInteger(lifecycle.revision)
    || lifecycle.revision < 0
    || !Object.isFrozen(lifecycle.requiredScopes)
    || !Object.isFrozen(lifecycle.grantedScopes)
    || !Object.isFrozen(lifecycle.missingRequiredScopes)) {
    fail("invalid_affiliate_creator_authorization_lifecycle");
  }
}

function requireEmptyFacts(facts) {
  if (facts === undefined) return Object.create(null);
  if (!exactKeys(facts, [])) fail("invalid_affiliate_creator_authorization_facts");
  return facts;
}

function requireNow(facts) {
  if (!exactKeys(facts, ["now"]) || !validUnixTimestamp(facts.now)) {
    fail("invalid_affiliate_creator_authorization_facts");
  }
  return facts.now;
}

function assessAffiliateCreatorTokenFacts(facts) {
  if (!exactKeys(facts, ["userType", "accessTokenExpiresAt", "refreshTokenExpiresAt", "grantedScopes", "requiredScopes", "optionalCapabilitiesComplete", "now"])) {
    fail("invalid_affiliate_creator_authorization_facts");
  }
  if (facts.userType !== 1) fail("creator_identity_required");
  if (!validUnixTimestamp(facts.now)
    || !validUnixTimestamp(facts.accessTokenExpiresAt)
    || !validUnixTimestamp(facts.refreshTokenExpiresAt)) {
    fail("invalid_affiliate_creator_authorization_facts");
  }
  if (facts.accessTokenExpiresAt <= facts.now || facts.refreshTokenExpiresAt <= facts.now) {
    fail("creator_token_expired");
  }
  if (facts.optionalCapabilitiesComplete !== undefined && typeof facts.optionalCapabilitiesComplete !== "boolean") {
    fail("invalid_affiliate_creator_authorization_facts");
  }
  const requiredScopes = normalizeRequiredScopes(facts.requiredScopes);
  const grantedScopes = normalizeScopes(facts.grantedScopes, "invalid_affiliate_creator_authorization_facts");
  const missingScopes = missingRequiredScopes(requiredScopes, grantedScopes);
  if (missingScopes.length > 0) fail("creator_scope_required");
  const assessment = Object.freeze(Object.assign(Object.create(null), {
    requiredScopes: Object.freeze([...requiredScopes]),
    grantedScopes: Object.freeze([...grantedScopes]),
    accessTokenExpiresAt: facts.accessTokenExpiresAt,
    refreshTokenExpiresAt: facts.refreshTokenExpiresAt,
    capabilityStatus: facts.optionalCapabilitiesComplete === false ? "limited" : "ready"
  }));
  return assessment;
}

function applyAssessment(lifecycle, assessment) {
  return createLifecycle({
    state: assessment.capabilityStatus === "ready" ? "authorized_ready" : "authorized_limited",
    revision: lifecycle.revision + 1,
    requiredScopes: assessment.requiredScopes,
    grantedScopes: assessment.grantedScopes,
    accessTokenExpiresAt: assessment.accessTokenExpiresAt,
    refreshTokenExpiresAt: assessment.refreshTokenExpiresAt
  });
}

function reduceScopes(lifecycle, facts) {
  if (!exactKeys(facts, ["grantedScopes", "optionalCapabilitiesComplete", "now"]) || !validUnixTimestamp(facts.now)) {
    fail("invalid_affiliate_creator_authorization_facts");
  }
  if (facts.optionalCapabilitiesComplete !== undefined && typeof facts.optionalCapabilitiesComplete !== "boolean") {
    fail("invalid_affiliate_creator_authorization_facts");
  }
  const grantedScopes = normalizeScopes(facts.grantedScopes, "invalid_affiliate_creator_authorization_facts");
  const missingScopes = missingRequiredScopes(lifecycle.requiredScopes, grantedScopes);
  if (missingScopes.length > 0) {
    return emptyLifecycle("reauthorization_required", lifecycle.revision + 1, lifecycle.requiredScopes);
  }
  return createLifecycle({
    state: facts.optionalCapabilitiesComplete === false ? "authorized_limited" : "authorized_ready",
    revision: lifecycle.revision + 1,
    requiredScopes: lifecycle.requiredScopes,
    grantedScopes,
    accessTokenExpiresAt: lifecycle.accessTokenExpiresAt,
    refreshTokenExpiresAt: lifecycle.refreshTokenExpiresAt
  });
}

function transitionAffiliateCreatorAuthorizationLifecycle(lifecycle, event, facts) {
  validateLifecycle(lifecycle);
  if (typeof event !== "string" || !AFFILIATE_CREATOR_AUTHORIZATION_EVENTS.includes(event)) {
    fail("invalid_affiliate_creator_authorization_event");
  }

  const transition = `${lifecycle.state}:${event}`;
  if (transition === "not_authorized:authorization_started") {
    requireEmptyFacts(facts);
    return emptyLifecycle("authorization_pending", lifecycle.revision + 1, lifecycle.requiredScopes);
  }
  if (transition === "authorization_pending:callback_accepted") {
    requireEmptyFacts(facts);
    return emptyLifecycle("callback_received", lifecycle.revision + 1, lifecycle.requiredScopes);
  }
  if (transition === "authorization_pending:authorization_restarted") {
    requireEmptyFacts(facts);
    return emptyLifecycle("authorization_pending", lifecycle.revision + 1, lifecycle.requiredScopes);
  }
  if ((lifecycle.state === "callback_received" || lifecycle.state === "authorized_limited") && event === "token_validated") {
    return applyAssessment(lifecycle, assessAffiliateCreatorTokenFacts(facts));
  }
  if (lifecycle.state === "refresh_required" && event === "refresh_succeeded") {
    try {
      return applyAssessment(lifecycle, assessAffiliateCreatorTokenFacts(facts));
    } catch (error) {
      if (error instanceof AffiliateCreatorAuthorizationLifecycleError
        && ["creator_scope_required", "creator_token_expired", "creator_identity_required"].includes(error.code)) {
        return emptyLifecycle("reauthorization_required", lifecycle.revision + 1, lifecycle.requiredScopes);
      }
      throw error;
    }
  }
  if ((lifecycle.state === "authorized_limited" || lifecycle.state === "authorized_ready") && event === "scopes_reduced") {
    return reduceScopes(lifecycle, facts);
  }
  if ((lifecycle.state === "authorized_limited" || lifecycle.state === "authorized_ready") && (event === "token_expiring" || event === "token_expired")) {
    const now = requireNow(facts);
    if (event === "token_expiring" && now >= lifecycle.accessTokenExpiresAt) fail("creator_token_expired");
    if (event === "token_expired" && now < lifecycle.accessTokenExpiresAt) fail("invalid_affiliate_creator_authorization_transition");
    return createLifecycle({
      state: "refresh_required",
      revision: lifecycle.revision + 1,
      requiredScopes: lifecycle.requiredScopes,
      grantedScopes: lifecycle.grantedScopes,
      accessTokenExpiresAt: lifecycle.accessTokenExpiresAt,
      refreshTokenExpiresAt: lifecycle.refreshTokenExpiresAt
    });
  }
  if (lifecycle.state === "refresh_required" && event === "refresh_failed") {
    requireEmptyFacts(facts);
    return emptyLifecycle("reauthorization_required", lifecycle.revision + 1, lifecycle.requiredScopes);
  }
  if (["authorized_limited", "authorized_ready", "reauthorization_required", "deauthorized"].includes(lifecycle.state) && event === "authorization_restarted") {
    requireEmptyFacts(facts);
    return emptyLifecycle("authorization_pending", lifecycle.revision + 1, lifecycle.requiredScopes);
  }
  if (event === "all_access_removed" && lifecycle.state !== "not_authorized") {
    requireEmptyFacts(facts);
    if (lifecycle.state === "deauthorized") return lifecycle;
    return emptyLifecycle("deauthorized", lifecycle.revision + 1, lifecycle.requiredScopes);
  }
  fail("invalid_affiliate_creator_authorization_transition");
}

function createAffiliateCreatorAuthorizationLifecycle(facts) {
  if (facts === undefined) return emptyLifecycle("not_authorized", 0);
  if (!exactKeys(facts, ["requiredScopes"])) fail("invalid_affiliate_creator_authorization_facts");
  return emptyLifecycle("not_authorized", 0, normalizeRequiredScopes(facts.requiredScopes));
}

module.exports = {
  AffiliateCreatorAuthorizationLifecycleError,
  AFFILIATE_CREATOR_AUTHORIZATION_STATES,
  AFFILIATE_CREATOR_AUTHORIZATION_EVENTS,
  createAffiliateCreatorAuthorizationLifecycle,
  transitionAffiliateCreatorAuthorizationLifecycle,
  assessAffiliateCreatorTokenFacts
};
