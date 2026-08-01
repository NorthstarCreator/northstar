const { exactAccountId } = require("./revenue-provider-contract");
const { PROVIDER } = require("./providers/tiktok-shop-affiliate-creator");

const AUTHORIZATION_STATES = Object.freeze([
  "disabled", "pending", "authorized", "expired", "revoked", "error"
]);
const AUTHORIZATION_TRANSITIONS = Object.freeze({
  disabled: Object.freeze(["pending"]),
  pending: Object.freeze(["authorized", "error", "revoked"]),
  authorized: Object.freeze(["expired", "revoked", "error"]),
  expired: Object.freeze(["revoked"]),
  error: Object.freeze(["pending", "revoked"]),
  revoked: Object.freeze([])
});
const RANGE_MODES = Object.freeze(["start_date", "all_available"]);
const ATTRIBUTION_TYPES = Object.freeze(["video", "live", "showcase", "other", "unknown"]);

class AffiliateCreatorDomainError extends Error {
  constructor(code) {
    super(code);
    this.name = "AffiliateCreatorDomainError";
    this.code = code;
  }
}

function exactKeys(value, allowed, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AffiliateCreatorDomainError(code);
  if (Object.keys(value).some((key) => !allowed.includes(key))) throw new AffiliateCreatorDomainError(code);
}

function uuid(value, code) {
  try {
    return exactAccountId(value);
  } catch {
    throw new AffiliateCreatorDomainError(code);
  }
}

function boundedText(value, code, { nullable = false, maximum = 300 } = {}) {
  if (nullable && (value === null || value === undefined)) return null;
  const text = String(value || "").trim();
  if (!text || text.length > maximum) throw new AffiliateCreatorDomainError(code);
  return text;
}

function nullableText(value, code, maximum = 300) {
  return boundedText(value, code, { nullable: true, maximum });
}

function nullableTimestamp(value, code) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new AffiliateCreatorDomainError(code);
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.toISOString() !== value) throw new AffiliateCreatorDomainError(code);
  return value;
}

function nullableInteger(value, code, { nonnegative = false } = {}) {
  if (value === null || value === undefined) return null;
  if (!Number.isSafeInteger(value) || (nonnegative && value < 0)) throw new AffiliateCreatorDomainError(code);
  return value;
}

function currency(value, { nullable = true } = {}) {
  if (nullable && (value === null || value === undefined)) return null;
  const normalized = String(value || "").toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) throw new AffiliateCreatorDomainError("invalid_currency");
  return normalized;
}

function reportingTimezone(value) {
  const timezone = boundedText(value, "invalid_reporting_timezone", { maximum: 100 });
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
  } catch {
    throw new AffiliateCreatorDomainError("invalid_reporting_timezone");
  }
  return timezone;
}

function createImportPolicy(input) {
  exactKeys(input, ["creatorAccountId", "rangeMode", "inclusiveStartDate", "reportingTimezone"], "invalid_import_policy");
  const rangeMode = String(input.rangeMode || "");
  if (!RANGE_MODES.includes(rangeMode)) throw new AffiliateCreatorDomainError("invalid_range_mode");
  const timezone = reportingTimezone(input.reportingTimezone);
  let inclusiveStartDate = input.inclusiveStartDate;
  if (rangeMode === "start_date") {
    if (typeof inclusiveStartDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(inclusiveStartDate)) {
      throw new AffiliateCreatorDomainError("inclusive_start_date_required");
    }
    const date = new Date(`${inclusiveStartDate}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== inclusiveStartDate) {
      throw new AffiliateCreatorDomainError("invalid_inclusive_start_date");
    }
  } else if (inclusiveStartDate !== null && inclusiveStartDate !== undefined) {
    throw new AffiliateCreatorDomainError("all_available_disallows_start_date");
  } else {
    inclusiveStartDate = null;
  }
  return Object.freeze({
    creatorAccountId: exactAccountId(input.creatorAccountId),
    provider: PROVIDER,
    rangeMode,
    inclusiveStartDate,
    reportingTimezone: timezone
  });
}

function createIdentityBinding(input) {
  exactKeys(input, ["id", "creatorAccountId", "providerCreatorId", "state"], "invalid_identity_binding");
  const state = String(input.state || "");
  if (!AUTHORIZATION_STATES.includes(state)) throw new AffiliateCreatorDomainError("invalid_authorization_state");
  const providerCreatorId = nullableText(input.providerCreatorId, "invalid_provider_creator_id", 200);
  if (state === "authorized" && !providerCreatorId) {
    throw new AffiliateCreatorDomainError("authorized_identity_required");
  }
  return Object.freeze({
    id: uuid(input.id, "invalid_binding_id"),
    creatorAccountId: exactAccountId(input.creatorAccountId),
    provider: PROVIDER,
    providerCreatorId,
    state
  });
}

function transitionIdentityBinding(binding, { toState, providerCreatorId = binding?.providerCreatorId } = {}) {
  const current = createIdentityBinding({
    id: binding?.id,
    creatorAccountId: binding?.creatorAccountId,
    providerCreatorId: binding?.providerCreatorId,
    state: binding?.state
  });
  const nextState = String(toState || "");
  if (!AUTHORIZATION_STATES.includes(nextState)) throw new AffiliateCreatorDomainError("invalid_authorization_state");
  if (!AUTHORIZATION_TRANSITIONS[current.state].includes(nextState)) {
    throw new AffiliateCreatorDomainError("invalid_authorization_transition");
  }
  if (current.providerCreatorId && providerCreatorId !== current.providerCreatorId) {
    throw new AffiliateCreatorDomainError("provider_creator_identity_immutable");
  }
  return createIdentityBinding({
    id: current.id,
    creatorAccountId: current.creatorAccountId,
    state: nextState,
    providerCreatorId
  });
}

function assertAccountScope(record, creatorAccountId) {
  const expected = exactAccountId(creatorAccountId);
  if (record?.creatorAccountId !== expected) throw new AffiliateCreatorDomainError("creator_account_mismatch");
  return record;
}

function commonEntity(input, allowed, kind) {
  exactKeys(input, ["id", "creatorAccountId", "providerRecordId", ...allowed], `invalid_${kind}`);
  return {
    id: uuid(input.id, `invalid_${kind}_id`),
    creatorAccountId: exactAccountId(input.creatorAccountId),
    provider: PROVIDER,
    providerRecordId: boundedText(input.providerRecordId, `invalid_${kind}_provider_id`, { maximum: 200 })
  };
}

function createCollaboration(input) {
  return Object.freeze({
    ...commonEntity(input, ["collaborationType", "status", "title", "startedAt", "endedAt"], "collaboration"),
    collaborationType: nullableText(input.collaborationType, "invalid_collaboration_type", 100),
    status: nullableText(input.status, "invalid_collaboration_status", 100),
    title: nullableText(input.title, "invalid_collaboration_title", 300),
    startedAt: nullableTimestamp(input.startedAt, "invalid_collaboration_started_at"),
    endedAt: nullableTimestamp(input.endedAt, "invalid_collaboration_ended_at")
  });
}

function createProduct(input) {
  return Object.freeze({
    ...commonEntity(input, ["title", "showcaseStatus", "currency", "priceMinor", "commissionRateBasisPoints"], "product"),
    title: nullableText(input.title, "invalid_product_title", 300),
    showcaseStatus: nullableText(input.showcaseStatus, "invalid_showcase_status", 100),
    currency: currency(input.currency),
    priceMinor: nullableInteger(input.priceMinor, "invalid_product_price", { nonnegative: true }),
    commissionRateBasisPoints: nullableInteger(input.commissionRateBasisPoints, "invalid_commission_rate", { nonnegative: true })
  });
}

function createSampleApplication(input) {
  return Object.freeze({
    ...commonEntity(input, ["productProviderId", "applicationType", "status"], "sample_application"),
    productProviderId: boundedText(input.productProviderId, "invalid_sample_product_id", { maximum: 200 }),
    applicationType: nullableText(input.applicationType, "invalid_sample_type", 100),
    status: nullableText(input.status, "invalid_sample_status", 100)
  });
}

function createAffiliateOrder(input) {
  const base = commonEntity(input, [
    "productProviderId", "createdAt", "status", "quantity", "currency", "gmvMinor",
    "estimatedCommissionMinor", "finalCommissionMinor", "refundMinor", "settledAt"
  ], "affiliate_order");
  return Object.freeze({
    ...base,
    productProviderId: boundedText(input.productProviderId, "invalid_order_product_id", { maximum: 200 }),
    createdAt: nullableTimestamp(input.createdAt, "invalid_order_created_at"),
    status: nullableText(input.status, "invalid_order_status", 100),
    quantity: nullableInteger(input.quantity, "invalid_order_quantity", { nonnegative: true }),
    currency: currency(input.currency),
    gmvMinor: nullableInteger(input.gmvMinor, "invalid_order_gmv", { nonnegative: true }),
    estimatedCommissionMinor: nullableInteger(input.estimatedCommissionMinor, "invalid_estimated_commission", { nonnegative: true }),
    finalCommissionMinor: nullableInteger(input.finalCommissionMinor, "invalid_final_commission", { nonnegative: true }),
    refundMinor: nullableInteger(input.refundMinor, "invalid_refund", { nonnegative: true }),
    settledAt: nullableTimestamp(input.settledAt, "invalid_settled_at")
  });
}

function createAttribution(input) {
  const base = commonEntity(input, ["orderProviderId", "attributionType", "contentProviderId"], "attribution");
  const attributionType = input.attributionType === null || input.attributionType === undefined
    ? "unknown"
    : String(input.attributionType);
  if (!ATTRIBUTION_TYPES.includes(attributionType)) throw new AffiliateCreatorDomainError("invalid_attribution_type");
  return Object.freeze({
    ...base,
    orderProviderId: boundedText(input.orderProviderId, "invalid_attribution_order_id", { maximum: 200 }),
    attributionType,
    contentProviderId: nullableText(input.contentProviderId, "invalid_content_provider_id", 200)
  });
}

module.exports = {
  AUTHORIZATION_STATES,
  AUTHORIZATION_TRANSITIONS,
  RANGE_MODES,
  ATTRIBUTION_TYPES,
  AffiliateCreatorDomainError,
  createImportPolicy,
  createIdentityBinding,
  transitionIdentityBinding,
  assertAccountScope,
  createCollaboration,
  createProduct,
  createSampleApplication,
  createAffiliateOrder,
  createAttribution
};
