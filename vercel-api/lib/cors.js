const IS_SANDBOX = process.env.NORTHSTAR_ENV === "tiktok_sandbox";

const DEPLOYED_SANDBOX_DASHBOARD_ORIGIN = "https://northstar-dashboard-sandbox.vercel.app";

function splitOrigins(value) {
  return String(value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function uniqueOrigins(origins) {
  return [...new Set(origins.filter(Boolean))];
}

function sandboxOrigins() {
  return uniqueOrigins([
    process.env.TIKTOK_SANDBOX_REDIRECT_ORIGIN || DEPLOYED_SANDBOX_DASHBOARD_ORIGIN,
    ...splitOrigins(process.env.TIKTOK_SANDBOX_FRONTEND_URLS),
    process.env.TIKTOK_SANDBOX_FRONTEND_URL,
    DEPLOYED_SANDBOX_DASHBOARD_ORIGIN
  ]);
}

const APP_ORIGIN = IS_SANDBOX
  ? sandboxOrigins()[0]
  : (process.env.APP_ORIGIN || "https://app.northstar-creator.com");

const ALLOWED_ORIGINS = IS_SANDBOX ? sandboxOrigins() : [APP_ORIGIN];

function allowedOrigin(origin) {
  return ALLOWED_ORIGINS.includes(origin);
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (allowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-CSRF-Token");
}

function handleOptions(req, res) {
  applyCors(req, res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}

function validatePostOrigin(req) {
  return allowedOrigin(req.headers.origin);
}

function sendJson(req, res, status, payload) {
  applyCors(req, res);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function redirectToApp(res, params = {}) {
  const url = new URL(APP_ORIGIN);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  res.statusCode = 302;
  res.setHeader("Location", url.toString());
  res.end();
}

module.exports = {
  APP_ORIGIN,
  ALLOWED_ORIGINS,
  applyCors,
  allowedOrigin,
  handleOptions,
  validatePostOrigin,
  sendJson,
  redirectToApp
};
