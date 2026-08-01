const assert = require("node:assert/strict");
const fixture = require("./fixtures/tiktok-shop-affiliate-creator.synthetic");
const {
  createImportPlan,
  createPaginationRequest
} = require("../lib/tiktok-shop-affiliate-creator-import-plan");

function policy(overrides = {}) {
  return {
    creatorAccountId: fixture.ACCOUNT_A,
    rangeMode: "start_date",
    inclusiveStartDate: "2024-02-01",
    reportingTimezone: "America/New_York",
    ...overrides
  };
}

function testStartDateUsesCreatorTimezoneAndImmutableUpperBoundary() {
  const plan = createImportPlan({
    creatorAccountId: fixture.ACCOUNT_A,
    policy: policy(),
    runStartedAt: "2026-07-31T18:00:00.000Z"
  });
  assert.equal(plan.createTimeGe, "2024-02-01T05:00:00.000Z");
  assert.equal(plan.createTimeLt, "2026-07-31T18:00:00.000Z");
  assert.equal(plan.runStartedAt, plan.createTimeLt);
  assert.doesNotMatch(JSON.stringify(plan), /2025-10-01/);
}

function testAllAvailableOmitsLowerBoundary() {
  const plan = createImportPlan({
    creatorAccountId: fixture.ACCOUNT_A,
    policy: policy({ rangeMode: "all_available", inclusiveStartDate: null }),
    runStartedAt: "2026-07-31T18:00:00.000Z"
  });
  assert.equal(plan.createTimeGe, null);
  assert.equal(plan.createTimeLt, "2026-07-31T18:00:00.000Z");
}

function testAccountAndWindowValidation() {
  assert.throws(() => createImportPlan({
    creatorAccountId: fixture.ACCOUNT_B,
    policy: policy(),
    runStartedAt: "2026-07-31T18:00:00.000Z"
  }), { code: "creator_account_mismatch" });
  for (const creatorAccountId of ["All Accounts", "all", "all_accounts", "all-accounts"])
    assert.throws(() => createImportPlan({ creatorAccountId, policy: policy(), runStartedAt: "2026-07-31T18:00:00.000Z" }), { code: "exact_account_required" });
  assert.throws(() => createImportPlan({
    creatorAccountId: fixture.ACCOUNT_A,
    policy: policy({ inclusiveStartDate: "2026-08-01" }),
    runStartedAt: "2026-07-31T18:00:00.000Z"
  }), { code: "invalid_import_time_window" });
}

function testDeterministicPaginationAndReplayDetection() {
  const plan = createImportPlan({
    creatorAccountId: fixture.ACCOUNT_A,
    policy: policy(),
    runStartedAt: "2026-07-31T18:00:00.000Z"
  });
  const first = createPaginationRequest({
    creatorAccountId: fixture.ACCOUNT_A,
    importPlan: plan,
    operation: "search_creator_affiliate_orders",
    pageSize: 100
  });
  assert.equal(first.pageToken, null);
  assert.equal(first.createTimeGe, plan.createTimeGe);
  assert.equal(first.createTimeLt, plan.createTimeLt);
  const next = createPaginationRequest({
    creatorAccountId: fixture.ACCOUNT_A,
    importPlan: plan,
    operation: "search_creator_affiliate_orders",
    pageSize: 100,
    pageToken: "synthetic-opaque-token"
  });
  assert.match(next.pageTokenHash, /^[0-9a-f]{64}$/);
  assert.equal(next.pageTokenHash.includes("synthetic"), false);
  assert.throws(() => createPaginationRequest({
    creatorAccountId: fixture.ACCOUNT_A,
    importPlan: plan,
    operation: "search_creator_affiliate_orders",
    pageSize: 100,
    pageToken: "synthetic-opaque-token",
    seenPageTokenHashes: [next.pageTokenHash]
  }), { code: "repeated_page_token" });
  assert.throws(() => createPaginationRequest({
    creatorAccountId: fixture.ACCOUNT_A,
    importPlan: plan,
    operation: "get_showcase_products",
    pageSize: 21
  }), { code: "invalid_page_size" });
  assert.throws(() => createPaginationRequest({
    creatorAccountId: fixture.ACCOUNT_A,
    importPlan: plan,
    operation: "get_live_core_stats",
    pageSize: 1
  }), { code: "pagination_contract_unconfirmed" });
  assert.throws(() => createPaginationRequest({
    creatorAccountId: fixture.ACCOUNT_B,
    importPlan: plan,
    operation: "search_creator_affiliate_orders",
    pageSize: 20
  }), { code: "creator_account_mismatch" });
}

[
  testStartDateUsesCreatorTimezoneAndImmutableUpperBoundary,
  testAllAvailableOmitsLowerBoundary,
  testAccountAndWindowValidation,
  testDeterministicPaginationAndReplayDetection
].forEach((test) => test());

console.log("TikTok Shop Affiliate Creator import-plan tests passed.");
