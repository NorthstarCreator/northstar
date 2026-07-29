const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { buildSourceStatuses, readRevenueSourceStatus } = require("../lib/revenue-source-status");

function sqlFixture(results) {
  const calls = [];
  const sql = async (strings, ...values) => {
    calls.push({ text: strings.join("?"), values });
    return results[calls.length - 1] || [];
  };
  sql.calls = calls;
  return sql;
}

function testDefaultsKeepDisplayCutoffIsolated() {
  const sources = buildSourceStatuses({ displayFirstImportStatus: "approved" });
  assert.deepEqual(sources.map(({ sourceCode }) => sourceCode), [
    "tiktok_display_api", "tiktok_shop", "creator_rewards", "tiktok_go"
  ]);
  assert.equal(sources[0].cutoffStartAt, "2025-10-01T00:00:00.000Z");
  assert.equal(sources[0].firstImportStatus, "approved");
  assert.ok(sources.slice(1).every(({ cutoffStartAt }) => cutoffStartAt === null));
  assert.ok(sources.every(({ reportingTimezone }) => reportingTimezone === "America/New_York"));
  assert.ok(sources.every(({ policyConfigurationStatus }) => policyConfigurationStatus === "not_configured"));
  assert.equal(sources[0].providerBlockers.length, 0);
  assert.ok(sources.slice(1).every(({ providerBlockers }) => providerBlockers.length > 0));
  assert.equal(sources.some(({ sourceCode }) => /all/i.test(sourceCode)), false);
}

async function testExactAccountIsolationAndOptionalPolicyRows() {
  const accountId = "00000000-0000-4000-8000-000000000001";
  const sql = sqlFixture([
    [{ id: accountId, display_name: "Exact Creator", policy_table: "source_import_policies" }],
    [{ status: "approved" }],
    [{
      source_code: "tiktok_shop",
      import_range_mode: "all_available",
      reporting_timezone: "America/Los_Angeles",
      status: "approved",
      first_import_status: "pending_review"
    }]
  ]);

  const result = await readRevenueSourceStatus(sql, "exact-open-id");
  assert.deepEqual(result.account, { id: accountId, displayName: "Exact Creator" });
  const shop = result.sources.find(({ sourceCode }) => sourceCode === "tiktok_shop");
  assert.equal(shop.approvalStatus, "unconfirmed");
  assert.equal(shop.policyApprovalStatus, "approved");
  assert.equal(shop.selectedRangeMode, "all_available");
  assert.equal(shop.reportingTimezone, "America/Los_Angeles");
  assert.equal(shop.firstImportStatus, "pending_review");
  assert.equal(shop.policyConfigurationStatus, "configured");
  assert.equal(shop.blockingReason, "provider_documentation_required");
  assert.equal(shop.providerConnectionState, "blocked");
  assert.ok(shop.providerBlockers.includes("provider_endpoint_unconfirmed"));
  assert.equal(shop.cutoffStartAt, null);

  assert.match(sql.calls[0].text, /tiktok_open_id = \?/);
  assert.deepEqual(sql.calls[0].values, ["exact-open-id"]);
  assert.match(sql.calls[1].text, /account_id = \?::uuid/);
  assert.deepEqual(sql.calls[1].values, [accountId]);
  assert.match(sql.calls[2].text, /account_id = \?::uuid/);
  assert.deepEqual(sql.calls[2].values, [accountId]);
  assert.ok(sql.calls.every(({ text }) => !/\b(?:INSERT|UPDATE|DELETE|UPSERT|MERGE|TRUNCATE)\b/i.test(text)));
}

async function testMissingPolicyTableIsMigrationSafe() {
  const sql = sqlFixture([
    [{ id: "00000000-0000-4000-8000-000000000002", display_name: "Pre-migration Creator", policy_table: null }],
    []
  ]);
  const result = await readRevenueSourceStatus(sql, "pre-migration-open-id");
  assert.equal(sql.calls.length, 2);
  assert.equal(result.policyTableAvailable, false);
  assert.equal(result.sources.length, 4);
  assert.ok(result.sources.every(({ policyConfigurationStatus }) => policyConfigurationStatus === "not_configured"));
  assert.ok(result.sources.every(({ firstImportStatus }) => firstImportStatus === "not_started"));
}

function testEndpointIsGetOnlyAndHasNoActionPath() {
  const endpoint = fs.readFileSync(path.join(__dirname, "../api/revenue/source-status.js"), "utf8");
  const readModel = fs.readFileSync(path.join(__dirname, "../lib/revenue-source-status.js"), "utf8");
  assert.match(endpoint, /req\.method !== "GET"/);
  assert.match(endpoint, /getConnectionMetadata\(session\.id\)/);
  assert.doesNotMatch(endpoint, /getConnection\(session\.id\)/);
  assert.doesNotMatch(endpoint, /activeConnection|\bsync\b|\bdisconnect\b|refreshAccessToken|fetchTikTok|\bPOST\b/);
  assert.doesNotMatch(`${endpoint}\n${readModel}`, /\b(?:INSERT|UPDATE|DELETE|UPSERT|MERGE|TRUNCATE)\b/i);
  assert.doesNotMatch(`${endpoint}\n${readModel}`, /demo|reference.file/i);
}

(async () => {
  testDefaultsKeepDisplayCutoffIsolated();
  await testExactAccountIsolationAndOptionalPolicyRows();
  await testMissingPolicyTableIsMigrationSafe();
  testEndpointIsGetOnlyAndHasNoActionPath();
  console.log("Revenue source-status tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
