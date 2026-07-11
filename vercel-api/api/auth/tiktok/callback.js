const { redirectToApp } = require("../../../lib/cors");
const { setSessionCookie } = require("../../../lib/session");
const { consumeOAuthState, storeEncryptedConnection } = require("../../../lib/token-store");
const { exchangeCode, getUserInfo, tokenExpiry } = require("../../../lib/tiktok");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return redirectToApp(res, { tiktok: "error_method" });

  const url = new URL(req.url, `https://${req.headers.host}`);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const denied = url.searchParams.get("error");

  if (denied) return redirectToApp(res, { tiktok: "error_denied" });
  if (!code || !state) return redirectToApp(res, { tiktok: "error_missing_code" });

  try {
    const statePayload = await consumeOAuthState(state);
    if (!statePayload?.sessionId) return redirectToApp(res, { tiktok: "error_state" });

    const tokenPayload = await exchangeCode(code);
    const profile = await getUserInfo(tokenPayload.access_token);

    await storeEncryptedConnection(statePayload.sessionId, {
      accessToken: tokenPayload.access_token,
      refreshToken: tokenPayload.refresh_token,
      expiresAt: tokenExpiry(tokenPayload),
      refreshExpiresAt: tokenPayload.refresh_expires_in ? Date.now() + Number(tokenPayload.refresh_expires_in) * 1000 : null,
      openId: tokenPayload.open_id || profile?.open_id || "",
      scopes: String(tokenPayload.scope || statePayload.scopes.join(",")).split(",").map((scope) => scope.trim()).filter(Boolean),
      connectedAt: new Date().toISOString()
    });

    setSessionCookie(res, statePayload.sessionId);
    return redirectToApp(res, { tiktok: "connected" });
  } catch (error) {
    return redirectToApp(res, { tiktok: "error_callback" });
  }
};
