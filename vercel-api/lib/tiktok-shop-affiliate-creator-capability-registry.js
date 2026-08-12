"use strict";

const OBSERVED_SCOPE_STATUS = "observed_active";

function endpoint(key, name, classification, documentationState, variant = "current") {
  return Object.freeze({
    key,
    name,
    variant,
    classification,
    documentationState,
    runtimeAllowed: false
  });
}

function scope(key, endpoints) {
  return Object.freeze({
    key,
    observedStatus: OBSERVED_SCOPE_STATUS,
    endpoints: Object.freeze(endpoints)
  });
}

const CAPABILITY_REGISTRY = Object.freeze([
  scope("creator.affiliate.info", [
    endpoint("check-anchor-content", "Check Anchor Content", "validation_only", "contract_not_reviewed"),
    endpoint("check-anchor-prerequisites", "Check Anchor Prerequisites", "validation_only", "contract_not_reviewed"),
    endpoint("get-creator-profile", "Get Creator Profile", "future_read_only_candidate", "ui_doc_available"),
    endpoint("get-creator-profile-old", "Get Creator Profile (old)", "legacy", "contract_not_reviewed", "old"),
    endpoint("get-live-account-info-legacy", "Get Live Account Info", "legacy", "legacy", "legacy"),
    endpoint("get-live-room-info", "Get Live Room Info", "future_read_only_candidate", "contract_not_reviewed"),
    endpoint("get-live-room-info-legacy", "Get Live Room Info", "legacy", "legacy", "legacy"),
    endpoint("get-shop-products-legacy", "Get Shop Products (legacy)", "legacy", "legacy", "legacy"),
    endpoint("get-online-room-product-information-legacy", "get user online room's product information", "legacy", "legacy", "legacy")
  ]),
  scope("creator.data.live.read.public", [
    endpoint("get-live-room-core-stats", "Get Live Room Core Stats", "future_read_only_candidate", "contract_not_reviewed"),
    endpoint("get-live-room-gmv-trend", "Get Live Room GMV Trend", "future_read_only_candidate", "contract_not_reviewed"),
    endpoint("get-live-room-interactive-trends", "Get Live Room Interactive Trends", "future_read_only_candidate", "contract_not_reviewed"),
    endpoint("get-live-room-product-stats", "Get Live Room Product Stats", "future_read_only_candidate", "contract_not_reviewed"),
    endpoint("get-live-room-traffic-performance", "Get Live Room Traffic Performance", "future_read_only_candidate", "contract_not_reviewed"),
    endpoint("get-live-room-user-portraits", "Get Live Room User Portraits", "out_of_scope", "contract_not_reviewed"),
    endpoint("get-live-room-view-trends", "Get Live Room View Trends", "future_read_only_candidate", "contract_not_reviewed")
  ]),
  scope("creator.affiliate.share_link.read", [
    endpoint("creator-generate-general-link", "Creator Generate General Link", "action_or_artifact", "contract_not_reviewed"),
    endpoint("creator-generate-publisher-link", "Creator Generate Publisher Link", "action_or_artifact", "contract_not_reviewed"),
    endpoint("creator-search-affiliate-trace-orders", "Creator Search Affiliate Trace Orders", "future_read_only_candidate", "contract_not_reviewed"),
    endpoint("toko-product-mapper-v2", "Toko Product Mapper V2", "out_of_scope", "contract_not_reviewed")
  ]),
  scope("creator.affiliate_collaboration.read", [
    endpoint("creator-get-sample-request-deeplink", "Creator Get Sample Request Deeplink", "action_or_artifact", "ui_doc_unavailable"),
    endpoint("creator-search-open-collaboration-product", "Creator Search Open Collaboration Product", "future_read_only_candidate", "contract_not_reviewed"),
    endpoint("creator-search-sample-application-fulfillments", "Creator Search Sample Application Fulfillments", "future_read_only_candidate", "contract_not_reviewed"),
    endpoint("creator-select-affiliate-product", "Creator Select Affiliate Product", "action_or_artifact", "ui_doc_unavailable"),
    endpoint("get-creator-applicable-sample-label", "Get Creator Applicable Sample Label", "future_read_only_candidate", "contract_not_reviewed"),
    endpoint("get-creator-sample-application-detail", "Get Creator Sample Application Detail", "future_read_only_candidate", "contract_not_reviewed"),
    endpoint("get-open-collaboration-product-list-by-product-ids", "Get Open Collaboration Product List By Product Ids", "future_read_only_candidate", "contract_not_reviewed")
  ]),
  scope("creator.showcase.read", [
    endpoint("get-showcase-products", "Get Showcase Products", "future_read_only_candidate", "contract_not_reviewed"),
    endpoint("get-showcase-products-old", "Get Showcase Products (old)", "legacy", "legacy", "old")
  ])
]);

const SCOPE_BY_KEY = new Map(CAPABILITY_REGISTRY.map((record) => [record.key, record]));

function validLookup(value) {
  return typeof value === "string" && value.length > 0 && value === value.trim();
}

function getObservedScope(scopeKey) {
  if (!validLookup(scopeKey)) return null;
  return SCOPE_BY_KEY.get(scopeKey) || null;
}

function getScopeEndpoints(scopeKey) {
  const record = getObservedScope(scopeKey);
  return record ? record.endpoints : Object.freeze([]);
}

function getEndpoint(scopeKey, endpointKey) {
  if (!validLookup(endpointKey)) return null;
  const record = getObservedScope(scopeKey);
  return record ? record.endpoints.find((item) => item.key === endpointKey) || null : null;
}

function isRuntimeAllowed(scopeKey, endpointKey) {
  const record = getEndpoint(scopeKey, endpointKey);
  return record ? record.runtimeAllowed === true : false;
}

module.exports = {
  OBSERVED_SCOPE_STATUS,
  CAPABILITY_REGISTRY,
  getObservedScope,
  getScopeEndpoints,
  getEndpoint,
  isRuntimeAllowed
};
