const assert = require("node:assert/strict");
process.env.NORTHSTAR_ENV = "tiktok_sandbox";
process.env.TIKTOK_SHOP_CREATOR_AUTH_ENABLED = "true";
const { createHandler } = require("../api/auth/tiktok-shop/callback");
const { TikTokShopOAuthStateError } = require("../lib/tiktok-shop-oauth-state");

const SESSION_ID = "sandbox_session_0123456789abcdef0123456789abcdef";
const STATE = "abcdefghijklmnopqrstuvwxyz123456";

function responseDouble() {
  return {
    headers: {}, statusCode: 200,
    setHeader(name, value) { this.headers[name] = value; },
    end(body = "") { this.body = body; }
  };
}

async function call(handler, method, query) {
  const req = { method, url: `/auth/tiktok-shop/callback${query}`, headers: {} };
  const res = responseDouble();
  await handler(req, res);
  return { res, payload: JSON.parse(res.body) };
}

function validHandler(overrides = {}) {
  return createHandler({
    authorizationEnabled: () => true,
    requireSession: async () => ({ id: SESSION_ID }),
    consumeTikTokShopOAuthState: async () => ({ creatorAccountId: "00000000-0000-4000-8000-000000000001" }),
    ...overrides
  });
}

async function testDisabledSandboxMethodAndSessionGuards() {
  let touched = false;
  delete process.env.TIKTOK_SHOP_CREATOR_AUTH_ENABLED;
  const disabled = await call(validHandler({
    authorizationEnabled: undefined,
    requireSession: async () => { touched = true; }
  }), "GET", `?state=${STATE}&code=value`);
  process.env.TIKTOK_SHOP_CREATOR_AUTH_ENABLED = "true";
  assert.equal(disabled.res.statusCode, 404);
  assert.equal(disabled.payload.status, "authorization_disabled");
  assert.equal(touched, false);

  process.env.NORTHSTAR_ENV = "production";
  const production = await call(validHandler(), "GET", `?state=${STATE}&code=value`);
  process.env.NORTHSTAR_ENV = "tiktok_sandbox";
  assert.equal(production.res.statusCode, 404);
  assert.equal(production.payload.status, "sandbox_callback_unavailable");

  const method = await call(validHandler(), "POST", "");
  assert.equal(method.res.statusCode, 405);
  assert.equal(method.res.headers.Allow, "GET");

  const noSession = await call(validHandler({ requireSession: async () => null }), "GET", `?state=${STATE}&code=value`);
  assert.equal(noSession.res.statusCode, 401);
  assert.equal(noSession.payload.status, "session_required");
}

async function testValidStateIsTerminalAndRedacted() {
  let consumedWith;
  const handler = validHandler({
    consumeTikTokShopOAuthState: async (state, options) => {
      consumedWith = { state, options };
      return { creatorAccountId: "00000000-0000-4000-8000-000000000001" };
    }
  });
  const authorizationCode = "temporary-code-must-never-appear";
  const { res, payload } = await call(handler, "GET", `?code=${authorizationCode}&state=${STATE}`);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(consumedWith, { state: STATE, options: { sessionId: SESSION_ID } });
  assert.deepEqual(payload, {
    source: "tiktok_shop",
    status: "callback_received_token_exchange_blocked",
    connectionCreated: false,
    tokenExchangeAttempted: false
  });
  assert.equal(res.body.includes(authorizationCode), false);
  assert.equal(res.body.includes(STATE), false);
}

async function testStateFailuresAndUnavailableStore() {
  for (const query of ["?code=value", `?state=&code=value`, `?state=${STATE}&state=${STATE}&code=value`]) {
    assert.equal((await call(validHandler(), "GET", query)).payload.status, "invalid_state");
  }
  for (const [code, expected] of [
    ["invalid_or_replayed_state", "invalid_state"],
    ["invalid_state_record", "invalid_state"],
    ["mismatched_session_state", "invalid_state"],
    ["expired_state", "expired_state"]
  ]) {
    const handler = validHandler({
      consumeTikTokShopOAuthState: async () => { throw new TikTokShopOAuthStateError(code); }
    });
    assert.equal((await call(handler, "GET", `?state=${STATE}&code=value`)).payload.status, expected);
  }
  const unavailable = validHandler({
    consumeTikTokShopOAuthState: async () => { throw new Error("redis unavailable"); }
  });
  const result = await call(unavailable, "GET", `?state=${STATE}&code=value`);
  assert.equal(result.res.statusCode, 503);
  assert.equal(result.payload.status, "state_validation_unavailable");
}

async function testDenialProviderErrorsAndParameterAmbiguity() {
  let consumptionCount = 0;
  const handler = validHandler({
    consumeTikTokShopOAuthState: async () => { consumptionCount += 1; }
  });
  assert.equal((await call(handler, "GET", `?code=null&error=auth_denied&state=${STATE}`)).payload.status, "authorization_denied");
  assert.equal((await call(handler, "GET", `?code=null&error=access_denied&state=${STATE}`)).payload.status, "authorization_denied");
  const detail = "provider-detail-must-never-appear";
  const provider = await call(handler, "GET", `?error=${detail}&state=${STATE}`);
  assert.equal(provider.payload.status, "provider_error");
  assert.equal(provider.res.body.includes(detail), false);
  assert.equal((await call(handler, "GET", `?code=one&code=two&state=${STATE}`)).payload.status, "invalid_callback_parameters");
  assert.equal((await call(handler, "GET", `?state=${STATE}`)).payload.status, "missing_callback_code");
  assert.equal(consumptionCount, 5);
}

(async () => {
  await testDisabledSandboxMethodAndSessionGuards();
  await testValidStateIsTerminalAndRedacted();
  await testStateFailuresAndUnavailableStore();
  await testDenialProviderErrorsAndParameterAmbiguity();
  console.log("TikTok Shop OAuth callback tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
