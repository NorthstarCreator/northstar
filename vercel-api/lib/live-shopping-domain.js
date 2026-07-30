const { exactAccountId } = require("./revenue-provider-contract");

const LIVE_SHOPPING_PROVIDER = "tiktok_shop_affiliate_creator";
const LIVE_SHOPPING_REVENUE_KIND = "live_shopping_affiliate_commission";
const LIVE_GIFTS_REVENUE_KIND = "live_gifts";
const LIVE_SHOPPING_SOURCES = Object.freeze({
  manual: Object.freeze({
    code: "manual",
    label: "Manual",
    availability: "available",
    blockingReason: null
  }),
  imported: Object.freeze({
    code: "imported",
    label: "Imported",
    availability: "available",
    blockingReason: null
  }),
  tiktok_api: Object.freeze({
    code: "tiktok_api",
    label: "TikTok API",
    availability: "unavailable",
    blockingReason: "affiliate_creator_api_authorization_required"
  })
});

const UUID_PATTERN = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

class LiveShoppingDomainError extends Error {
  constructor(code) {
    super(code);
    this.name = "LiveShoppingDomainError";
    this.code = code;
  }
}

function exactUuid(value, code) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!UUID_PATTERN.test(normalized)) throw new LiveShoppingDomainError(code);
  return normalized;
}

function exactKeys(value, allowed, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new LiveShoppingDomainError(code);
  }
  if (Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new LiveShoppingDomainError(code);
  }
}

function isoTimestamp(value, code, { nullable = false } = {}) {
  if (nullable && (value === null || value === undefined || value === "")) return null;
  if (typeof value !== "string") throw new LiveShoppingDomainError(code);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new LiveShoppingDomainError(code);
  }
  return value;
}

function nonnegativeInteger(value, code, { nullable = false } = {}) {
  if (nullable && (value === null || value === undefined)) return null;
  if (!Number.isSafeInteger(value) || value < 0) throw new LiveShoppingDomainError(code);
  return value;
}

function safeAdd(left, right) {
  const total = left + right;
  if (!Number.isSafeInteger(total)) throw new LiveShoppingDomainError("live_metric_total_overflow");
  return total;
}

function sourceDefinition(value) {
  const source = LIVE_SHOPPING_SOURCES[String(value || "")];
  if (!source) throw new LiveShoppingDomainError("invalid_live_shopping_source");
  if (source.availability !== "available") {
    throw new LiveShoppingDomainError(source.blockingReason);
  }
  return source;
}

function normalizeReplay(value) {
  exactKeys(value, ["available", "url", "publishedAt", "expiresAt"], "invalid_replay_information");
  if (typeof value.available !== "boolean") {
    throw new LiveShoppingDomainError("invalid_replay_information");
  }
  const url = value.url === null || value.url === undefined ? null : String(value.url);
  if (!value.available && (url || value.publishedAt || value.expiresAt)) {
    throw new LiveShoppingDomainError("invalid_replay_information");
  }
  if (url) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      throw new LiveShoppingDomainError("invalid_replay_url");
    }
    if (
      parsed.protocol !== "https:"
      || parsed.username
      || parsed.password
      || parsed.hash
      || url.length > 2048
      || /[\u0000-\u0020\u007f]/.test(url)
    ) {
      throw new LiveShoppingDomainError("invalid_replay_url");
    }
  }
  const publishedAt = isoTimestamp(value.publishedAt, "invalid_replay_published_at", { nullable: true });
  const expiresAt = isoTimestamp(value.expiresAt, "invalid_replay_expires_at", { nullable: true });
  if (publishedAt && expiresAt && Date.parse(expiresAt) <= Date.parse(publishedAt)) {
    throw new LiveShoppingDomainError("invalid_replay_window");
  }
  return Object.freeze({
    available: value.available,
    url,
    publishedAt,
    expiresAt
  });
}

function createLiveShoppingSession(input) {
  exactKeys(input, [
    "id", "creatorAccountId", "source", "title", "startedAt", "endedAt",
    "replay", "sourceRecordId"
  ], "invalid_live_session");
  const creatorAccountId = exactAccountId(input.creatorAccountId);
  const source = sourceDefinition(input.source);
  const startedAt = isoTimestamp(input.startedAt, "invalid_live_started_at");
  const endedAt = isoTimestamp(input.endedAt, "invalid_live_ended_at", { nullable: true });
  if (endedAt && Date.parse(endedAt) <= Date.parse(startedAt)) {
    throw new LiveShoppingDomainError("invalid_live_duration");
  }
  const title = String(input.title || "").trim();
  if (title.length > 200) throw new LiveShoppingDomainError("invalid_live_title");
  const sourceRecordId = input.sourceRecordId == null ? null : exactUuid(input.sourceRecordId, "invalid_source_record_id");
  return Object.freeze({
    id: exactUuid(input.id, "invalid_live_session_id"),
    creatorAccountId,
    provider: LIVE_SHOPPING_PROVIDER,
    revenueKind: LIVE_SHOPPING_REVENUE_KIND,
    source: source.code,
    title,
    startedAt,
    endedAt,
    replay: normalizeReplay(input.replay || { available: false }),
    sourceRecordId
  });
}

function createLiveProductRelationship(input) {
  exactKeys(input, [
    "id", "creatorAccountId", "liveSessionId", "productId", "source",
    "featuredAt", "removedAt", "sourceRecordId"
  ], "invalid_live_product_relationship");
  const source = sourceDefinition(input.source);
  const featuredAt = isoTimestamp(input.featuredAt, "invalid_product_featured_at");
  const removedAt = isoTimestamp(input.removedAt, "invalid_product_removed_at", { nullable: true });
  if (removedAt && Date.parse(removedAt) < Date.parse(featuredAt)) {
    throw new LiveShoppingDomainError("invalid_product_feature_window");
  }
  return Object.freeze({
    id: exactUuid(input.id, "invalid_live_product_relationship_id"),
    creatorAccountId: exactAccountId(input.creatorAccountId),
    liveSessionId: exactUuid(input.liveSessionId, "invalid_live_session_id"),
    productId: exactUuid(input.productId, "invalid_product_id"),
    source: source.code,
    featuredAt,
    removedAt,
    sourceRecordId: input.sourceRecordId == null
      ? null
      : exactUuid(input.sourceRecordId, "invalid_source_record_id")
  });
}

function createLiveAffiliateMetric(input) {
  exactKeys(input, [
    "id", "creatorAccountId", "liveSessionId", "productId", "source", "bucketStartedAt",
    "bucketEndedAt", "orders", "units", "gmvMinor", "estimatedCommissionMinor",
    "finalCommissionMinor", "refundCount", "refundGmvMinor", "refundCommissionMinor",
    "sourceRecordId"
  ], "invalid_live_affiliate_metric");
  const source = sourceDefinition(input.source);
  const bucketStartedAt = isoTimestamp(input.bucketStartedAt, "invalid_metric_started_at");
  const bucketEndedAt = isoTimestamp(input.bucketEndedAt, "invalid_metric_ended_at");
  if (Date.parse(bucketEndedAt) <= Date.parse(bucketStartedAt)) {
    throw new LiveShoppingDomainError("invalid_metric_duration");
  }
  return Object.freeze({
    id: exactUuid(input.id, "invalid_live_metric_id"),
    creatorAccountId: exactAccountId(input.creatorAccountId),
    liveSessionId: exactUuid(input.liveSessionId, "invalid_live_session_id"),
    productId: input.productId == null ? null : exactUuid(input.productId, "invalid_product_id"),
    provider: LIVE_SHOPPING_PROVIDER,
    revenueKind: LIVE_SHOPPING_REVENUE_KIND,
    source: source.code,
    bucketStartedAt,
    bucketEndedAt,
    orders: nonnegativeInteger(input.orders, "invalid_order_count"),
    units: nonnegativeInteger(input.units, "invalid_unit_count"),
    gmvMinor: nonnegativeInteger(input.gmvMinor, "invalid_gmv"),
    estimatedCommissionMinor: nonnegativeInteger(input.estimatedCommissionMinor, "invalid_estimated_commission"),
    finalCommissionMinor: nonnegativeInteger(input.finalCommissionMinor, "invalid_final_commission", { nullable: true }),
    refundCount: nonnegativeInteger(input.refundCount, "invalid_refund_count"),
    refundGmvMinor: nonnegativeInteger(input.refundGmvMinor, "invalid_refund_gmv"),
    refundCommissionMinor: nonnegativeInteger(input.refundCommissionMinor, "invalid_refund_commission"),
    sourceRecordId: input.sourceRecordId == null
      ? null
      : exactUuid(input.sourceRecordId, "invalid_source_record_id")
  });
}

function assertSameIdentity(record, session) {
  if (record.creatorAccountId !== session.creatorAccountId || record.liveSessionId !== session.id) {
    throw new LiveShoppingDomainError("live_session_identity_mismatch");
  }
  if (record.source !== session.source) throw new LiveShoppingDomainError("live_session_source_mismatch");
}

function assertWithinSession(startedAt, endedAt, session, code) {
  if (
    Date.parse(startedAt) < Date.parse(session.startedAt)
    || (session.endedAt && Date.parse(endedAt || startedAt) > Date.parse(session.endedAt))
  ) {
    throw new LiveShoppingDomainError(code);
  }
}

function intervalsOverlap(leftStart, leftEnd, rightStart, rightEnd) {
  const leftFinish = leftEnd ? Date.parse(leftEnd) : Number.POSITIVE_INFINITY;
  const rightFinish = rightEnd ? Date.parse(rightEnd) : Number.POSITIVE_INFINITY;
  return Date.parse(leftStart) < rightFinish && Date.parse(rightStart) < leftFinish;
}

function assertRelationshipWindows(relationships, session) {
  for (let index = 0; index < relationships.length; index += 1) {
    const relationship = relationships[index];
    assertWithinSession(
      relationship.featuredAt,
      relationship.removedAt,
      session,
      "live_product_outside_session"
    );
    for (let otherIndex = 0; otherIndex < index; otherIndex += 1) {
      const other = relationships[otherIndex];
      if (
        relationship.productId === other.productId
        && intervalsOverlap(
          relationship.featuredAt,
          relationship.removedAt,
          other.featuredAt,
          other.removedAt
        )
      ) {
        throw new LiveShoppingDomainError("overlapping_live_product_relationship");
      }
    }
  }
}

function assertMetricWindows(metrics, session) {
  for (let index = 0; index < metrics.length; index += 1) {
    const metric = metrics[index];
    assertWithinSession(
      metric.bucketStartedAt,
      metric.bucketEndedAt,
      session,
      "live_metric_outside_session"
    );
    for (let otherIndex = 0; otherIndex < index; otherIndex += 1) {
      const other = metrics[otherIndex];
      const sameDimension = metric.productId === other.productId
        || metric.productId === null
        || other.productId === null;
      if (
        sameDimension
        && intervalsOverlap(
          metric.bucketStartedAt,
          metric.bucketEndedAt,
          other.bucketStartedAt,
          other.bucketEndedAt
        )
      ) {
        throw new LiveShoppingDomainError("overlapping_live_metric_bucket");
      }
    }
  }
}

function summarizeLiveShopping(sessionInput, metricInputs = []) {
  const session = createLiveShoppingSession(sessionInput);
  const metrics = metricInputs.map(createLiveAffiliateMetric);
  metrics.forEach((metric) => assertSameIdentity(metric, session));
  assertMetricWindows(metrics, session);
  const durationEnd = session.endedAt || metrics.reduce(
    (latest, metric) => Date.parse(metric.bucketEndedAt) > Date.parse(latest) ? metric.bucketEndedAt : latest,
    session.startedAt
  );
  const durationHours = Math.max((Date.parse(durationEnd) - Date.parse(session.startedAt)) / 3600000, 0);
  const totals = metrics.reduce((result, metric) => ({
    orders: safeAdd(result.orders, metric.orders),
    units: safeAdd(result.units, metric.units),
    gmvMinor: safeAdd(result.gmvMinor, metric.gmvMinor),
    estimatedCommissionMinor: safeAdd(result.estimatedCommissionMinor, metric.estimatedCommissionMinor),
    finalCommissionMinor: safeAdd(result.finalCommissionMinor, metric.finalCommissionMinor || 0),
    finalizedMetricCount: safeAdd(result.finalizedMetricCount, metric.finalCommissionMinor === null ? 0 : 1),
    refundCount: safeAdd(result.refundCount, metric.refundCount),
    refundGmvMinor: safeAdd(result.refundGmvMinor, metric.refundGmvMinor),
    refundCommissionMinor: safeAdd(result.refundCommissionMinor, metric.refundCommissionMinor)
  }), {
    orders: 0,
    units: 0,
    gmvMinor: 0,
    estimatedCommissionMinor: 0,
    finalCommissionMinor: 0,
    finalizedMetricCount: 0,
    refundCount: 0,
    refundGmvMinor: 0,
    refundCommissionMinor: 0
  });
  return Object.freeze({
    ...totals,
    finalCommissionMinor: totals.finalizedMetricCount === 0 ? null : totals.finalCommissionMinor,
    finalCommissionStatus: totals.finalizedMetricCount === metrics.length && metrics.length > 0 ? "final" : "partial_or_pending",
    durationHours,
    salesPerHour: durationHours > 0 ? totals.units / durationHours : 0,
    gmvPerHourMinor: durationHours > 0 ? totals.gmvMinor / durationHours : 0,
    liveGiftRevenueIncluded: false
  });
}

function createLiveShoppingBundle({ session: sessionInput, products = [], metrics = [] } = {}) {
  const session = createLiveShoppingSession(sessionInput);
  const relationships = products.map(createLiveProductRelationship);
  const normalizedMetrics = metrics.map(createLiveAffiliateMetric);
  const seenRelationshipIds = new Set();
  const linkedProductIds = new Set();
  for (const relationship of relationships) {
    assertSameIdentity(relationship, session);
    if (seenRelationshipIds.has(relationship.id)) {
      throw new LiveShoppingDomainError("duplicate_live_product_relationship");
    }
    seenRelationshipIds.add(relationship.id);
    linkedProductIds.add(relationship.productId);
  }
  assertRelationshipWindows(relationships, session);
  const seenMetricIds = new Set();
  for (const metric of normalizedMetrics) {
    assertSameIdentity(metric, session);
    if (seenMetricIds.has(metric.id)) throw new LiveShoppingDomainError("duplicate_live_metric");
    if (metric.productId && !linkedProductIds.has(metric.productId)) {
      throw new LiveShoppingDomainError("unlinked_live_product_metric");
    }
    seenMetricIds.add(metric.id);
  }
  return Object.freeze({
    session,
    products: Object.freeze(relationships),
    metrics: Object.freeze(normalizedMetrics),
    summary: summarizeLiveShopping(sessionInput, metrics)
  });
}

function liveShoppingSourceStatuses() {
  return Object.freeze(Object.values(LIVE_SHOPPING_SOURCES).map((source) => Object.freeze({ ...source })));
}

module.exports = {
  LIVE_SHOPPING_PROVIDER,
  LIVE_SHOPPING_REVENUE_KIND,
  LIVE_GIFTS_REVENUE_KIND,
  LIVE_SHOPPING_SOURCES,
  LiveShoppingDomainError,
  createLiveShoppingSession,
  createLiveProductRelationship,
  createLiveAffiliateMetric,
  createLiveShoppingBundle,
  summarizeLiveShopping,
  liveShoppingSourceStatuses
};
