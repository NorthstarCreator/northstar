const assert = require("node:assert/strict");

const SANDBOX_DASHBOARD_ORIGIN = "https://sandbox-dashboard.northstar-creator.com";
const SANDBOX_VERCEL_ORIGIN = "https://northstar-dashboard-sandbox.vercel.app";
const UNKNOWN_ORIGIN = "https://example.invalid";
const PRODUCTION_ORIGIN = "https://app.northstar-creator.com";

function clearModule(modulePath) {
  delete require.cache[require.resolve(modulePath)];
}

function loadCors(env = {}) {
  clearModule("../lib/cors");
  process.env.NORTHSTAR_ENV = env.NORTHSTAR_ENV || "";
  process.env.APP_ORIGIN = env.APP_ORIGIN || "";
  process.env.TIKTOK_SANDBOX_FRONTEND_URL = env.TIKTOK_SANDBOX_FRONTEND_URL || "";
  process.env.TIKTOK_SANDBOX_FRONTEND_URLS = env.TIKTOK_SANDBOX_FRONTEND_URLS || "";
  process.env.TIKTOK_SANDBOX_REDIRECT_ORIGIN = env.TIKTOK_SANDBOX_REDIRECT_ORIGIN || "";
  return require("../lib/cors");
}

function loadSession(env = {}) {
  clearModule("../lib/session");
  process.env.NORTHSTAR_ENV = env.NORTHSTAR_ENV || "";
  return require("../lib/session");
}

function responseDouble() {
  const headers = {};
  return {
    headers,
    statusCode: 200,
    setHeader(name, value) {
      headers[name] = value;
    },
    end(body = "") {
      this.body = body;
    }
  };
}

function requestDouble(origin) {
  return { headers: { origin } };
}

function testAllowedSandboxOrigin() {
  const cors = loadCors({ NORTHSTAR_ENV: "tiktok_sandbox" });
  const res = responseDouble();
  cors.applyCors(requestDouble(SANDBOX_DASHBOARD_ORIGIN), res);
  assert.equal(res.headers["Access-Control-Allow-Origin"], SANDBOX_DASHBOARD_ORIGIN);
  assert.equal(res.headers["Access-Control-Allow-Credentials"], "true");
  assert.equal(cors.validatePostOrigin(requestDouble(SANDBOX_DASHBOARD_ORIGIN)), true);
}

function testAllowedFallbackVercelSandboxOrigin() {
  const cors = loadCors({ NORTHSTAR_ENV: "tiktok_sandbox" });
  const res = responseDouble();
  cors.applyCors(requestDouble(SANDBOX_VERCEL_ORIGIN), res);
  assert.equal(res.headers["Access-Control-Allow-Origin"], SANDBOX_VERCEL_ORIGIN);
  assert.equal(res.headers["Access-Control-Allow-Credentials"], "true");
  assert.equal(cors.validatePostOrigin(requestDouble(SANDBOX_VERCEL_ORIGIN)), true);
}

function testRejectedUnknownOrigin() {
  const cors = loadCors({ NORTHSTAR_ENV: "tiktok_sandbox" });
  const res = responseDouble();
  cors.applyCors(requestDouble(UNKNOWN_ORIGIN), res);
  assert.equal(res.headers["Access-Control-Allow-Origin"], undefined);
  assert.equal(res.headers["Access-Control-Allow-Credentials"], undefined);
  assert.equal(cors.validatePostOrigin(requestDouble(UNKNOWN_ORIGIN)), false);
}

function testSandboxCookieSameSiteNone() {
  const session = loadSession({ NORTHSTAR_ENV: "tiktok_sandbox" });
  const res = responseDouble();
  session.setSessionCookie(res, "session-id");
  assert.match(res.headers["Set-Cookie"], /HttpOnly/);
  assert.match(res.headers["Set-Cookie"], /Secure/);
  assert.match(res.headers["Set-Cookie"], /SameSite=None/);
  assert.match(res.headers["Set-Cookie"], /Path=\//);
}

function testProductionCookieUnchanged() {
  const session = loadSession();
  const res = responseDouble();
  session.setSessionCookie(res, "session-id");
  assert.match(res.headers["Set-Cookie"], /HttpOnly/);
  assert.match(res.headers["Set-Cookie"], /Secure/);
  assert.match(res.headers["Set-Cookie"], /SameSite=Lax/);
  assert.match(res.headers["Set-Cookie"], /Path=\//);
}

function testOAuthRedirectTarget() {
  const cors = loadCors({ NORTHSTAR_ENV: "tiktok_sandbox" });
  const res = responseDouble();
  cors.redirectToApp(res, { tiktok: "connected" });
  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.Location, `${SANDBOX_DASHBOARD_ORIGIN}/?tiktok=connected`);
}

function testProductionOriginUnchanged() {
  const cors = loadCors({ APP_ORIGIN: PRODUCTION_ORIGIN });
  const res = responseDouble();
  cors.applyCors(requestDouble(PRODUCTION_ORIGIN), res);
  assert.equal(cors.APP_ORIGIN, PRODUCTION_ORIGIN);
  assert.equal(res.headers["Access-Control-Allow-Origin"], PRODUCTION_ORIGIN);
  assert.equal(cors.validatePostOrigin(requestDouble(PRODUCTION_ORIGIN)), true);
  assert.equal(cors.validatePostOrigin(requestDouble(SANDBOX_DASHBOARD_ORIGIN)), false);
  assert.equal(cors.validatePostOrigin(requestDouble(SANDBOX_VERCEL_ORIGIN)), false);
}

[
  testAllowedSandboxOrigin,
  testAllowedFallbackVercelSandboxOrigin,
  testRejectedUnknownOrigin,
  testSandboxCookieSameSiteNone,
  testProductionCookieUnchanged,
  testOAuthRedirectTarget,
  testProductionOriginUnchanged
].forEach((test) => test());

console.log("Sandbox CORS, cookie, and redirect tests passed.");
