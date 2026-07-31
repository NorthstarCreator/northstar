const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
process.env.NORTHSTAR_ENV = "tiktok_sandbox";
process.env.TIKTOK_SHOP_CREATOR_AUTH_ENABLED = "true";
const { createHandler } = require("../api/auth/tiktok-shop/start");
const {
  CREATOR_AUTHORIZATION_URL,
  APP_KEY_ENV_NAME,
  creatorAuthorizationUrl,
  readOwnedCreatorAccount
} = require("../lib/tiktok-shop-oauth");

const ACCOUNT_ID = "00000000-0000-4000-8000-000000000001";
const SESSION_ID = "sandbox_session_0123456789abcdef0123456789abcdef";
const OPEN_ID = "existing-display-api-open-id";
const STATE = "abcdefghijklmnopqrstuvwxyz123456";

function responseDouble() {
  return {
    headers: {}, statusCode: 200,
    setHeader(name, value) { this.headers[name] = value; },
    end(body = "") { this.body = body; }
  };
}

async function call(handler, method = "GET", query = `?creatorAccountId=${ACCOUNT_ID}`) {
  const req = { method, url: `/auth/tiktok-shop/start${query}`, headers: {} };
  const res = responseDouble();
  await handler(req, res);
  return { res, payload: res.body ? JSON.parse(res.body) : null };
}

function validHandler(overrides = {}) {
  return createHandler({
    authorizationEnabled: () => true,
    requireSession: async () => ({ id: SESSION_ID }),
    getConnectionMetadata: async () => ({ openId: OPEN_ID }),
    withDatabase: async (callback) => callback(() => {}),
    readOwnedCreatorAccount: async (_sql, input) => {
      assert.deepEqual(input, { creatorAccountId: ACCOUNT_ID, tiktokOpenId: OPEN_ID });
      return { id: ACCOUNT_ID };
    },
    issueTikTokShopOAuthState: async (input) => {
      assert.deepEqual(input, { creatorAccountId: ACCOUNT_ID, sessionId: SESSION_ID });
      return STATE;
    },
    creatorAuthorizationUrl: (state) => `${CREATOR_AUTHORIZATION_URL}?app_key=test-only&state=${state}`,
    ...overrides
  });
}

async function testRouteAndSuccessfulStart() {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, "../vercel.json"), "utf8"));
  assert.deepEqual(config.rewrites.filter((route) => route.source.includes("tiktok-shop")), [
    { source: "/auth/tiktok-shop/start", destination: "/api/auth/tiktok-shop/start" },
    { source: "/auth/tiktok-shop/callback", destination: "/api/auth/tiktok-shop/callback" },
    {
      source: "/auth/tiktok-shop/affiliate-creator/callback",
      destination: "/api/auth/tiktok-shop/affiliate-creator/callback"
    }
  ]);
  const { res } = await call(validHandler());
  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.Location, `${CREATOR_AUTHORIZATION_URL}?app_key=test-only&state=${STATE}`);
  assert.equal(res.headers["Cache-Control"], "private, no-store, max-age=0");
  assert.equal(res.headers["Referrer-Policy"], "no-referrer");
  assert.equal(res.body, "");
}

async function testDisabledSandboxAndMethodGuards() {
  let touched = false;
  delete process.env.TIKTOK_SHOP_CREATOR_AUTH_ENABLED;
  const disabled = await call(validHandler({
    authorizationEnabled: undefined,
    requireSession: async () => { touched = true; }
  }));
  process.env.TIKTOK_SHOP_CREATOR_AUTH_ENABLED = "true";
  assert.equal(disabled.res.statusCode, 404);
  assert.equal(disabled.payload.error, "authorization_disabled");
  assert.equal(touched, false);

  process.env.NORTHSTAR_ENV = "production";
  const production = await call(validHandler());
  process.env.NORTHSTAR_ENV = "tiktok_sandbox";
  assert.equal(production.res.statusCode, 404);
  assert.equal(production.payload.error, "sandbox_route_unavailable");

  const method = await call(validHandler(), "POST");
  assert.equal(method.res.statusCode, 405);
  assert.equal(method.res.headers.Allow, "GET");
}

async function testAccountAndOwnershipFailures() {
  for (const value of ["", "all", "all-accounts", "all_accounts", "All Accounts", "not-a-uuid"]) {
    const result = await call(validHandler(), "GET", `?creatorAccountId=${encodeURIComponent(value)}`);
    assert.equal(result.res.statusCode, 400);
  }
  assert.equal((await call(validHandler(), "GET", `?creatorAccountId=${ACCOUNT_ID}&creatorAccountId=${ACCOUNT_ID}`)).res.statusCode, 400);
  assert.equal((await call(validHandler({ requireSession: async () => null }))).res.statusCode, 401);
  assert.equal((await call(validHandler({ getConnectionMetadata: async () => null }))).res.statusCode, 409);
  assert.equal((await call(validHandler({ readOwnedCreatorAccount: async () => null }))).res.statusCode, 404);
}

async function testOfficialUrlAndReadOnlyQuery() {
  const url = new URL(creatorAuthorizationUrl(STATE, {
    NORTHSTAR_ENV: "tiktok_sandbox",
    TIKTOK_SHOP_CREATOR_AUTH_ENABLED: "true",
    [APP_KEY_ENV_NAME]: "test-only-app-key"
  }));
  assert.equal(url.origin + url.pathname, CREATOR_AUTHORIZATION_URL);
  assert.deepEqual([...url.searchParams.keys()].sort(), ["app_key", "state"]);
  assert.throws(() => creatorAuthorizationUrl(STATE, {
    NORTHSTAR_ENV: "tiktok_sandbox",
    TIKTOK_SHOP_CREATOR_AUTH_ENABLED: "false",
    [APP_KEY_ENV_NAME]: "test-only-app-key"
  }));
  assert.throws(() => creatorAuthorizationUrl(STATE, {
    NORTHSTAR_ENV: "tiktok_sandbox",
    TIKTOK_SHOP_CREATOR_AUTH_ENABLED: "true"
  }));

  const calls = [];
  const sql = async (strings, ...values) => {
    calls.push({ text: strings.join("?"), values });
    return [{ id: ACCOUNT_ID }];
  };
  assert.deepEqual(await readOwnedCreatorAccount(sql, {
    creatorAccountId: ACCOUNT_ID,
    tiktokOpenId: OPEN_ID
  }), { id: ACCOUNT_ID });
  assert.match(calls[0].text, /ca\.id = \?::uuid/);
  assert.match(calls[0].text, /cta\.tiktok_open_id = \?/);
  assert.match(calls[0].text, /cta\.disconnected_at IS NULL/);
  assert.doesNotMatch(calls[0].text, /\b(?:INSERT|UPDATE|DELETE|UPSERT|MERGE|TRUNCATE)\b/i);
}

async function testFailuresDoNotIssueOrRedirect() {
  let issued = false;
  const result = await call(validHandler({
    withDatabase: async () => { throw new Error("database unavailable"); },
    issueTikTokShopOAuthState: async () => { issued = true; return STATE; }
  }));
  assert.equal(result.res.statusCode, 503);
  assert.equal(issued, false);
  assert.equal(result.res.headers.Location, undefined);

  const redisFailure = await call(validHandler({
    issueTikTokShopOAuthState: async () => { throw new Error("redis unavailable"); }
  }));
  assert.equal(redisFailure.res.statusCode, 503);
  assert.equal(redisFailure.res.headers.Location, undefined);
}

(async () => {
  await testRouteAndSuccessfulStart();
  await testDisabledSandboxAndMethodGuards();
  await testAccountAndOwnershipFailures();
  await testOfficialUrlAndReadOnlyQuery();
  await testFailuresDoNotIssueOrRedirect();
  console.log("TikTok Shop OAuth start tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
