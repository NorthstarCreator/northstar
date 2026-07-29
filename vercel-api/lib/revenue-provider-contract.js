const REVENUE_PROVIDER_SOURCES = Object.freeze([
  "tiktok_shop",
  "creator_rewards",
  "tiktok_go"
]);

const CONNECTION_STATES = Object.freeze([
  "not_configured",
  "blocked",
  "pending_approval",
  "ready"
]);

const UNKNOWN_PROVIDER_BLOCKERS = Object.freeze([
  "provider_endpoint_unconfirmed",
  "provider_authentication_unconfirmed",
  "provider_permissions_unconfirmed",
  "provider_approval_requirements_unconfirmed",
  "provider_payload_schema_unconfirmed",
  "provider_account_identifier_unconfirmed",
  "provider_pagination_unconfirmed",
  "provider_rate_limits_unconfirmed",
  "provider_availability_window_unconfirmed",
  "provider_timezone_semantics_unconfirmed",
  "provider_idempotency_identifier_unconfirmed"
]);

class RevenueProviderError extends Error {
  constructor(code, message, { sourceCode = null, retryable = false, blockers = [] } = {}) {
    super(message);
    this.name = "RevenueProviderError";
    this.code = code;
    this.sourceCode = sourceCode;
    this.retryable = !!retryable;
    this.blockers = Object.freeze([...blockers]);
  }

  toStatus() {
    return Object.freeze({
      code: this.code,
      sourceCode: this.sourceCode,
      retryable: this.retryable,
      blockers: Object.freeze([...this.blockers])
    });
  }
}

function exactAccountId(value) {
  const accountId = String(value || "").trim();
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(accountId)) {
    throw new RevenueProviderError(
      "exact_account_required",
      "An exact creator account UUID is required."
    );
  }
  return accountId.toLowerCase();
}

function revenueSourceCode(value) {
  const sourceCode = String(value || "").trim();
  if (!REVENUE_PROVIDER_SOURCES.includes(sourceCode)) {
    throw new RevenueProviderError(
      "unsupported_revenue_provider",
      "A supported revenue provider source is required.",
      { sourceCode: sourceCode || null }
    );
  }
  return sourceCode;
}

function blockerCodes(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new RevenueProviderError(
      "provider_blockers_required",
      "Unconfirmed providers must expose explicit blockers."
    );
  }
  const blockers = [...new Set(values.map((value) => String(value || "").trim()))];
  if (blockers.some((value) => !UNKNOWN_PROVIDER_BLOCKERS.includes(value))) {
    throw new RevenueProviderError(
      "invalid_provider_blocker",
      "Provider blockers must use the standardized unknown-detail model."
    );
  }
  return blockers;
}

function createBlockedProviderAdapter({ sourceCode, displayName, blockers = UNKNOWN_PROVIDER_BLOCKERS }) {
  const normalizedSource = revenueSourceCode(sourceCode);
  const normalizedBlockers = blockerCodes(blockers);
  const name = String(displayName || "").trim();
  if (!name) {
    throw new RevenueProviderError("provider_name_required", "A provider display name is required.");
  }

  return Object.freeze({
    sourceCode: normalizedSource,
    displayName: name,
    interfaceVersion: 1,
    blockers: Object.freeze([...normalizedBlockers]),
    supportsConnection: false,
    supportsImportPlanning: false,
    supportsImportExecution: false,
    getConnectionState({ accountId }) {
      return Object.freeze({
        accountId: exactAccountId(accountId),
        sourceCode: normalizedSource,
        state: "blocked",
        providerAvailability: "unconfirmed",
        approvalStatus: "unconfirmed",
        blockers: Object.freeze([...normalizedBlockers])
      });
    },
    assertReady() {
      throw new RevenueProviderError(
        "provider_documentation_required",
        "Confirmed provider documentation and approval are required.",
        { sourceCode: normalizedSource, blockers: normalizedBlockers }
      );
    }
  });
}

module.exports = {
  REVENUE_PROVIDER_SOURCES,
  CONNECTION_STATES,
  UNKNOWN_PROVIDER_BLOCKERS,
  RevenueProviderError,
  exactAccountId,
  revenueSourceCode,
  blockerCodes,
  createBlockedProviderAdapter
};
