const { handleOptions, sendJson } = require("../../lib/cors");
const { requireSession } = require("../../lib/session");
const { getConnectionMetadata } = require("../../lib/token-store");
const { withDatabase } = require("../../lib/db");
const { readRevenueSourceStatus } = require("../../lib/revenue-source-status");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "GET") return sendJson(req, res, 405, { error: "method_not_allowed" });

  const session = await requireSession(req);
  if (!session) return sendJson(req, res, 401, { error: "session_required" });

  try {
    const connection = await getConnectionMetadata(session.id);
    if (!connection?.openId) return sendJson(req, res, 409, { error: "not_connected" });
    const result = await withDatabase((sql) => readRevenueSourceStatus(sql, connection.openId));
    if (!result?.account) return sendJson(req, res, 404, { error: "persisted_account_not_found" });
    return sendJson(req, res, 200, result);
  } catch {
    return sendJson(req, res, 500, { error: "source_status_unavailable" });
  }
};
