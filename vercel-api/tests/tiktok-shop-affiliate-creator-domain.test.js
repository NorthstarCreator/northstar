const assert = require("node:assert/strict");
const fixture = require("./fixtures/tiktok-shop-affiliate-creator.synthetic");
const {
  createImportPolicy,
  createIdentityBinding,
  transitionIdentityBinding,
  assertAccountScope,
  createCollaboration,
  createProduct,
  createSampleApplication,
  createAffiliateOrder,
  createAttribution
} = require("../lib/tiktok-shop-affiliate-creator-domain");

function testImportHistoryModesAreCompleteAndAccountScoped() {
  assert.deepEqual(createImportPolicy({
    creatorAccountId: fixture.ACCOUNT_A,
    rangeMode: "start_date",
    inclusiveStartDate: "2024-02-01",
    reportingTimezone: "America/New_York"
  }), {
    creatorAccountId: fixture.ACCOUNT_A,
    provider: "tiktok_shop_affiliate_creator",
    rangeMode: "start_date",
    inclusiveStartDate: "2024-02-01",
    reportingTimezone: "America/New_York"
  });
  assert.deepEqual(createImportPolicy({
    creatorAccountId: fixture.ACCOUNT_A,
    rangeMode: "all_available",
    inclusiveStartDate: null,
    reportingTimezone: "America/New_York"
  }), {
    creatorAccountId: fixture.ACCOUNT_A,
    provider: "tiktok_shop_affiliate_creator",
    rangeMode: "all_available",
    inclusiveStartDate: null,
    reportingTimezone: "America/New_York"
  });
  assert.throws(() => createImportPolicy({ creatorAccountId: fixture.ACCOUNT_A, rangeMode: "start_date", reportingTimezone: "UTC" }), { code: "inclusive_start_date_required" });
  assert.throws(() => createImportPolicy({ creatorAccountId: fixture.ACCOUNT_A, rangeMode: "all_available", inclusiveStartDate: "2025-10-01", reportingTimezone: "UTC" }), { code: "all_available_disallows_start_date" });
  assert.throws(() => createImportPolicy({ creatorAccountId: fixture.ACCOUNT_A, rangeMode: "start_date", inclusiveStartDate: "2024-02-30", reportingTimezone: "UTC" }), { code: "invalid_inclusive_start_date" });
  assert.throws(() => createImportPolicy({ creatorAccountId: fixture.ACCOUNT_A, rangeMode: "all_available", reportingTimezone: "Not/AZone" }), { code: "invalid_reporting_timezone" });
  for (const value of ["all", "All Accounts", "all_accounts", "all-accounts"])
    assert.throws(() => createImportPolicy({ creatorAccountId: value, rangeMode: "all_available", reportingTimezone: "UTC" }), { code: "exact_account_required" });
}

function testIdentityAndCrossAccountIsolation() {
  const binding = createIdentityBinding(fixture.binding);
  assert.equal(binding.state, "disabled");
  assert.equal(assertAccountScope(binding, fixture.ACCOUNT_A), binding);
  assert.throws(() => assertAccountScope(binding, fixture.ACCOUNT_B), { code: "creator_account_mismatch" });
  assert.throws(() => createIdentityBinding({ ...fixture.binding, creatorAccountId: "all" }), { code: "exact_account_required" });
  assert.throws(() => createIdentityBinding({ ...fixture.binding, state: "connected" }), { code: "invalid_authorization_state" });
  const pending = transitionIdentityBinding(binding, { toState: "pending" });
  const authorized = transitionIdentityBinding(pending, {
    toState: "authorized",
    providerCreatorId: "synthetic-creator-a"
  });
  assert.equal(authorized.providerCreatorId, "synthetic-creator-a");
  assert.throws(() => transitionIdentityBinding(authorized, { toState: "pending" }), { code: "invalid_authorization_transition" });
  assert.throws(() => transitionIdentityBinding(authorized, {
    toState: "revoked",
    providerCreatorId: "synthetic-creator-b"
  }), { code: "provider_creator_identity_immutable" });
  const revoked = transitionIdentityBinding(authorized, { toState: "revoked" });
  assert.throws(() => transitionIdentityBinding(revoked, { toState: "pending" }), { code: "invalid_authorization_transition" });
  assert.throws(() => createIdentityBinding({ ...fixture.binding, state: "authorized" }), { code: "authorized_identity_required" });
}

function testModelsPreserveUnavailableValues() {
  assert.equal(createCollaboration(fixture.collaboration).status, null);
  const product = createProduct(fixture.product);
  assert.equal(product.priceMinor, null);
  assert.equal(product.commissionRateBasisPoints, null);
  assert.equal(createSampleApplication(fixture.sample).status, null);
  const order = createAffiliateOrder(fixture.order);
  for (const field of [
    "quantity", "currency", "gmvMinor", "estimatedCommissionMinor",
    "finalCommissionMinor", "refundMinor", "settledAt"
  ]) assert.equal(order[field], null);
  const attribution = createAttribution(fixture.attribution);
  assert.equal(attribution.attributionType, "unknown");
  assert.equal(attribution.contentProviderId, null);
}

function testModelsRejectCrossAccountAndUnexpectedSensitiveFields() {
  const order = createAffiliateOrder(fixture.order);
  assert.throws(() => assertAccountScope(order, fixture.ACCOUNT_B), { code: "creator_account_mismatch" });
  for (const field of ["email", "phone", "address", "buyerId", "accessToken", "shopperActivity"])
    assert.throws(() => createAffiliateOrder({ ...fixture.order, [field]: "synthetic-prohibited" }), { code: "invalid_affiliate_order" });
  assert.throws(() => createAffiliateOrder({ ...fixture.order, gmvMinor: 0.5 }), { code: "invalid_order_gmv" });
  assert.throws(() => createAttribution({ ...fixture.attribution, attributionType: "shop_ads" }), { code: "invalid_attribution_type" });
}

[
  testImportHistoryModesAreCompleteAndAccountScoped,
  testIdentityAndCrossAccountIsolation,
  testModelsPreserveUnavailableValues,
  testModelsRejectCrossAccountAndUnexpectedSensitiveFields
].forEach((test) => test());

console.log("TikTok Shop Affiliate Creator domain tests passed.");
