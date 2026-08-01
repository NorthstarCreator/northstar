const { exactAccountId } = require("./revenue-provider-contract");
const {
  createAffiliateOrder,
  createCollaboration,
  createProduct,
  createSampleApplication
} = require("./tiktok-shop-affiliate-creator-domain");
const { PROVIDER } = require("./providers/tiktok-shop-affiliate-creator");

class AffiliateCreatorMapperError extends Error {
  constructor(code) {
    super(code);
    this.name = "AffiliateCreatorMapperError";
    this.code = code;
  }
}

function object(value, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AffiliateCreatorMapperError(code);
  }
  return value;
}

function exactKeys(value, allowed, code) {
  object(value, code);
  if (Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new AffiliateCreatorMapperError(code);
  }
}

function text(value, code, { nullable = false, maximum = 300 } = {}) {
  if (nullable && (value === null || value === undefined)) return null;
  if (typeof value !== "string") throw new AffiliateCreatorMapperError(code);
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) throw new AffiliateCreatorMapperError(code);
  return normalized;
}

function nullableInteger(value, code) {
  if (value === null || value === undefined) return null;
  if (!Number.isSafeInteger(value) || value < 0) throw new AffiliateCreatorMapperError(code);
  return value;
}

function nullableNumber(value, code) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new AffiliateCreatorMapperError(code);
  return value;
}

function unixTimestamp(value, code) {
  if (value === null || value === undefined) return null;
  if (!Number.isSafeInteger(value) || value < 0) throw new AffiliateCreatorMapperError(code);
  const milliseconds = value * 1000;
  if (!Number.isSafeInteger(milliseconds)) throw new AffiliateCreatorMapperError(code);
  const date = new Date(milliseconds);
  if (Number.isNaN(date.getTime())) throw new AffiliateCreatorMapperError(code);
  return date.toISOString();
}

function mappingContext(input) {
  exactKeys(input, [
    "creatorAccountId", "boundProviderCreatorId", "tokenProviderCreatorId"
  ], "invalid_mapping_context");
  const creatorAccountId = exactAccountId(input.creatorAccountId);
  const boundProviderCreatorId = text(
    input.boundProviderCreatorId,
    "bound_provider_creator_id_required",
    { maximum: 200 }
  );
  const tokenProviderCreatorId = text(
    input.tokenProviderCreatorId,
    "token_provider_creator_id_required",
    { maximum: 200 }
  );
  if (boundProviderCreatorId !== tokenProviderCreatorId) {
    throw new AffiliateCreatorMapperError("provider_creator_identity_mismatch");
  }
  return Object.freeze({ creatorAccountId, boundProviderCreatorId, tokenProviderCreatorId });
}

function assertSameCreatorAccount(left, right) {
  const leftAccount = exactAccountId(left?.creatorAccountId);
  const rightAccount = exactAccountId(right?.creatorAccountId);
  if (leftAccount !== rightAccount) throw new AffiliateCreatorMapperError("creator_account_mismatch");
  return true;
}

function mapCreatorProfile({ context, response } = {}) {
  const scoped = mappingContext(context);
  const profile = object(response, "invalid_creator_profile_response");
  const providerCreatorId = text(
    profile.creator_user_open_id,
    "creator_profile_identity_required",
    { maximum: 200 }
  );
  if (providerCreatorId !== scoped.boundProviderCreatorId) {
    throw new AffiliateCreatorMapperError("provider_creator_identity_mismatch");
  }
  let permissions = null;
  if (profile.permissions !== null && profile.permissions !== undefined) {
    if (!Array.isArray(profile.permissions)) {
      throw new AffiliateCreatorMapperError("invalid_creator_permissions");
    }
    permissions = Object.freeze(profile.permissions.map((value) =>
      text(value, "invalid_creator_permission", { maximum: 200 })
    ));
  }
  return Object.freeze({
    creatorAccountId: scoped.creatorAccountId,
    provider: PROVIDER,
    providerCreatorId,
    username: text(profile.username, "invalid_creator_username", { nullable: true, maximum: 200 }),
    selectionRegion: text(profile.selection_region, "invalid_selection_region", { nullable: true, maximum: 20 }),
    registerRegion: text(profile.register_region, "invalid_register_region", { nullable: true, maximum: 20 }),
    sellerType: text(profile.seller_type, "invalid_seller_type", { nullable: true, maximum: 100 }),
    userType: nullableInteger(profile.user_type, "invalid_creator_user_type"),
    permissions
  });
}

function mapAffiliateOrderSku({ context, entityId, responseOrder, responseSku } = {}) {
  const scoped = mappingContext(context);
  const order = object(responseOrder, "invalid_affiliate_order_response");
  const sku = object(responseSku, "invalid_affiliate_order_sku_response");
  const orderId = text(order.id, "affiliate_order_id_required", { maximum: 200 });
  const skuId = text(sku.id, "affiliate_order_sku_id_required", { maximum: 200 });
  const price = sku.price === null || sku.price === undefined
    ? null
    : object(sku.price, "invalid_affiliate_order_price");
  return createAffiliateOrder({
    id: entityId,
    creatorAccountId: scoped.creatorAccountId,
    providerRecordId: `${orderId}:${skuId}`,
    productProviderId: text(sku.product_id, "affiliate_order_product_id_required", { maximum: 200 }),
    createdAt: unixTimestamp(order.create_time, "invalid_affiliate_order_create_time"),
    status: text(order.status, "invalid_affiliate_order_status", { nullable: true, maximum: 100 }),
    quantity: null,
    currency: price
      ? text(price.currency, "invalid_affiliate_order_currency", { nullable: true, maximum: 3 })
      : null,
    gmvMinor: null,
    estimatedCommissionMinor: null,
    finalCommissionMinor: null,
    refundMinor: null,
    settledAt: null
  });
}

function mapTargetCollaboration({ context, entityId, response } = {}) {
  const scoped = mappingContext(context);
  const collaboration = object(response, "invalid_target_collaboration_response");
  return createCollaboration({
    id: entityId,
    creatorAccountId: scoped.creatorAccountId,
    providerRecordId: text(collaboration.id, "target_collaboration_id_required", { maximum: 200 }),
    collaborationType: "target",
    status: text(collaboration.status, "invalid_target_collaboration_status", { nullable: true, maximum: 100 }),
    title: text(collaboration.name, "invalid_target_collaboration_name", { nullable: true, maximum: 300 }),
    startedAt: null,
    endedAt: null
  });
}

function mapTargetCollaborationProduct({ context, entityId, response } = {}) {
  const scoped = mappingContext(context);
  const product = object(response, "invalid_target_collaboration_product_response");
  const commission = product.commission === null || product.commission === undefined
    ? null
    : object(product.commission, "invalid_target_collaboration_commission");
  return createProduct({
    id: entityId,
    creatorAccountId: scoped.creatorAccountId,
    providerRecordId: text(product.id, "target_collaboration_product_id_required", { maximum: 200 }),
    title: text(product.title, "invalid_target_collaboration_product_title", { nullable: true, maximum: 300 }),
    showcaseStatus: null,
    currency: commission
      ? text(commission.currency, "invalid_target_collaboration_currency", { nullable: true, maximum: 3 })
      : null,
    priceMinor: null,
    commissionRateBasisPoints: null
  });
}

function mapSampleApplication({ context, entityId, response } = {}) {
  const scoped = mappingContext(context);
  const sample = object(response, "invalid_sample_application_response");
  const product = object(sample.sample_product, "invalid_sample_product_response");
  return createSampleApplication({
    id: entityId,
    creatorAccountId: scoped.creatorAccountId,
    providerRecordId: text(sample.id, "sample_application_id_required", { maximum: 200 }),
    productProviderId: text(product.id, "sample_product_id_required", { maximum: 200 }),
    applicationType: text(sample.type, "invalid_sample_application_type", { nullable: true, maximum: 100 }),
    status: text(sample.status, "invalid_sample_application_status", { nullable: true, maximum: 100 })
  });
}

function mapLiveCoreStats({ context, liveRoomId, response } = {}) {
  const scoped = mappingContext(context);
  const stats = object(response, "invalid_live_core_stats_response");
  return Object.freeze({
    creatorAccountId: scoped.creatorAccountId,
    provider: PROVIDER,
    liveRoomProviderId: text(liveRoomId, "live_room_id_required", { maximum: 200 }),
    sales: nullableInteger(stats.sales, "invalid_live_sales"),
    createdOrderCount: nullableInteger(stats.created_order_count, "invalid_live_created_order_count"),
    currentVisitorCount: nullableInteger(stats.current_visitor_count, "invalid_live_current_visitor_count"),
    paidOrderCount: nullableInteger(stats.paid_order_count, "invalid_live_paid_order_count"),
    productReachCount: nullableInteger(stats.product_reach_count, "invalid_live_product_reach_count"),
    watchPv: nullableInteger(stats.watch_pv, "invalid_live_watch_pv"),
    clickThroughRate: nullableNumber(stats.click_through_rate, "invalid_live_click_through_rate"),
    accumulatedNewFollowerCount: nullableInteger(stats.accumulated_new_follower_count, "invalid_live_new_follower_count"),
    buyerCount: nullableInteger(stats.buyer_count, "invalid_live_buyer_count"),
    accumulatedCommentCount: nullableInteger(stats.accumulated_comment_count, "invalid_live_comment_count"),
    productViewCount: nullableInteger(stats.product_view_count, "invalid_live_product_view_count"),
    clickOrderRate: nullableNumber(stats.click_order_rate, "invalid_live_click_order_rate"),
    avgWatchingDuration: nullableNumber(stats.avg_watching_duration, "invalid_live_avg_watching_duration"),
    accumulatedSharingCount: nullableInteger(stats.accumulated_sharing_count, "invalid_live_sharing_count"),
    peakConcurrentUserCount: nullableInteger(stats.peak_concurrent_user_count, "invalid_live_peak_user_count"),
    localGmvMinor: null,
    localUnitPriceMinor: null,
    currency: null
  });
}

function mapLiveViewTrend({ context, liveRoomId, response } = {}) {
  const scoped = mappingContext(context);
  const trend = object(response, "invalid_live_view_trend_response");
  const performances = trend.view_trend_performances;
  if (!Array.isArray(performances)) throw new AffiliateCreatorMapperError("invalid_live_view_trend_performances");
  return Object.freeze({
    creatorAccountId: scoped.creatorAccountId,
    provider: PROVIDER,
    liveRoomProviderId: text(liveRoomId, "live_room_id_required", { maximum: 200 }),
    performances: Object.freeze(performances.map((performance) => {
      object(performance, "invalid_live_view_trend_performance");
      if (!Array.isArray(performance.data_points)) {
        throw new AffiliateCreatorMapperError("invalid_live_view_trend_points");
      }
      return Object.freeze({
        statsType: text(performance.stats_type, "invalid_live_view_stats_type", { maximum: 100 }),
        dataPoints: Object.freeze(performance.data_points.map((point) => {
          object(point, "invalid_live_view_trend_point");
          return Object.freeze({
            timestamp: unixTimestamp(point.timestamp, "invalid_live_view_trend_timestamp"),
            value: nullableNumber(point.value, "invalid_live_view_trend_value")
          });
        }))
      });
    }))
  });
}

module.exports = {
  AffiliateCreatorMapperError,
  mappingContext,
  assertSameCreatorAccount,
  mapCreatorProfile,
  mapAffiliateOrderSku,
  mapTargetCollaboration,
  mapTargetCollaborationProduct,
  mapSampleApplication,
  mapLiveCoreStats,
  mapLiveViewTrend
};
