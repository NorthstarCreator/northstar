const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  DISPLAY_BINDING_PROVIDER,
  CALCULATED_ACCOUNT_ALIASES,
  SessionCreatorAccountAuthorizationError,
  resolveSessionCreatorAccountAuthorization,
  getAuthorizedCreatorAccountId
} = require("../lib/session-creator-account-authorization");

const ACCOUNT_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_ACCOUNT_ID = "00000000-0000-4000-8000-000000000002";
const DISPLAY_IDENTITY = "display-identity-sensitive-value";

function facts(overrides = {}) {
  return {
    session: { id: "server-session-sensitive-value", expired: false },
    displayConnection: {
      displayIdentity: DISPLAY_IDENTITY,
      bindingProvider: DISPLAY_BINDING_PROVIDER,
      disconnectedAt: null
    },
    bindingCandidates: [{
      creatorAccountId: ACCOUNT_ID,
      displayIdentity: DISPLAY_IDENTITY,
      bindingProvider: DISPLAY_BINDING_PROVIDER,
      connectionDisconnectedAt: null,
      accountStatus: "active",
      accountSlug: "creator-one"
    }],
    expectedBindingProvider: DISPLAY_BINDING_PROVIDER,
    ...overrides
  };
}

function errorCode(code) {
  return (error) => error instanceof SessionCreatorAccountAuthorizationError
    && error.code === code
    && error.message === code;
}

function testSessionAndConnectionRequirements() {
  for (const session of [null, [], {}, { id: "" }, { id: "session", expired: true }]) {
    assert.throws(() => resolveSessionCreatorAccountAuthorization(facts({ session })), errorCode("session_required"));
  }
  for (const displayConnection of [null, [], {}, { displayIdentity: "" }]) {
    assert.throws(
      () => resolveSessionCreatorAccountAuthorization(facts({ displayConnection })),
      errorCode("authenticated_account_required")
    );
  }
}

function testExactlyOneBindingRequired() {
  assert.throws(
    () => resolveSessionCreatorAccountAuthorization(facts({ bindingCandidates: [] })),
    errorCode("account_not_found")
  );
  const candidate = facts().bindingCandidates[0];
  assert.throws(
    () => resolveSessionCreatorAccountAuthorization(facts({ bindingCandidates: [candidate, { ...candidate }] })),
    errorCode("ambiguous_account_binding")
  );
}

function testAvailabilityAndProviderBoundaries() {
  const candidate = facts().bindingCandidates[0];
  for (const accountStatus of ["disconnected", "archived", "pending", ""] ) {
    assert.throws(
      () => resolveSessionCreatorAccountAuthorization(facts({
        bindingCandidates: [{ ...candidate, accountStatus }]
      })),
      errorCode("account_unavailable")
    );
  }
  assert.throws(
    () => resolveSessionCreatorAccountAuthorization(facts({
      displayConnection: { ...facts().displayConnection, disconnectedAt: "2026-08-05T00:00:00Z" }
    })),
    errorCode("account_unavailable")
  );
  assert.throws(
    () => resolveSessionCreatorAccountAuthorization(facts({
      bindingCandidates: [{ ...candidate, connectionDisconnectedAt: "2026-08-05T00:00:00Z" }]
    })),
    errorCode("account_unavailable")
  );
  assert.throws(
    () => resolveSessionCreatorAccountAuthorization(facts({ expectedBindingProvider: "other-provider" })),
    errorCode("provider_mismatch")
  );
  assert.throws(
    () => resolveSessionCreatorAccountAuthorization(facts({
      bindingCandidates: [{ ...candidate, bindingProvider: "other-provider" }]
    })),
    errorCode("provider_mismatch")
  );
}

function testCalculatedAndCrossAccountRejection() {
  const candidate = facts().bindingCandidates[0];
  assert.deepEqual(CALCULATED_ACCOUNT_ALIASES, [
    "all", "all-accounts", "all_accounts", "all accounts", "allaccounts"
  ]);
  for (const alias of CALCULATED_ACCOUNT_ALIASES) {
    assert.throws(
      () => resolveSessionCreatorAccountAuthorization(facts({ callerSelection: alias })),
      errorCode("calculated_account_not_allowed")
    );
    assert.throws(
      () => resolveSessionCreatorAccountAuthorization(facts({
        bindingCandidates: [{ ...candidate, accountSlug: alias }]
      })),
      errorCode("calculated_account_not_allowed")
    );
  }
  assert.throws(
    () => resolveSessionCreatorAccountAuthorization(facts({ callerSelection: OTHER_ACCOUNT_ID })),
    errorCode("cross_account_request_rejected")
  );
  assert.throws(
    () => resolveSessionCreatorAccountAuthorization(facts({
      callerSelection: ACCOUNT_ID,
      bindingCandidates: []
    })),
    errorCode("account_not_found")
  );
  assert.throws(
    () => resolveSessionCreatorAccountAuthorization(facts({ callerSelection: "dashboard-account-slug" })),
    errorCode("cross_account_request_rejected")
  );
  assert.throws(
    () => resolveSessionCreatorAccountAuthorization(facts({
      bindingCandidates: [{ ...candidate, displayIdentity: "different-sensitive-identity" }]
    })),
    errorCode("cross_account_request_rejected")
  );
}

function testOpaqueImmutableAuthorizationContext() {
  const context = resolveSessionCreatorAccountAuthorization(facts({ callerSelection: ACCOUNT_ID }));
  assert.equal(Object.isFrozen(context), true);
  assert.deepEqual(Object.keys(context), []);
  assert.equal(JSON.stringify(context), "{}");
  assert.equal(JSON.stringify(context).includes(ACCOUNT_ID), false);
  assert.equal(JSON.stringify(context).includes(DISPLAY_IDENTITY), false);
  assert.equal(JSON.stringify(context).includes(DISPLAY_BINDING_PROVIDER), false);
  assert.equal(getAuthorizedCreatorAccountId(context), ACCOUNT_ID);
  assert.throws(() => getAuthorizedCreatorAccountId({}), errorCode("cross_account_request_rejected"));
  assert.throws(
    () => getAuthorizedCreatorAccountId(Object.freeze(Object.create(null))),
    errorCode("cross_account_request_rejected")
  );
}

function testControlledErrorsContainNoSensitiveFacts() {
  const sensitiveValues = [ACCOUNT_ID, OTHER_ACCOUNT_ID, DISPLAY_IDENTITY, DISPLAY_BINDING_PROVIDER, "server-session-sensitive-value"];
  const attempts = [
    () => resolveSessionCreatorAccountAuthorization(facts({ callerSelection: OTHER_ACCOUNT_ID })),
    () => resolveSessionCreatorAccountAuthorization(facts({ bindingCandidates: [] })),
    () => resolveSessionCreatorAccountAuthorization(facts({ expectedBindingProvider: "other-provider" }))
  ];
  for (const attempt of attempts) {
    let error;
    try { attempt(); } catch (caught) { error = caught; }
    assert.ok(error instanceof SessionCreatorAccountAuthorizationError);
    const serialized = JSON.stringify({ name: error.name, code: error.code, message: error.message });
    for (const value of sensitiveValues) assert.equal(serialized.includes(value), false);
  }
}

function testStaticPurityAndRouteIsolation() {
  const root = path.join(__dirname, "..");
  const moduleName = "session-creator-account-authorization";
  const source = fs.readFileSync(path.join(root, `lib/${moduleName}.js`), "utf8");
  assert.doesNotMatch(source, /\b(?:SELECT|INSERT|UPDATE|DELETE|UPSERT|MERGE|TRUNCATE|ALTER|CREATE|DROP|GRANT|REVOKE|CALL|DO)\b/);
  assert.doesNotMatch(source, /https?:\/\/|\bfetch\s*\(|axios|redis|upstash|oauth|access_token|refresh_token|authorization_code|app_secret/i);
  assert.doesNotMatch(source, /process\.env|process\s*\[\s*["']env|2025-10-01|connected_tiktok_accounts|creator_accounts|sync_runs|videos/i);
  assert.doesNotMatch(source, /require\s*\(/);

  const apiRoot = path.join(root, "api");
  const routeFiles = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (entry.name.endsWith(".js")) routeFiles.push(target);
    }
  };
  visit(apiRoot);
  const routes = routeFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");
  assert.equal(routes.includes(moduleName), false);
}

testSessionAndConnectionRequirements();
testExactlyOneBindingRequired();
testAvailabilityAndProviderBoundaries();
testCalculatedAndCrossAccountRejection();
testOpaqueImmutableAuthorizationContext();
testControlledErrorsContainNoSensitiveFacts();
testStaticPurityAndRouteIsolation();
console.log("Session-to-creator-account authorization resolver tests passed.");
