const IS_SANDBOX = process.env.NORTHSTAR_ENV === "tiktok_sandbox";
function requiredSandboxOrigin() {
  const value = process.env.TIKTOK_SANDBOX_FRONTEND_URL;
  if (!value) throw new Error("TIKTOK_SANDBOX_FRONTEND_URL is not configured.");
  return value;
}

const APP_ORIGIN = IS_SANDBOX
  ? requiredSandboxOrigin()
  : (process.env.APP_ORIGIN || "https://app.northstar-creator.com");

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin === APP_ORIGIN) {
    res.setHeader("Access-Control-Allow-Origin", APP_ORIGIN);
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
  return req.headers.origin === APP_ORIGIN;
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
  applyCors,
  handleOptions,
  validatePostOrigin,
  sendJson,
  redirectToApp
};
