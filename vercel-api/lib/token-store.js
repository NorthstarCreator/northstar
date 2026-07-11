const { encryptJson, decryptJson } = require("./crypto");

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

function ensureRedis() {
  if (!redisUrl || !redisToken) {
    throw new Error("Upstash Redis environment variables are not configured.");
  }
}

async function redis(command, ...args) {
  ensureRedis();
  const response = await fetch(`${redisUrl}/pipeline`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${redisToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify([[command, ...args]])
  });
  if (!response.ok) throw new Error("Token store request failed.");
  const [result] = await response.json();
  if (result.error) throw new Error("Token store command failed.");
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
  await setJson(`northstar:tiktok:${sessionId}`, safeConnection);
  return safeConnection;
}

async function getConnection(sessionId) {
  const connection = await getJson(`northstar:tiktok:${sessionId}`);
  if (!connection) return null;
  const tokens = decryptJson(connection.encryptedTokens);
  return { ...connection, ...tokens };
}

async function getConnectionMetadata(sessionId) {
  const connection = await getJson(`northstar:tiktok:${sessionId}`);
  if (!connection) return null;
  const { encryptedTokens, ...metadata } = connection;
  return metadata;
}

async function deleteConnection(sessionId) {
  return del(`northstar:tiktok:${sessionId}`);
}

async function storeSession(session) {
  await setJson(`northstar:session:${session.id}`, session, 60 * 60 * 24 * 30);
  return session;
}

async function getSession(sessionId) {
  return getJson(`northstar:session:${sessionId}`);
}

async function storeOAuthState(state, payload) {
  await setJson(`northstar:oauth-state:${state}`, payload, 60 * 10);
}

async function consumeOAuthState(state) {
  const key = `northstar:oauth-state:${state}`;
  const payload = await getJson(key);
  if (payload) await del(key);
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
