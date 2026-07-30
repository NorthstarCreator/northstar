const assert = require("node:assert/strict");
process.env.NORTHSTAR_ENV = "tiktok_sandbox";
process.env.TIKTOK_SHOP_CREATOR_AUTH_ENABLED = "true";
const {
  STATE_TTL_SECONDS,
  MAX_ISSUE_ATTEMPTS,
  CONSUME_SCRIPT,
  authorizationEnabled,
  issueTikTokShopOAuthState,
  consumeTikTokShopOAuthState
} = require("../lib/tiktok-shop-oauth-state");

const ACCOUNT_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_ACCOUNT_ID = "00000000-0000-4000-8000-000000000002";
const SESSION_ID = "sandbox_session_0123456789abcdef0123456789abcdef";
const OTHER_SESSION_ID = "sandbox_session_fedcba9876543210fedcba9876543210";
const NOW = 1785344400000;

function memoryRedis() {
  const values = new Map();
  const calls = [];
  const command = async (name, ...args) => {
    calls.push([name, ...args]);
    if (name === "SET") {
      const [key, value, ex, ttl, nx] = args;
      assert.equal(ex, "EX");
      assert.equal(ttl, String(STATE_TTL_SECONDS));
      assert.equal(nx, "NX");
      if (values.has(key)) return null;
      values.set(key, value);
      return "OK";
    }
    if (name === "EVAL") {
      const [script, keyCount, key] = args;
      assert.equal(script, CONSUME_SCRIPT);
      assert.equal(keyCount, "1");
      const value = values.get(key) || null;
      values.delete(key);
      return value;
    }
    throw new Error("unexpected command");
  };
  return { values, calls, command };
}

async function issued(redis = memoryRedis()) {
  const state = await issueTikTokShopOAuthState({
    creatorAccountId: ACCOUNT_ID,
    sessionId: SESSION_ID,
    now: NOW,
    command: redis.command
  });
  return { redis, state };
}

async function testDisabledAndEnvironmentGuards() {
  assert.equal(authorizationEnabled({
    NORTHSTAR_ENV: "tiktok_sandbox",
    TIKTOK_SHOP_CREATOR_AUTH_ENABLED: "true"
  }), true);
  for (const value of [undefined, "", "TRUE", "1", " true", "true "]) {
    assert.equal(authorizationEnabled({
      NORTHSTAR_ENV: "tiktok_sandbox",
      TIKTOK_SHOP_CREATOR_AUTH_ENABLED: value
    }), false);
  }

  delete process.env.TIKTOK_SHOP_CREATOR_AUTH_ENABLED;
  await assert.rejects(issueTikTokShopOAuthState({
    creatorAccountId: ACCOUNT_ID,
    sessionId: SESSION_ID,
    command: memoryRedis().command
  }), { code: "authorization_disabled" });
  process.env.TIKTOK_SHOP_CREATOR_AUTH_ENABLED = "true";
  process.env.NORTHSTAR_ENV = "production";
  await assert.rejects(issueTikTokShopOAuthState({
    creatorAccountId: ACCOUNT_ID,
    sessionId: SESSION_ID,
    command: memoryRedis().command
  }), { code: "sandbox_only" });
  process.env.NORTHSTAR_ENV = "tiktok_sandbox";
}

async function testDigestOnlyStorageAndExactBindings() {
  const { redis, state } = await issued();
  assert.match(state, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(redis.values.size, 1);
  const [[key, encoded]] = [...redis.values.entries()];
  assert.match(key, /oauth-state:tiktok-shop:[0-9a-f]{64}$/);
  assert.equal(key.includes(state), false);
  assert.equal(encoded.includes(state), false);
  assert.equal(encoded.includes(SESSION_ID), false);
  const record = JSON.parse(encoded);
  assert.deepEqual({
    version: record.version,
    provider: record.provider,
    purpose: record.purpose,
    environment: record.environment,
    creatorAccountId: record.creatorAccountId,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt
  }, {
    version: 1,
    provider: "tiktok_shop",
    purpose: "creator_authorization",
    environment: "tiktok_sandbox",
    creatorAccountId: ACCOUNT_ID,
    createdAt: NOW,
    expiresAt: NOW + 600000
  });
  assert.match(record.sessionIdHash, /^[0-9a-f]{64}$/);

  const consumed = await consumeTikTokShopOAuthState(state, {
    sessionId: SESSION_ID,
    creatorAccountId: ACCOUNT_ID,
    now: NOW + 1,
    command: redis.command
  });
  assert.equal(consumed.creatorAccountId, ACCOUNT_ID);
  assert.equal(redis.values.size, 0);
  await assert.rejects(consumeTikTokShopOAuthState(state, {
    sessionId: SESSION_ID,
    now: NOW + 2,
    command: redis.command
  }), { code: "invalid_or_replayed_state" });
}

async function testExpirationAndMismatchConsumeAtomically() {
  for (const scenario of [
    { options: { sessionId: SESSION_ID, now: NOW + 600000 }, code: "expired_state" },
    { options: { sessionId: OTHER_SESSION_ID, now: NOW + 1 }, code: "mismatched_session_state" },
    { options: { sessionId: SESSION_ID, creatorAccountId: OTHER_ACCOUNT_ID, now: NOW + 1 }, code: "mismatched_account_state" }
  ]) {
    const { redis, state } = await issued();
    await assert.rejects(consumeTikTokShopOAuthState(state, {
      ...scenario.options,
      command: redis.command
    }), { code: scenario.code });
    assert.equal(redis.values.size, 0);
  }
}

async function testMalformedRecordsNormalizeAndConsume() {
  const corruptions = [
    "not-json",
    JSON.stringify({}),
    JSON.stringify({
      version: 1,
      provider: "tiktok_shop",
      purpose: "creator_authorization",
      environment: "tiktok_sandbox",
      creatorAccountId: "not-a-uuid",
      sessionIdHash: "0".repeat(64),
      createdAt: NOW,
      expiresAt: NOW + 600000
    })
  ];
  for (const encoded of corruptions) {
    const { redis, state } = await issued();
    const [key] = redis.values.keys();
    redis.values.set(key, encoded);
    await assert.rejects(consumeTikTokShopOAuthState(state, {
      sessionId: SESSION_ID,
      now: NOW + 1,
      command: redis.command
    }), { code: "invalid_state_record" });
    assert.equal(redis.values.size, 0);
  }
}

async function testCalculatedAccountsInvalidInputAndFailures() {
  for (const creatorAccountId of ["all", "all-accounts", "all_accounts", "All Accounts", ""]) {
    await assert.rejects(issueTikTokShopOAuthState({
      creatorAccountId,
      sessionId: SESSION_ID,
      now: NOW,
      command: memoryRedis().command
    }), { code: "exact_account_required" });
  }
  await assert.rejects(issueTikTokShopOAuthState({
    creatorAccountId: ACCOUNT_ID,
    sessionId: "short",
    now: NOW,
    command: memoryRedis().command
  }), { code: "invalid_session" });
  await assert.rejects(issueTikTokShopOAuthState({
    creatorAccountId: ACCOUNT_ID,
    sessionId: SESSION_ID,
    now: -1,
    command: memoryRedis().command
  }), { code: "invalid_state_time" });

  let attempts = 0;
  await assert.rejects(issueTikTokShopOAuthState({
    creatorAccountId: ACCOUNT_ID,
    sessionId: SESSION_ID,
    now: NOW,
    command: async () => { attempts += 1; return null; }
  }), { code: "state_issue_failed" });
  assert.equal(attempts, MAX_ISSUE_ATTEMPTS);

  await assert.rejects(issueTikTokShopOAuthState({
    creatorAccountId: ACCOUNT_ID,
    sessionId: SESSION_ID,
    now: NOW,
    command: async () => { throw new Error("redis unavailable"); }
  }), /redis unavailable/);
  await assert.rejects(consumeTikTokShopOAuthState("abcdefghijklmnopqrstuvwxyz123456", {
    sessionId: SESSION_ID,
    now: NOW,
    command: async () => { throw new Error("redis unavailable"); }
  }), /redis unavailable/);
}

async function testStaticSafety() {
  assert.match(CONSUME_SCRIPT, /redis\.call\('GET'/);
  assert.match(CONSUME_SCRIPT, /redis\.call\('DEL'/);
  const source = require("node:fs").readFileSync(require("node:path").join(__dirname, "../lib/tiktok-shop-oauth-state.js"), "utf8");
  assert.doesNotMatch(source, /app.?key|app.?secret|access.?token|refresh.?token|authorization.?code/i);
  assert.doesNotMatch(source, /\b(?:INSERT\s+INTO|UPDATE\s+[a-z_]|DELETE\s+FROM|UPSERT\s+INTO)\b/i);
}

(async () => {
  await testDisabledAndEnvironmentGuards();
  await testDigestOnlyStorageAndExactBindings();
  await testExpirationAndMismatchConsumeAtomically();
  await testMalformedRecordsNormalizeAndConsume();
  await testCalculatedAccountsInvalidInputAndFailures();
  await testStaticSafety();
  console.log("TikTok Shop OAuth durable-state tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
