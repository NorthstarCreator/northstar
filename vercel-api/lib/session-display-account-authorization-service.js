const {
  DISPLAY_BINDING_PROVIDER,
  readSessionDisplayAccountBindings
} = require("./session-display-account-binding-repository");
const {
  SessionCreatorAccountAuthorizationError,
  resolveSessionCreatorAccountAuthorization
} = require("./session-creator-account-authorization");

function fail(code) {
  throw new SessionCreatorAccountAuthorizationError(code);
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function validateTrustedFacts(session, displayConnection) {
  if (!isRecord(session) || !text(session.id) || session.expired === true) {
    fail("session_required");
  }
  if (!isRecord(displayConnection) || !text(displayConnection.displayIdentity)) {
    fail("authenticated_account_required");
  }
  if (text(displayConnection.bindingProvider) !== DISPLAY_BINDING_PROVIDER) {
    fail("provider_mismatch");
  }
  if (displayConnection.disconnectedAt !== null && displayConnection.disconnectedAt !== undefined) {
    fail("account_unavailable");
  }
  return text(displayConnection.displayIdentity);
}

async function authorizeSessionDisplayCreatorAccount(input = {}) {
  if (!isRecord(input)
    || Object.keys(input).some((key) => !["query", "session", "displayConnection"].includes(key))) {
    fail("invalid_authorization_input");
  }
  const { query, session, displayConnection } = input;
  const displayIdentity = validateTrustedFacts(session, displayConnection);
  let bindingCandidates;
  try {
    bindingCandidates = await readSessionDisplayAccountBindings(
      query,
      displayIdentity,
      DISPLAY_BINDING_PROVIDER
    );
  } catch (_) {
    fail("account_binding_unavailable");
  }
  return resolveSessionCreatorAccountAuthorization({
    session,
    displayConnection,
    bindingCandidates,
    expectedBindingProvider: DISPLAY_BINDING_PROVIDER
  });
}

module.exports = {
  authorizeSessionDisplayCreatorAccount
};
