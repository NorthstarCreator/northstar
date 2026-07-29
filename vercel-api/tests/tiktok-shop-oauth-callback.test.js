const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
process.env.NORTHSTAR_ENV = "tiktok_sandbox";
const handler = require("../api/auth/tiktok-shop/callback");
const { COOKIE_NAME } = require("../lib/session");
const {
  issueTikTokShopOAuthState,
  consumeTikTokShopOAuthState,
  clearTikTokShopOAuthStatesForTests
} = require("../lib/tiktok-shop-oauth-state");

const ACCOUNT_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_ACCOUNT_ID = "00000000-0000-4000-8000-000000000002";
const SESSION_ID = "sandbox_session_0123456789abcdef0123456789abcdef";
const OTHER_SESSION_ID = "sandbox_session_fedcba9876543210fedcba9876543210";
const NOW = Date.now();

function responseDouble() {
  return {
    headers: {},
    statusCode: 200,
    setHeader(name, value) { this.headers[name] = value; },
    end(body = "") { this.body = body; }
  };
}

function request(method, query, sessionId = SESSION_ID) {
  return {
    method,
    url: `/auth/tiktok-shop/callback${query}`,
    headers: { cookie: `${COOKIE_NAME}=${encodeURIComponent(sessionId)}` }
  };
}

async function call(method, query, sessionId) {
  const res = responseDouble();
  await handler(request(method, query, sessionId), res);
  return { res, payload: JSON.parse(res.body) };
}

function issue(overrides = {}) {
  return issueTikTokShopOAuthState({
    creatorAccountId: ACCOUNT_ID,
    sessionId: SESSION_ID,
    now: NOW,
    ...overrides
  });
}

async function testRoutingAndMethodRestriction() {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, "../vercel.json"), "utf8"));
  assert.deepEqual(
    config.rewrites.filter((route) => route.source.includes("tiktok-shop")),
    [{ source: "/auth/tiktok-shop/callback", destination: "/api/auth/tiktok-shop/callback" }]
  );
  const { res, payload } = await call("POST", "");
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, "GET");
  assert.equal(payload.status, "method_not_allowed");
}

async function testSandboxOnlyGuard() {
  const originalEnvironment = process.env.NORTHSTAR_ENV;
  process.env.NORTHSTAR_ENV = "production";
  const state = issue();
  const { res, payload } = await call("GET", `?code=value&state=${state}`);
  process.env.NORTHSTAR_ENV = originalEnvironment;
  assert.equal(res.statusCode, 404);
  assert.equal(payload.status, "sandbox_callback_unavailable");
}

async function testValidStateDoesNotExchangeOrConnect() {
  const state = issue();
  const authorizationCode = "temporary-code-must-never-appear";
  const { res, payload } = await call("GET", `?code=${authorizationCode}&state=${state}`);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(payload, {
    source: "tiktok_shop",
    status: "authorization_code_received_token_exchange_blocked",
    connectionCreated: false,
    tokenExchangeAttempted: false
  });
  assert.equal(res.body.includes(authorizationCode), false);
  assert.equal(res.body.includes(state), false);
}

async function testInvalidExpiredMismatchedAndReplayState() {
  assert.equal((await call("GET", "?code=value")).payload.status, "invalid_state");
  assert.equal((await call("GET", "?code=value&state=not-valid")).payload.status, "invalid_state");

  const expired = issue({ now: NOW - 20_000, ttlMs: 1 });
  assert.equal((await call("GET", `?code=value&state=${expired}`)).payload.status, "expired_state");

  const wrongSession = issue();
  assert.equal((await call("GET", `?code=value&state=${wrongSession}`, OTHER_SESSION_ID)).payload.status, "invalid_state");

  const wrongAccount = issue();
  assert.throws(
    () => consumeTikTokShopOAuthState(wrongAccount, {
      sessionId: SESSION_ID,
      creatorAccountId: OTHER_ACCOUNT_ID,
      now: NOW
    }),
    { code: "mismatched_account_state" }
  );

  const replay = issue();
  assert.equal((await call("GET", `?code=value&state=${replay}`)).res.statusCode, 200);
  assert.equal((await call("GET", `?code=value&state=${replay}`)).payload.status, "invalid_state");
}

async function testCalculatedAccountsRejected() {
  for (const creatorAccountId of ["all", "all-accounts", "all_accounts", "All Accounts"] ) {
    assert.throws(() => issue({ creatorAccountId }), { code: "exact_account_required" });
  }
}

async function testDenialProviderErrorsAndSecretRedaction() {
  const deniedState = issue();
  const denied = await call("GET", `?code=null&error=auth_denied&state=${deniedState}`);
  assert.equal(denied.payload.status, "authorization_denied");

  const accessDeniedState = issue();
  assert.equal(
    (await call("GET", `?code=null&error=access_denied&state=${accessDeniedState}`)).payload.status,
    "authorization_denied"
  );

  const errorState = issue();
  const providerError = "provider-detail-must-never-appear";
  const failed = await call("GET", `?error=${providerError}&state=${errorState}`);
  assert.equal(failed.payload.status, "provider_error");
  assert.equal(failed.res.body.includes(providerError), false);
  assert.equal(failed.res.body.includes(errorState), false);

  const missingCodeState = issue();
  assert.equal(
    (await call("GET", `?state=${missingCodeState}`)).payload.status,
    "missing_authorization_code"
  );

  const duplicateState = issue();
  assert.equal(
    (await call("GET", `?code=one&code=two&state=${duplicateState}`)).payload.status,
    "invalid_callback_parameters"
  );

  const emptyErrorState = issue();
  assert.equal(
    (await call("GET", `?code=value&error=&state=${emptyErrorState}`)).payload.status,
    "provider_error"
  );
}

async function testNoNetworkPersistenceOrCredentialPaths() {
  const root = path.join(__dirname, "..");
  const source = [
    "api/auth/tiktok-shop/callback.js",
    "lib/tiktok-shop-oauth-state.js"
  ].map((file) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
  assert.doesNotMatch(source, /fetch\(|axios|https\.request|http\.request|open-api|auth\.tiktok/i);
  assert.doesNotMatch(source, /\b(?:INSERT\s+INTO|UPDATE\s+[a-z_]|DELETE\s+FROM|UPSERT\s+INTO|MERGE\s+INTO|TRUNCATE\s+TABLE)\b/i);
  assert.doesNotMatch(source, /app.?key|app.?secret|access.?token|refresh.?token|authorizationUrl|signed.?url/i);
  assert.doesNotMatch(source, /token-store|storeSession|storeOAuthState|storeEncryptedConnection|withDatabase|sql`/i);
}

(async () => {
  clearTikTokShopOAuthStatesForTests();
  await testRoutingAndMethodRestriction();
  await testSandboxOnlyGuard();
  await testValidStateDoesNotExchangeOrConnect();
  await testInvalidExpiredMismatchedAndReplayState();
  await testCalculatedAccountsRejected();
  await testDenialProviderErrorsAndSecretRedaction();
  await testNoNetworkPersistenceOrCredentialPaths();
  clearTikTokShopOAuthStatesForTests();
  console.log("TikTok Shop OAuth callback tests passed.");
})().catch((error) => {
  clearTikTokShopOAuthStatesForTests();
  console.error(error);
  process.exitCode = 1;
});
