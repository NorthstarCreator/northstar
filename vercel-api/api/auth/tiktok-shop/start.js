const { sendJson } = require("../../../lib/cors");
const { requireSession } = require("../../../lib/session");
const { getConnectionMetadata } = require("../../../lib/token-store");
const { withDatabase } = require("../../../lib/db");
const { exactAccountId } = require("../../../lib/revenue-provider-contract");
const {
  authorizationEnabled,
  ENVIRONMENT,
  issueTikTokShopOAuthState
} = require("../../../lib/tiktok-shop-oauth-state");
const {
  creatorAuthorizationUrl,
  readOwnedCreatorAccount
} = require("../../../lib/tiktok-shop-oauth");

function fail(req, res, status, error) {
  return sendJson(req, res, status, { error });
}

function createHandler(dependencies = {}) {
  const sessionReader = dependencies.requireSession || requireSession;
  const connectionReader = dependencies.getConnectionMetadata || getConnectionMetadata;
  const database = dependencies.withDatabase || withDatabase;
  const accountReader = dependencies.readOwnedCreatorAccount || readOwnedCreatorAccount;
  const stateIssuer = dependencies.issueTikTokShopOAuthState || issueTikTokShopOAuthState;
  const authorizationUrl = dependencies.creatorAuthorizationUrl || creatorAuthorizationUrl;
  const enabled = dependencies.authorizationEnabled || authorizationEnabled;

  return async function handler(req, res) {
    if (process.env.NORTHSTAR_ENV !== ENVIRONMENT) {
      return fail(req, res, 404, "sandbox_route_unavailable");
    }
    if (!enabled()) {
      return fail(req, res, 404, "authorization_disabled");
    }
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return fail(req, res, 405, "method_not_allowed");
    }

    const url = new URL(req.url, "https://sandbox-api.northstar-creator.com");
    const accountValues = url.searchParams.getAll("creatorAccountId");
    let creatorAccountId;
    try {
      if (accountValues.length !== 1) throw new Error("invalid account parameter");
      creatorAccountId = exactAccountId(accountValues[0]);
    } catch {
      return fail(req, res, 400, "exact_creator_account_required");
    }

    try {
      const session = await sessionReader(req);
      if (!session?.id) return fail(req, res, 401, "session_required");
      const connection = await connectionReader(session.id);
      if (!connection?.openId) return fail(req, res, 409, "authenticated_tiktok_account_required");

      const account = await database((sql) => accountReader(sql, {
        creatorAccountId,
        tiktokOpenId: connection.openId
      }));
      if (!account) return fail(req, res, 404, "creator_account_not_found");

      const state = await stateIssuer({ creatorAccountId: account.id, sessionId: session.id });
      const location = authorizationUrl(state);
      res.statusCode = 302;
      res.setHeader("Location", location);
      res.setHeader("Cache-Control", "private, no-store, max-age=0");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.setHeader("Referrer-Policy", "no-referrer");
      res.end();
    } catch {
      return fail(req, res, 503, "authorization_start_unavailable");
    }
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
