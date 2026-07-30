const crypto = require("node:crypto");
const { randomToken, timingSafeEqual } = require("./crypto");
const { exactAccountId } = require("./revenue-provider-contract");
const { redisCommand, namespacedKey } = require("./token-store");

const STATE_TTL_SECONDS = 600;
const MAX_ISSUE_ATTEMPTS = 3;
const STATE_PATTERN = /^[A-Za-z0-9_-]{32,256}$/;
const SESSION_PATTERN = /^[A-Za-z0-9_-]{32,256}$/;
const PROVIDER = "tiktok_shop";
const PURPOSE = "creator_authorization";
const ENVIRONMENT = "tiktok_sandbox";
const ENABLE_ENV_NAME = "TIKTOK_SHOP_CREATOR_AUTH_ENABLED";
const CONSUME_SCRIPT = [
  "local value = redis.call('GET', KEYS[1])",
  "if value then redis.call('DEL', KEYS[1]) end",
  "return value"
].join("\n");

class TikTokShopOAuthStateError extends Error {
  constructor(code) {
    super(code);
    this.name = "TikTokShopOAuthStateError";
    this.code = code;
  }
}

function sha256(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function authorizationEnabled(env = process.env) {
  return env.NORTHSTAR_ENV === ENVIRONMENT && env[ENABLE_ENV_NAME] === "true";
}

function opaqueValue(value, pattern, code) {
  const normalized = String(value || "");
  if (!pattern.test(normalized)) throw new TikTokShopOAuthStateError(code);
  return normalized;
}

function stateKey(state) {
  return namespacedKey("oauth-state:tiktok-shop", sha256(state));
}

function stateRecord({ creatorAccountId, sessionId, now }) {
  return Object.freeze({
    version: 1,
    provider: PROVIDER,
    purpose: PURPOSE,
    environment: ENVIRONMENT,
    creatorAccountId,
    sessionIdHash: sha256(sessionId),
    createdAt: now,
    expiresAt: now + STATE_TTL_SECONDS * 1000
  });
}

async function issueTikTokShopOAuthState({
  creatorAccountId,
  sessionId,
  now = Date.now(),
  command = redisCommand
}) {
  if (process.env.NORTHSTAR_ENV !== ENVIRONMENT) {
    throw new TikTokShopOAuthStateError("sandbox_only");
  }
  if (!authorizationEnabled()) {
    throw new TikTokShopOAuthStateError("authorization_disabled");
  }
  const accountId = exactAccountId(creatorAccountId);
  const boundSessionId = opaqueValue(sessionId, SESSION_PATTERN, "invalid_session");
  if (!Number.isSafeInteger(now) || now < 0) throw new TikTokShopOAuthStateError("invalid_state_time");

  for (let attempt = 0; attempt < MAX_ISSUE_ATTEMPTS; attempt += 1) {
    const state = randomToken(32);
    const result = await command(
      "SET",
      stateKey(state),
      JSON.stringify(stateRecord({ creatorAccountId: accountId, sessionId: boundSessionId, now })),
      "EX",
      String(STATE_TTL_SECONDS),
      "NX"
    );
    if (result === "OK") return state;
  }
  throw new TikTokShopOAuthStateError("state_issue_failed");
}

function invalidRecord() {
  return new TikTokShopOAuthStateError("invalid_state_record");
}

function validateRecord(record, { sessionId, creatorAccountId, now }) {
  let accountId;
  try {
    accountId = exactAccountId(record?.creatorAccountId);
  } catch {
    throw invalidRecord();
  }
  if (
    record?.version !== 1
    || record?.provider !== PROVIDER
    || record?.purpose !== PURPOSE
    || record?.environment !== ENVIRONMENT
    || !/^[0-9a-f]{64}$/.test(String(record?.sessionIdHash || ""))
    || !Number.isSafeInteger(record?.createdAt)
    || !Number.isSafeInteger(record?.expiresAt)
    || record.expiresAt - record.createdAt !== STATE_TTL_SECONDS * 1000
  ) {
    throw invalidRecord();
  }
  if (!Number.isSafeInteger(now) || now < record.createdAt || now >= record.expiresAt) {
    throw new TikTokShopOAuthStateError("expired_state");
  }
  if (!timingSafeEqual(sha256(sessionId), record.sessionIdHash)) {
    throw new TikTokShopOAuthStateError("mismatched_session_state");
  }
  if (creatorAccountId !== undefined) {
    let expectedAccountId;
    try {
      expectedAccountId = exactAccountId(creatorAccountId);
    } catch {
      throw new TikTokShopOAuthStateError("mismatched_account_state");
    }
    if (expectedAccountId !== accountId) {
      throw new TikTokShopOAuthStateError("mismatched_account_state");
    }
  }
  return Object.freeze({ ...record, creatorAccountId: accountId });
}

async function consumeTikTokShopOAuthState(state, {
  sessionId,
  creatorAccountId,
  now = Date.now(),
  command = redisCommand
} = {}) {
  if (process.env.NORTHSTAR_ENV !== ENVIRONMENT) {
    throw new TikTokShopOAuthStateError("sandbox_only");
  }
  if (!authorizationEnabled()) {
    throw new TikTokShopOAuthStateError("authorization_disabled");
  }
  const opaqueState = opaqueValue(state, STATE_PATTERN, "invalid_state");
  const boundSessionId = opaqueValue(sessionId, SESSION_PATTERN, "invalid_session");
  const encoded = await command("EVAL", CONSUME_SCRIPT, "1", stateKey(opaqueState));
  if (!encoded) throw new TikTokShopOAuthStateError("invalid_or_replayed_state");

  let record;
  try {
    record = JSON.parse(encoded);
  } catch {
    throw invalidRecord();
  }
  return validateRecord(record, {
    sessionId: boundSessionId,
    creatorAccountId,
    now
  });
}

module.exports = {
  STATE_TTL_SECONDS,
  MAX_ISSUE_ATTEMPTS,
  PROVIDER,
  PURPOSE,
  ENVIRONMENT,
  ENABLE_ENV_NAME,
  CONSUME_SCRIPT,
  TikTokShopOAuthStateError,
  authorizationEnabled,
  issueTikTokShopOAuthState,
  consumeTikTokShopOAuthState
};
