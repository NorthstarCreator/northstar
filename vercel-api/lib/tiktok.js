const TIKTOK_AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const TIKTOK_REVOKE_URL = "https://open.tiktokapis.com/v2/oauth/revoke/";
const TIKTOK_USER_INFO_URL = "https://open.tiktokapis.com/v2/user/info/";
const TIKTOK_VIDEO_LIST_URL = "https://open.tiktokapis.com/v2/video/list/";

const requestedScopes = (process.env.TIKTOK_SCOPES || "user.info.basic,user.info.stats,video.list")
  .split(",")
  .map((scope) => scope.trim())
  .filter(Boolean);

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
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
  if (!response.ok || payload.error) {
    throw new Error(payload.error_description || payload.error || "TikTok token request failed.");
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

async function tiktokFetch(url, accessToken, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error?.code) {
    throw new Error(payload.error?.message || payload.error?.code || "TikTok API request failed.");
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
  tokenExpiry
};
