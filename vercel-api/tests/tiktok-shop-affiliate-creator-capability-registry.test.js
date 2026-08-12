"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  OBSERVED_SCOPE_STATUS,
  CAPABILITY_REGISTRY,
  getObservedScope,
  getScopeEndpoints,
  getEndpoint,
  isRuntimeAllowed
} = require("../lib/tiktok-shop-affiliate-creator-capability-registry");

const EXPECTED_SCOPES = [
  "creator.affiliate.info",
  "creator.data.live.read.public",
  "creator.affiliate.share_link.read",
  "creator.affiliate_collaboration.read",
  "creator.showcase.read"
];

const EXPECTED_ENDPOINT_COUNTS = Object.freeze({
  "creator.affiliate.info": 9,
  "creator.data.live.read.public": 7,
  "creator.affiliate.share_link.read": 4,
  "creator.affiliate_collaboration.read": 7,
  "creator.showcase.read": 2
});

function testRegistryContentsAndImmutability() {
  assert.equal(OBSERVED_SCOPE_STATUS, "observed_active");
  assert.deepEqual(CAPABILITY_REGISTRY.map((record) => record.key), EXPECTED_SCOPES);
  assert.equal(new Set(CAPABILITY_REGISTRY.map((record) => record.key)).size, 5);
  assert.equal(CAPABILITY_REGISTRY.length, 5);
  assert.equal(CAPABILITY_REGISTRY.reduce((count, record) => count + record.endpoints.length, 0), 29);
  assert.ok(Object.isFrozen(CAPABILITY_REGISTRY));

  for (const record of CAPABILITY_REGISTRY) {
    assert.equal(record.observedStatus, "observed_active");
    assert.equal(record.endpoints.length, EXPECTED_ENDPOINT_COUNTS[record.key]);
    assert.ok(Object.isFrozen(record));
    assert.ok(Object.isFrozen(record.endpoints));
    for (const item of record.endpoints) {
      assert.equal(item.runtimeAllowed, false);
      assert.ok(Object.isFrozen(item));
    }
  }

  assert.equal(CAPABILITY_REGISTRY.filter((record) => record.key === "creator.affiliate_collaboration.read").length, 1);
  assert.throws(() => CAPABILITY_REGISTRY.push({}));
  assert.throws(() => getScopeEndpoints(EXPECTED_SCOPES[0]).push({}));
}

function testEndpointPlacementAndVariants() {
  const namesByScope = Object.fromEntries(CAPABILITY_REGISTRY.map((record) => [record.key, record.endpoints.map((item) => item.name)]));
  assert.deepEqual(namesByScope["creator.affiliate.info"], [
    "Check Anchor Content", "Check Anchor Prerequisites", "Get Creator Profile", "Get Creator Profile (old)",
    "Get Live Account Info", "Get Live Room Info", "Get Live Room Info", "Get Shop Products (legacy)",
    "get user online room's product information"
  ]);
  assert.deepEqual(namesByScope["creator.data.live.read.public"], [
    "Get Live Room Core Stats", "Get Live Room GMV Trend", "Get Live Room Interactive Trends",
    "Get Live Room Product Stats", "Get Live Room Traffic Performance", "Get Live Room User Portraits",
    "Get Live Room View Trends"
  ]);
  assert.deepEqual(namesByScope["creator.affiliate.share_link.read"], [
    "Creator Generate General Link", "Creator Generate Publisher Link", "Creator Search Affiliate Trace Orders", "Toko Product Mapper V2"
  ]);
  assert.deepEqual(namesByScope["creator.affiliate_collaboration.read"], [
    "Creator Get Sample Request Deeplink", "Creator Search Open Collaboration Product",
    "Creator Search Sample Application Fulfillments", "Creator Select Affiliate Product",
    "Get Creator Applicable Sample Label", "Get Creator Sample Application Detail",
    "Get Open Collaboration Product List By Product Ids"
  ]);
  assert.deepEqual(namesByScope["creator.showcase.read"], ["Get Showcase Products", "Get Showcase Products (old)"]);

  const affiliateInfo = getScopeEndpoints("creator.affiliate.info");
  assert.equal(affiliateInfo.filter((item) => item.documentationState === "contract_reviewed_official_markdown").length, 1);
  assert.equal(getEndpoint("creator.affiliate.info", "get-creator-profile").documentationState, "contract_reviewed_official_markdown");
  assert.equal(getEndpoint("creator.affiliate.info", "get-creator-profile").contractVersion, "202405");
  assert.deepEqual(affiliateInfo.filter((item) => item.name === "Get Live Room Info").map((item) => item.variant), ["current", "legacy"]);
  assert.equal(getEndpoint("creator.showcase.read", "get-showcase-products-old").variant, "old");

  for (const key of ["creator-get-sample-request-deeplink", "creator-select-affiliate-product"]) {
    const item = getEndpoint("creator.affiliate_collaboration.read", key);
    assert.equal(item.classification, "action_or_artifact");
    assert.equal(item.documentationState, "ui_doc_unavailable");
    assert.equal(item.runtimeAllowed, false);
  }
}

function testDefaultDenyAndPureLookups() {
  assert.equal(getObservedScope(EXPECTED_SCOPES[0]).key, EXPECTED_SCOPES[0]);
  assert.equal(getObservedScope("unknown"), null);
  assert.equal(getObservedScope(" creator.affiliate.info"), null);
  assert.deepEqual(getScopeEndpoints("unknown"), []);
  assert.ok(Object.isFrozen(getScopeEndpoints("unknown")));
  assert.equal(getEndpoint(EXPECTED_SCOPES[0], "unknown"), null);
  for (const value of [null, undefined, "", " ", {}, [], 1]) {
    assert.equal(isRuntimeAllowed(value, "get-creator-profile"), false);
    assert.equal(isRuntimeAllowed(EXPECTED_SCOPES[0], value), false);
  }
  for (const record of CAPABILITY_REGISTRY) {
    for (const item of record.endpoints) assert.equal(isRuntimeAllowed(record.key, item.key), false);
  }
}

function testStaticSafetyAndDormancy() {
  const root = path.join(__dirname, "..");
  const moduleName = "tiktok-shop-affiliate-creator-capability-registry";
  const modulePath = path.join(root, `lib/${moduleName}.js`);
  const source = fs.readFileSync(modulePath, "utf8");
  assert.doesNotMatch(source, /scope[_ ]?id|app[_ ]?id|client[_ ]?id|caller[_ ]?id/i);
  assert.doesNotMatch(source, /https?:\/\/|\b(?:GET|POST|PUT|PATCH|DELETE)\s+\//);
  assert.doesNotMatch(source, /requestPath|payload|responseSchema|responseFields/i);
  assert.doesNotMatch(source, /\bfetch\s*\(|axios|https?\.request|WebSocket|redis|upstash|oauth|access_token|refresh_token|authorization_code|credential|secret/i);
  assert.doesNotMatch(source, /process\.env|feature[_-]?flag|retry|logger|console\.|cache|withDatabase|\bsql`/i);
  assert.doesNotMatch(source, /\b(?:INSERT|UPDATE|DELETE|UPSERT|MERGE|TRUNCATE|ALTER|CREATE|DROP|GRANT|REVOKE|CALL|DO)\b/i);
  assert.doesNotMatch(source, /2025-10-01|sync_runs|videos|connected_tiktok_accounts/i);

  const runtimeRoots = [path.join(root, "api"), path.join(root, "lib")];
  const permittedDormantConsumers = new Set([
    "lib/tiktok-shop-affiliate-creator-authorization-persistence-contract.js"
  ]);
  const consumers = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (entry.name.endsWith(".js") && target !== modulePath && fs.readFileSync(target, "utf8").includes(moduleName)) {
        consumers.push(path.relative(root, target));
      }
    }
  };
  runtimeRoots.forEach(visit);
  assert.deepEqual(consumers, [...permittedDormantConsumers]);
}

testRegistryContentsAndImmutability();
testEndpointPlacementAndVariants();
testDefaultDenyAndPureLookups();
testStaticSafetyAndDormancy();
console.log("TikTok Shop Affiliate Creator capability registry tests passed.");
