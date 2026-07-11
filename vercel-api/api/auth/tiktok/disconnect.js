const { handleOptions, sendJson, validatePostOrigin } = require("../../../lib/cors");
const { requireCsrf } = require("../../../lib/session");
const { getConnection, deleteConnection } = require("../../../lib/token-store");
const { revokeToken } = require("../../../lib/tiktok");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return sendJson(req, res, 405, { error: "method_not_allowed" });
  if (!validatePostOrigin(req)) return sendJson(req, res, 403, { error: "invalid_origin" });

  const session = await requireCsrf(req);
  if (!session) return sendJson(req, res, 403, { error: "invalid_csrf" });

  try {
    const connection = await getConnection(session.id);
    if (connection?.accessToken) {
      try {
        await revokeToken(connection.accessToken);
      } catch (error) {
        if (!/invalid|expired|revoked/i.test(error.message || "")) throw error;
      }
    }
    await deleteConnection(session.id);
    return sendJson(req, res, 200, { disconnected: true });
  } catch (error) {
    return sendJson(req, res, 500, { error: "disconnect_failed" });
  }
};
