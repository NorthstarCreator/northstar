const { handleOptions, redirectToApp } = require("../../../lib/cors");
const { getOrCreateSession } = require("../../../lib/session");
const { storeOAuthState } = require("../../../lib/token-store");
const { randomToken } = require("../../../lib/crypto");
const { authorizationUrl, requestedScopes } = require("../../../lib/tiktok");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "GET") return redirectToApp(res, { tiktok: "error_method" });

  try {
    const session = await getOrCreateSession(req, res);
    const state = randomToken(32);
    await storeOAuthState(state, {
      sessionId: session.id,
      scopes: requestedScopes,
      createdAt: new Date().toISOString()
    });
    res.statusCode = 302;
    res.setHeader("Location", authorizationUrl(state));
    res.end();
  } catch (error) {
    redirectToApp(res, { tiktok: "error_config" });
  }
};
