const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  SELECTED_SCOPES,
  ENDPOINTS,
  ENABLE_ENV_NAME,
  adapter,
  featureEnabled,
  assertAllowedEndpoint
} = require("../lib/providers/tiktok-shop-affiliate-creator");

function testExactScopeAndEndpointAllowlist() {
  assert.deepEqual(SELECTED_SCOPES, [
    "creator.affiliate.info",
    "creator.data.live.read.public",
    "creator.affiliate.share_link.read",
    "creator.affiliate_collaboration.read",
    "creator.showcase.read"
  ]);
  assert.equal(Object.keys(ENDPOINTS).length, 9);
  for (const [operation, contract] of Object.entries(ENDPOINTS)) {
    assert.equal(assertAllowedEndpoint({ operation, ...contract }), contract);
    assert.ok(SELECTED_SCOPES.includes(contract.scope));
    assert.ok(["GET", "POST"].includes(contract.method));
    assert.match(contract.path, /^\/(?:affiliate_creator|analytics)\//);
  }
  assert.equal(Object.values(ENDPOINTS).some((item) => item.scope === "creator.affiliate.share_link.read"), false);
}

function testRejectsEverythingOutsideExactContract() {
  const base = { operation: "get_creator_profile", ...ENDPOINTS.get_creator_profile };
  for (const operation of [
    "generate_affiliate_link", "create_collaboration", "manage_showcase",
    "search_seller_orders", "get_live_user_portraits", "get_live_gmv_trends"
  ]) {
    assert.throws(() => assertAllowedEndpoint({ ...base, operation }), { code: "operation_not_allowlisted" });
  }
  assert.throws(() => assertAllowedEndpoint({ ...base, scope: "seller.order.info" }), { code: "scope_not_selected" });
  assert.throws(() => assertAllowedEndpoint({ ...base, method: "POST" }), { code: "endpoint_contract_mismatch" });
  assert.throws(() => assertAllowedEndpoint({ ...base, path: "/undocumented" }), { code: "endpoint_contract_mismatch" });
}

function testFeatureRemainsDisabledAndAdapterHasNoActions() {
  assert.equal(ENABLE_ENV_NAME, "TIKTOK_SHOP_AFFILIATE_CREATOR_AUTH_ENABLED");
  assert.equal(featureEnabled({ NORTHSTAR_ENV: "tiktok_sandbox" }), false);
  assert.equal(featureEnabled({ NORTHSTAR_ENV: "tiktok_sandbox", [ENABLE_ENV_NAME]: "false" }), false);
  assert.equal(featureEnabled({ NORTHSTAR_ENV: "production", [ENABLE_ENV_NAME]: "true" }), false);
  assert.equal(adapter.supportsNetwork, false);
  assert.equal(adapter.supportsAuthorization, false);
  assert.equal(adapter.supportsTokenExchange, false);
  assert.equal(adapter.supportsPersistence, false);
  for (const name of ["fetch", "connect", "authorize", "exchange", "refresh", "import", "sync", "write"])
    assert.equal(name in adapter, false);
}

function testFoundationContainsNoNetworkPersistenceOrCutoff() {
  const root = path.join(__dirname, "..");
  const files = [
    "lib/providers/tiktok-shop-affiliate-creator.js",
    "lib/tiktok-shop-affiliate-creator-domain.js",
    "lib/tiktok-shop-affiliate-creator-ledger.js"
  ];
  const source = files.map((file) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
  assert.doesNotMatch(source, /https?:\/\/|\bfetch\s*\(|axios|x-tts-access-token|app_secret/i);
  assert.doesNotMatch(source, /\b(?:INSERT\s+INTO|UPDATE\s+[a-z_]|DELETE\s+FROM|UPSERT\s+INTO|MERGE\s+INTO|TRUNCATE\s+TABLE)\b/i);
  assert.doesNotMatch(source, /2025-10-01|DISPLAY_API_CUTOFF/i);
  assert.equal(fs.existsSync(path.join(root, "api/tiktok-shop/affiliate-creator/import.js")), false);
}

[
  testExactScopeAndEndpointAllowlist,
  testRejectsEverythingOutsideExactContract,
  testFeatureRemainsDisabledAndAdapterHasNoActions,
  testFoundationContainsNoNetworkPersistenceOrCutoff
].forEach((test) => test());

console.log("TikTok Shop Affiliate Creator provider tests passed.");
