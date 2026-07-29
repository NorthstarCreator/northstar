const { LIVE_IMPORT_CUTOFF_ISO } = require("./live-import-policy");
const { providerAdapter } = require("./providers");

const DEFAULT_TIMEZONE = "America/New_York";
const SOURCE_DEFINITIONS = Object.freeze([
  Object.freeze({
    code: "tiktok_display_api",
    displayName: "TikTok Content",
    providerAvailability: "available",
    approvalStatus: "approved",
    selectedRangeMode: "specific_date",
    firstImportStatus: "not_started",
    blockingReason: null,
    cutoffStartAt: LIVE_IMPORT_CUTOFF_ISO
  }),
  Object.freeze({
    code: "tiktok_shop",
    displayName: "TikTok Shop",
    providerAvailability: "unconfirmed",
    approvalStatus: "unconfirmed",
    selectedRangeMode: null,
    firstImportStatus: "not_started",
    blockingReason: "provider_documentation_required",
    cutoffStartAt: null
  }),
  Object.freeze({
    code: "creator_rewards",
    displayName: "Creator Rewards",
    providerAvailability: "unconfirmed",
    approvalStatus: "unconfirmed",
    selectedRangeMode: null,
    firstImportStatus: "not_started",
    blockingReason: "creator_api_not_confirmed",
    cutoffStartAt: null
  }),
  Object.freeze({
    code: "tiktok_go",
    displayName: "TikTok GO",
    providerAvailability: "unconfirmed",
    approvalStatus: "unconfirmed",
    selectedRangeMode: null,
    firstImportStatus: "not_started",
    blockingReason: "creator_api_not_confirmed",
    cutoffStartAt: null
  })
]);

function timestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function policyBySource(rows = []) {
  return new Map(rows.map((row) => [String(row.source_code), row]));
}

function buildSourceStatuses({ policyRows = [], displayFirstImportStatus = "not_started", accountId = null } = {}) {
  const policies = policyBySource(policyRows);
  return SOURCE_DEFINITIONS.map((definition) => {
    const policy = policies.get(definition.code);
    const adapter = providerAdapter(definition.code);
    const providerState = adapter && accountId ? adapter.getConnectionState({ accountId }) : null;
    const firstImportStatus = policy?.first_import_status
      || (definition.code === "tiktok_display_api" ? displayFirstImportStatus : definition.firstImportStatus);
    return {
      sourceCode: definition.code,
      displayName: definition.displayName,
      policyConfigurationStatus: policy ? "configured" : "not_configured",
      providerAvailability: definition.providerAvailability,
      providerConnectionState: providerState?.state || (adapter ? "blocked" : "ready"),
      providerBlockers: providerState?.blockers || adapter?.blockers || [],
      approvalStatus: adapter ? "unconfirmed" : policy?.status || definition.approvalStatus,
      policyApprovalStatus: policy?.status || "not_configured",
      selectedRangeMode: policy?.import_range_mode || definition.selectedRangeMode,
      requestedStartAt: timestamp(policy?.requested_start_at),
      effectiveStartAt: timestamp(policy?.effective_start_at),
      providerEarliestAvailableAt: timestamp(policy?.provider_earliest_available_at),
      providerLatestAvailableAt: timestamp(policy?.provider_latest_available_at),
      reportingTimezone: policy?.reporting_timezone || DEFAULT_TIMEZONE,
      firstImportStatus,
      blockingReason: policy?.status === "blocked"
        ? "source_policy_blocked"
        : adapter
          ? "provider_documentation_required"
          : definition.blockingReason,
      cutoffStartAt: definition.cutoffStartAt
    };
  });
}

async function readRevenueSourceStatus(sql, openId) {
  const accountRows = await sql`
    SELECT ca.id, ca.display_name,
      to_regclass('public.source_import_policies') AS policy_table
    FROM connected_tiktok_accounts cta
    JOIN creator_accounts ca ON ca.id = cta.account_id
    WHERE cta.tiktok_open_id = ${openId}
      AND cta.disconnected_at IS NULL
    LIMIT 1
  `;
  const account = accountRows[0] || null;
  if (!account) return null;

  const firstImportRows = await sql`
    SELECT fic.status
    FROM first_import_controls fic
    WHERE fic.account_id = ${account.id}::uuid
    ORDER BY fic.created_at DESC
    LIMIT 1
  `;
  let policyRows = [];
  if (account.policy_table) {
    policyRows = await sql`
      SELECT
        source_code,
        import_range_mode,
        requested_start_at,
        effective_start_at,
        provider_earliest_available_at,
        provider_latest_available_at,
        reporting_timezone,
        status,
        first_import_status
      FROM source_import_policies
      WHERE account_id = ${account.id}::uuid
      ORDER BY source_code ASC
    `;
  }

  return {
    account: { id: account.id, displayName: account.display_name },
    policyTableAvailable: !!account.policy_table,
    sources: buildSourceStatuses({
      policyRows,
      accountId: account.id,
      displayFirstImportStatus: firstImportRows[0]?.status || "not_started"
    })
  };
}

module.exports = {
  DEFAULT_TIMEZONE,
  SOURCE_DEFINITIONS,
  buildSourceStatuses,
  readRevenueSourceStatus
};
