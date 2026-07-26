const TIKTOK_AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const TIKTOK_REVOKE_URL = "https://open.tiktokapis.com/v2/oauth/revoke/";
const TIKTOK_USER_INFO_URL = "https://open.tiktokapis.com/v2/user/info/";
const TIKTOK_VIDEO_LIST_URL = "https://open.tiktokapis.com/v2/video/list/";
const {
  LIVE_IMPORT_CUTOFF: NORTHSTAR_LIVE_IMPORT_CUTOFF,
  isOnOrAfterLiveImportCutoff
} = require("./live-import-policy");

const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const DEFAULT_VIDEO_PAGE_RETRIES = 2;
const DEFAULT_VIDEO_RETRY_DELAY_MS = 250;

const requestedScopes = (process.env.TIKTOK_SCOPES || "user.info.basic,user.info.stats,video.list")
  .split(",")
  .map((scope) => scope.trim())
  .filter(Boolean);

function requiredEnv(name) {
  const envName = process.env.NORTHSTAR_ENV === "tiktok_sandbox" ? `${name}_SANDBOX` : name;
  const value = process.env[envName];
  if (!value) throw new Error(`${envName} is not configured.`);
  return value;
}

function authorizationUrl(state) {
  const url = new URL(TIKTOK_AUTH_URL);
  url.searchParams.set("client_key", requiredEnv("TIKTOK_CLIENT_KEY"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", requestedScopes.join(","));
  url.searchParams.set("redirect_uri", requiredEnv("TIKTOK_REDIRECT_URI"));
  url.searchParams.set("state", state);
  return url.toString();
}

async function tokenRequest(params) {
  const body = new URLSearchParams({
    client_key: requiredEnv("TIKTOK_CLIENT_KEY"),
    client_secret: requiredEnv("TIKTOK_CLIENT_SECRET"),
    ...params
  });
  const response = await fetch(TIKTOK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || (payload.error?.code && payload.error.code !== "ok") || (typeof payload.error === "string" && payload.error !== "ok")) {
    throw new Error(payload.error_description || payload.error?.message || payload.error?.code || payload.error || "TikTok token request failed.");
  }
  return payload;
}

async function exchangeCode(code) {
  return tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: requiredEnv("TIKTOK_REDIRECT_URI")
  });
}

async function refreshAccessToken(refreshToken) {
  return tokenRequest({
    grant_type: "refresh_token",
    refresh_token: refreshToken
  });
}

async function revokeToken(token) {
  if (!token) return;
  const body = new URLSearchParams({
    client_key: requiredEnv("TIKTOK_CLIENT_KEY"),
    client_secret: requiredEnv("TIKTOK_CLIENT_SECRET"),
    token
  });
  const response = await fetch(TIKTOK_REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    if (!/invalid|expired|revoked/i.test(`${payload.error} ${payload.error_description}`)) {
      throw new Error("TikTok revoke request failed.");
    }
  }
}

function apiError(code, safeMessage, retryable = false, retryAfterMs = 0) {
  const error = new Error("TikTok API request failed.");
  error.code = code;
  error.safeMessage = safeMessage;
  error.retryable = retryable;
  error.retryAfterMs = retryAfterMs;
  return error;
}

function classifyTikTokApiError(response, payload = {}) {
  const status = Number(response?.status || 0);
  const apiCode = String(payload?.error?.code || payload?.error || "").toLowerCase();
  const retryAfterSeconds = Number(response?.headers?.get?.("retry-after") || 0);
  const retryAfterMs = Number.isFinite(retryAfterSeconds)
    ? Math.min(Math.max(retryAfterSeconds * 1000, 0), 2000)
    : 0;

  if (status === 429 || /rate|throttl|too_many/.test(apiCode)) {
    return apiError(
      "tiktok_api_rate_limited",
      "TikTok temporarily limited video requests after retry attempts.",
      true,
      retryAfterMs
    );
  }
  if (RETRYABLE_HTTP_STATUSES.has(status) || /internal|temporar|timeout|unavailable/.test(apiCode)) {
    return apiError(
      "tiktok_api_temporarily_unavailable",
      "TikTok video data was temporarily unavailable after retry attempts.",
      true,
      retryAfterMs
    );
  }
  if (status === 401 || status === 403 || /access_token|scope|unauthor|forbidden/.test(apiCode)) {
    return apiError(
      "tiktok_api_authorization_failed",
      "TikTok authorization no longer permits the requested video data."
    );
  }
  return apiError(
    "tiktok_api_request_rejected",
    "TikTok rejected the video data request."
  );
}

async function tiktokFetch(url, accessToken, options = {}) {
  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });
  } catch (_error) {
    throw apiError(
      "tiktok_api_network_error",
      "TikTok video data could not be reached after retry attempts.",
      true
    );
  }
  const payload = await response.json().catch(() => ({}));
  const payloadErrorCode = typeof payload.error === "string"
    ? payload.error
    : payload.error?.code;
  if (!response.ok || (payloadErrorCode && payloadErrorCode !== "ok")) {
    throw classifyTikTokApiError(response, payload);
  }
  return payload;
}

async function getUserInfo(accessToken) {
  const fields = [
    "open_id",
    "union_id",
    "avatar_url",
    "display_name",
    "follower_count",
    "following_count",
    "likes_count",
    "video_count"
  ].join(",");
  const url = new URL(TIKTOK_USER_INFO_URL);
  url.searchParams.set("fields", fields);
  const payload = await tiktokFetch(url.toString(), accessToken);
  return payload.data?.user || null;
}

async function listVideos(accessToken, cursor = 0, maxCount = 20) {
  const fields = [
    "id",
    "title",
    "video_description",
    "duration",
    "cover_image_url",
    "share_url",
    "embed_link",
    "create_time",
    "view_count",
    "like_count",
    "comment_count",
    "share_count"
  ].join(",");
  const url = new URL(TIKTOK_VIDEO_LIST_URL);
  url.searchParams.set("fields", fields);
  const payload = await tiktokFetch(url.toString(), accessToken, {
    method: "POST",
    body: JSON.stringify({ cursor, max_count: maxCount })
  });
  return payload.data || { videos: [], cursor: 0, has_more: false };
}

async function listAllVideos(accessToken, maxPages = 5) {
  let cursor = 0;
  let hasMore = true;
  const videos = [];
  const seen = new Set();
  for (let page = 0; page < maxPages && hasMore; page += 1) {
    const payload = await listVideos(accessToken, cursor, 20);
    (payload.videos || []).filter(isOnOrAfterLiveImportCutoff).forEach((video) => {
      if (!video?.id || seen.has(video.id)) return;
      seen.add(video.id);
      videos.push(video);
    });
    cursor = payload.cursor || 0;
    hasMore = !!payload.has_more;
  }
  return { videos, cursor, has_more: hasMore };
}

async function listVideosSinceCutoff(accessToken, options = {}) {
  const requestedMaxPages = Number(options.maxPages || process.env.TIKTOK_VIDEO_SYNC_MAX_PAGES || 50);
  const maxPages = Math.min(Math.max(Number.isInteger(requestedMaxPages) ? requestedMaxPages : 50, 1), 100);
  const pageSize = 20;
  let cursor = 0;
  let hasMore = true;
  let reachedCutoff = false;
  let pagesFetched = 0;
  let skippedBeforeCutoff = 0;
  const videos = [];
  const seen = new Set();
  const listPage = options.listPage || listVideos;
  const sleep = options.sleep || ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)));
  const maxRetries = Number.isInteger(options.maxRetries)
    ? Math.min(Math.max(options.maxRetries, 0), 4)
    : DEFAULT_VIDEO_PAGE_RETRIES;
  const retryDelayMs = Number.isFinite(Number(options.retryDelayMs))
    ? Math.min(Math.max(Number(options.retryDelayMs), 0), 2000)
    : DEFAULT_VIDEO_RETRY_DELAY_MS;

  while (pagesFetched < maxPages && hasMore && !reachedCutoff) {
    let payload;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        payload = await listPage(accessToken, cursor, pageSize);
        break;
      } catch (error) {
        if (!error?.retryable || attempt >= maxRetries) throw error;
        const backoff = Math.min(retryDelayMs * (2 ** attempt), 2000);
        await sleep(Math.max(backoff, Number(error.retryAfterMs || 0)));
      }
    }
    pagesFetched += 1;
    const pageVideos = Array.isArray(payload.videos) ? payload.videos : [];

    for (const video of pageVideos) {
      if (!isOnOrAfterLiveImportCutoff(video)) {
        skippedBeforeCutoff += 1;
        reachedCutoff = true;
        continue;
      }
      if (!video?.id || seen.has(String(video.id))) continue;
      seen.add(String(video.id));
      videos.push(video);
    }

    const nextCursor = payload.cursor || 0;
    hasMore = !!payload.has_more;
    if (hasMore && String(nextCursor) === String(cursor)) {
      throw apiError(
        "tiktok_video_pagination_stalled",
        "TikTok video pagination did not advance."
      );
    }
    cursor = nextCursor;
  }

  return {
    videos,
    cursor,
    has_more: hasMore && !reachedCutoff,
    pagesFetched,
    skippedBeforeCutoff,
    reachedCutoff,
    truncated: hasMore && !reachedCutoff && pagesFetched >= maxPages
  };
}

function tokenExpiry(payload) {
  const seconds = Number(payload.expires_in || 0);
  return Date.now() + Math.max(seconds - 120, 60) * 1000;
}

module.exports = {
  requestedScopes,
  authorizationUrl,
  exchangeCode,
  refreshAccessToken,
  revokeToken,
  getUserInfo,
  listVideos,
  listAllVideos,
  listVideosSinceCutoff,
  isOnOrAfterLiveImportCutoff,
  NORTHSTAR_LIVE_IMPORT_CUTOFF,
  tokenExpiry
};
