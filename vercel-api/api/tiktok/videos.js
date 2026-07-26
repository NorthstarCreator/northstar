const { handleOptions, sendJson } = require("../../lib/cors");
const { requireSession } = require("../../lib/session");
const { listAllVideos } = require("../../lib/tiktok");
const { activeConnection } = require("./me");
const { withDatabase } = require("../../lib/db");
const { readPersistedTikTokDashboard } = require("../../lib/dashboard-read-model");
const {
  buildTikTokLiveOverlay,
  coalesceLiveOverlay,
  normalizeRange,
  safeOverlayError
} = require("../../lib/tiktok-live-overlay");

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
      const range = normalizeRange(req.query || Object.fromEntries(new URL(req.url, "https://sandbox-api.northstar-creator.com").searchParams));
      let liveResult;
      try {
        const overlayKey = `${session.id}:${range.start}:${range.end}`;
        liveResult = await coalesceLiveOverlay(overlayKey, () => buildTikTokLiveOverlay({
          accessToken: connection.accessToken,
          persistedVideos: persisted.videos,
          lastSuccessfulSyncAt: persisted.lastSuccessfulSyncAt,
          range
        }));
      } catch (error) {
        liveResult = {
          videos: persisted.videos.map((video) => ({ ...video, live_status: "persisted" })),
          overlay: {
            ...safeOverlayError(error),
            readAt: null,
            requestCount: 0,
            refreshedCount: 0,
            newCount: 0,
            range
          }
        };
      }
      return sendJson(req, res, 200, {
        connected: true,
        source: "northstar_postgres_live_overlay",
        videos: liveResult.videos,
        accountMetricSnapshots: persisted.accountMetricSnapshots,
        lastSuccessfulSyncAt: persisted.lastSuccessfulSyncAt,
        overlay: liveResult.overlay,
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
