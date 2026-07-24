const VALID_DATABASE_ENVIRONMENTS = new Set(["production", "sandbox", "development"]);

const DATABASE_URL_NAMES = Object.freeze({
  production: ["DATABASE_URL", "POSTGRES_URL", "NEON_DATABASE_URL"],
  sandbox: ["DATABASE_URL_SANDBOX", "POSTGRES_URL_SANDBOX", "NEON_DATABASE_URL_SANDBOX"],
  development: ["DATABASE_URL_DEVELOPMENT", "POSTGRES_URL_DEVELOPMENT"]
});

function normalizeApplicationEnvironment(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "tiktok_sandbox") return "sandbox";
  if (normalized === "northstar_production") return "production";
  if (VALID_DATABASE_ENVIRONMENTS.has(normalized)) return normalized;
  throw new Error("Invalid or missing NorthStar application environment.");
}

function expectedDatabaseEnvironment(env = process.env) {
  const applicationEnvironment = normalizeApplicationEnvironment(env.NORTHSTAR_ENV);
  const databaseEnvironment = normalizeDatabaseEnvironment(env.NORTHSTAR_DATABASE_ENV);
  if (applicationEnvironment !== databaseEnvironment) {
    throw new Error("NorthStar application and database environments do not match.");
  }
  return databaseEnvironment;
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
  const populated = DATABASE_URL_NAMES[expected].filter((name) => String(env[name] || "").trim());
  if (populated.length === 0) {
    throw new Error(`Database URL is not configured for ${expected}.`);
  }
  if (populated.length > 1) {
    throw new Error(`Ambiguous database URL configuration for ${expected}.`);
  }
  const [name] = populated;
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
  DATABASE_URL_NAMES,
  normalizeApplicationEnvironment,
  expectedDatabaseEnvironment,
  normalizeDatabaseEnvironment,
  databaseUrl,
  createSqlClient,
  readDatabaseEnvironment,
  assertDatabaseEnvironment,
  withDatabase
};
