const VALID_DATABASE_ENVIRONMENTS = new Set(["production", "sandbox", "development"]);

function expectedDatabaseEnvironment(env = process.env) {
  if (env.NORTHSTAR_DATABASE_ENV) return normalizeDatabaseEnvironment(env.NORTHSTAR_DATABASE_ENV);
  if (env.NORTHSTAR_ENV === "tiktok_sandbox") return "sandbox";
  if (env.NORTHSTAR_ENV === "production" || env.NORTHSTAR_ENV === "northstar_production") return "production";
  if (env.NORTHSTAR_ENV === "development" || env.NODE_ENV === "development" || env.NODE_ENV === "test") return "development";
  throw new Error("NorthStar database environment is not configured.");
}

function normalizeDatabaseEnvironment(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!VALID_DATABASE_ENVIRONMENTS.has(normalized)) {
    throw new Error("Invalid NorthStar database environment.");
  }
  return normalized;
}

function databaseUrl(env = process.env) {
  const expected = expectedDatabaseEnvironment(env);
  const names = expected === "sandbox"
    ? ["DATABASE_URL_SANDBOX", "POSTGRES_URL_SANDBOX", "NEON_DATABASE_URL_SANDBOX"]
    : expected === "production"
      ? ["DATABASE_URL", "POSTGRES_URL", "NEON_DATABASE_URL"]
      : ["DATABASE_URL_DEVELOPMENT", "POSTGRES_URL_DEVELOPMENT", "DATABASE_URL"];

  const name = names.find((candidate) => env[candidate]);
  if (!name) {
    throw new Error(`Database URL is not configured for ${expected}.`);
  }
  return { name, value: String(env[name]).trim(), environment: expected };
}

function createSqlClient(env = process.env) {
  const { value } = databaseUrl(env);
  let neon;
  try {
    ({ neon } = require("@neondatabase/serverless"));
  } catch (error) {
    throw new Error("The Neon serverless database client is not installed.");
  }
  return neon(value);
}

async function readDatabaseEnvironment(sql) {
  const rows = await sql`
    SELECT environment
    FROM application_environment
    WHERE id = true
    LIMIT 2
  `;
  return rows;
}

async function assertDatabaseEnvironment(sql, env = process.env) {
  const expected = expectedDatabaseEnvironment(env);
  const rows = await readDatabaseEnvironment(sql);
  if (rows.length !== 1) {
    throw new Error("Database environment guard is not initialized.");
  }
  const actual = normalizeDatabaseEnvironment(rows[0].environment);
  if (actual !== expected) {
    throw new Error("Database environment mismatch.");
  }
  return { expected, actual };
}

async function withDatabase(callback, env = process.env) {
  const sql = createSqlClient(env);
  await assertDatabaseEnvironment(sql, env);
  return callback(sql);
}

module.exports = {
  VALID_DATABASE_ENVIRONMENTS,
  expectedDatabaseEnvironment,
  normalizeDatabaseEnvironment,
  databaseUrl,
  createSqlClient,
  readDatabaseEnvironment,
  assertDatabaseEnvironment,
  withDatabase
};
