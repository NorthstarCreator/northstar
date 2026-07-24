const assert = require("node:assert/strict");

const databaseHealth = require("../api/health/database");

const TABLES = databaseHealth.CREATOR_TABLES;
const STRONG_TOKEN = "health-token-for-tests-only-32-chars";

function createRequest({ method = "GET", token } = {}) {
  return {
    method,
    headers: token ? { authorization: `Bearer ${token}` } : {}
  };
}

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: "",
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(body = "") {
      this.body = body;
    }
  };
}

function parseBody(res) {
  return res.body ? JSON.parse(res.body) : null;
}

function enabledEnvironment(overrides = {}) {
  return {
    NORTHSTAR_ENV: "tiktok_sandbox",
    NORTHSTAR_DATABASE_ENV: "sandbox",
    NORTHSTAR_DATABASE_HEALTH_ENABLED: "true",
    NORTHSTAR_DATABASE_HEALTH_TOKEN: STRONG_TOKEN,
    ...overrides
  };
}

function successfulDatabaseDouble({ counts = {} } = {}) {
  let calls = 0;
  let query = "";
  const withDatabase = async (callback) => {
    calls += 1;
    const sql = async (strings) => {
      query = strings.join(" ");
      return [{
        ...Object.fromEntries(TABLES.map((table) => [table, 0])),
        ...counts
      }];
    };
    return callback(sql);
  };
  return { withDatabase, calls: () => calls, query: () => query };
}

async function testDisabledDoesNotQuery() {
  const database = successfulDatabaseDouble();
  const handler = databaseHealth.createHandler({
    env: enabledEnvironment({ NORTHSTAR_DATABASE_HEALTH_ENABLED: "" }),
    withDatabase: database.withDatabase
  });
  const res = createResponse();
  await handler(createRequest({ token: STRONG_TOKEN }), res);
  assert.equal(res.statusCode, 404);
  assert.equal(database.calls(), 0);

  const optionsResponse = createResponse();
  await handler(createRequest({ method: "OPTIONS" }), optionsResponse);
  assert.equal(optionsResponse.statusCode, 404);
  assert.equal(database.calls(), 0);
}

async function testUnauthorizedDoesNotQuery() {
  const database = successfulDatabaseDouble();
  const handler = databaseHealth.createHandler({
    env: enabledEnvironment(),
    withDatabase: database.withDatabase
  });
  for (const token of [undefined, "wrong-token"]) {
    const res = createResponse();
    await handler(createRequest({ token }), res);
    assert.equal(res.statusCode, 401);
  }
  assert.equal(database.calls(), 0);
}

async function testWeakConfiguredTokenFailsClosed() {
  const database = successfulDatabaseDouble();
  const handler = databaseHealth.createHandler({
    env: enabledEnvironment({ NORTHSTAR_DATABASE_HEALTH_TOKEN: "too-short" }),
    withDatabase: database.withDatabase
  });
  const res = createResponse();
  await handler(createRequest({ token: "too-short" }), res);
  assert.equal(res.statusCode, 503);
  assert.equal(database.calls(), 0);
}

async function testEnvironmentMismatchDoesNotQuery() {
  const database = successfulDatabaseDouble();
  const handler = databaseHealth.createHandler({
    env: enabledEnvironment({ NORTHSTAR_DATABASE_ENV: "production" }),
    withDatabase: database.withDatabase
  });
  const res = createResponse();
  await handler(createRequest({ token: STRONG_TOKEN }), res);
  assert.equal(res.statusCode, 503);
  assert.equal(database.calls(), 0);
  assert.deepEqual(parseBody(res), { error: "database_health_unavailable" });
}

async function testAuthorizedCheckIsReadOnly() {
  const database = successfulDatabaseDouble({ counts: { videos: "2" } });
  const handler = databaseHealth.createHandler({
    env: enabledEnvironment(),
    withDatabase: database.withDatabase,
    expectedDatabaseEnvironment: () => "sandbox"
  });
  const res = createResponse();
  await handler(createRequest({ token: STRONG_TOKEN }), res);
  assert.equal(res.statusCode, 200);
  const body = parseBody(res);
  assert.equal(body.connection, "ok");
  assert.equal(body.expectedEnvironment, "sandbox");
  assert.equal(body.environmentMatch, true);
  assert.equal(body.allCreatorTablesEmpty, false);
  assert.equal(body.tableCounts.videos, 2);
  assert.equal(database.calls(), 1);
  assert.match(database.query(), /^\s*SELECT\b/i);
  assert.doesNotMatch(database.query(), /\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE)\b/i);
}

async function testSensitiveValuesNeverAppear() {
  const secretUrl = "postgres://sensitive-host.invalid/database";
  const secretToken = "database-health-secret-token-value";
  const env = enabledEnvironment({
    NORTHSTAR_DATABASE_HEALTH_TOKEN: secretToken,
    DATABASE_URL_SANDBOX: secretUrl
  });
  const handler = databaseHealth.createHandler({
    env,
    expectedDatabaseEnvironment: () => "sandbox",
    withDatabase: async () => {
      throw new Error(`Failure involving ${secretUrl} and ${secretToken}`);
    }
  });
  const res = createResponse();
  const capturedLogs = [];
  const originalConsole = { log: console.log, warn: console.warn, error: console.error };
  console.log = (...values) => capturedLogs.push(values.join(" "));
  console.warn = (...values) => capturedLogs.push(values.join(" "));
  console.error = (...values) => capturedLogs.push(values.join(" "));
  try {
    await handler(createRequest({ token: secretToken }), res);
  } finally {
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  }
  assert.equal(res.statusCode, 503);
  assert.doesNotMatch(res.body, /sensitive-host|secret-token|postgres:/);
  assert.deepEqual(parseBody(res), { error: "database_health_unavailable" });
  assert.equal(capturedLogs.length, 0);
}

(async () => {
  await testDisabledDoesNotQuery();
  await testUnauthorizedDoesNotQuery();
  await testWeakConfiguredTokenFailsClosed();
  await testEnvironmentMismatchDoesNotQuery();
  await testAuthorizedCheckIsReadOnly();
  await testSensitiveValuesNeverAppear();
  console.log("Database health tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
