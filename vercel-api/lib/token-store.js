const { encryptJson, decryptJson } = require("./crypto");

const isSandbox = process.env.NORTHSTAR_ENV === "tiktok_sandbox";

function envValue(name) {
  const raw = process.env[name];
  return typeof raw === "string" ? raw.trim() : raw;
}

function envHealth(name, value) {
  const raw = process.env[name];
  const text = typeof raw === "string" ? raw : "";
  let firstNonAsciiIndex = null;
  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) > 127) {
      firstNonAsciiIndex = index;
      break;
    }
  }
  return {
    name,
    configured: !!raw,
    length: text.length,
    trimmedLength: text.trim().length,
    hasLeadingOrTrailingWhitespace: text !== text.trim(),
    hasNewline: /[\r\n]/.test(text),
    firstNonAsciiIndex,
    sanitizedLength: typeof value === "string" ? value.length : 0
  };
}

const redisUrlName = isSandbox ? "UPSTASH_REDIS_REST_URL_SANDBOX" : null;
const redisTokenName = isSandbox ? "UPSTASH_REDIS_REST_TOKEN_SANDBOX" : null;

const redisUrl = isSandbox
  ? envValue(redisUrlName)
  : (envValue("UPSTASH_REDIS_REST_URL") || envValue("KV_REST_API_URL"));

const redisToken = isSandbox
  ? envValue(redisTokenName)
  : (envValue("UPSTASH_REDIS_REST_TOKEN") || envValue("KV_REST_API_TOKEN"));

const redisUrlSource = isSandbox
  ? redisUrlName
  : (envValue("UPSTASH_REDIS_REST_URL") ? "UPSTASH_REDIS_REST_URL" : "KV_REST_API_URL");

const redisTokenSource = isSandbox
  ? redisTokenName
  : (envValue("UPSTASH_REDIS_REST_TOKEN") ? "UPSTASH_REDIS_REST_TOKEN" : "KV_REST_API_TOKEN");

const keyPrefix = isSandbox
  ? (envValue("TOKEN_STORE_PREFIX_SANDBOX") || "northstar:sandbox")
  : (envValue("TOKEN_STORE_PREFIX") || "northstar");

function key(name, id) {
  return `${keyPrefix}:${name}:${id}`;
}

function ensureRedis() {
  if (!redisUrl || !redisToken) {
    throw new Error(isSandbox
      ? "Sandbox Upstash Redis environment variables are not configured."
      : "Upstash Redis environment variables are not configured.");
  }
}

async function redis(command, ...args) {
  ensureRedis();
  console.error("[northstar-token-store-env]", {
    command,
    headerNames: ["Authorization", "Content-Type"],
    redisUrl: envHealth(redisUrlSource, redisUrl),
    redisToken: envHealth(redisTokenSource, redisToken)
  });
  const response = await fetch(`${redisUrl}/pipeline`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${redisToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify([[command, ...args]])
  });
  if (!response.ok) {
    console.error("[northstar-token-store]", {
      command,
      status: response.status,
      statusText: response.statusText || null
    });
    throw new Error("Token store request failed.");
  }
  const payload = await response.json().catch((error) => {
    console.error("[northstar-token-store]", {
      command,
      stage: "parse_response",
      message: error?.message || "Unable to parse token store response"
    });
    throw new Error("Token store response could not be parsed.");
  });
  const [result] = Array.isArray(payload) ? payload : [];
  if (!result || result.error) {
    console.error("[northstar-token-store]", {
      command,
      stage: "command_result",
      error: result?.error || "Unexpected token store response shape"
    });
    throw new Error("Token store command failed.");
  }
  return result.result;
}

async function setJson(key, value, ttlSeconds) {
  const encoded = JSON.stringify(value);
  if (ttlSeconds) return redis("SET", key, encoded, "EX", String(ttlSeconds));
  return redis("SET", key, encoded);
}

async function getJson(key) {
  const value = await redis("GET", key);
  if (!value) return null;
  return JSON.parse(value);
}

async function del(key) {
  return redis("DEL", key);
}

async function storeEncryptedConnection(sessionId, connection) {
  const encrypted = encryptJson({
    accessToken: connection.accessToken,
    refreshToken: connection.refreshToken
  });
  const safeConnection = {
    encryptedTokens: encrypted,
    expiresAt: connection.expiresAt,
    refreshExpiresAt: connection.refreshExpiresAt || null,
    openId: connection.openId || "",
    scopes: connection.scopes || [],
    connectedAt: connection.connectedAt || new Date().toISOString(),
    sessionId
  };
  await setJson(key("tiktok", sessionId), safeConnection);
  return safeConnection;
}

async function getConnection(sessionId) {
  const connection = await getJson(key("tiktok", sessionId));
  if (!connection) return null;
  const tokens = decryptJson(connection.encryptedTokens);
  return { ...connection, ...tokens };
}

async function getConnectionMetadata(sessionId) {
  const connection = await getJson(key("tiktok", sessionId));
  if (!connection) return null;
  const { encryptedTokens, ...metadata } = connection;
  return metadata;
}

async function deleteConnection(sessionId) {
  return del(key("tiktok", sessionId));
}

async function storeSession(session) {
  await setJson(key("session", session.id), session, 60 * 60 * 24 * 30);
  return session;
}

async function getSession(sessionId) {
  return getJson(key("session", sessionId));
}

async function storeOAuthState(state, payload) {
  await setJson(key("oauth-state", state), payload, 60 * 10);
}

async function consumeOAuthState(state) {
  const stateKey = key("oauth-state", state);
  const payload = await getJson(stateKey);
  if (payload) await del(stateKey);
  return payload;
}

module.exports = {
  setJson,
  getJson,
  del,
  storeSession,
  getSession,
  storeOAuthState,
  consumeOAuthState,
  storeEncryptedConnection,
  getConnection,
  getConnectionMetadata,
  deleteConnection
};
