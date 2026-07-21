const { handleOptions, sendJson } = require("../../lib/cors");
const { requireSession } = require("../../lib/session");
const { listAllVideos } = require("../../lib/tiktok");
const { activeConnection } = require("./me");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "GET") return sendJson(req, res, 405, { error: "method_not_allowed" });

  const session = await requireSession(req);
  if (!session) return sendJson(req, res, 401, { error: "session_required" });

  try {
    const connection = await activeConnection(session.id);
    if (!connection) return sendJson(req, res, 409, { error: "not_connected" });
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
