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
  AffiliateCreatorProviderError,
  featureEnabled,
  endpointContract,
  assertAllowedEndpoint,
  adapter
};
