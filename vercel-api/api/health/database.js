const crypto = require("node:crypto");
const { handleOptions, sendJson } = require("../../lib/cors");
const database = require("../../lib/db");

const CREATOR_TABLES = Object.freeze([
  "creator_accounts",
  "connected_tiktok_accounts",
  "sync_runs",
  "sync_run_errors",
  "videos",
  "account_metric_snapshots",
  "video_metric_snapshots",
  "revenue_sources"
]);

function enabled(env) {
  return String(env.NORTHSTAR_DATABASE_HEALTH_ENABLED || "").trim().toLowerCase() === "true";
}

function configuredToken(env) {
  const token = String(env.NORTHSTAR_DATABASE_HEALTH_TOKEN || "");
  return token.length >= 32 ? token : null;
}

function bearerToken(req) {
  const authorization = String(req.headers.authorization || "");
  return authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
}

function tokensMatch(received, expected) {
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}

function toCount(value) {
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error("Invalid database count.");
  }
  return count;
}

function createHandler(dependencies = {}) {
  const env = dependencies.env || process.env;
  const withDatabase = dependencies.withDatabase || database.withDatabase;
  const expectedDatabaseEnvironment = dependencies.expectedDatabaseEnvironment
    || database.expectedDatabaseEnvironment;

  return async function databaseHealthHandler(req, res) {
    if (!enabled(env)) return sendJson(req, res, 404, { error: "not_found" });
    if (handleOptions(req, res)) return;
    if (req.method !== "GET") return sendJson(req, res, 405, { error: "method_not_allowed" });

    const expectedToken = configuredToken(env);
    if (!expectedToken) {
      return sendJson(req, res, 503, { error: "database_health_unavailable" });
    }
    if (!tokensMatch(bearerToken(req), expectedToken)) {
      return sendJson(req, res, 401, { error: "unauthorized" });
    }

    try {
      const expectedEnvironment = expectedDatabaseEnvironment(env);
      const tableCounts = await withDatabase(async (sql) => {
        const rows = await sql`
          SELECT
            (SELECT COUNT(*)::integer FROM creator_accounts) AS creator_accounts,
            (SELECT COUNT(*)::integer FROM connected_tiktok_accounts) AS connected_tiktok_accounts,
            (SELECT COUNT(*)::integer FROM sync_runs) AS sync_runs,
            (SELECT COUNT(*)::integer FROM sync_run_errors) AS sync_run_errors,
            (SELECT COUNT(*)::integer FROM videos) AS videos,
            (SELECT COUNT(*)::integer FROM account_metric_snapshots) AS account_metric_snapshots,
            (SELECT COUNT(*)::integer FROM video_metric_snapshots) AS video_metric_snapshots,
            (SELECT COUNT(*)::integer FROM revenue_sources) AS revenue_sources
        `;
        if (rows.length !== 1) throw new Error("Database count query failed.");
        return Object.fromEntries(CREATOR_TABLES.map((table) => [table, toCount(rows[0][table])]));
      }, env);

      return sendJson(req, res, 200, {
        connection: "ok",
        expectedEnvironment,
        environmentMatch: true,
        allCreatorTablesEmpty: Object.values(tableCounts).every((count) => count === 0),
        tableCounts
      });
    } catch (_error) {
      return sendJson(req, res, 503, { error: "database_health_unavailable" });
    }
  };
}

const handler = createHandler();

module.exports = handler;
module.exports.createHandler = createHandler;
module.exports.CREATOR_TABLES = CREATOR_TABLES;
