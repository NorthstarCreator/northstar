const DISPLAY_BINDING_PROVIDER = "tiktok_display_api";

const CALCULATED_ACCOUNT_ALIASES = Object.freeze([
  "all",
  "all-accounts",
  "all_accounts",
  "all accounts",
  "allaccounts"
]);

const UUID_PATTERN = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const authorizedAccounts = new WeakMap();

class SessionCreatorAccountAuthorizationError extends Error {
  constructor(code) {
    super(code);
    this.name = "SessionCreatorAccountAuthorizationError";
    this.code = code;
  }
}

function fail(code) {
  throw new SessionCreatorAccountAuthorizationError(code);
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isCalculatedAlias(value) {
  return CALCULATED_ACCOUNT_ALIASES.includes(text(value).toLowerCase());
}

function exactUuid(value, code) {
  const candidate = text(value);
  if (!UUID_PATTERN.test(candidate)) fail(code);
  return candidate.toLowerCase();
}

function validateSession(session) {
  if (!isRecord(session) || !text(session.id) || session.expired === true) {
    fail("session_required");
  }
}

function validateConnection(connection, expectedProvider) {
  if (!isRecord(connection) || !text(connection.displayIdentity)) {
    fail("authenticated_account_required");
  }
  if (text(expectedProvider) !== DISPLAY_BINDING_PROVIDER
    || text(connection.bindingProvider) !== expectedProvider) {
    fail("provider_mismatch");
  }
  if (connection.disconnectedAt !== null && connection.disconnectedAt !== undefined) {
    fail("account_unavailable");
  }
  return text(connection.displayIdentity);
}

function validateCallerSelection(selection, accountId) {
  if (selection === null || selection === undefined || selection === "") return;
  if (isCalculatedAlias(selection)) fail("calculated_account_not_allowed");
  if (exactUuid(selection, "cross_account_request_rejected") !== accountId) {
    fail("cross_account_request_rejected");
  }
}

function resolveSessionCreatorAccountAuthorization({
  session,
  displayConnection,
  bindingCandidates,
  expectedBindingProvider,
  callerSelection = null
} = {}) {
  validateSession(session);
  const displayIdentity = validateConnection(displayConnection, expectedBindingProvider);

  if (!Array.isArray(bindingCandidates) || bindingCandidates.length === 0) {
    fail("account_not_found");
  }
  if (bindingCandidates.length !== 1) fail("ambiguous_account_binding");

  const candidate = bindingCandidates[0];
  if (!isRecord(candidate)) fail("account_not_found");
  if (text(candidate.bindingProvider) !== expectedBindingProvider) fail("provider_mismatch");
  if (text(candidate.displayIdentity) !== displayIdentity) fail("cross_account_request_rejected");
  if (candidate.connectionDisconnectedAt !== null
    && candidate.connectionDisconnectedAt !== undefined) {
    fail("account_unavailable");
  }
  if (text(candidate.accountStatus) !== "active") fail("account_unavailable");
  if (isCalculatedAlias(candidate.accountSlug)) fail("calculated_account_not_allowed");

  const accountId = exactUuid(candidate.creatorAccountId, "account_not_found");
  validateCallerSelection(callerSelection, accountId);

  const context = Object.freeze(Object.create(null));
  authorizedAccounts.set(context, accountId);
  return context;
}

function getAuthorizedCreatorAccountId(context) {
  if (!context || typeof context !== "object" || !authorizedAccounts.has(context)) {
    fail("cross_account_request_rejected");
  }
  return authorizedAccounts.get(context);
}

module.exports = {
  DISPLAY_BINDING_PROVIDER,
  CALCULATED_ACCOUNT_ALIASES,
  SessionCreatorAccountAuthorizationError,
  resolveSessionCreatorAccountAuthorization,
  getAuthorizedCreatorAccountId
};
