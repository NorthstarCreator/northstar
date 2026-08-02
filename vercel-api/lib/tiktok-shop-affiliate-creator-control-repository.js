const { exactAccountId } = require("./revenue-provider-contract");
const { PROVIDER } = require("./providers/tiktok-shop-affiliate-creator");

const CALCULATED_ACCOUNT_ALIASES = Object.freeze([
  "all",
  "all-accounts",
  "all_accounts",
  "all accounts",
  "allaccounts"
]);

class AffiliateCreatorControlRepositoryError extends Error {
  constructor(code) {
    super(code);
    this.name = "AffiliateCreatorControlRepositoryError";
    this.code = code;
  }
}

function creatorAccountId(value) {
  const candidate = String(value || "").trim();
  if (CALCULATED_ACCOUNT_ALIASES.includes(candidate.toLowerCase())) {
    throw new AffiliateCreatorControlRepositoryError("calculated_account_not_allowed");
  }
  try {
    return exactAccountId(candidate);
  } catch {
    throw new AffiliateCreatorControlRepositoryError("exact_creator_account_required");
  }
}

function nullableTimestamp(value) {
  if (value === null || value === undefined) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function nullableDate(value) {
  if (value === null || value === undefined) return null;
  const text = String(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function nullableText(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

function emptyStatus(blockingReason = "not_configured") {
  return Object.freeze({
    configurationStatus: "not_configured",
    connectionState: "inactive",
    policyStatus: "not_configured",
    rangeMode: null,
    requestedStartDate: null,
    effectiveStartAt: null,
    reportingTimezone: null,
    firstImportStatus: "not_started",
    latestImportStatus: null,
    latestWindowStartAt: null,
    latestWindowEndAt: null,
    blockingReason
  });
}

function normalizeControlStatus(row, expectedAccountId) {
  if (!row) return emptyStatus("creator_account_not_found");
  if (String(row.account_id || "") !== expectedAccountId) {
    throw new AffiliateCreatorControlRepositoryError("cross_account_result_rejected");
  }

  const connectionState = nullableText(row.connection_state) || "inactive";
  const policyStatus = nullableText(row.policy_status) || "not_configured";
  const hasConnection = row.connection_state !== null && row.connection_state !== undefined;
  const hasPolicy = row.policy_status !== null && row.policy_status !== undefined;
  let blockingReason = null;
  if (!hasConnection) blockingReason = "connection_not_configured";
  else if (!hasPolicy) blockingReason = "policy_not_configured";
  else if (connectionState !== "authorized") blockingReason = "connection_inactive";
  else if (!new Set(["approved", "active"]).has(policyStatus)) blockingReason = "policy_inactive";

  return Object.freeze({
    configurationStatus: hasConnection || hasPolicy ? "configured" : "not_configured",
    connectionState,
    policyStatus,
    rangeMode: nullableText(row.import_range_mode),
    requestedStartDate: nullableDate(row.requested_start_date),
    effectiveStartAt: nullableTimestamp(row.effective_start_at),
    reportingTimezone: nullableText(row.reporting_timezone),
    firstImportStatus: nullableText(row.policy_first_import_status) || "not_started",
    latestImportStatus: nullableText(row.latest_import_status),
    latestWindowStartAt: nullableTimestamp(row.latest_window_start_at),
    latestWindowEndAt: nullableTimestamp(row.latest_window_end_at),
    blockingReason
  });
}

async function readAffiliateCreatorControlStatus(sql, creatorAccountValue) {
  if (typeof sql !== "function") {
    throw new AffiliateCreatorControlRepositoryError("database_reader_required");
  }
  const accountId = creatorAccountId(creatorAccountValue);
  const rows = await sql`
    SELECT
      ca.id AS account_id,
      connection.state AS connection_state,
      policy.status AS policy_status,
      policy.import_range_mode,
      policy.requested_start_date,
      policy.effective_start_at,
      policy.reporting_timezone,
      policy.first_import_status AS policy_first_import_status,
      latest_run.status AS latest_import_status,
      latest_run.window_start_at AS latest_window_start_at,
      latest_run.window_end_at AS latest_window_end_at
    FROM public.creator_accounts ca
    LEFT JOIN public.affiliate_creator_connections connection
      ON connection.account_id = ca.id
     AND connection.provider_code = ${PROVIDER}
    LEFT JOIN public.source_import_policies policy
      ON policy.account_id = ca.id
     AND policy.source_code = ${PROVIDER}
    LEFT JOIN LATERAL (
      SELECT run.status, run.window_start_at, run.window_end_at
      FROM public.affiliate_creator_import_runs run
      WHERE run.account_id = ca.id
        AND run.provider_code = ${PROVIDER}
      ORDER BY run.created_at DESC
      LIMIT 1
    ) latest_run ON true
    WHERE ca.id = ${accountId}::uuid
      AND lower(btrim(ca.slug)) <> ALL(${CALCULATED_ACCOUNT_ALIASES}::text[])
    LIMIT 2
  `;
  if (!Array.isArray(rows)) {
    throw new AffiliateCreatorControlRepositoryError("invalid_database_result");
  }
  if (rows.length > 1) {
    throw new AffiliateCreatorControlRepositoryError("ambiguous_control_status");
  }
  return normalizeControlStatus(rows[0] || null, accountId);
}

module.exports = {
  CALCULATED_ACCOUNT_ALIASES,
  AffiliateCreatorControlRepositoryError,
  creatorAccountId,
  normalizeControlStatus,
  readAffiliateCreatorControlStatus
};
