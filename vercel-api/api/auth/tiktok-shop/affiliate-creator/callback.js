const { requireSession } = require("../../../../lib/session");
const { sendJson } = require("../../../../lib/cors");
const {
  authorizationEnabled,
  ENVIRONMENT,
  consumeTikTokShopAffiliateCreatorOAuthState,
  TikTokShopAffiliateCreatorOAuthStateError
} = require("../../../../lib/tiktok-shop-affiliate-creator-oauth-state");

function response(req, res, status, code) {
  return sendJson(req, res, status, {
    source: "tiktok_shop_affiliate_creator",
    status: code,
    connectionCreated: false,
    tokenExchangeAttempted: false
  });
}

function createHandler(dependencies = {}) {
  const sessionReader = dependencies.requireSession || requireSession;
  const stateConsumer = dependencies.consumeState || consumeTikTokShopAffiliateCreatorOAuthState;
  const enabled = dependencies.authorizationEnabled || authorizationEnabled;

  return async function handler(req, res) {
    if (process.env.NORTHSTAR_ENV !== ENVIRONMENT) {
      return response(req, res, 404, "sandbox_callback_unavailable");
    }
    if (!enabled()) return response(req, res, 404, "authorization_disabled");
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return response(req, res, 405, "method_not_allowed");
    }

    const url = new URL(req.url, "https://sandbox-api.northstar-creator.com");
    const states = url.searchParams.getAll("state");
    if (states.length !== 1 || !states[0]) return response(req, res, 400, "invalid_state");

    try {
      const session = await sessionReader(req);
      if (!session?.id) return response(req, res, 401, "session_required");
      await stateConsumer(states[0], { sessionId: session.id });
    } catch (error) {
      if (!(error instanceof TikTokShopAffiliateCreatorOAuthStateError)) {
        return response(req, res, 503, "state_validation_unavailable");
      }
      const status = error.code === "expired_state" ? "expired_state" : "invalid_state";
      return response(req, res, 400, status);
    }

    const errors = url.searchParams.getAll("error");
    const codes = url.searchParams.getAll("code");
    if (errors.length > 1 || codes.length > 1 || (errors.length && codes.length)) {
      return response(req, res, 400, "invalid_callback_parameters");
    }
    if (errors.length === 1) return response(req, res, 400, "provider_error");
    if (codes.length !== 1 || !codes[0] || codes[0] === "null") {
      return response(req, res, 400, "missing_callback_code");
    }

    return response(req, res, 200, "callback_received_token_exchange_blocked");
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
