const { handleOptions, sendJson } = require("../../lib/cors");
const { requireSession } = require("../../lib/session");
const { listAllVideos } = require("../../lib/tiktok");
const { activeConnection } = require("./me");
const { withDatabase } = require("../../lib/db");
const { readPersistedTikTokDashboard } = require("../../lib/dashboard-read-model");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "GET") return sendJson(req, res, 405, { error: "method_not_allowed" });

  const session = await requireSession(req);
  if (!session) return sendJson(req, res, 401, { error: "session_required" });

  try {
    const connection = await activeConnection(session.id);
    if (!connection) return sendJson(req, res, 409, { error: "not_connected" });
    if (process.env.NORTHSTAR_ENV === "tiktok_sandbox") {
      const persisted = await withDatabase((sql) => readPersistedTikTokDashboard(sql, connection.openId));
      if (!persisted.account) return sendJson(req, res, 404, { error: "persisted_account_not_found" });
      return sendJson(req, res, 200, {
        connected: true,
        source: "northstar_postgres",
        videos: persisted.videos,
        accountMetricSnapshots: persisted.accountMetricSnapshots,
        cursor: 0,
        hasMore: false
      });
    }
    const page = await listAllVideos(connection.accessToken);
    return sendJson(req, res, 200, {
      connected: true,
      videos: page.videos || [],
      cursor: page.cursor || 0,
      hasMore: !!page.has_more
    });
  } catch (error) {
    return sendJson(req, res, 500, { error: "videos_unavailable" });
  }
};
