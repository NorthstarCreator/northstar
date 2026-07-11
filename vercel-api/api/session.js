const { handleOptions, sendJson } = require("../lib/cors");
const { getOrCreateSession } = require("../lib/session");
const { getConnectionMetadata } = require("../lib/token-store");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "GET") return sendJson(req, res, 405, { error: "method_not_allowed" });

  try {
    const session = await getOrCreateSession(req, res);
    const connection = await getConnectionMetadata(session.id);
    return sendJson(req, res, 200, {
      session: {
        id: session.id.slice(0, 8),
        createdAt: session.createdAt
      },
      csrfToken: session.csrfToken,
      connected: !!connection,
      connection: connection ? {
        openId: connection.openId,
        scopes: connection.scopes,
        connectedAt: connection.connectedAt,
        expiresAt: connection.expiresAt
      } : null
    });
  } catch (error) {
    return sendJson(req, res, 500, { error: "session_unavailable" });
  }
};
