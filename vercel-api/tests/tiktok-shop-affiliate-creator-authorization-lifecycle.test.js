"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  AffiliateCreatorAuthorizationLifecycleError,
  AFFILIATE_CREATOR_AUTHORIZATION_STATES: STATES,
  AFFILIATE_CREATOR_AUTHORIZATION_EVENTS: EVENTS,
  createAffiliateCreatorAuthorizationLifecycle: create,
  transitionAffiliateCreatorAuthorizationLifecycle: transition,
  assessAffiliateCreatorTokenFacts: assess
} = require("../lib/tiktok-shop-affiliate-creator-authorization-lifecycle");
const { CREATOR_AUTHORIZATION_CONTRACT } = require("../lib/tiktok-shop-affiliate-creator-authorization-contract");
const { CAPABILITY_REGISTRY } = require("../lib/tiktok-shop-affiliate-creator-capability-registry");

const NOW = 1760000000;
const SCOPE = "creator.affiliate.info";
function assertCode(action, expected) {
  assert.throws(action, (error) => {
    assert.ok(error instanceof AffiliateCreatorAuthorizationLifecycleError);
    assert.equal(error.code, expected);
    assert.equal(error.message, expected);
    assert.deepEqual(Object.keys(error).sort(), ["code", "name"]);
    return true;
  });
}
function tokenFacts(overrides = {}) {
  return { userType: 1, now: NOW, accessTokenExpiresAt: NOW + 30, refreshTokenExpiresAt: NOW + 60, grantedScopes: [SCOPE], ...overrides };
}
function pending() { return transition(create(), "authorization_started"); }
function callback() { return transition(pending(), "callback_accepted"); }
function ready() { return transition(callback(), "token_validated", tokenFacts()); }
function limited() { return transition(callback(), "token_validated", tokenFacts({ optionalCapabilitiesComplete: false })); }
function assertTransition(state, event, facts, expected) { assert.equal(transition(state, event, facts).state, expected); }

function testStaticCollectionsAndInitialState() {
  assert.deepEqual(STATES, ["not_authorized", "authorization_pending", "callback_received", "authorized_limited", "authorized_ready", "refresh_required", "reauthorization_required", "deauthorized"]);
  assert.deepEqual(EVENTS, ["authorization_started", "callback_accepted", "token_validated", "token_expiring", "token_expired", "refresh_succeeded", "refresh_failed", "scopes_reduced", "all_access_removed", "authorization_restarted"]);
  assert.ok(Object.isFrozen(STATES)); assert.ok(Object.isFrozen(EVENTS));
  const initial = create();
  assert.equal(initial.state, "not_authorized"); assert.equal(initial.revision, 0);
  assert.deepEqual(initial.requiredScopes, [SCOPE]); assert.deepEqual(initial.grantedScopes, []);
  assert.equal(Object.getPrototypeOf(initial), null); assert.ok(Object.isFrozen(initial));
  for (const value of [initial.requiredScopes, initial.grantedScopes, initial.missingRequiredScopes]) assert.ok(Object.isFrozen(value));
  assertCode(() => create({ extra: true }), "invalid_affiliate_creator_authorization_facts");
}

function testEveryAllowedTransition() {
  const initial = create();
  const started = transition(initial, "authorization_started");
  assert.equal(started.state, "authorization_pending"); assert.equal(started.revision, 1);
  assertTransition(started, "callback_accepted", undefined, "callback_received");
  assertTransition(started, "all_access_removed", undefined, "deauthorized");
  const restartedPending = transition(started, "authorization_restarted"); assert.equal(restartedPending.state, "authorization_pending"); assert.equal(restartedPending.revision, 2);
  const received = callback();
  assertTransition(received, "token_validated", tokenFacts(), "authorized_ready");
  assertTransition(received, "token_validated", tokenFacts({ optionalCapabilitiesComplete: false }), "authorized_limited");
  assertTransition(received, "all_access_removed", undefined, "deauthorized");
  const low = limited(); const high = ready();
  for (const lifecycle of [low, high]) {
    assertTransition(lifecycle, "token_expiring", { now: NOW + 1 }, "refresh_required");
    assertTransition(lifecycle, "token_expired", { now: NOW + 30 }, "refresh_required");
    assertTransition(lifecycle, "scopes_reduced", { grantedScopes: [SCOPE], optionalCapabilitiesComplete: false, now: NOW }, "authorized_limited");
    assertTransition(lifecycle, "scopes_reduced", { grantedScopes: [], optionalCapabilitiesComplete: false, now: NOW }, "reauthorization_required");
    assertTransition(lifecycle, "authorization_restarted", undefined, "authorization_pending");
    assertTransition(lifecycle, "all_access_removed", undefined, "deauthorized");
  }
  assertTransition(low, "token_validated", tokenFacts(), "authorized_ready");
  const refresh = transition(high, "token_expiring", { now: NOW + 1 });
  assertTransition(refresh, "refresh_succeeded", tokenFacts(), "authorized_ready");
  assertTransition(refresh, "refresh_succeeded", tokenFacts({ optionalCapabilitiesComplete: false }), "authorized_limited");
  assertTransition(refresh, "refresh_succeeded", tokenFacts({ grantedScopes: [] }), "reauthorization_required");
  assertTransition(refresh, "refresh_failed", undefined, "reauthorization_required");
  assertTransition(refresh, "all_access_removed", undefined, "deauthorized");
  const reauth = transition(high, "scopes_reduced", { grantedScopes: [], optionalCapabilitiesComplete: false, now: NOW });
  assertTransition(reauth, "authorization_restarted", undefined, "authorization_pending");
  assertTransition(reauth, "all_access_removed", undefined, "deauthorized");
  const removed = transition(high, "all_access_removed");
  assert.equal(transition(removed, "all_access_removed"), removed);
  assertTransition(removed, "authorization_restarted", undefined, "authorization_pending");
}

function testUnlistedTransitionMatrixRejects() {
  const representative = {
    not_authorized: create(), authorization_pending: pending(), callback_received: callback(),
    authorized_limited: limited(), authorized_ready: ready(),
    refresh_required: transition(ready(), "token_expiring", { now: NOW + 1 }),
    reauthorization_required: transition(ready(), "scopes_reduced", { grantedScopes: [], optionalCapabilitiesComplete: false, now: NOW }),
    deauthorized: transition(ready(), "all_access_removed")
  };
  const allowed = new Set([
    "not_authorized:authorization_started", "authorization_pending:callback_accepted", "authorization_pending:all_access_removed", "authorization_pending:authorization_restarted",
    "callback_received:token_validated", "callback_received:all_access_removed",
    "authorized_limited:token_expiring", "authorized_limited:token_expired", "authorized_limited:scopes_reduced", "authorized_limited:all_access_removed", "authorized_limited:authorization_restarted", "authorized_limited:token_validated",
    "authorized_ready:token_expiring", "authorized_ready:token_expired", "authorized_ready:scopes_reduced", "authorized_ready:all_access_removed", "authorized_ready:authorization_restarted",
    "refresh_required:refresh_succeeded", "refresh_required:refresh_failed", "refresh_required:all_access_removed",
    "reauthorization_required:authorization_restarted", "reauthorization_required:all_access_removed",
    "deauthorized:authorization_restarted", "deauthorized:all_access_removed"
  ]);
  for (const [state, lifecycle] of Object.entries(representative)) for (const event of EVENTS) {
    if (allowed.has(`${state}:${event}`)) continue;
    assertCode(() => transition(lifecycle, event), "invalid_affiliate_creator_authorization_transition");
  }
}

function testFactsAndPrivacy() {
  const normal = assess(tokenFacts({ grantedScopes: ["creator.showcase.read", SCOPE, SCOPE] }));
  assert.deepEqual(normal.grantedScopes, [SCOPE, "creator.showcase.read"]); assert.equal(normal.capabilityStatus, "ready");
  assert.ok(Object.isFrozen(normal)); assert.ok(Object.isFrozen(normal.grantedScopes));
  assert.throws(() => normal.grantedScopes.push(SCOPE));
  for (const userType of [0, 2, 3, 4, 5]) assertCode(() => assess(tokenFacts({ userType })), "creator_identity_required");
  assertCode(() => assess(tokenFacts({ grantedScopes: [] })), "creator_scope_required");
  assertCode(() => assess(tokenFacts({ grantedScopes: ["seller.order.info"] })), "invalid_affiliate_creator_authorization_facts");
  assertCode(() => assess(tokenFacts({ accessTokenExpiresAt: NOW })), "creator_token_expired");
  assertCode(() => assess(tokenFacts({ refreshTokenExpiresAt: NOW })), "creator_token_expired");
  assertCode(() => assess({ access_token: "x" }), "invalid_affiliate_creator_authorization_facts");
  assertCode(() => transition(ready(), "token_expiring", { now: NOW + 30 }), "creator_token_expired");
  assertCode(() => transition(ready(), "token_expired", { now: NOW + 1 }), "invalid_affiliate_creator_authorization_transition");
  assertCode(() => transition(ready(), "token_expiring", { now: NOW, extra: true }), "invalid_affiliate_creator_authorization_facts");
  assertCode(() => transition({}, "authorization_started"), "invalid_affiliate_creator_authorization_lifecycle");
  assertCode(() => transition(ready(), "unknown"), "invalid_affiliate_creator_authorization_event");
  const before = ready(); assertCode(() => transition(callback(), "token_validated", tokenFacts({ grantedScopes: [] })), "creator_scope_required"); assert.equal(before.state, "authorized_ready"); assert.equal(before.revision, 3);
  const revoked = transition(before, "all_access_removed"); assert.deepEqual(revoked.grantedScopes, []); assert.equal(revoked.accessTokenExpiresAt, null); assert.equal(revoked.refreshTokenExpiresAt, null);
  const restarted = transition(revoked, "authorization_restarted"); assert.deepEqual(restarted.grantedScopes, []); assert.equal(restarted.accessTokenExpiresAt, null); assert.equal(restarted.revision, revoked.revision + 1);
}

function testDormancyAndCompatibility() {
  assert.equal(CREATOR_AUTHORIZATION_CONTRACT.runtimeAllowed, false);
  for (const scope of CAPABILITY_REGISTRY) for (const endpoint of scope.endpoints) assert.equal(endpoint.runtimeAllowed, false);
  const root = path.join(__dirname, ".."); const name = "tiktok-shop-affiliate-creator-authorization-lifecycle"; const target = path.join(root, `lib/${name}.js`); const source = fs.readFileSync(target, "utf8");
  assert.doesNotMatch(source, /fetch\s*\(|axios|https?\.request|WebSocket|process\.env|withDatabase|cache|logger|console\.|retry|setTimeout|setInterval|\bsql`/i);
  assert.doesNotMatch(source, /\b(?:INSERT\s+INTO|UPDATE\s+[\w."]+\s+SET|DELETE\s+FROM|ALTER\s+TABLE|DROP\s+TABLE|GRANT\s+|REVOKE\s+|CALL\s+)\b/i);
  assert.doesNotMatch(source, /2025-10-01|sync_runs|videos|connected_tiktok_accounts|seller|partner|local_sellers|tiktok_display_api|tiktok_for_developers/i);
  const permittedDormantConsumers = new Set(["lib/tiktok-shop-affiliate-creator-authorization-persistence-contract.js"]);
  const consumers = []; for (const dir of [path.join(root, "api"), path.join(root, "lib")]) for (const item of fs.readdirSync(dir, { withFileTypes: true })) { const candidate = path.join(dir, item.name); if (item.name.endsWith(".js") && candidate !== target && fs.readFileSync(candidate, "utf8").includes(name)) consumers.push(path.relative(root, candidate)); } assert.deepEqual(consumers, [...permittedDormantConsumers]);
}

[testStaticCollectionsAndInitialState, testEveryAllowedTransition, testUnlistedTransitionMatrixRejects, testFactsAndPrivacy, testDormancyAndCompatibility].forEach(test => test());
console.log("TikTok Shop Affiliate Creator authorization lifecycle tests passed.");
