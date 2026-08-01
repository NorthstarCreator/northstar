const PROVIDER = "tiktok_shop_affiliate_creator";
const ENABLE_ENV_NAME = "TIKTOK_SHOP_AFFILIATE_CREATOR_AUTH_ENABLED";

const SELECTED_SCOPES = Object.freeze([
  "creator.affiliate.info",
  "creator.data.live.read.public",
  "creator.affiliate.share_link.read",
  "creator.affiliate_collaboration.read",
  "creator.showcase.read"
]);

const ENDPOINTS = Object.freeze({
  get_creator_profile: Object.freeze({
    scope: "creator.affiliate.info",
    method: "GET",
    path: "/affiliate_creator/202508/profiles"
  }),
  search_creator_affiliate_orders: Object.freeze({
    scope: "creator.affiliate_collaboration.read",
    method: "POST",
    path: "/affiliate_creator/202410/orders/search"
  }),
  search_creator_target_collaborations: Object.freeze({
    scope: "creator.affiliate_collaboration.read",
    method: "POST",
    path: "/affiliate_creator/202405/target_collaborations/search"
  }),
  search_open_collaboration_products: Object.freeze({
    scope: "creator.affiliate_collaboration.read",
    method: "POST",
    path: "/affiliate_creator/202405/open_collaborations/products/search"
  }),
  get_open_collaboration_products_by_id: Object.freeze({
    scope: "creator.affiliate_collaboration.read",
    method: "POST",
    path: "/affiliate_creator/202509/open_collaborations/products"
  }),
  get_sample_application_detail: Object.freeze({
    scope: "creator.affiliate_collaboration.read",
    method: "POST",
    path: "/affiliate_creator/202412/sample_applications/single_query"
  }),
  get_showcase_products: Object.freeze({
    scope: "creator.showcase.read",
    method: "GET",
    path: "/affiliate_creator/202405/showcases/products"
  }),
  get_live_core_stats: Object.freeze({
    scope: "creator.data.live.read.public",
    method: "GET",
    path: "/analytics/202502/live_rooms/{live_room_id}/core_stats"
  }),
  get_live_view_trends: Object.freeze({
    scope: "creator.data.live.read.public",
    method: "GET",
    path: "/analytics/202502/live_rooms/{live_room_id}/view_trend_performances"
  })
});

const CONFIRMED_RESPONSE_FIELDS = Object.freeze({
  get_creator_profile: Object.freeze([
    "avatar", "username", "selection_region", "register_region", "seller_type",
    "permissions", "user_type", "creator_user_open_id"
  ]),
  search_creator_affiliate_orders: Object.freeze([
    "orders[].id", "orders[].create_time", "orders[].delivery_time", "orders[].status",
    "orders[].skus[].id", "orders[].skus[].campaign_id",
    "orders[].skus[].open_collaboration_id", "orders[].skus[].target_collaboration_id",
    "orders[].skus[].product_name", "orders[].skus[].product_id",
    "orders[].skus[].price.amount", "orders[].skus[].price.currency",
    "orders[].skus[].shop_name", "next_page_token", "total_count"
  ]),
  search_creator_target_collaborations: Object.freeze([
    "target_collaborations[].id", "target_collaborations[].name",
    "target_collaborations[].status", "target_collaborations[].products[].id",
    "target_collaborations[].products[].title",
    "target_collaborations[].products[].main_image_url",
    "target_collaborations[].products[].commission.rate",
    "target_collaborations[].products[].commission.amount",
    "target_collaborations[].products[].commission.currency",
    "next_page_token", "total_count"
  ]),
  get_sample_application_detail: Object.freeze([
    "sample_application.id", "sample_application.create_time",
    "sample_application.sample_product.id", "sample_application.sample_product.sku_id",
    "sample_application.sample_product.sku_sale_property_value_names",
    "sample_application.main_order_id", "sample_application.activity_id",
    "sample_application.type", "sample_application.status",
    "sample_application.creator_fulfillment.id",
    "sample_application.creator_fulfillment.expiration_time",
    "sample_application.creator_fulfillment.total_suspend_duration",
    "sample_application.creator_fulfillment.status"
  ]),
  get_live_core_stats: Object.freeze([
    "sales", "local_gmv", "created_order_count", "current_visitor_count",
    "paid_order_count", "local_unit_price", "product_reach_count", "watch_pv",
    "click_through_rate", "accumulated_new_follower_count", "buyer_count",
    "accumulated_comment_count", "product_view_count", "click_order_rate",
    "avg_watching_duration", "accumulated_sharing_count",
    "peak_concurrent_user_count"
  ]),
  get_live_view_trends: Object.freeze([
    "view_trend_performances[].stats_type",
    "view_trend_performances[].data_points[].value",
    "view_trend_performances[].data_points[].timestamp"
  ])
});

class AffiliateCreatorProviderError extends Error {
  constructor(code) {
    super(code);
    this.name = "AffiliateCreatorProviderError";
    this.code = code;
  }
}

function featureEnabled(env = process.env) {
  return env.NORTHSTAR_ENV === "tiktok_sandbox" && env[ENABLE_ENV_NAME] === "true";
}

function endpointContract(operation) {
  const contract = ENDPOINTS[String(operation || "")];
  if (!contract) throw new AffiliateCreatorProviderError("operation_not_allowlisted");
  return contract;
}

function assertAllowedEndpoint({ operation, scope, method, path }) {
  const contract = endpointContract(operation);
  if (!SELECTED_SCOPES.includes(String(scope || ""))) {
    throw new AffiliateCreatorProviderError("scope_not_selected");
  }
  if (scope !== contract.scope || method !== contract.method || path !== contract.path) {
    throw new AffiliateCreatorProviderError("endpoint_contract_mismatch");
  }
  return contract;
}

const adapter = Object.freeze({
  provider: PROVIDER,
  interfaceVersion: 1,
  selectedScopes: SELECTED_SCOPES,
  endpoints: ENDPOINTS,
  confirmedResponseFields: CONFIRMED_RESPONSE_FIELDS,
  supportsNetwork: false,
  supportsAuthorization: false,
  supportsTokenExchange: false,
  supportsPersistence: false,
  featureEnabled,
  endpointContract,
  assertAllowedEndpoint
});

module.exports = {
  PROVIDER,
  ENABLE_ENV_NAME,
  SELECTED_SCOPES,
  ENDPOINTS,
  CONFIRMED_RESPONSE_FIELDS,
  AffiliateCreatorProviderError,
  featureEnabled,
  endpointContract,
  assertAllowedEndpoint,
  adapter
};
