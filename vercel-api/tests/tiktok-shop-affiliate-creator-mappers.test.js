const assert = require("node:assert/strict");
const fixture = require("./fixtures/tiktok-shop-affiliate-creator.synthetic");
const {
  mappingContext,
  assertSameCreatorAccount,
  mapCreatorProfile,
  mapAffiliateOrderSku,
  mapTargetCollaboration,
  mapTargetCollaborationProduct,
  mapSampleApplication,
  mapLiveCoreStats,
  mapLiveViewTrend
} = require("../lib/tiktok-shop-affiliate-creator-mappers");

function testIdentityAndAccountIsolation() {
  assert.equal(mappingContext(fixture.mappingContext).creatorAccountId, fixture.ACCOUNT_A);
  for (const creatorAccountId of ["All Accounts", "all", "all_accounts", "all-accounts"])
    assert.throws(() => mappingContext({ ...fixture.mappingContext, creatorAccountId }), { code: "exact_account_required" });
  assert.throws(() => mappingContext({
    ...fixture.mappingContext,
    tokenProviderCreatorId: "synthetic-other-creator"
  }), { code: "provider_creator_identity_mismatch" });
  assert.throws(() => mapCreatorProfile({
    context: fixture.mappingContext,
    response: { ...fixture.creatorProfileResponse, creator_user_open_id: "synthetic-other-creator" }
  }), { code: "provider_creator_identity_mismatch" });
  assert.throws(() => assertSameCreatorAccount(
    { creatorAccountId: fixture.ACCOUNT_A },
    { creatorAccountId: fixture.ACCOUNT_B }
  ), { code: "creator_account_mismatch" });
}

function testConfirmedProfileAndNullableOrderMapping() {
  const profile = mapCreatorProfile({
    context: fixture.mappingContext,
    response: fixture.creatorProfileResponse
  });
  assert.equal(profile.providerCreatorId, "synthetic-creator-a");
  assert.equal(profile.username, "synthetic_creator");
  assert.equal(profile.userType, 1);

  const order = mapAffiliateOrderSku({
    context: fixture.mappingContext,
    entityId: "90000000-0000-4000-8000-000000000009",
    responseOrder: fixture.affiliateOrderResponse,
    responseSku: fixture.affiliateOrderResponse.skus[0]
  });
  assert.equal(order.providerRecordId, "synthetic-order-2:synthetic-sku-2");
  assert.equal(order.productProviderId, "synthetic-product-2");
  assert.equal(order.createdAt, "2024-02-01T18:00:00.000Z");
  assert.equal(order.currency, "USD");
  for (const field of [
    "quantity", "gmvMinor", "estimatedCommissionMinor", "finalCommissionMinor",
    "refundMinor", "settledAt"
  ]) assert.equal(order[field], null);
}

function testCollaborationProductAndSampleMapping() {
  const collaboration = mapTargetCollaboration({
    context: fixture.mappingContext,
    entityId: "91000000-0000-4000-8000-000000000010",
    response: fixture.targetCollaborationResponse
  });
  assert.equal(collaboration.collaborationType, "target");
  assert.equal(collaboration.status, null);
  assert.equal(collaboration.startedAt, null);
  assert.equal(collaboration.endedAt, null);

  const product = mapTargetCollaborationProduct({
    context: fixture.mappingContext,
    entityId: "92000000-0000-4000-8000-000000000011",
    response: fixture.targetCollaborationResponse.products[0]
  });
  assert.equal(product.currency, "USD");
  assert.equal(product.priceMinor, null);
  assert.equal(product.commissionRateBasisPoints, null);

  const sample = mapSampleApplication({
    context: fixture.mappingContext,
    entityId: "93000000-0000-4000-8000-000000000012",
    response: fixture.sampleApplicationResponse
  });
  assert.equal(sample.providerRecordId, "synthetic-sample-2");
  assert.equal(sample.productProviderId, "synthetic-product-2");
  assert.equal(sample.applicationType, null);
  assert.equal(sample.status, null);
}

function testLiveMappingPreservesMoneyAndMissingValues() {
  const stats = mapLiveCoreStats({
    context: fixture.mappingContext,
    liveRoomId: "synthetic-live-room",
    response: fixture.liveCoreStatsResponse
  });
  assert.equal(stats.sales, 7);
  assert.equal(stats.currentVisitorCount, null);
  assert.equal(stats.localGmvMinor, null);
  assert.equal(stats.localUnitPriceMinor, null);
  assert.equal(stats.currency, null);

  const trend = mapLiveViewTrend({
    context: fixture.mappingContext,
    liveRoomId: "synthetic-live-room",
    response: fixture.liveViewTrendResponse
  });
  assert.equal(trend.performances[0].dataPoints[0].timestamp, "2024-02-01T18:00:00.000Z");
  assert.equal(trend.performances[0].dataPoints[1].value, null);
}

function testUnexpectedSensitiveAndUndocumentedFieldsAreIgnoredOrRejected() {
  const order = mapAffiliateOrderSku({
    context: fixture.mappingContext,
    entityId: "94000000-0000-4000-8000-000000000013",
    responseOrder: { ...fixture.affiliateOrderResponse, buyer_email: "synthetic@example.invalid" },
    responseSku: fixture.affiliateOrderResponse.skus[0]
  });
  assert.equal("buyerEmail" in order, false);
  assert.equal("priceAmount" in order, false);
}

[
  testIdentityAndAccountIsolation,
  testConfirmedProfileAndNullableOrderMapping,
  testCollaborationProductAndSampleMapping,
  testLiveMappingPreservesMoneyAndMissingValues,
  testUnexpectedSensitiveAndUndocumentedFieldsAreIgnoredOrRejected
].forEach((test) => test());

console.log("TikTok Shop Affiliate Creator mapper tests passed.");
