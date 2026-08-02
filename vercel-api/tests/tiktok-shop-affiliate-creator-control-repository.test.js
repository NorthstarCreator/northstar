const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  AffiliateCreatorControlRepositoryError,
  creatorAccountId,
  normalizeControlStatus,
  readAffiliateCreatorControlStatus
} = require("../lib/tiktok-shop-affiliate-creator-control-repository");

const ACCOUNT_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_ACCOUNT_ID = "00000000-0000-4000-8000-000000000002";

function sqlReader(rows) {
  const calls = [];
  const sql = async (strings, ...values) => {
    calls.push({ text: strings.join("?"), values });
    return rows;
  };
  return { sql, calls };
}

function testExactAccountValidation() {
  assert.equal(creatorAccountId(ACCOUNT_ID), ACCOUNT_ID);
  for (const value of [
    null, "", "not-a-uuid", "All", "ALL ACCOUNTS", "all-accounts",
    "all_accounts", "allaccounts"
  ]) {
    assert.throws(
      () => creatorAccountId(value),
      (error) => error instanceof AffiliateCreatorControlRepositoryError
    );
  }
}

async function testParameterizedExactAccountRead() {
  const { sql, calls } = sqlReader([]);
  const result = await readAffiliateCreatorControlStatus(sql, ACCOUNT_ID);
  assert.deepEqual(result, {
    configurationStatus: "not_configured",
    connectionState: "inactive",
    policyStatus: "not_configured",
    rangeMode: null,
    requestedStartDate: null,
    effectiveStartAt: null,
    reportingTimezone: null,
    firstImportStatus: "not_started",
    latestImportStatus: null,
    latestWindowStartAt: null,
    latestWindowEndAt: null,
    blockingReason: "creator_account_not_found"
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].values.filter((value) => value === ACCOUNT_ID).length, 1);
  assert.equal(calls[0].values.filter((value) => value === "tiktok_shop_affiliate_creator").length, 3);
  assert.ok(calls[0].values.some((value) => Array.isArray(value) && value.includes("all-accounts")));
  assert.match(calls[0].text, /^\s*SELECT\b/i);
  assert.match(calls[0].text, /WHERE ca\.id = \?::uuid/);
  assert.match(calls[0].text, /connection\.account_id = ca\.id/);
  assert.match(calls[0].text, /policy\.account_id = ca\.id/);
  assert.match(calls[0].text, /run\.account_id = ca\.id/);
}

async function testControlledConfiguredAndUnknownStates() {
  const row = {
    account_id: ACCOUNT_ID,
    connection_state: "disabled",
    policy_status: "draft",
    import_range_mode: "all_available",
    requested_start_date: null,
    effective_start_at: null,
    reporting_timezone: "America/New_York",
    policy_first_import_status: null,
    latest_import_status: null,
    latest_window_start_at: null,
    latest_window_end_at: null,
    provider_creator_open_id: "must-not-be-exposed"
  };
  const result = normalizeControlStatus(row, ACCOUNT_ID);
  assert.equal(result.configurationStatus, "configured");
  assert.equal(result.connectionState, "disabled");
  assert.equal(result.policyStatus, "draft");
  assert.equal(result.firstImportStatus, "not_started");
  assert.equal(result.blockingReason, "connection_inactive");
  assert.equal("accountId" in result, false);
  assert.equal("providerCreatorId" in result, false);
  assert.equal(JSON.stringify(result).includes("must-not-be-exposed"), false);
}

async function testCrossAccountAndAmbiguousResultsFailClosed() {
  await assert.rejects(
    readAffiliateCreatorControlStatus(sqlReader([{ account_id: OTHER_ACCOUNT_ID }]).sql, ACCOUNT_ID),
    (error) => error.code === "cross_account_result_rejected"
  );
  await assert.rejects(
    readAffiliateCreatorControlStatus(sqlReader([{ account_id: ACCOUNT_ID }, { account_id: ACCOUNT_ID }]).sql, ACCOUNT_ID),
    (error) => error.code === "ambiguous_control_status"
  );
  await assert.rejects(
    readAffiliateCreatorControlStatus(null, ACCOUNT_ID),
    (error) => error.code === "database_reader_required"
  );
}

function testStaticReadOnlyAndRouteIsolation() {
  const root = path.join(__dirname, "..");
  const modulePath = path.join(root, "lib/tiktok-shop-affiliate-creator-control-repository.js");
  const source = fs.readFileSync(modulePath, "utf8");
  const sqlBodies = [...source.matchAll(/await sql`([\s\S]*?)`/g)].map((match) => match[1]);
  assert.equal(sqlBodies.length, 1);
  assert.ok(sqlBodies.every((body) => /^\s*SELECT\b/i.test(body)));
  assert.doesNotMatch(source, /\b(?:INSERT|UPDATE|DELETE|UPSERT|MERGE|TRUNCATE|ALTER|CREATE|DROP|GRANT|REVOKE|CALL|DO)\b/i);
  assert.doesNotMatch(source, /https?:\/\/|\bfetch\s*\(|axios|redis|upstash|oauth|access_token|refresh_token|authorization_code|app_secret/i);
  assert.doesNotMatch(source, /erase_affiliate_creator_control_data\s*\(|2025-10-01|live-import-policy|videos|sync_runs/i);
  assert.doesNotMatch(source, /process\.env|TIKTOK_SHOP_AFFILIATE_CREATOR_AUTH_ENABLED|IMPORT_ENABLED/);

  const apiRoot = path.join(root, "api");
  const routeFiles = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (entry.name.endsWith(".js")) routeFiles.push(target);
    }
  };
  visit(apiRoot);
  const routes = routeFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");
  assert.equal(routes.includes("tiktok-shop-affiliate-creator-control-repository"), false);
}

(async () => {
  testExactAccountValidation();
  await testParameterizedExactAccountRead();
  await testControlledConfiguredAndUnknownStates();
  await testCrossAccountAndAmbiguousResultsFailClosed();
  testStaticReadOnlyAndRouteIsolation();
  console.log("TikTok Shop Affiliate Creator control repository tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
