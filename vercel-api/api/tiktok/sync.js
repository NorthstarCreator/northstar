const { handleOptions, sendJson, validatePostOrigin } = require("../../lib/cors");
const { requireCsrf } = require("../../lib/session");
const { listVideos, getUserInfo } = require("../../lib/tiktok");
const { activeConnection } = require("./me");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return sendJson(req, res, 405, { error: "method_not_allowed" });
  if (!validatePostOrigin(req)) return sendJson(req, res, 403, { error: "invalid_origin" });

  const session = await requireCsrf(req);
  if (!session) return sendJson(req, res, 403, { error: "invalid_csrf" });

  try {
    const connection = await activeConnection(session.id);
    if (!connection) return sendJson(req, res, 409, { error: "not_connected" });
    const [profile, page] = await Promise.all([
      getUserInfo(connection.accessToken),
      listVideos(connection.accessToken, 0, 20)
    ]);
    return sendJson(req, res, 200, {
      syncedAt: new Date().toISOString(),
      profile,
      videos: page.videos || [],
      cursor: page.cursor || 0,
      hasMore: !!page.has_more
    });
  } catch (error) {
    return sendJson(req, res, 500, { error: "sync_failed" });
  }
};
