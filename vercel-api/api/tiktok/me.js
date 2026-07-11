const { handleOptions, sendJson } = require("../../lib/cors");
const { requireSession } = require("../../lib/session");
const { getConnection, storeEncryptedConnection } = require("../../lib/token-store");
const { getUserInfo, refreshAccessToken, tokenExpiry } = require("../../lib/tiktok");

async function activeConnection(sessionId) {
  const connection = await getConnection(sessionId);
  if (!connection) return null;
  if (Date.now() < Number(connection.expiresAt || 0)) return connection;
  const refreshed = await refreshAccessToken(connection.refreshToken);
  await storeEncryptedConnection(sessionId, {
    ...connection,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token || connection.refreshToken,
    expiresAt: tokenExpiry(refreshed),
    scopes: String(refreshed.scope || connection.scopes.join(",")).split(",").map((scope) => scope.trim()).filter(Boolean)
  });
  return getConnection(sessionId);
}

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "GET") return sendJson(req, res, 405, { error: "method_not_allowed" });

  const session = await requireSession(req);
  if (!session) return sendJson(req, res, 401, { error: "session_required" });

  try {
    const connection = await activeConnection(session.id);
    if (!connection) return sendJson(req, res, 200, { connected: false });
    const profile = await getUserInfo(connection.accessToken);
    return sendJson(req, res, 200, {
      connected: true,
      profile,
      connection: {
        openId: connection.openId,
        scopes: connection.scopes,
        connectedAt: connection.connectedAt,
        expiresAt: connection.expiresAt
      }
    });
  } catch (error) {
    return sendJson(req, res, 500, { error: "profile_unavailable" });
  }
};

module.exports.activeConnection = activeConnection;
