const crypto = require("node:crypto");
const { timingSafeEqual } = require("./crypto");
const { exactAccountId } = require("./revenue-provider-contract");
const { redisCommand, namespacedKey } = require("./token-store");

const STATE_TTL_SECONDS = 600;
const STATE_PATTERN = /^[A-Za-z0-9_-]{32,256}$/;
const SESSION_PATTERN = /^[A-Za-z0-9_-]{32,256}$/;
const PROVIDER = "tiktok_shop_affiliate_creator";
const PURPOSE = "creator_authorization";
const ENVIRONMENT = "tiktok_sandbox";
const ENABLE_ENV_NAME = "TIKTOK_SHOP_AFFILIATE_CREATOR_AUTH_ENABLED";
const CONSUME_SCRIPT = [
  "local value = redis.call('GET', KEYS[1])",
  "if value then redis.call('DEL', KEYS[1]) end",
  "return value"
].join("\n");

class TikTokShopAffiliateCreatorOAuthStateError extends Error {
  constructor(code) {
    super(code);
    this.name = "TikTokShopAffiliateCreatorOAuthStateError";
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
  if (!pattern.test(normalized)) throw new TikTokShopAffiliateCreatorOAuthStateError(code);
  return normalized;
}

function stateKey(state) {
  return namespacedKey("oauth-state:tiktok-shop-affiliate-creator", sha256(state));
}

function invalidRecord() {
  return new TikTokShopAffiliateCreatorOAuthStateError("invalid_state_record");
}

function validateRecord(record, { sessionId, now }) {
  let creatorAccountId;
  try {
    creatorAccountId = exactAccountId(record?.creatorAccountId);
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
    throw new TikTokShopAffiliateCreatorOAuthStateError("expired_state");
  }
  if (!timingSafeEqual(sha256(sessionId), record.sessionIdHash)) {
    throw new TikTokShopAffiliateCreatorOAuthStateError("mismatched_session_state");
  }
  return Object.freeze({ ...record, creatorAccountId });
}

async function consumeTikTokShopAffiliateCreatorOAuthState(state, {
  sessionId,
  now = Date.now(),
  command = redisCommand
} = {}) {
  if (process.env.NORTHSTAR_ENV !== ENVIRONMENT) {
    throw new TikTokShopAffiliateCreatorOAuthStateError("sandbox_only");
  }
  if (!authorizationEnabled()) {
    throw new TikTokShopAffiliateCreatorOAuthStateError("authorization_disabled");
  }
  const opaqueState = opaqueValue(state, STATE_PATTERN, "invalid_state");
  const boundSessionId = opaqueValue(sessionId, SESSION_PATTERN, "invalid_session");
  const encoded = await command("EVAL", CONSUME_SCRIPT, "1", stateKey(opaqueState));
  if (!encoded) throw new TikTokShopAffiliateCreatorOAuthStateError("invalid_or_replayed_state");

  let record;
  try {
    record = JSON.parse(encoded);
  } catch {
    throw invalidRecord();
  }
  return validateRecord(record, { sessionId: boundSessionId, now });
}

module.exports = {
  STATE_TTL_SECONDS,
  PROVIDER,
  PURPOSE,
  ENVIRONMENT,
  ENABLE_ENV_NAME,
  CONSUME_SCRIPT,
  TikTokShopAffiliateCreatorOAuthStateError,
  authorizationEnabled,
  consumeTikTokShopAffiliateCreatorOAuthState
};
