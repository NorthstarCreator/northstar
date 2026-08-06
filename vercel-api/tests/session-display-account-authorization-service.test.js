const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  DISPLAY_BINDING_PROVIDER,
  MAX_DISPLAY_IDENTITY_LENGTH
} = require("../lib/session-display-account-binding-repository");
const {
  SessionCreatorAccountAuthorizationError,
  getAuthorizedCreatorAccountId
} = require("../lib/session-creator-account-authorization");
const {
  authorizeSessionDisplayCreatorAccount
} = require("../lib/session-display-account-authorization-service");

const ACCOUNT_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_ACCOUNT_ID = "00000000-0000-4000-8000-000000000002";
const DISPLAY_IDENTITY = "private-display-identity";

function facts(overrides = {}) {
  return {
    query: async () => [{
      creator_account_id: ACCOUNT_ID,
      display_identity: DISPLAY_IDENTITY,
      binding_provider: DISPLAY_BINDING_PROVIDER,
      connection_disconnected_at: null,
      account_status: "active",
      account_slug: "creator-one"
    }],
    session: { id: "private-server-session", expired: false },
    displayConnection: {
      displayIdentity: DISPLAY_IDENTITY,
      bindingProvider: DISPLAY_BINDING_PROVIDER,
      disconnectedAt: null
    },
    ...overrides
  };
}

function errorCode(code) {
  return (error) => error instanceof SessionCreatorAccountAuthorizationError
    && error.code === code && error.message === code;
}

async function testTrustedFactsFailBeforeQuery() {
  for (const session of [null, [], {}, { id: "" }, { id: "session", expired: true }]) {
    let calls = 0;
    await assert.rejects(
      authorizeSessionDisplayCreatorAccount(facts({ session, query: async () => { calls += 1; return []; } })),
      errorCode("session_required")
    );
    assert.equal(calls, 0);
  }
  for (const displayConnection of [null, [], {}, { displayIdentity: "" }]) {
    let calls = 0;
    await assert.rejects(
      authorizeSessionDisplayCreatorAccount(facts({
        displayConnection,
        query: async () => { calls += 1; return []; }
      })),
      errorCode("authenticated_account_required")
    );
    assert.equal(calls, 0);
  }
  for (const [displayConnection, code] of [
    [{ ...facts().displayConnection, bindingProvider: "other-provider" }, "provider_mismatch"],
    [{ ...facts().displayConnection, disconnectedAt: "2026-08-06T00:00:00Z" }, "account_unavailable"]
  ]) {
    let calls = 0;
    await assert.rejects(
      authorizeSessionDisplayCreatorAccount(facts({
        displayConnection,
        query: async () => { calls += 1; return []; }
      })),
      errorCode(code)
    );
    assert.equal(calls, 0);
  }
}

async function testCallerControlledInputsAreRejected() {
  for (const forbidden of [
    { creatorAccountId: ACCOUNT_ID },
    { callerSelection: ACCOUNT_ID },
    { dashboardSelection: "all" },
    { affiliateIdentity: "private-affiliate-identity" },
    { token: "private-token" },
    { scope: "private-scope" },
    { req: {} },
    { res: {} }
  ]) {
    let calls = 0;
    await assert.rejects(
      authorizeSessionDisplayCreatorAccount(facts({
        ...forbidden,
        query: async () => { calls += 1; return []; }
      })),
      errorCode("invalid_authorization_input")
    );
    assert.equal(calls, 0);
  }
}

async function testRepositoryCalledOnceAndOpaqueContextReturned() {
  let calls = 0;
  let capturedValues;
  const query = async (strings, ...values) => {
    calls += 1;
    capturedValues = values;
    return [{
      creator_account_id: ACCOUNT_ID,
      display_identity: DISPLAY_IDENTITY,
      binding_provider: DISPLAY_BINDING_PROVIDER,
      connection_disconnected_at: null,
      account_status: "active",
      account_slug: "creator-one"
    }];
  };
  const context = await authorizeSessionDisplayCreatorAccount(facts({ query }));
  assert.equal(calls, 1);
  assert.deepEqual(capturedValues, [DISPLAY_IDENTITY]);
  assert.equal(Object.isFrozen(context), true);
  assert.deepEqual(Object.keys(context), []);
  assert.equal(JSON.stringify(context), "{}");
  assert.equal(getAuthorizedCreatorAccountId(context), ACCOUNT_ID);
}

async function testResolverDecisionsRemainControlled() {
  const scenarios = [
    [[], "account_not_found"],
    [[
      {
        creator_account_id: ACCOUNT_ID,
        display_identity: DISPLAY_IDENTITY,
        binding_provider: DISPLAY_BINDING_PROVIDER,
        connection_disconnected_at: null,
        account_status: "active",
        account_slug: "creator-one"
      },
      {
        creator_account_id: OTHER_ACCOUNT_ID,
        display_identity: DISPLAY_IDENTITY,
        binding_provider: DISPLAY_BINDING_PROVIDER,
        connection_disconnected_at: null,
        account_status: "active",
        account_slug: "creator-two"
      }
    ], "ambiguous_account_binding"],
    [[{
      creator_account_id: ACCOUNT_ID,
      display_identity: DISPLAY_IDENTITY,
      binding_provider: DISPLAY_BINDING_PROVIDER,
      connection_disconnected_at: "2026-08-06T00:00:00Z",
      account_status: "active",
      account_slug: "creator-one"
    }], "account_unavailable"],
    [[{
      creator_account_id: ACCOUNT_ID,
      display_identity: DISPLAY_IDENTITY,
      binding_provider: DISPLAY_BINDING_PROVIDER,
      connection_disconnected_at: null,
      account_status: "archived",
      account_slug: "creator-one"
    }], "account_unavailable"],
    [[{
      creator_account_id: ACCOUNT_ID,
      display_identity: DISPLAY_IDENTITY,
      binding_provider: DISPLAY_BINDING_PROVIDER,
      connection_disconnected_at: null,
      account_status: "active",
      account_slug: "all accounts"
    }], "calculated_account_not_allowed"]
  ];
  for (const [rows, code] of scenarios) {
    await assert.rejects(
      authorizeSessionDisplayCreatorAccount(facts({ query: async () => rows })),
      errorCode(code)
    );
  }
}

async function testRepositoryErrorsAreContained() {
  const attempts = [
    facts({ query: null }),
    facts({ query: async () => { throw new Error("private database detail"); } }),
    facts({ displayConnection: { ...facts().displayConnection, displayIdentity: "x".repeat(MAX_DISPLAY_IDENTITY_LENGTH + 1) } }),
    facts({ query: async () => ({ private: "raw result" }) })
  ];
  for (const input of attempts) {
    let error;
    try { await authorizeSessionDisplayCreatorAccount(input); } catch (caught) { error = caught; }
    assert.ok(error instanceof SessionCreatorAccountAuthorizationError);
    assert.equal(error.code, "account_binding_unavailable");
    assert.equal(error.message, "account_binding_unavailable");
    const serialized = JSON.stringify(error);
    for (const secret of [ACCOUNT_ID, DISPLAY_IDENTITY, DISPLAY_BINDING_PROVIDER, "private database detail", "raw result"]) {
      assert.equal(serialized.includes(secret), false);
    }
    assert.equal("cause" in error, false);
  }
}

function testStaticPurityAndDormancy() {
  const root = path.join(__dirname, "..");
  const moduleName = "session-display-account-authorization-service";
  const source = fs.readFileSync(path.join(root, `lib/${moduleName}.js`), "utf8");
  assert.doesNotMatch(source, /withDatabase|process\.env|https?:\/\/|fetch\s*\(|axios|redis|upstash|oauth|token|credential|cache|logger|console\.|serialize|2025-10-01/i);
  assert.doesNotMatch(source, /\b(?:SELECT|INSERT|UPDATE|DELETE|UPSERT|MERGE|TRUNCATE|ALTER|CREATE|DROP|GRANT|REVOKE|CALL|DO)\b/);
  assert.doesNotMatch(source, /creatorAccountId|callerSelection|dashboard|affiliate|scope|\breq\b|\bres\b/i);
  assert.equal((source.match(/readSessionDisplayAccountBindings\s*\(/g) || []).length, 1);
  assert.equal((source.match(/resolveSessionCreatorAccountAuthorization\s*\(/g) || []).length, 1);

  const imports = [];
  const ownFile = path.join(root, `lib/${moduleName}.js`);
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (entry.name.endsWith(".js") && target !== ownFile
        && fs.readFileSync(target, "utf8").includes(moduleName)) imports.push(target);
    }
  };
  [path.join(root, "api"), path.join(root, "lib"), path.join(root, "../dashboard")].forEach(visit);
  assert.deepEqual(imports, []);
}

(async () => {
  await testTrustedFactsFailBeforeQuery();
  await testCallerControlledInputsAreRejected();
  await testRepositoryCalledOnceAndOpaqueContextReturned();
  await testResolverDecisionsRemainControlled();
  await testRepositoryErrorsAreContained();
  testStaticPurityAndDormancy();
  console.log("Session Display account-authorization service tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
