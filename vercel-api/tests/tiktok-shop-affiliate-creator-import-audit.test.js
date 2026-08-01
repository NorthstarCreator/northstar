const assert = require("node:assert/strict");
const fixture = require("./fixtures/tiktok-shop-affiliate-creator.synthetic");
const {
  createImportAudit,
  assertAuditAccount
} = require("../lib/tiktok-shop-affiliate-creator-import-audit");

function audit(overrides = {}) {
  return {
    creatorAccountId: fixture.ACCOUNT_A,
    runId: "synthetic-run-1",
    operation: "search_creator_affiliate_orders",
    rangeMode: "start_date",
    reportingTimezone: "America/New_York",
    windowStartedAt: "2024-02-01T05:00:00.000Z",
    windowEndedAt: "2026-07-31T18:00:00.000Z",
    startedAt: "2026-07-31T18:00:00.000Z",
    completedAt: null,
    status: "planned",
    pageCount: 0,
    receivedCount: 0,
    mappedCount: 0,
    skippedCount: 0,
    unknownFieldCount: 0,
    providerRequestIds: ["synthetic-request-id"],
    failureCode: null,
    ...overrides
  };
}

function testImmutableSafeAudit() {
  const result = createImportAudit(audit());
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.providerRequestIds), true);
  assert.match(result.accountReference, /^acct:[0-9a-f]{64}$/);
  assert.match(result.providerRequestIds[0], /^request:[0-9a-f]{64}$/);
  assert.equal(JSON.stringify(result).includes("synthetic-request-id"), false);
  assert.equal(assertAuditAccount(result, fixture.ACCOUNT_A), result);
}

function testAccountAndSecretRejection() {
  assert.throws(() => assertAuditAccount(createImportAudit(audit()), fixture.ACCOUNT_B), { code: "creator_account_mismatch" });
  assert.throws(() => createImportAudit(audit({ creatorAccountId: "All Accounts" })), { code: "exact_account_required" });
  for (const field of ["accessToken", "refreshToken", "authorizationCode", "appSecret", "pageToken", "payload"])
    assert.throws(() => createImportAudit({ ...audit(), [field]: "synthetic-prohibited" }), { code: "invalid_import_audit" });
  assert.throws(() => createImportAudit(audit({ operation: "trace_orders" })), { code: "operation_not_allowlisted" });
  assert.throws(() => createImportAudit(audit({ receivedCount: null })), { code: "invalid_audit_received_count" });
}

[
  testImmutableSafeAudit,
  testAccountAndSecretRejection
].forEach((test) => test());

console.log("TikTok Shop Affiliate Creator import-audit tests passed.");
