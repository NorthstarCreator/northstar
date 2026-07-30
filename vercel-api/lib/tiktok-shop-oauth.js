const { exactAccountId } = require("./revenue-provider-contract");
const { authorizationEnabled, ENVIRONMENT } = require("./tiktok-shop-oauth-state");

const CREATOR_AUTHORIZATION_URL = "https://shop.tiktok.com/alliance/creator/auth";
const APP_KEY_ENV_NAME = "TIKTOK_SHOP_APP_KEY_SANDBOX";

function requiredAppKey(env = process.env) {
  if (env.NORTHSTAR_ENV !== ENVIRONMENT || !authorizationEnabled(env)) {
    throw new Error("TikTok Shop creator authorization is unavailable.");
  }
  const raw = String(env[APP_KEY_ENV_NAME] || "");
  const value = raw.trim();
  if (!value || raw !== value || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error("TikTok Shop sandbox app key is not configured.");
  }
  return value;
}

function creatorAuthorizationUrl(state, env = process.env) {
  const opaqueState = String(state || "");
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(opaqueState)) {
    throw new Error("TikTok Shop OAuth state is invalid.");
  }
  const url = new URL(CREATOR_AUTHORIZATION_URL);
  url.searchParams.set("app_key", requiredAppKey(env));
  url.searchParams.set("state", opaqueState);
  return url.toString();
}

async function readOwnedCreatorAccount(sql, { creatorAccountId, tiktokOpenId }) {
  const accountId = exactAccountId(creatorAccountId);
  const openId = String(tiktokOpenId || "");
  if (!openId) return null;
  const rows = await sql`
    SELECT ca.id
    FROM creator_accounts ca
    JOIN connected_tiktok_accounts cta ON cta.account_id = ca.id
    WHERE ca.id = ${accountId}::uuid
      AND ca.status = 'active'
      AND cta.tiktok_open_id = ${openId}
      AND cta.disconnected_at IS NULL
    LIMIT 1
  `;
  return rows.length === 1 && String(rows[0].id).toLowerCase() === accountId
    ? Object.freeze({ id: accountId })
    : null;
}

module.exports = {
  CREATOR_AUTHORIZATION_URL,
  APP_KEY_ENV_NAME,
  requiredAppKey,
  creatorAuthorizationUrl,
  readOwnedCreatorAccount
};
