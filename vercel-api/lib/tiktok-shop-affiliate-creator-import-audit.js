const { createHash } = require("node:crypto");
const { exactAccountId } = require("./revenue-provider-contract");
const { PROVIDER, ENDPOINTS } = require("./providers/tiktok-shop-affiliate-creator");

const AUDIT_STATUSES = Object.freeze(["planned", "running", "completed", "failed", "blocked"]);

class AffiliateCreatorImportAuditError extends Error {
  constructor(code) {
    super(code);
    this.name = "AffiliateCreatorImportAuditError";
    this.code = code;
  }
}

function exactKeys(value, allowed, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AffiliateCreatorImportAuditError(code);
  }
  if (Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new AffiliateCreatorImportAuditError(code);
  }
}

function text(value, code, maximum = 200, { nullable = false } = {}) {
  if (nullable && (value === null || value === undefined)) return null;
  if (typeof value !== "string") throw new AffiliateCreatorImportAuditError(code);
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) throw new AffiliateCreatorImportAuditError(code);
  return normalized;
}

function timestamp(value, code, { nullable = false } = {}) {
  if (nullable && (value === null || value === undefined)) return null;
  const normalized = text(value, code, 40);
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== normalized) {
    throw new AffiliateCreatorImportAuditError(code);
  }
  return normalized;
}

function count(value, code) {
  if (!Number.isSafeInteger(value) || value < 0) throw new AffiliateCreatorImportAuditError(code);
  return value;
}

function accountReference(creatorAccountId) {
  const accountId = exactAccountId(creatorAccountId);
  return `acct:${createHash("sha256").update(accountId).digest("hex")}`;
}

function createImportAudit(input) {
  exactKeys(input, [
    "creatorAccountId", "runId", "operation", "rangeMode", "reportingTimezone",
    "windowStartedAt", "windowEndedAt", "startedAt", "completedAt", "status",
    "pageCount", "receivedCount", "mappedCount", "skippedCount", "unknownFieldCount",
    "providerRequestIds", "failureCode"
  ], "invalid_import_audit");
  const creatorAccountId = exactAccountId(input.creatorAccountId);
  const operation = text(input.operation, "invalid_audit_operation", 100);
  if (!ENDPOINTS[operation]) throw new AffiliateCreatorImportAuditError("operation_not_allowlisted");
  const rangeMode = text(input.rangeMode, "invalid_audit_range_mode", 20);
  if (!["start_date", "all_available"].includes(rangeMode)) {
    throw new AffiliateCreatorImportAuditError("invalid_audit_range_mode");
  }
  if (!Array.isArray(input.providerRequestIds)) {
    throw new AffiliateCreatorImportAuditError("invalid_provider_request_ids");
  }
  const providerRequestIds = Object.freeze(input.providerRequestIds.map((value) =>
    `request:${createHash("sha256").update(text(value, "invalid_provider_request_id", 200)).digest("hex")}`
  ));
  const status = text(input.status, "invalid_audit_status", 40);
  if (!AUDIT_STATUSES.includes(status)) throw new AffiliateCreatorImportAuditError("invalid_audit_status");
  const failureCode = text(input.failureCode, "invalid_audit_failure_code", 100, { nullable: true });
  if (failureCode && !/^[a-z0-9_:-]+$/.test(failureCode)) {
    throw new AffiliateCreatorImportAuditError("invalid_audit_failure_code");
  }
  return Object.freeze({
    creatorAccountId,
    accountReference: accountReference(creatorAccountId),
    provider: PROVIDER,
    runId: text(input.runId, "invalid_audit_run_id", 200),
    operation,
    rangeMode,
    reportingTimezone: text(input.reportingTimezone, "invalid_audit_timezone", 100),
    windowStartedAt: timestamp(input.windowStartedAt, "invalid_audit_window_start", { nullable: true }),
    windowEndedAt: timestamp(input.windowEndedAt, "invalid_audit_window_end"),
    startedAt: timestamp(input.startedAt, "invalid_audit_started_at"),
    completedAt: timestamp(input.completedAt, "invalid_audit_completed_at", { nullable: true }),
    status,
    pageCount: count(input.pageCount, "invalid_audit_page_count"),
    receivedCount: count(input.receivedCount, "invalid_audit_received_count"),
    mappedCount: count(input.mappedCount, "invalid_audit_mapped_count"),
    skippedCount: count(input.skippedCount, "invalid_audit_skipped_count"),
    unknownFieldCount: count(input.unknownFieldCount, "invalid_audit_unknown_count"),
    providerRequestIds,
    failureCode
  });
}

function assertAuditAccount(audit, creatorAccountId) {
  const accountId = exactAccountId(creatorAccountId);
  if (audit?.creatorAccountId !== accountId) {
    throw new AffiliateCreatorImportAuditError("creator_account_mismatch");
  }
  return audit;
}

module.exports = {
  AUDIT_STATUSES,
  AffiliateCreatorImportAuditError,
  accountReference,
  createImportAudit,
  assertAuditAccount
};
