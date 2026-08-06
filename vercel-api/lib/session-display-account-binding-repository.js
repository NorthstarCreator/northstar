const DISPLAY_BINDING_PROVIDER = "tiktok_display_api";
const MAX_DISPLAY_IDENTITY_LENGTH = 200;
const UUID_PATTERN = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const ACCOUNT_STATUSES = new Set(["active", "disconnected", "archived"]);

class SessionDisplayAccountBindingRepositoryError extends Error {
  constructor(code) {
    super(code);
    this.name = "SessionDisplayAccountBindingRepositoryError";
    this.code = code;
  }
}

function fail(code) {
  throw new SessionDisplayAccountBindingRepositoryError(code);
}

function requiredText(value, code, maximum = null) {
  if (typeof value !== "string") fail(code);
  const normalized = value.trim();
  if (!normalized || (maximum !== null && normalized.length > maximum)) fail(code);
  return normalized;
}

function normalizeCandidate(row, expectedDisplayIdentity) {
  if (!row || typeof row !== "object" || Array.isArray(row)) fail("invalid_binding_candidate");
  const creatorAccountId = requiredText(row.creator_account_id, "invalid_binding_candidate").toLowerCase();
  const displayIdentity = requiredText(row.display_identity, "invalid_binding_candidate", MAX_DISPLAY_IDENTITY_LENGTH);
  const bindingProvider = requiredText(row.binding_provider, "invalid_binding_candidate");
  const accountStatus = requiredText(row.account_status, "invalid_binding_candidate");
  const accountSlug = requiredText(row.account_slug, "invalid_binding_candidate");
  if (!UUID_PATTERN.test(creatorAccountId)
    || displayIdentity !== expectedDisplayIdentity
    || bindingProvider !== DISPLAY_BINDING_PROVIDER
    || !ACCOUNT_STATUSES.has(accountStatus)
    || (row.connection_disconnected_at !== null
      && row.connection_disconnected_at !== undefined
      && typeof row.connection_disconnected_at !== "string"
      && !(row.connection_disconnected_at instanceof Date))) {
    fail("invalid_binding_candidate");
  }
  return Object.freeze({
    creatorAccountId,
    displayIdentity,
    bindingProvider,
    connectionDisconnectedAt: row.connection_disconnected_at ?? null,
    accountStatus,
    accountSlug
  });
}

async function readSessionDisplayAccountBindings(query, displayIdentity, expectedProvider) {
  if (typeof query !== "function") fail("binding_query_required");
  const trustedDisplayIdentity = requiredText(displayIdentity, "display_identity_required", MAX_DISPLAY_IDENTITY_LENGTH);
  if (expectedProvider !== DISPLAY_BINDING_PROVIDER) fail("display_provider_mismatch");

  let rows;
  try {
    rows = await query`
      SELECT
        ca.id AS creator_account_id,
        cta.tiktok_open_id AS display_identity,
        'tiktok_display_api'::text AS binding_provider,
        cta.disconnected_at AS connection_disconnected_at,
        ca.status AS account_status,
        ca.slug AS account_slug
      FROM public.connected_tiktok_accounts AS cta
      JOIN public.creator_accounts AS ca
        ON ca.id = cta.account_id
      WHERE cta.tiktok_open_id = ${trustedDisplayIdentity}
        AND ca.platform = 'tiktok'
      ORDER BY ca.id
      LIMIT 2
    `;
  } catch (_) {
    fail("binding_query_failed");
  }
  if (!Array.isArray(rows)) fail("invalid_binding_result");
  if (rows.length > 2) fail("binding_candidate_invariant_failed");
  return Object.freeze(rows.map((row) => normalizeCandidate(row, trustedDisplayIdentity)));
}

module.exports = {
  DISPLAY_BINDING_PROVIDER,
  MAX_DISPLAY_IDENTITY_LENGTH,
  SessionDisplayAccountBindingRepositoryError,
  readSessionDisplayAccountBindings
};
