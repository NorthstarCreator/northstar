const crypto = require("node:crypto");
const { randomToken, timingSafeEqual } = require("./crypto");
const { exactAccountId } = require("./revenue-provider-contract");

const DEFAULT_STATE_TTL_MS = 10 * 60 * 1000;
const STATE_PATTERN = /^[A-Za-z0-9_-]{32,256}$/;
const SESSION_PATTERN = /^[A-Za-z0-9_-]{32,256}$/;
const pendingStates = new Map();

class TikTokShopOAuthStateError extends Error {
  constructor(code) {
    super(code);
    this.name = "TikTokShopOAuthStateError";
    this.code = code;
  }
}

function stateDigest(state) {
  return crypto.createHash("sha256").update(state, "utf8").digest("hex");
}

function validOpaqueValue(value, pattern) {
  const normalized = String(value || "");
  return pattern.test(normalized) ? normalized : "";
}

function issueTikTokShopOAuthState({
  creatorAccountId,
  sessionId,
  now = Date.now(),
  ttlMs = DEFAULT_STATE_TTL_MS
}) {
  const accountId = exactAccountId(creatorAccountId);
  const boundSessionId = validOpaqueValue(sessionId, SESSION_PATTERN);
  if (!boundSessionId) throw new TikTokShopOAuthStateError("invalid_session");
  if (!Number.isSafeInteger(now) || now < 0) throw new TikTokShopOAuthStateError("invalid_state_time");
  if (!Number.isSafeInteger(ttlMs) || ttlMs < 1 || ttlMs > DEFAULT_STATE_TTL_MS) {
    throw new TikTokShopOAuthStateError("invalid_state_ttl");
  }

  const state = randomToken(32);
  pendingStates.set(stateDigest(state), Object.freeze({
    creatorAccountId: accountId,
    sessionId: boundSessionId,
    expiresAt: now + ttlMs
  }));
  return state;
}

function consumeTikTokShopOAuthState(state, {
  sessionId,
  creatorAccountId,
  now = Date.now()
} = {}) {
  const opaqueState = validOpaqueValue(state, STATE_PATTERN);
  if (!opaqueState) throw new TikTokShopOAuthStateError("invalid_state");
  const boundSessionId = validOpaqueValue(sessionId, SESSION_PATTERN);
  if (!boundSessionId) throw new TikTokShopOAuthStateError("invalid_session");

  const digest = stateDigest(opaqueState);
  const record = pendingStates.get(digest);
  pendingStates.delete(digest);
  if (!record) throw new TikTokShopOAuthStateError("invalid_or_replayed_state");
  if (!Number.isSafeInteger(now) || now < 0 || now > record.expiresAt) {
    throw new TikTokShopOAuthStateError("expired_state");
  }
  if (!timingSafeEqual(boundSessionId, record.sessionId)) {
    throw new TikTokShopOAuthStateError("mismatched_session_state");
  }
  if (creatorAccountId !== undefined && exactAccountId(creatorAccountId) !== record.creatorAccountId) {
    throw new TikTokShopOAuthStateError("mismatched_account_state");
  }
  return record;
}

function clearTikTokShopOAuthStatesForTests() {
  pendingStates.clear();
}

module.exports = {
  DEFAULT_STATE_TTL_MS,
  TikTokShopOAuthStateError,
  issueTikTokShopOAuthState,
  consumeTikTokShopOAuthState,
  clearTikTokShopOAuthStatesForTests
};
