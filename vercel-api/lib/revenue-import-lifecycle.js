const { createHash } = require("node:crypto");
const {
  RevenueProviderError,
  exactAccountId,
  revenueSourceCode
} = require("./revenue-provider-contract");

const IMPORT_JOB_STATES = Object.freeze([
  "planned",
  "blocked",
  "awaiting_approval",
  "ready",
  "queued",
  "running",
  "succeeded",
  "partial",
  "failed",
  "cancelled"
]);

const IMPORT_JOB_TRANSITIONS = Object.freeze({
  planned: Object.freeze(["blocked", "awaiting_approval"]),
  blocked: Object.freeze(["awaiting_approval", "cancelled"]),
  awaiting_approval: Object.freeze(["ready", "cancelled"]),
  ready: Object.freeze(["queued", "cancelled"]),
  queued: Object.freeze(["running", "failed", "cancelled"]),
  running: Object.freeze(["succeeded", "partial", "failed"]),
  succeeded: Object.freeze([]),
  partial: Object.freeze([]),
  failed: Object.freeze([]),
  cancelled: Object.freeze([])
});

const AUDIT_EVENT_TYPES = Object.freeze([
  "job_planned",
  "job_blocked",
  "approval_requested",
  "job_approved",
  "job_queued",
  "job_started",
  "job_succeeded",
  "job_partially_succeeded",
  "job_failed",
  "job_cancelled"
]);

const AUDIT_ACTOR_TYPES = Object.freeze(["system", "operator", "provider"]);

function requiredUuid(value, code) {
  try {
    return exactAccountId(value);
  } catch {
    throw new RevenueProviderError(code, "A UUID is required.");
  }
}

function requiredTimestamp(value, field) {
  const time = Date.parse(String(value || ""));
  if (!Number.isFinite(time)) {
    throw new RevenueProviderError(`invalid_${field}`, `${field} must be an explicit timestamp.`);
  }
  return new Date(time).toISOString();
}

function requiredText(value, field, maximum = 200) {
  const text = String(value || "").trim();
  if (!text || text.length > maximum) {
    throw new RevenueProviderError(`invalid_${field}`, `${field} is required and must be bounded.`);
  }
  return text;
}

function idempotencyKey({ accountId, sourceCode, operationId }) {
  const identity = [
    exactAccountId(accountId),
    revenueSourceCode(sourceCode),
    requiredUuid(operationId, "invalid_operation_id")
  ].join("|");
  return `revenue-import:v1:${createHash("sha256").update(identity).digest("hex")}`;
}

function validatedJobIdentity(job) {
  const key = String(job?.idempotencyKey || "");
  if (!/^revenue-import:v1:[0-9a-f]{64}$/.test(key)) {
    throw new RevenueProviderError("invalid_idempotency_key", "Import job idempotency key is invalid.");
  }
  const revision = Number(job?.revision);
  if (!Number.isInteger(revision) || revision < 1) {
    throw new RevenueProviderError("invalid_job_revision", "Import job revision is invalid.");
  }
  return {
    id: requiredUuid(job?.id, "invalid_job_id"),
    accountId: exactAccountId(job?.accountId),
    sourceCode: revenueSourceCode(job?.sourceCode),
    idempotencyKey: key,
    revision
  };
}

function transitionTimestamp(job, occurredAt) {
  const normalized = requiredTimestamp(occurredAt, "occurred_at");
  const previous = requiredTimestamp(job?.updatedAt, "updated_at");
  if (normalized < previous) {
    throw new RevenueProviderError("non_monotonic_job_time", "Import job timestamps must be monotonic.");
  }
  return normalized;
}

function createImportJobPlan({ jobId, accountId, sourceCode, operationId, createdAt, blockers = [] }) {
  const normalizedBlockers = [...new Set((Array.isArray(blockers) ? blockers : []).map((item) => requiredText(item, "blocker")))];
  return Object.freeze({
    id: requiredUuid(jobId, "invalid_job_id"),
    accountId: exactAccountId(accountId),
    sourceCode: revenueSourceCode(sourceCode),
    idempotencyKey: idempotencyKey({ accountId, sourceCode, operationId }),
    state: normalizedBlockers.length ? "blocked" : "planned",
    blockers: Object.freeze(normalizedBlockers),
    createdAt: requiredTimestamp(createdAt, "created_at"),
    updatedAt: requiredTimestamp(createdAt, "created_at"),
    revision: 1
  });
}

function transitionImportJob(job, { toState, occurredAt }) {
  const identity = validatedJobIdentity(job);
  const currentState = String(job?.state || "");
  const nextState = String(toState || "");
  if (!IMPORT_JOB_STATES.includes(currentState) || !IMPORT_JOB_STATES.includes(nextState)) {
    throw new RevenueProviderError("invalid_import_job_state", "Import job state is invalid.");
  }
  if (!IMPORT_JOB_TRANSITIONS[currentState].includes(nextState)) {
    throw new RevenueProviderError(
      "invalid_import_job_transition",
      `Import job cannot transition from ${currentState} to ${nextState}.`
    );
  }
  if (nextState === "ready" && Array.isArray(job.blockers) && job.blockers.length) {
    throw new RevenueProviderError("import_job_blocked", "Blockers must be resolved before approval.", {
      sourceCode: job.sourceCode,
      blockers: job.blockers
    });
  }
  return Object.freeze({
    ...job,
    ...identity,
    state: nextState,
    blockers: Object.freeze([...(job.blockers || [])]),
    updatedAt: transitionTimestamp(job, occurredAt),
    revision: identity.revision + 1
  });
}

function replaceImportJobBlockers(job, { blockers, occurredAt }) {
  const identity = validatedJobIdentity(job);
  if (!["blocked", "awaiting_approval"].includes(job?.state)) {
    throw new RevenueProviderError(
      "blocker_update_not_allowed",
      "Blockers may change only during blocked or approval review states."
    );
  }
  const normalizedBlockers = [...new Set((Array.isArray(blockers) ? blockers : []).map((item) => requiredText(item, "blocker")))];
  return Object.freeze({
    ...job,
    ...identity,
    blockers: Object.freeze(normalizedBlockers),
    updatedAt: transitionTimestamp(job, occurredAt),
    revision: identity.revision + 1
  });
}

function createAuditEvent({ eventId, job, eventType, occurredAt, actorType, statusCode = null }) {
  const identity = validatedJobIdentity(job);
  const normalizedType = String(eventType || "");
  if (!AUDIT_EVENT_TYPES.includes(normalizedType)) {
    throw new RevenueProviderError("invalid_audit_event_type", "Audit event type is invalid.");
  }
  const normalizedActor = String(actorType || "").trim();
  if (!AUDIT_ACTOR_TYPES.includes(normalizedActor)) {
    throw new RevenueProviderError("invalid_actor_type", "Audit actor type is invalid.");
  }
  const normalizedStatus = statusCode ? requiredText(statusCode, "status_code", 100) : null;
  if (normalizedStatus && !/^[a-z][a-z0-9_]*$/.test(normalizedStatus)) {
    throw new RevenueProviderError("invalid_status_code", "Audit status code is invalid.");
  }
  return Object.freeze({
    id: requiredUuid(eventId, "invalid_audit_event_id"),
    jobId: identity.id,
    accountId: identity.accountId,
    sourceCode: identity.sourceCode,
    eventType: normalizedType,
    occurredAt: requiredTimestamp(occurredAt, "occurred_at"),
    actorType: normalizedActor,
    statusCode: normalizedStatus,
    jobRevision: identity.revision
  });
}

module.exports = {
  IMPORT_JOB_STATES,
  IMPORT_JOB_TRANSITIONS,
  AUDIT_EVENT_TYPES,
  AUDIT_ACTOR_TYPES,
  idempotencyKey,
  createImportJobPlan,
  transitionImportJob,
  replaceImportJobBlockers,
  createAuditEvent
};
