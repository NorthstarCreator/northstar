const { randomToken, timingSafeEqual } = require("./crypto");
const { getSession, storeSession } = require("./token-store");

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "northstar_session";

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(header.split(";").map((part) => {
    const [key, ...value] = part.trim().split("=");
    return [key, decodeURIComponent(value.join("=") || "")];
  }).filter(([key]) => key));
}

function setSessionCookie(res, sessionId) {
  const cookie = [
    `${COOKIE_NAME}=${encodeURIComponent(sessionId)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Max-Age=2592000"
  ].join("; ");
  res.setHeader("Set-Cookie", cookie);
}

async function getOrCreateSession(req, res) {
  const cookies = parseCookies(req);
  const existingId = cookies[COOKIE_NAME];
  if (existingId) {
    const existing = await getSession(existingId);
    if (existing?.id) {
      setSessionCookie(res, existing.id);
      return existing;
    }
  }
  const session = {
    id: randomToken(32),
    csrfToken: randomToken(32),
    createdAt: new Date().toISOString()
  };
  await storeSession(session);
  setSessionCookie(res, session.id);
  return session;
}

async function requireSession(req) {
  const cookies = parseCookies(req);
  const sessionId = cookies[COOKIE_NAME];
  if (!sessionId) return null;
  return getSession(sessionId);
}

async function requireCsrf(req) {
  const session = await requireSession(req);
  if (!session?.csrfToken) return null;
  const provided = req.headers["x-csrf-token"];
  if (!timingSafeEqual(provided, session.csrfToken)) return null;
  return session;
}

module.exports = {
  COOKIE_NAME,
  parseCookies,
  setSessionCookie,
  getOrCreateSession,
  requireSession,
  requireCsrf
};
