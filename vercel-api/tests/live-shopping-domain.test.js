const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  LIVE_SHOPPING_PROVIDER,
  LIVE_SHOPPING_REVENUE_KIND,
  LIVE_GIFTS_REVENUE_KIND,
  LiveShoppingDomainError,
  createLiveShoppingSession,
  createLiveProductRelationship,
  createLiveAffiliateMetric,
  createLiveShoppingBundle,
  summarizeLiveShopping,
  liveShoppingSourceStatuses
} = require("../lib/live-shopping-domain");

const ACCOUNT_ID = "00000000-0000-4000-8000-000000000001";
const SESSION_ID = "00000000-0000-4000-8000-000000000002";
const PRODUCT_ID = "00000000-0000-4000-8000-000000000003";
const RELATIONSHIP_ID = "00000000-0000-4000-8000-000000000004";
const METRIC_ID = "00000000-0000-4000-8000-000000000005";
const SECOND_PRODUCT_ID = "00000000-0000-4000-8000-000000000006";

function session(overrides = {}) {
  return {
    id: SESSION_ID,
    creatorAccountId: ACCOUNT_ID,
    source: "manual",
    title: "",
    startedAt: "2026-07-30T12:00:00.000Z",
    endedAt: "2026-07-30T14:00:00.000Z",
    replay: { available: false },
    sourceRecordId: null,
    ...overrides
  };
}

function relationship(overrides = {}) {
  return {
    id: RELATIONSHIP_ID,
    creatorAccountId: ACCOUNT_ID,
    liveSessionId: SESSION_ID,
    productId: PRODUCT_ID,
    source: "manual",
    featuredAt: "2026-07-30T12:10:00.000Z",
    removedAt: null,
    sourceRecordId: null,
    ...overrides
  };
}

function metric(overrides = {}) {
  return {
    id: METRIC_ID,
    creatorAccountId: ACCOUNT_ID,
    liveSessionId: SESSION_ID,
    productId: PRODUCT_ID,
    source: "manual",
    bucketStartedAt: "2026-07-30T12:00:00.000Z",
    bucketEndedAt: "2026-07-30T14:00:00.000Z",
    orders: 3,
    units: 4,
    gmvMinor: 12500,
    estimatedCommissionMinor: 1500,
    finalCommissionMinor: 1400,
    refundCount: 1,
    refundGmvMinor: 1000,
    refundCommissionMinor: 120,
    sourceRecordId: null,
    ...overrides
  };
}

function throwsCode(callback, code) {
  assert.throws(callback, (error) => error instanceof LiveShoppingDomainError && error.code === code);
}

function testModelsAndRelationships() {
  const normalizedSession = createLiveShoppingSession(session());
  assert.equal(normalizedSession.provider, LIVE_SHOPPING_PROVIDER);
  assert.equal(normalizedSession.revenueKind, LIVE_SHOPPING_REVENUE_KIND);
  assert.deepEqual(normalizedSession.replay, {
    available: false, url: null, publishedAt: null, expiresAt: null
  });
  assert.equal(createLiveProductRelationship(relationship()).productId, PRODUCT_ID);
  assert.equal(createLiveAffiliateMetric(metric()).gmvMinor, 12500);

  const bundle = createLiveShoppingBundle({
    session: session(), products: [relationship()], metrics: [metric()]
  });
  assert.equal(bundle.products.length, 1);
  assert.equal(bundle.metrics.length, 1);
  assert.equal(bundle.summary.salesPerHour, 2);
  assert.equal(bundle.summary.gmvPerHourMinor, 6250);
  assert.equal(bundle.summary.liveGiftRevenueIncluded, false);
  assert.equal(bundle.summary.finalCommissionStatus, "final");
}

function testMetricsAndPendingFinalCommission() {
  const summary = summarizeLiveShopping(session(), [
    metric({ finalCommissionMinor: null })
  ]);
  assert.deepEqual(summary, {
    orders: 3,
    units: 4,
    gmvMinor: 12500,
    estimatedCommissionMinor: 1500,
    finalCommissionMinor: null,
    finalizedMetricCount: 0,
    refundCount: 1,
    refundGmvMinor: 1000,
    refundCommissionMinor: 120,
    finalCommissionStatus: "partial_or_pending",
    durationHours: 2,
    salesPerHour: 2,
    gmvPerHourMinor: 6250,
    liveGiftRevenueIncluded: false
  });
}

function testSourcesFailClosed() {
  assert.deepEqual(liveShoppingSourceStatuses(), [
    { code: "manual", label: "Manual", availability: "available", blockingReason: null },
    { code: "imported", label: "Imported", availability: "available", blockingReason: null },
    { code: "tiktok_api", label: "TikTok API", availability: "unavailable", blockingReason: "affiliate_creator_api_authorization_required" }
  ]);
  assert.equal(createLiveShoppingSession(session({ source: "imported" })).source, "imported");
  throwsCode(
    () => createLiveShoppingSession(session({ source: "tiktok_api" })),
    "affiliate_creator_api_authorization_required"
  );
  throwsCode(() => createLiveShoppingSession(session({ source: "demo" })), "invalid_live_shopping_source");
}

function testExactAccountAndIdentityIsolation() {
  for (const creatorAccountId of ["all", "all-accounts", "all_accounts", "All Accounts", "not-a-uuid"]) {
    assert.throws(
      () => createLiveShoppingSession(session({ creatorAccountId })),
      (error) => error.code === "exact_account_required"
    );
  }
  throwsCode(() => createLiveShoppingBundle({
    session: session(),
    products: [relationship({ creatorAccountId: "00000000-0000-4000-8000-000000000099" })]
  }), "live_session_identity_mismatch");
  throwsCode(() => createLiveShoppingBundle({
    session: session(),
    products: [relationship()],
    metrics: [metric({ liveSessionId: "00000000-0000-4000-8000-000000000099" })]
  }), "live_session_identity_mismatch");
  throwsCode(() => createLiveShoppingBundle({
    session: session(),
    metrics: [metric()]
  }), "unlinked_live_product_metric");
}

function testSensitiveFieldsAndGiftSeparation() {
  const prohibited = [
    "directMessage", "phoneNumber", "emailAddress", "address", "loginIp",
    "paymentDetails", "searchHistory", "watchHistory", "customerServiceConversation",
    "shopperActivity"
  ];
  for (const field of prohibited) {
    throwsCode(() => createLiveAffiliateMetric(metric({ [field]: "prohibited" })), "invalid_live_affiliate_metric");
  }
  assert.notEqual(LIVE_GIFTS_REVENUE_KIND, LIVE_SHOPPING_REVENUE_KIND);
  assert.equal(summarizeLiveShopping(session(), [metric()]).liveGiftRevenueIncluded, false);
}

function testReplayAndTimeValidation() {
  assert.equal(createLiveShoppingSession(session({ replay: {
    available: true,
    url: "https://example.test/replay/opaque",
    publishedAt: "2026-07-30T15:00:00.000Z",
    expiresAt: null
  } })).replay.available, true);
  throwsCode(() => createLiveShoppingSession(session({ replay: {
    available: false, url: "https://example.test/replay/opaque"
  } })), "invalid_replay_information");
  for (const url of [
    "https://user:password@example.test/replay",
    "https://example.test/replay#authorization-fragment",
    `https://example.test/${"a".repeat(2049)}`,
    " https://example.test/replay",
    "https://example.test/replay\n"
  ]) {
    throwsCode(() => createLiveShoppingSession(session({ replay: {
      available: true, url, publishedAt: null, expiresAt: null
    } })), "invalid_replay_url");
  }
  throwsCode(() => createLiveShoppingSession(session({ replay: {
    available: true,
    url: "https://example.test/replay",
    publishedAt: "2026-07-30T16:00:00.000Z",
    expiresAt: "2026-07-30T15:00:00.000Z"
  } })), "invalid_replay_window");
  throwsCode(() => createLiveShoppingSession(session({ endedAt: session().startedAt })), "invalid_live_duration");
  throwsCode(() => createLiveAffiliateMetric(metric({ orders: -1 })), "invalid_order_count");
}

function testSessionBoundariesAndOverlaps() {
  throwsCode(() => createLiveShoppingBundle({
    session: session(),
    products: [relationship({ featuredAt: "2026-07-30T11:59:59.000Z" })]
  }), "live_product_outside_session");
  throwsCode(() => createLiveShoppingBundle({
    session: session(),
    products: [relationship({ removedAt: "2026-07-30T14:00:01.000Z" })]
  }), "live_product_outside_session");
  for (const outsideMetric of [
    metric({ bucketStartedAt: "2026-07-30T11:00:00.000Z", bucketEndedAt: "2026-07-30T12:30:00.000Z" }),
    metric({ bucketStartedAt: "2026-07-30T13:00:00.000Z", bucketEndedAt: "2026-07-30T14:00:01.000Z" })
  ]) {
    throwsCode(() => summarizeLiveShopping(session(), [outsideMetric]), "live_metric_outside_session");
  }

  const first = metric({ bucketEndedAt: "2026-07-30T13:00:00.000Z" });
  const overlapping = metric({
    id: "00000000-0000-4000-8000-000000000020",
    bucketStartedAt: "2026-07-30T12:30:00.000Z"
  });
  throwsCode(() => summarizeLiveShopping(session(), [first, overlapping]), "overlapping_live_metric_bucket");
  throwsCode(() => summarizeLiveShopping(session(), [
    first,
    metric({
      id: "00000000-0000-4000-8000-000000000021",
      productId: null,
      bucketStartedAt: "2026-07-30T12:30:00.000Z"
    })
  ]), "overlapping_live_metric_bucket");

  const adjacent = metric({
    id: "00000000-0000-4000-8000-000000000022",
    bucketStartedAt: "2026-07-30T13:00:00.000Z"
  });
  assert.equal(summarizeLiveShopping(session(), [first, adjacent]).orders, 6);

  const secondProductRelationship = relationship({
    id: "00000000-0000-4000-8000-000000000023",
    productId: SECOND_PRODUCT_ID
  });
  const secondProductMetric = metric({
    id: "00000000-0000-4000-8000-000000000024",
    productId: SECOND_PRODUCT_ID
  });
  assert.equal(createLiveShoppingBundle({
    session: session(),
    products: [relationship(), secondProductRelationship],
    metrics: [metric(), secondProductMetric]
  }).summary.orders, 6);

  throwsCode(() => createLiveShoppingBundle({
    session: session(),
    products: [
      relationship({ removedAt: "2026-07-30T13:00:00.000Z" }),
      relationship({
        id: "00000000-0000-4000-8000-000000000025",
        featuredAt: "2026-07-30T12:30:00.000Z"
      })
    ]
  }), "overlapping_live_product_relationship");
}

function testMonetaryPrecisionFailsClosed() {
  const first = metric({
    bucketEndedAt: "2026-07-30T13:00:00.000Z",
    gmvMinor: Number.MAX_SAFE_INTEGER
  });
  const second = metric({
    id: "00000000-0000-4000-8000-000000000030",
    bucketStartedAt: "2026-07-30T13:00:00.000Z",
    gmvMinor: 1
  });
  throwsCode(() => summarizeLiveShopping(session(), [first, second]), "live_metric_total_overflow");
}

function testStaticSafety() {
  const source = fs.readFileSync(path.join(__dirname, "../lib/live-shopping-domain.js"), "utf8");
  assert.doesNotMatch(source, /2025-10-01|LIVE_IMPORT_CUTOFF/);
  assert.doesNotMatch(source, /https?:\/\/(?:open|business-api|shop)\.tiktok/i);
  assert.doesNotMatch(source, /\b(?:INSERT\s+INTO|UPDATE\s+[a-z_]|DELETE\s+FROM|UPSERT\s+INTO|MERGE\s+INTO)\b/i);
  assert.doesNotMatch(source, /data portability|full archive/i);
}

testModelsAndRelationships();
testMetricsAndPendingFinalCommission();
testSourcesFailClosed();
testExactAccountAndIdentityIsolation();
testSensitiveFieldsAndGiftSeparation();
testReplayAndTimeValidation();
testSessionBoundariesAndOverlaps();
testMonetaryPrecisionFailsClosed();
testStaticSafety();
console.log("LIVE Shopping domain tests passed.");
