const assert = require("node:assert/strict");
const crypto = require("node:crypto");
process.env.NORTHSTAR_ENV = "tiktok_sandbox";
process.env.TIKTOK_SHOP_AFFILIATE_CREATOR_AUTH_ENABLED = "true";
const { createHandler } = require("../api/auth/tiktok-shop/affiliate-creator/callback");
const {
  consumeTikTokShopAffiliateCreatorOAuthState,
  TikTokShopAffiliateCreatorOAuthStateError
} = require("../lib/tiktok-shop-affiliate-creator-oauth-state");

const SESSION_ID = "sandbox_session_0123456789abcdef0123456789abcdef";
const STATE = "abcdefghijklmnopqrstuvwxyz123456";
const ACCOUNT_ID = "00000000-0000-4000-8000-000000000001";

function responseDouble() {
  return {
    headers: {}, statusCode: 200,
    setHeader(name, value) { this.headers[name] = value; },
    end(body = "") { this.body = body; }
  };
}

async function call(handler, method, query = "") {
  const req = { method, url: `/auth/tiktok-shop/affiliate-creator/callback${query}`, headers: {} };
  const res = responseDouble();
  await handler(req, res);
  return { res, payload: JSON.parse(res.body) };
}

function validHandler(overrides = {}) {
  return createHandler({
    authorizationEnabled: () => true,
    requireSession: async () => ({ id: SESSION_ID }),
    consumeState: async () => ({ creatorAccountId: "00000000-0000-4000-8000-000000000001" }),
    ...overrides
  });
}

async function testDormancyEnvironmentAndMethod() {
  let touched = false;
  delete process.env.TIKTOK_SHOP_AFFILIATE_CREATOR_AUTH_ENABLED;
  const disabled = await call(createHandler({ requireSession: async () => { touched = true; } }), "GET", `?state=${STATE}&code=value`);
  process.env.TIKTOK_SHOP_AFFILIATE_CREATOR_AUTH_ENABLED = "true";
  assert.equal(disabled.res.statusCode, 404);
  assert.equal(disabled.payload.status, "authorization_disabled");
  assert.equal(touched, false);

  process.env.NORTHSTAR_ENV = "production";
  const production = await call(validHandler(), "GET", `?state=${STATE}&code=value`);
  process.env.NORTHSTAR_ENV = "tiktok_sandbox";
  assert.equal(production.payload.status, "sandbox_callback_unavailable");

  const post = await call(validHandler(), "POST");
  assert.equal(post.res.statusCode, 405);
  assert.equal(post.res.headers.Allow, "GET");
}

async function testTerminalSuccessIsRedacted() {
  let consumed;
  const handler = validHandler({ consumeState: async (state, options) => { consumed = { state, options }; } });
  const secretCode = "authorization-code-must-not-appear";
  const { res, payload } = await call(handler, "GET", `?code=${secretCode}&state=${STATE}`);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(consumed, { state: STATE, options: { sessionId: SESSION_ID } });
  assert.deepEqual(payload, {
    source: "tiktok_shop_affiliate_creator",
    status: "callback_received_token_exchange_blocked",
    connectionCreated: false,
    tokenExchangeAttempted: false
  });
  assert.equal(res.body.includes(secretCode), false);
  assert.equal(res.body.includes(STATE), false);
}

async function testFailuresConsumeSafely() {
  assert.equal((await call(validHandler(), "GET", "?code=value")).payload.status, "invalid_state");
  assert.equal((await call(validHandler({ requireSession: async () => null }), "GET", `?state=${STATE}&code=value`)).payload.status, "session_required");

  for (const [code, expected] of [["expired_state", "expired_state"], ["invalid_or_replayed_state", "invalid_state"], ["mismatched_session_state", "invalid_state"]]) {
    const handler = validHandler({ consumeState: async () => { throw new TikTokShopAffiliateCreatorOAuthStateError(code); } });
    assert.equal((await call(handler, "GET", `?state=${STATE}&code=value`)).payload.status, expected);
  }
  const unavailable = validHandler({ consumeState: async () => { throw new Error("unavailable"); } });
  assert.equal((await call(unavailable, "GET", `?state=${STATE}&code=value`)).res.statusCode, 503);
}

async function testProviderParametersAreNeverReflected() {
  const handler = validHandler();
  const detail = "provider-detail-must-not-appear";
  const providerError = await call(handler, "GET", `?state=${STATE}&error=${detail}`);
  assert.equal(providerError.payload.status, "provider_error");
  assert.equal(providerError.res.body.includes(detail), false);
  assert.equal((await call(handler, "GET", `?state=${STATE}`)).payload.status, "missing_callback_code");
  assert.equal((await call(handler, "GET", `?state=${STATE}&code=one&code=two`)).payload.status, "invalid_callback_parameters");
  assert.equal((await call(handler, "GET", `?state=${STATE}&code=one&error=denied`)).payload.status, "invalid_callback_parameters");
}

async function testDurableStateIsolationValidationAndReplay() {
  const now = 1760000000000;
  const record = JSON.stringify({
    version: 1,
    provider: "tiktok_shop_affiliate_creator",
    purpose: "creator_authorization",
    environment: "tiktok_sandbox",
    creatorAccountId: ACCOUNT_ID,
    sessionIdHash: crypto.createHash("sha256").update(SESSION_ID).digest("hex"),
    createdAt: now,
    expiresAt: now + 600000
  });
  let available = true;
  let consumedKey;
  const command = async (operation, script, keyCount, key) => {
    assert.equal(operation, "EVAL");
    assert.equal(keyCount, "1");
    assert.match(script, /GET/);
    assert.match(script, /DEL/);
    assert.match(key, /oauth-state:tiktok-shop-affiliate-creator:[0-9a-f]{64}$/);
    consumedKey = key;
    if (!available) return null;
    available = false;
    return record;
  };
  const consumed = await consumeTikTokShopAffiliateCreatorOAuthState(STATE, { sessionId: SESSION_ID, now, command });
  assert.equal(consumed.creatorAccountId, ACCOUNT_ID);
  assert.ok(consumedKey);
  await assert.rejects(
    consumeTikTokShopAffiliateCreatorOAuthState(STATE, { sessionId: SESSION_ID, now, command }),
    (error) => error.code === "invalid_or_replayed_state"
  );

  const malformed = async () => "not-json";
  await assert.rejects(
    consumeTikTokShopAffiliateCreatorOAuthState(STATE, { sessionId: SESSION_ID, now, command: malformed }),
    (error) => error.code === "invalid_state_record"
  );
}

(async () => {
  await testDormancyEnvironmentAndMethod();
  await testTerminalSuccessIsRedacted();
  await testFailuresConsumeSafely();
  await testProviderParametersAreNeverReflected();
  await testDurableStateIsolationValidationAndReplay();
  console.log("TikTok Shop Affiliate Creator OAuth callback tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
