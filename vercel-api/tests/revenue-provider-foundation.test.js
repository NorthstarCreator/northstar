const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  UNKNOWN_PROVIDER_BLOCKERS,
  RevenueProviderError,
  exactAccountId
} = require("../lib/revenue-provider-contract");
const { adapters, providerAdapter } = require("../lib/providers");
const {
  idempotencyKey,
  createImportJobPlan,
  transitionImportJob,
  replaceImportJobBlockers,
  createAuditEvent
} = require("../lib/revenue-import-lifecycle");

const ACCOUNT_ID = "00000000-0000-4000-8000-000000000001";
const JOB_ID = "00000000-0000-4000-8000-000000000002";
const EVENT_ID = "00000000-0000-4000-8000-000000000003";
const OPERATION_ID = "00000000-0000-4000-8000-000000000004";
const CREATED_AT = "2026-07-29T16:00:00Z";

function testSeparateFailClosedProviderAdapters() {
  assert.deepEqual(Object.keys(adapters).sort(), ["creator_rewards", "tiktok_go", "tiktok_shop"]);
  for (const [sourceCode, adapter] of Object.entries(adapters)) {
    assert.equal(providerAdapter(sourceCode), adapter);
    assert.equal(adapter.sourceCode, sourceCode);
    assert.equal(adapter.supportsConnection, false);
    assert.equal(adapter.supportsImportPlanning, false);
    assert.equal(adapter.supportsImportExecution, false);
    assert.equal("connect" in adapter, false);
    assert.equal("import" in adapter, false);
    assert.equal("sync" in adapter, false);
    const state = adapter.getConnectionState({ accountId: ACCOUNT_ID });
    assert.equal(state.accountId, ACCOUNT_ID);
    assert.equal(state.state, "blocked");
    assert.equal(state.providerAvailability, "unconfirmed");
    assert.deepEqual(state.blockers, [...UNKNOWN_PROVIDER_BLOCKERS]);
    assert.throws(() => adapter.assertReady(), (error) => {
      assert.ok(error instanceof RevenueProviderError);
      assert.equal(error.code, "provider_documentation_required");
      assert.equal(error.sourceCode, sourceCode);
      assert.deepEqual(error.toStatus().blockers, [...UNKNOWN_PROVIDER_BLOCKERS]);
      return true;
    });
  }
}

function testExactAccountValidationRejectsCalculatedIdentity() {
  assert.equal(exactAccountId(ACCOUNT_ID.toUpperCase()), ACCOUNT_ID);
  for (const value of ["all", "all-accounts", "all_accounts", "All Accounts", "fixture-open-id", ""]) {
    assert.throws(() => exactAccountId(value), { code: "exact_account_required" });
  }
  assert.throws(
    () => adapters.tiktok_shop.getConnectionState({ accountId: "all" }),
    { code: "exact_account_required" }
  );
}

function testDeterministicAccountAndSourceIdempotency() {
  const input = { accountId: ACCOUNT_ID, sourceCode: "tiktok_shop", operationId: OPERATION_ID };
  const key = idempotencyKey(input);
  assert.equal(key, idempotencyKey({ ...input }));
  assert.notEqual(key, idempotencyKey({ ...input, accountId: JOB_ID }));
  assert.notEqual(key, idempotencyKey({ ...input, sourceCode: "creator_rewards" }));
  assert.match(key, /^revenue-import:v1:[0-9a-f]{64}$/);
  assert.equal(key.includes(input.operationId), false);
  assert.throws(() => idempotencyKey({ ...input, operationId: "creator@example.com" }), {
    code: "invalid_operation_id"
  });
}

function testImportLifecycleAndImmutableIdentity() {
  const blocked = createImportJobPlan({
    jobId: JOB_ID,
    accountId: ACCOUNT_ID,
    sourceCode: "tiktok_go",
    operationId: OPERATION_ID,
    createdAt: CREATED_AT,
    blockers: UNKNOWN_PROVIDER_BLOCKERS
  });
  assert.equal(blocked.state, "blocked");
  assert.equal(blocked.revision, 1);
  assert.equal(Object.isFrozen(blocked.blockers), true);
  assert.throws(
    () => transitionImportJob(blocked, { toState: "ready", occurredAt: "2026-07-29T16:01:00Z" }),
    { code: "invalid_import_job_transition" }
  );

  const awaiting = transitionImportJob(blocked, {
    toState: "awaiting_approval",
    occurredAt: "2026-07-29T16:01:00Z"
  });
  assert.throws(
    () => transitionImportJob(awaiting, { toState: "blocked", occurredAt: "2026-07-29T16:02:00Z" }),
    { code: "invalid_import_job_transition" }
  );
  assert.throws(
    () => transitionImportJob(awaiting, { toState: "ready", occurredAt: "2026-07-29T16:02:00Z" }),
    { code: "import_job_blocked" }
  );
  const reviewed = replaceImportJobBlockers(awaiting, {
    blockers: [],
    occurredAt: "2026-07-29T16:02:00Z"
  });
  const ready = transitionImportJob(reviewed, {
    toState: "ready",
    occurredAt: "2026-07-29T16:03:00Z"
  });
  assert.equal(ready.state, "ready");
  assert.equal(ready.accountId, ACCOUNT_ID);
  assert.equal(ready.sourceCode, "tiktok_go");
  assert.equal(ready.idempotencyKey, blocked.idempotencyKey);
  assert.equal(ready.revision, 4);
  assert.throws(
    () => transitionImportJob({ ...ready, accountId: "all" }, { toState: "queued", occurredAt: "2026-07-29T16:04:00Z" }),
    { code: "exact_account_required" }
  );
  assert.throws(
    () => transitionImportJob(ready, { toState: "queued", occurredAt: "2026-07-29T15:00:00Z" }),
    { code: "non_monotonic_job_time" }
  );
  assert.throws(
    () => transitionImportJob(ready, { toState: "succeeded", occurredAt: "2026-07-29T16:04:00Z" }),
    { code: "invalid_import_job_transition" }
  );
}

function testStandardizedAuditAndErrorModels() {
  const job = createImportJobPlan({
    jobId: JOB_ID,
    accountId: ACCOUNT_ID,
    sourceCode: "creator_rewards",
    operationId: OPERATION_ID,
    createdAt: CREATED_AT
  });
  const event = createAuditEvent({
    eventId: EVENT_ID,
    job,
    eventType: "job_planned",
    occurredAt: CREATED_AT,
    actorType: "system",
    statusCode: "provider_documentation_required"
  });
  assert.deepEqual(event, {
    id: EVENT_ID,
    jobId: JOB_ID,
    accountId: ACCOUNT_ID,
    sourceCode: "creator_rewards",
    eventType: "job_planned",
    occurredAt: "2026-07-29T16:00:00.000Z",
    actorType: "system",
    statusCode: "provider_documentation_required",
    jobRevision: 1
  });
  assert.throws(() => createAuditEvent({ ...event, eventId: "bad", job }), { code: "invalid_audit_event_id" });
  assert.throws(() => createAuditEvent({ ...event, eventId: EVENT_ID, job, actorType: "Jennifer" }), {
    code: "invalid_actor_type"
  });
  assert.throws(() => createAuditEvent({ ...event, eventId: EVENT_ID, job, statusCode: "Bearer secret" }), {
    code: "invalid_status_code"
  });
  assert.throws(() => createImportJobPlan({
    jobId: JOB_ID,
    accountId: ACCOUNT_ID,
    sourceCode: "tiktok_content",
    operationId: OPERATION_ID,
    createdAt: CREATED_AT
  }), { code: "unsupported_revenue_provider" });
}

function testFoundationHasNoRoutePersistenceOrProviderAssumptions() {
  const root = path.join(__dirname, "..");
  const files = [
    "lib/revenue-provider-contract.js",
    "lib/revenue-import-lifecycle.js",
    "lib/providers/tiktok-shop.js",
    "lib/providers/creator-rewards.js",
    "lib/providers/tiktok-go.js",
    "lib/providers/index.js"
  ];
  const source = files.map((file) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
  assert.doesNotMatch(source, /\b(?:INSERT\s+INTO|UPDATE\s+[a-z_]|DELETE\s+FROM|UPSERT\s+INTO|MERGE\s+INTO|TRUNCATE\s+TABLE)\b/i);
  assert.doesNotMatch(source, /https?:\/\/|fetch\(|axios|authorization|bearer|access.?token|refresh.?token/i);
  assert.doesNotMatch(source, /2025-10-01|LIVE_IMPORT_CUTOFF/);
  assert.equal(fs.existsSync(path.join(root, "api/revenue/import.js")), false);
  assert.equal(fs.existsSync(path.join(root, "api/revenue/jobs.js")), false);
  const schemaPlan = fs.readFileSync(path.join(root, "db/schema-plan.md"), "utf8");
  assert.match(schemaPlan, /Planned Provider-Neutral Persistence \(Not Migrated\)/);
  assert.match(schemaPlan, /migration `003_source_import_policies\.sql` remains unexecuted and\s+unchanged/);
  assert.match(schemaPlan, /must not inherit the Display API\s+cutoff/);
  assert.match(schemaPlan, /All Accounts is always calculated/);
}

[
  testSeparateFailClosedProviderAdapters,
  testExactAccountValidationRejectsCalculatedIdentity,
  testDeterministicAccountAndSourceIdempotency,
  testImportLifecycleAndImmutableIdentity,
  testStandardizedAuditAndErrorModels,
  testFoundationHasNoRoutePersistenceOrProviderAssumptions
].forEach((test) => test());

console.log("Revenue provider foundation tests passed.");
