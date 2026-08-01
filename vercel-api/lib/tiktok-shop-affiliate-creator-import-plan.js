const { createHash } = require("node:crypto");
const { exactAccountId } = require("./revenue-provider-contract");
const { createImportPolicy } = require("./tiktok-shop-affiliate-creator-domain");
const { ENDPOINTS, PROVIDER } = require("./providers/tiktok-shop-affiliate-creator");

const PAGE_SIZE_LIMITS = Object.freeze({
  search_creator_affiliate_orders: 100,
  search_creator_target_collaborations: 100,
  get_showcase_products: 20
});

class AffiliateCreatorImportPlanError extends Error {
  constructor(code) {
    super(code);
    this.name = "AffiliateCreatorImportPlanError";
    this.code = code;
  }
}

function exactKeys(value, allowed, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AffiliateCreatorImportPlanError(code);
  }
  if (Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new AffiliateCreatorImportPlanError(code);
  }
}

function isoTimestamp(value, code) {
  if (typeof value !== "string") throw new AffiliateCreatorImportPlanError(code);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new AffiliateCreatorImportPlanError(code);
  }
  return value;
}

function localPartsAt(timestamp, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date(timestamp));
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

function localDateStartUtc(dateText, timeZone) {
  const [year, month, day] = dateText.split("-").map(Number);
  const nominalUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
  let candidate = nominalUtc;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = localPartsAt(candidate, timeZone);
    const representedAsUtc = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second)
    );
    candidate += nominalUtc - representedAsUtc;
  }
  const verified = localPartsAt(candidate, timeZone);
  if (
    verified.year !== String(year).padStart(4, "0")
    || verified.month !== String(month).padStart(2, "0")
    || verified.day !== String(day).padStart(2, "0")
    || verified.hour !== "00"
    || verified.minute !== "00"
    || verified.second !== "00"
  ) {
    throw new AffiliateCreatorImportPlanError("local_start_time_unresolvable");
  }
  return new Date(candidate).toISOString();
}

function createImportPlan({ creatorAccountId, policy, runStartedAt } = {}) {
  const accountId = exactAccountId(creatorAccountId);
  const normalizedPolicy = createImportPolicy(policy);
  if (normalizedPolicy.creatorAccountId !== accountId) {
    throw new AffiliateCreatorImportPlanError("creator_account_mismatch");
  }
  const upperBoundary = isoTimestamp(runStartedAt, "invalid_run_started_at");
  const lowerBoundary = normalizedPolicy.rangeMode === "start_date"
    ? localDateStartUtc(normalizedPolicy.inclusiveStartDate, normalizedPolicy.reportingTimezone)
    : null;
  if (lowerBoundary && Date.parse(lowerBoundary) >= Date.parse(upperBoundary)) {
    throw new AffiliateCreatorImportPlanError("invalid_import_time_window");
  }
  return Object.freeze({
    creatorAccountId: accountId,
    provider: PROVIDER,
    rangeMode: normalizedPolicy.rangeMode,
    reportingTimezone: normalizedPolicy.reportingTimezone,
    inclusiveStartDate: normalizedPolicy.inclusiveStartDate,
    createTimeGe: lowerBoundary,
    createTimeLt: upperBoundary,
    runStartedAt: upperBoundary
  });
}

function tokenHash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function createPaginationRequest({
  creatorAccountId,
  importPlan,
  operation,
  pageSize,
  pageToken = null,
  seenPageTokenHashes = []
} = {}) {
  const accountId = exactAccountId(creatorAccountId);
  if (importPlan?.creatorAccountId !== accountId) {
    throw new AffiliateCreatorImportPlanError("creator_account_mismatch");
  }
  if (!ENDPOINTS[operation]) throw new AffiliateCreatorImportPlanError("operation_not_allowlisted");
  const pageSizeLimit = PAGE_SIZE_LIMITS[operation];
  if (!pageSizeLimit) throw new AffiliateCreatorImportPlanError("pagination_contract_unconfirmed");
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > pageSizeLimit) {
    throw new AffiliateCreatorImportPlanError("invalid_page_size");
  }
  if (!Array.isArray(seenPageTokenHashes) || seenPageTokenHashes.some((value) => !/^[0-9a-f]{64}$/.test(value))) {
    throw new AffiliateCreatorImportPlanError("invalid_seen_page_tokens");
  }
  let pageTokenHash = null;
  if (pageToken !== null) {
    if (typeof pageToken !== "string" || !pageToken || pageToken.length > 2000) {
      throw new AffiliateCreatorImportPlanError("invalid_page_token");
    }
    pageTokenHash = tokenHash(pageToken);
    if (seenPageTokenHashes.includes(pageTokenHash)) {
      throw new AffiliateCreatorImportPlanError("repeated_page_token");
    }
  }
  return Object.freeze({
    creatorAccountId: accountId,
    provider: PROVIDER,
    operation,
    pageSize,
    pageToken,
    pageTokenHash,
    createTimeGe: operation === "search_creator_affiliate_orders" ? importPlan.createTimeGe : null,
    createTimeLt: operation === "search_creator_affiliate_orders" ? importPlan.createTimeLt : null
  });
}

module.exports = {
  PAGE_SIZE_LIMITS,
  AffiliateCreatorImportPlanError,
  createImportPlan,
  createPaginationRequest
};
