const { parseCookies, COOKIE_NAME } = require("../../../lib/session");
const { sendJson } = require("../../../lib/cors");
const {
  consumeTikTokShopOAuthState,
  TikTokShopOAuthStateError
} = require("../../../lib/tiktok-shop-oauth-state");

const DENIAL_ERRORS = new Set(["auth_denied", "access_denied"]);

function response(req, res, status, code) {
  return sendJson(req, res, status, {
    source: "tiktok_shop",
    status: code,
    connectionCreated: false,
    tokenExchangeAttempted: false
  });
}

function singleParameter(searchParams, name) {
  const values = searchParams.getAll(name);
  return values.length === 1 ? values[0] : null;
}

module.exports = async function handler(req, res) {
  if (process.env.NORTHSTAR_ENV !== "tiktok_sandbox") {
    return response(req, res, 404, "sandbox_callback_unavailable");
  }
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return response(req, res, 405, "method_not_allowed");
  }

  const url = new URL(req.url, "https://sandbox-api.northstar-creator.com");
  const state = singleParameter(url.searchParams, "state");
  if (!state) return response(req, res, 400, "invalid_state");

  try {
    const sessionId = parseCookies(req)[COOKIE_NAME];
    consumeTikTokShopOAuthState(state, { sessionId });
  } catch (error) {
    const status = error instanceof TikTokShopOAuthStateError && error.code === "expired_state"
      ? "expired_state"
      : "invalid_state";
    return response(req, res, 400, status);
  }

  const providerErrors = url.searchParams.getAll("error");
  const codes = url.searchParams.getAll("code");
  if (providerErrors.length > 1 || codes.length > 1) {
    return response(req, res, 400, "invalid_callback_parameters");
  }
  if (providerErrors.length === 1) {
    const providerError = providerErrors[0];
    return response(req, res, 400, DENIAL_ERRORS.has(providerError) ? "authorization_denied" : "provider_error");
  }
  const code = codes.length === 1 ? codes[0] : null;
  if (!code || code === "null") return response(req, res, 400, "missing_authorization_code");

  return response(req, res, 200, "authorization_code_received_token_exchange_blocked");
};
