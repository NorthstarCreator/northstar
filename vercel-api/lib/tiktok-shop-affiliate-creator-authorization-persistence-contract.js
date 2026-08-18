"use strict";

const {
  CREATOR_AUTHORIZATION_CONTRACT,
  getValidatedCreatorAuthorizationIdentity
} = require("./tiktok-shop-affiliate-creator-authorization-contract");
const {
  AFFILIATE_CREATOR_AUTHORIZATION_STATES,
  assessAffiliateCreatorTokenFacts
} = require("./tiktok-shop-affiliate-creator-authorization-lifecycle");
const {
  getAuthorizedCreatorAccountId
} = require("./session-creator-account-authorization");
const {
  CAPABILITY_REGISTRY
} = require("./tiktok-shop-affiliate-creator-capability-registry");
const {
  mapAffiliateCreatorCredentialEnvelopePersistenceMaterial
} = require("./tiktok-shop-affiliate-creator-credential-envelope-persistence-contract");

const AUTHORIZED_STATES = Object.freeze(["authorized_limited", "authorized_ready"]);
const REQUIRED_SCOPE = CREATOR_AUTHORIZATION_CONTRACT.requiredScope;
const APPROVED_CREATOR_SCOPES = Object.freeze(CAPABILITY_REGISTRY.map((item) => item.key).sort());
const commands = new WeakMap();

class AffiliateCreatorAuthorizationPersistenceContractError extends Error {
  constructor(code) {
    super(code);
    this.name = "AffiliateCreatorAuthorizationPersistenceContractError";
    this.code = code;
  }
}

function fail(code) {
  throw new AffiliateCreatorAuthorizationPersistenceContractError(code);
}

function isRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, keys) {
  return isRecord(value) && Object.keys(value).every((key) => keys.includes(key));
}

function validUnixSeconds(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function revision(value) {
  if (!Number.isSafeInteger(value) || value < 0) fail("invalid_authorization_revision");
  return value;
}

function validateRevisionPair(expectedRevision, nextRevision) {
  const expected = revision(expectedRevision);
  const next = revision(nextRevision);
  if (next !== expected + 1) fail("invalid_authorization_revision");
  return Object.freeze({ expected, next });
}

function trustedAccountId(context) {
  try {
    return getAuthorizedCreatorAccountId(context);
  } catch {
    fail("authorization_context_required");
  }
}

function normalizeScopes(value) {
  if (!Array.isArray(value) || value.length === 0) fail("invalid_authorization_scopes");
  const scopes = new Set();
  for (const scope of value) {
    if (typeof scope !== "string" || !APPROVED_CREATOR_SCOPES.includes(scope)) {
      fail("invalid_authorization_scopes");
    }
    scopes.add(scope);
  }
  if (!scopes.has(REQUIRED_SCOPE)) fail("invalid_authorization_scopes");
  return Object.freeze([...scopes].sort());
}

function supportedProviderProvenance(value) {
  if (value !== undefined) fail("unsupported_provider_provenance");
}

function authorizedAssessment({ state, grantedScopes, accessTokenExpiresAt, refreshTokenExpiresAt, validatedAt, optionalCapabilitiesComplete }) {
  if (!AUTHORIZED_STATES.includes(state)
    || !AFFILIATE_CREATOR_AUTHORIZATION_STATES.includes(state)) {
    fail("invalid_authorization_state");
  }
  if (optionalCapabilitiesComplete !== undefined && typeof optionalCapabilitiesComplete !== "boolean") {
    fail("invalid_authorization_state");
  }
  if (!validUnixSeconds(validatedAt)
    || !validUnixSeconds(accessTokenExpiresAt)
    || accessTokenExpiresAt <= validatedAt
    || (refreshTokenExpiresAt !== undefined
      && (!validUnixSeconds(refreshTokenExpiresAt)
        || refreshTokenExpiresAt <= accessTokenExpiresAt))) {
    fail("invalid_credential_expiration");
  }
  const expectedState = optionalCapabilitiesComplete === false ? "authorized_limited" : "authorized_ready";
  if (state !== expectedState) fail("invalid_authorization_state");
  // The reviewed lifecycle assessor requires a known refresh expiration. Use it
  // whenever that fact exists; a missing refresh expiration remains unknown,
  // rather than being fabricated by this persistence-only contract.
  if (refreshTokenExpiresAt !== undefined) {
    try {
      assessAffiliateCreatorTokenFacts({
        userType: CREATOR_AUTHORIZATION_CONTRACT.creatorUserType,
        now: validatedAt,
        accessTokenExpiresAt,
        refreshTokenExpiresAt,
        grantedScopes,
        requiredScopes: [REQUIRED_SCOPE],
        optionalCapabilitiesComplete
      });
    } catch {
      fail("invalid_authorization_scopes");
    }
  }
  return Object.freeze({ accessTokenExpiresAt, refreshTokenExpiresAt });
}

function command(publicFields, privateFields) {
  const normalized = Object.freeze(Object.create(null));
  commands.set(normalized, Object.freeze(Object.assign(Object.create(null), publicFields, privateFields)));
  return normalized;
}

function credentialsFor(input, credentialRevision) {
  try {
    return mapAffiliateCreatorCredentialEnvelopePersistenceMaterial({
      authorizationContext: input.authorizationContext,
      connectionId: input.connectionId,
      credentialRevision,
      accessEnvelope: input.accessEnvelope,
      refreshEnvelope: input.refreshEnvelope,
      expectedAccessAad: input.expectedAccessAad,
      expectedRefreshAad: input.expectedRefreshAad
    });
  } catch (error) {
    if (error && typeof error.code === "string") fail(error.code);
    fail("encrypted_credentials_required");
  }
}

function trustedAuthorizationFacts(result) {
  try {
    const facts = getValidatedCreatorAuthorizationIdentity(result);
    return Object.freeze({
      identity: Object.freeze(Object.assign(Object.create(null), {
        providerCreatorOpenId: facts.openId,
        userType: facts.userType
      })),
      scopes: normalizeScopes(facts.grantedScopes),
      accessTokenExpiresAt: facts.accessTokenExpiresAt,
      refreshTokenExpiresAt: facts.refreshTokenExpiresAt
    });
  } catch {
    fail("creator_authorization_result_required");
  }
}

function normalizeAuthorizationPersistenceCommand(input, { operation, timestampName }) {
  const keys = ["authorizationContext", "authorizationResult", "expectedRevision", "nextRevision", "state", "connectionId", "accessEnvelope", "refreshEnvelope", "expectedAccessAad", "expectedRefreshAad", timestampName, "validatedAt", "optionalCapabilitiesComplete", "providerApiVersion"];
  if (!exactKeys(input, keys) || !validUnixSeconds(input[timestampName]) || !validUnixSeconds(input.validatedAt) || input[timestampName] > input.validatedAt) {
    fail("invalid_persistence_input");
  }
  supportedProviderProvenance(input.providerApiVersion);
  const accountId = trustedAccountId(input.authorizationContext);
  const revisions = validateRevisionPair(input.expectedRevision, input.nextRevision);
  const facts = trustedAuthorizationFacts(input.authorizationResult);
  const assessment = authorizedAssessment({ ...input, grantedScopes: facts.scopes, accessTokenExpiresAt: facts.accessTokenExpiresAt, refreshTokenExpiresAt: facts.refreshTokenExpiresAt });
  const credentials = credentialsFor(input, revisions.next);
  return command({ operation, state: input.state, expectedRevision: revisions.expected, nextRevision: revisions.next }, {
    accountId, identity: facts.identity, scopes: facts.scopes, credentials, [timestampName]: input[timestampName], validatedAt: input.validatedAt,
    accessTokenExpiresAt: assessment.accessTokenExpiresAt, refreshTokenExpiresAt: assessment.refreshTokenExpiresAt ?? null
  });
}

function normalizeInitialAuthorizationPersistenceCommand(input) {
  return normalizeAuthorizationPersistenceCommand(input, { operation: "initial_authorization", timestampName: "authorizedAt" });
}

function normalizeReauthorizationPersistenceCommand(input) {
  return normalizeAuthorizationPersistenceCommand(input, { operation: "reauthorization", timestampName: "reauthorizedAt" });
}

function normalizeRefreshRotationPersistenceCommand(input) {
  const keys = ["authorizationContext", "expectedRevision", "nextRevision", "state", "grantedScopes", "connectionId", "accessEnvelope", "refreshEnvelope", "expectedAccessAad", "expectedRefreshAad", "accessTokenExpiresAt", "refreshTokenExpiresAt", "validatedAt", "refreshedAt", "optionalCapabilitiesComplete", "providerApiVersion"];
  if (!exactKeys(input, keys) || !validUnixSeconds(input.validatedAt) || !validUnixSeconds(input.refreshedAt) || input.validatedAt > input.refreshedAt) {
    fail("invalid_persistence_input");
  }
  supportedProviderProvenance(input.providerApiVersion);
  const accountId = trustedAccountId(input.authorizationContext);
  const revisions = validateRevisionPair(input.expectedRevision, input.nextRevision);
  const scopes = normalizeScopes(input.grantedScopes);
  const assessment = authorizedAssessment({ ...input, grantedScopes: scopes, validatedAt: input.refreshedAt });
  const credentials = credentialsFor(input, revisions.next);
  return command({ operation: "refresh_rotation", state: input.state, expectedRevision: revisions.expected, nextRevision: revisions.next }, {
    accountId, scopes, credentials, validatedAt: input.validatedAt, refreshedAt: input.refreshedAt,
    accessTokenExpiresAt: assessment.accessTokenExpiresAt, refreshTokenExpiresAt: assessment.refreshTokenExpiresAt ?? null
  });
}

function normalizeScopeLifecycleStateUpdateCommand(input) {
  const keys = ["authorizationContext", "expectedRevision", "nextRevision", "state", "previousGrantedScopes", "grantedScopes", "accessTokenExpiresAt", "refreshTokenExpiresAt", "validatedAt", "optionalCapabilitiesComplete", "providerApiVersion"];
  if (!exactKeys(input, keys)) fail("invalid_persistence_input");
  supportedProviderProvenance(input.providerApiVersion);
  const accountId = trustedAccountId(input.authorizationContext);
  const revisions = validateRevisionPair(input.expectedRevision, input.nextRevision);
  const priorScopes = normalizeScopes(input.previousGrantedScopes);
  const scopes = normalizeScopes(input.grantedScopes);
  if (scopes.length >= priorScopes.length || scopes.some((scope) => !priorScopes.includes(scope))) {
    fail("invalid_authorization_scopes");
  }
  const assessment = authorizedAssessment({ ...input, grantedScopes: scopes });
  return command({ operation: "scope_reduction", state: input.state, expectedRevision: revisions.expected, nextRevision: revisions.next }, {
    accountId, scopes, validatedAt: input.validatedAt,
    accessTokenExpiresAt: assessment.accessTokenExpiresAt, refreshTokenExpiresAt: assessment.refreshTokenExpiresAt
  });
}

function normalizeCredentialRemovalCommand(input, operation, state, timestampName) {
  const keys = ["authorizationContext", "expectedRevision", "nextRevision", "state", timestampName, "providerApiVersion"];
  if (!exactKeys(input, keys) || input.state !== state || !validUnixSeconds(input[timestampName])) {
    fail("invalid_persistence_input");
  }
  supportedProviderProvenance(input.providerApiVersion);
  const accountId = trustedAccountId(input.authorizationContext);
  const revisions = validateRevisionPair(input.expectedRevision, input.nextRevision);
  return command({ operation, state, expectedRevision: revisions.expected, nextRevision: revisions.next }, {
    accountId, [timestampName]: input[timestampName], removeCredentials: true
  });
}

function normalizeInvalidRefreshPersistenceCommand(input) {
  return normalizeCredentialRemovalCommand(input, "invalid_refresh", "reauthorization_required", "occurredAt");
}

function normalizeDeauthorizationPersistenceCommand(input) {
  return normalizeCredentialRemovalCommand(input, "deauthorization", "deauthorized", "revokedAt");
}

function privateCommand(commandValue) {
  if (!commandValue || typeof commandValue !== "object" || !commands.has(commandValue)) {
    fail("authorization_context_required");
  }
  return commands.get(commandValue);
}

function getAuthorizedCreatorAccountIdFromPersistenceCommand(commandValue) {
  return privateCommand(commandValue).accountId;
}

function getEncryptedCredentialPersistenceMaterial(commandValue) {
  const material = privateCommand(commandValue);
  if (!material.credentials) fail("encrypted_credentials_not_allowed");
  return material.credentials;
}

function getAffiliateCreatorIdentityFromPersistenceCommand(commandValue) {
  const material = privateCommand(commandValue);
  if (!material.identity) fail("creator_authorization_result_required");
  return material.identity;
}

module.exports = {
  AffiliateCreatorAuthorizationPersistenceContractError,
  APPROVED_CREATOR_SCOPES,
  REQUIRED_SCOPE,
  normalizeInitialAuthorizationPersistenceCommand,
  normalizeReauthorizationPersistenceCommand,
  normalizeRefreshRotationPersistenceCommand,
  normalizeScopeLifecycleStateUpdateCommand,
  normalizeInvalidRefreshPersistenceCommand,
  normalizeDeauthorizationPersistenceCommand,
  getAuthorizedCreatorAccountIdFromPersistenceCommand,
  getEncryptedCredentialPersistenceMaterial,
  getAffiliateCreatorIdentityFromPersistenceCommand
};
