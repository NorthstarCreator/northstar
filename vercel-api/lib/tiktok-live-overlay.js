const { listVideos, queryVideos } = require("./tiktok");
const { isOnOrAfterLiveImportCutoff } = require("./live-import-policy");

const TIME_ZONE = "America/New_York";
const QUERY_BATCH_SIZE = 20;
const DEFAULT_REQUEST_CEILING = 50;
const MAX_RETRIES = 2;
const pendingOverlays = new Map();
const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

function dateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = Object.fromEntries(dateFormatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function validDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function normalizeRange(query = {}) {
  const start = String(query.start || "");
  const end = String(query.end || "");
  if (!validDateKey(start) || !validDateKey(end) || start > end) {
    const error = new Error("Invalid live overlay date range.");
    error.code = "overlay_range_invalid";
    throw error;
  }
  return { start, end };
}

function videoTime(video) {
  if (video?.published_at) return new Date(video.published_at).getTime();
  if (video?.create_time) return Number(video.create_time) * 1000;
  return 0;
}

function inRange(video, range) {
  const key = dateKey(videoTime(video));
  return !!key && key >= range.start && key <= range.end;
}

function chunks(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

function safeOverlayError(error) {
  const code = String(error?.code || "");
  if (code === "tiktok_api_rate_limited") return { status: "stale", safeCode: "live_rate_limited" };
  if (code === "tiktok_api_authorization_failed") return { status: "authorization_required", safeCode: "live_authorization_required" };
  if (code === "overlay_request_ceiling") return { status: "partial", safeCode: "live_request_ceiling" };
  return { status: "stale", safeCode: "live_temporarily_unavailable" };
}

async function retry(operation, consume, sleep) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      consume();
      return await operation();
    } catch (error) {
      if (!error?.retryable || attempt === MAX_RETRIES) throw error;
      const delay = Math.max(Number(error.retryAfterMs || 0), Math.min(250 * (2 ** attempt), 1000));
      await sleep(delay);
    }
  }
  return null;
}

function mergeVideo(persisted, fresh, readAt, isNew) {
  const merged = { ...(persisted || {}) };
  for (const [key, value] of Object.entries(fresh || {})) {
    if (value !== undefined && value !== null && value !== "") merged[key] = value;
  }
  if (!merged.cover_image_url && persisted?.cover_image_url) merged.cover_image_url = persisted.cover_image_url;
  merged.live_status = isNew ? "not_yet_synced" : "refreshed";
  merged.live_read_at = readAt;
  return merged;
}

async function buildTikTokLiveOverlay(options) {
  const {
    accessToken,
    persistedVideos = [],
    lastSuccessfulSyncAt,
    range,
    maxRequests = DEFAULT_REQUEST_CEILING,
    listPage = listVideos,
    queryBatch = queryVideos,
    sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay)),
    now = new Date()
  } = options;
  const requestCeiling = Math.min(Math.max(Number(maxRequests) || DEFAULT_REQUEST_CEILING, 1), DEFAULT_REQUEST_CEILING);
  let requestCount = 0;
  const consume = () => {
    if (requestCount >= requestCeiling) {
      const error = new Error("Live overlay request ceiling reached.");
      error.code = "overlay_request_ceiling";
      throw error;
    }
    requestCount += 1;
  };
  const readAt = now.toISOString();
  const persistedById = new Map(persistedVideos.map((video) => [String(video.id), { ...video, live_status: "persisted" }]));
  const lastSyncTime = lastSuccessfulSyncAt ? new Date(lastSuccessfulSyncAt).getTime() : 0;
  const knownInRange = persistedVideos.filter((video) => inRange(video, range));
  const knownBatches = chunks(knownInRange.map((video) => String(video.id)), QUERY_BATCH_SIZE);
  const discovered = [];
  let cursor = 0;
  let hasMore = true;
  let reachedLastSync = false;

  while (hasMore && !reachedLastSync && requestCount < requestCeiling) {
    const page = await retry(() => listPage(accessToken, cursor, 20), consume, sleep);
    for (const video of Array.isArray(page?.videos) ? page.videos : []) {
      if (!isOnOrAfterLiveImportCutoff(video)) {
        reachedLastSync = true;
        continue;
      }
      if (lastSyncTime && videoTime(video) <= lastSyncTime) {
        reachedLastSync = true;
        continue;
      }
      if (video?.id) discovered.push(video);
    }
    const nextCursor = page?.cursor || 0;
    hasMore = !!page?.has_more;
    if (hasMore && !reachedLastSync && String(nextCursor) === String(cursor)) {
      const error = new Error("Live discovery pagination stalled.");
      error.code = "tiktok_video_pagination_stalled";
      throw error;
    }
    cursor = nextCursor;
  }

  const freshById = new Map();
  let queriedBatchCount = 0;
  for (const batch of knownBatches) {
    if (requestCount >= requestCeiling) break;
    const payload = await retry(() => queryBatch(accessToken, batch), consume, sleep);
    queriedBatchCount += 1;
    for (const video of Array.isArray(payload?.videos) ? payload.videos : []) {
      if (video?.id) freshById.set(String(video.id), video);
    }
  }
  for (const video of discovered) if (video?.id) freshById.set(String(video.id), video);

  for (const [id, fresh] of freshById) {
    const persisted = persistedById.get(id);
    persistedById.set(id, mergeVideo(persisted, fresh, readAt, !persisted));
  }

  const truncated = queriedBatchCount < knownBatches.length || (hasMore && !reachedLastSync && requestCount >= requestCeiling);
  return {
    videos: [...persistedById.values()].sort((a, b) => videoTime(b) - videoTime(a)),
    overlay: {
      status: truncated ? "partial" : "live",
      safeCode: truncated ? "live_request_ceiling" : "",
      readAt,
      requestCount,
      refreshedCount: [...freshById.keys()].filter((id) => persistedVideos.some((video) => String(video.id) === id)).length,
      newCount: [...freshById.keys()].filter((id) => !persistedVideos.some((video) => String(video.id) === id)).length,
      requestCeiling,
      truncated,
      range
    }
  };
}

function coalesceLiveOverlay(key, factory) {
  if (pendingOverlays.has(key)) return pendingOverlays.get(key);
  const pending = Promise.resolve().then(factory).finally(() => pendingOverlays.delete(key));
  pendingOverlays.set(key, pending);
  return pending;
}

module.exports = {
  DEFAULT_REQUEST_CEILING,
  QUERY_BATCH_SIZE,
  buildTikTokLiveOverlay,
  coalesceLiveOverlay,
  normalizeRange,
  safeOverlayError
};
