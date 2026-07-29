const SOURCE_CODES = Object.freeze([
  "tiktok_display_api",
  "tiktok_shop",
  "creator_rewards",
  "tiktok_go"
]);
const IMPORT_RANGE_MODES = Object.freeze([
  "all_available",
  "specific_date",
  "authorization_forward"
]);
const POLICY_STATUSES = Object.freeze([
  "draft",
  "pending_approval",
  "approved",
  "active",
  "blocked",
  "archived"
]);
const FIRST_IMPORT_STATUSES = Object.freeze([
  "not_started",
  "pending_review",
  "approved",
  "rolled_back",
  "blocked"
]);

function requiredEnum(value, allowed, field) {
  const normalized = String(value || "").trim();
  if (!allowed.includes(normalized)) {
    const error = new Error(`Invalid ${field}.`);
    error.code = `invalid_${field}`;
    throw error;
  }
  return normalized;
}

function optionalTimestamp(value, field) {
  if (value === null || value === undefined || value === "") return null;
  const timestamp = Date.parse(String(value));
  if (!Number.isFinite(timestamp)) {
    const error = new Error(`Invalid ${field}.`);
    error.code = `invalid_${field}`;
    throw error;
  }
  return new Date(timestamp).toISOString();
}

function reportingTimezone(value) {
  const timezone = String(value || "").trim();
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
  } catch {
    const error = new Error("Invalid reporting_timezone.");
    error.code = "invalid_reporting_timezone";
    throw error;
  }
  if (!timezone) {
    const error = new Error("Invalid reporting_timezone.");
    error.code = "invalid_reporting_timezone";
    throw error;
  }
  return timezone;
}

function normalizeSourceImportPolicy(input = {}) {
  const accountId = String(input.accountId || "").trim();
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(accountId)) {
    const error = new Error("An exact creator account is required.");
    error.code = "source_policy_account_required";
    throw error;
  }

  const sourceCode = requiredEnum(input.sourceCode, SOURCE_CODES, "source_code");
  const importRangeMode = requiredEnum(input.importRangeMode, IMPORT_RANGE_MODES, "import_range_mode");
  const status = requiredEnum(input.status || "draft", POLICY_STATUSES, "policy_status");
  const firstImportStatus = requiredEnum(
    input.firstImportStatus || "not_started",
    FIRST_IMPORT_STATUSES,
    "first_import_status"
  );
  const requestedStartAt = optionalTimestamp(input.requestedStartAt, "requested_start_at");
  const effectiveStartAt = optionalTimestamp(input.effectiveStartAt, "effective_start_at");
  const providerEarliestAvailableAt = optionalTimestamp(
    input.providerEarliestAvailableAt,
    "provider_earliest_available_at"
  );
  const providerLatestAvailableAt = optionalTimestamp(
    input.providerLatestAvailableAt,
    "provider_latest_available_at"
  );
  const approvedAt = optionalTimestamp(input.approvedAt, "approved_at");
  const firstImportCompletedAt = optionalTimestamp(
    input.firstImportCompletedAt,
    "first_import_completed_at"
  );

  if (importRangeMode === "specific_date" && !requestedStartAt) {
    const error = new Error("specific_date requires requested_start_at.");
    error.code = "source_policy_start_required";
    throw error;
  }
  if (providerEarliestAvailableAt && providerLatestAvailableAt
      && providerEarliestAvailableAt > providerLatestAvailableAt) {
    const error = new Error("Provider availability range is invalid.");
    error.code = "source_policy_provider_range_invalid";
    throw error;
  }
  if (effectiveStartAt && providerLatestAvailableAt && effectiveStartAt > providerLatestAvailableAt) {
    const error = new Error("Effective start is after provider availability.");
    error.code = "source_policy_effective_range_invalid";
    throw error;
  }
  if (["approved", "active"].includes(status) && !approvedAt) {
    const error = new Error("Approved policies require approved_at.");
    error.code = "source_policy_approval_time_required";
    throw error;
  }
  if (firstImportStatus === "approved" && !firstImportCompletedAt) {
    const error = new Error("Approved first imports require first_import_completed_at.");
    error.code = "source_policy_completion_time_required";
    throw error;
  }

  return {
    accountId,
    sourceCode,
    importRangeMode,
    requestedStartAt,
    effectiveStartAt,
    providerEarliestAvailableAt,
    providerLatestAvailableAt,
    reportingTimezone: reportingTimezone(input.reportingTimezone),
    status,
    approvedAt,
    firstImportStatus,
    firstImportCompletedAt
  };
}

module.exports = {
  SOURCE_CODES,
  IMPORT_RANGE_MODES,
  POLICY_STATUSES,
  FIRST_IMPORT_STATUSES,
  normalizeSourceImportPolicy
};
