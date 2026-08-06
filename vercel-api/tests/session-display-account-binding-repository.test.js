const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  DISPLAY_BINDING_PROVIDER,
  MAX_DISPLAY_IDENTITY_LENGTH,
  SessionDisplayAccountBindingRepositoryError,
  readSessionDisplayAccountBindings
} = require("../lib/session-display-account-binding-repository");

const ACCOUNT_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_ACCOUNT_ID = "00000000-0000-4000-8000-000000000002";
const DISPLAY_IDENTITY = "internal-display-identity";

function row(overrides = {}) {
  return {
    creator_account_id: ACCOUNT_ID,
    display_identity: DISPLAY_IDENTITY,
    binding_provider: DISPLAY_BINDING_PROVIDER,
    connection_disconnected_at: null,
    account_status: "active",
    account_slug: "creator-one",
    ...overrides
  };
}

function queryDouble(rows = []) {
  const calls = [];
  const query = async (strings, ...values) => {
    calls.push({ text: strings.join("?"), values });
    return rows;
  };
  return { query, calls };
}

function errorCode(code) {
  return (error) => error instanceof SessionDisplayAccountBindingRepositoryError
    && error.code === code && error.message === code;
}

async function testInputValidationBeforeQuery() {
  for (const identity of [undefined, null, "", "   ", 42, {}, "x".repeat(MAX_DISPLAY_IDENTITY_LENGTH + 1)]) {
    const probe = queryDouble();
    await assert.rejects(
      readSessionDisplayAccountBindings(probe.query, identity, DISPLAY_BINDING_PROVIDER),
      errorCode("display_identity_required")
    );
    assert.equal(probe.calls.length, 0);
  }
  const providerProbe = queryDouble();
  await assert.rejects(
    readSessionDisplayAccountBindings(providerProbe.query, DISPLAY_IDENTITY, "other-provider"),
    errorCode("display_provider_mismatch")
  );
  assert.equal(providerProbe.calls.length, 0);
}

async function testExactParameterizedQuery() {
  const probe = queryDouble([]);
  const result = await readSessionDisplayAccountBindings(probe.query, DISPLAY_IDENTITY, DISPLAY_BINDING_PROVIDER);
  assert.equal(Object.isFrozen(result), true);
  assert.deepEqual(result, []);
  assert.equal(probe.calls.length, 1);
  assert.deepEqual(probe.calls[0].values, [DISPLAY_IDENTITY]);
  const sql = probe.calls[0].text.replace(/\s+/g, " ").trim();
  assert.match(sql, /FROM public\.connected_tiktok_accounts AS cta/);
  assert.match(sql, /JOIN public\.creator_accounts AS ca ON ca\.id = cta\.account_id/);
  assert.match(sql, /WHERE cta\.tiktok_open_id = \? AND ca\.platform = 'tiktok'/);
  assert.match(sql, /ORDER BY ca\.id LIMIT 2$/);
  assert.doesNotMatch(sql, /LIMIT 1/);
}

async function testCandidateNormalizationAndImmutability() {
  for (const accountStatus of ["active", "disconnected", "archived"]) {
    const disconnectedAt = accountStatus === "active" ? null : "2026-08-05T00:00:00.000Z";
    const result = await readSessionDisplayAccountBindings(
      queryDouble([row({ account_status: accountStatus, connection_disconnected_at: disconnectedAt })]).query,
      DISPLAY_IDENTITY,
      DISPLAY_BINDING_PROVIDER
    );
    assert.equal(result.length, 1);
    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.isFrozen(result[0]), true);
    assert.equal(result[0].accountStatus, accountStatus);
    assert.equal(result[0].connectionDisconnectedAt, disconnectedAt);
  }
  const two = await readSessionDisplayAccountBindings(
    queryDouble([row(), row({ creator_account_id: OTHER_ACCOUNT_ID })]).query,
    DISPLAY_IDENTITY,
    DISPLAY_BINDING_PROVIDER
  );
  assert.equal(two.length, 2);
  for (const accountSlug of ["all", "all-accounts", "all_accounts", "all accounts", "allaccounts"]) {
    const result = await readSessionDisplayAccountBindings(
      queryDouble([row({ account_slug: accountSlug })]).query,
      DISPLAY_IDENTITY,
      DISPLAY_BINDING_PROVIDER
    );
    assert.equal(result[0].accountSlug, accountSlug);
  }
}

async function testInvariantAndMalformedRowsFailSafely() {
  await assert.rejects(
    readSessionDisplayAccountBindings(
      queryDouble([row(), row({ creator_account_id: OTHER_ACCOUNT_ID }), row()]).query,
      DISPLAY_IDENTITY,
      DISPLAY_BINDING_PROVIDER
    ),
    errorCode("binding_candidate_invariant_failed")
  );
  const malformed = [
    null, {}, row({ creator_account_id: "not-a-uuid" }),
    row({ display_identity: "different-private-identity" }),
    row({ binding_provider: "different-provider" }), row({ account_status: "pending" }),
    row({ account_slug: "" }), row({ connection_disconnected_at: 123 })
  ];
  for (const candidate of malformed) {
    await assert.rejects(
      readSessionDisplayAccountBindings(queryDouble([candidate]).query, DISPLAY_IDENTITY, DISPLAY_BINDING_PROVIDER),
      errorCode("invalid_binding_candidate")
    );
  }
}

async function testErrorsDiscloseNoSensitiveData() {
  const sensitive = [ACCOUNT_ID, DISPLAY_IDENTITY, "creator-secret-slug", DISPLAY_BINDING_PROVIDER, "raw-database-detail"];
  const attempts = [
    () => readSessionDisplayAccountBindings(
      queryDouble([row({ account_slug: "creator-secret-slug", display_identity: "wrong" })]).query,
      DISPLAY_IDENTITY,
      DISPLAY_BINDING_PROVIDER
    ),
    () => readSessionDisplayAccountBindings(
      async () => { throw new Error("raw-database-detail"); },
      DISPLAY_IDENTITY,
      DISPLAY_BINDING_PROVIDER
    )
  ];
  for (const attempt of attempts) {
    let error;
    try { await attempt(); } catch (caught) { error = caught; }
    assert.ok(error instanceof SessionDisplayAccountBindingRepositoryError);
    const serialized = JSON.stringify({ name: error.name, code: error.code, message: error.message });
    for (const value of sensitive) assert.equal(serialized.includes(value), false);
  }
}

function testStaticBoundariesAndDormancy() {
  const root = path.join(__dirname, "..");
  const moduleName = "session-display-account-binding-repository";
  const source = fs.readFileSync(path.join(root, `lib/${moduleName}.js`), "utf8");
  assert.equal((source.match(/\$\{/g) || []).length, 1);
  assert.match(source, /cta\.tiktok_open_id = \$\{trustedDisplayIdentity\}/);
  assert.doesNotMatch(source, /\b(?:INSERT|UPDATE|DELETE|UPSERT|MERGE|TRUNCATE|ALTER|CREATE|DROP|GRANT|REVOKE|CALL|DO)\b/);
  assert.doesNotMatch(source, /https?:\/\/|\bfetch\s*\(|axios|redis|upstash|oauth|token|credential|process\.env|withDatabase|2025-10-01/i);
  assert.doesNotMatch(source, /videos|sync_runs|snapshots|source_import_policies|affiliate_creator|revenue/i);
  assert.doesNotMatch(source, /tiktok_union_id|display_name|avatar_url|granted_scopes|follower_count|following_count|likes_count|video_count/);
  assert.doesNotMatch(source, /console\.|logger|cache|serialize|\breq\b|\bres\b/);

  const imports = [];
  const ownFile = path.join(root, `lib/${moduleName}.js`);
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (entry.name.endsWith(".js") && target !== ownFile
        && fs.readFileSync(target, "utf8").includes(moduleName)) imports.push(target);
    }
  };
  [path.join(root, "api"), path.join(root, "lib"), path.join(root, "../dashboard")].forEach(visit);
  assert.deepEqual(imports, [path.join(root, "lib/session-display-account-authorization-service.js")]);
}

(async () => {
  await testInputValidationBeforeQuery();
  await testExactParameterizedQuery();
  await testCandidateNormalizationAndImmutability();
  await testInvariantAndMalformedRowsFailSafely();
  await testErrorsDiscloseNoSensitiveData();
  testStaticBoundariesAndDormancy();
  console.log("Session Display account-binding repository tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
