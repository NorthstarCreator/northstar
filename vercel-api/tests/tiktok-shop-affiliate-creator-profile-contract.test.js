"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  CreatorProfileContractError,
  CREATOR_PROFILE_CONTRACT,
  normalizeCreatorProfileResponse
} = require("../lib/tiktok-shop-affiliate-creator-profile-contract");
const { CAPABILITY_REGISTRY, getEndpoint, getObservedScope, isRuntimeAllowed } = require("../lib/tiktok-shop-affiliate-creator-capability-registry");

const TEXT = String.fromCharCode(120);

function response(data = {}, envelope = {}) {
  return { code: 0, message: TEXT, request_id: TEXT, data: { creator_user_id: TEXT, ...data }, ...envelope };
}

function assertCode(callback, code) {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof CreatorProfileContractError);
    assert.equal(error.code, code);
    assert.equal(error.message, code);
    assert.deepEqual(Object.keys(error).sort(), ["code", "name"]);
    return true;
  });
}

function testStaticContract() {
  assert.equal(CREATOR_PROFILE_CONTRACT.version, "202405");
  assert.equal(CREATOR_PROFILE_CONTRACT.method, "GET");
  assert.equal(CREATOR_PROFILE_CONTRACT.relativePath, "/affiliate_creator/202405/profiles");
  assert.equal(CREATOR_PROFILE_CONTRACT.permittedScope, "creator.affiliate.info");
  assert.deepEqual(CREATOR_PROFILE_CONTRACT.documentedAlternativeScopes, ["creator.video.write"]);
  assert.equal(CREATOR_PROFILE_CONTRACT.documentedAlternativeScopes.includes(CREATOR_PROFILE_CONTRACT.permittedScope), false);
  assert.equal(getObservedScope("creator.video.write"), null);
  assert.equal(CREATOR_PROFILE_CONTRACT.runtimeAllowed, false);
  assert.deepEqual(CREATOR_PROFILE_CONTRACT.request.headerNames, ["content-type", "x-tts-access-token"]);
  assert.deepEqual(CREATOR_PROFILE_CONTRACT.request.queryFields, {
    app_key: "string", sign: "string", timestamp: "integer_unix_timestamp_utc"
  });
  assert.equal(CREATOR_PROFILE_CONTRACT.request.body, null);
  assert.deepEqual(CREATOR_PROFILE_CONTRACT.response.envelopeFields, ["code", "message", "request_id", "data"]);
  assert.deepEqual(CREATOR_PROFILE_CONTRACT.response.dataFields, {
    avatar: ["width", "height", "url"],
    username: "string",
    selection_region: "string",
    register_region: "string",
    seller_type: "enum",
    permissions: "array",
    user_type: "enum",
    creator_user_id: "string"
  });
  assert.deepEqual(CREATOR_PROFILE_CONTRACT.enums.sellerTypes, ["CROSS_BORDER", "LOCAL"]);
  assert.deepEqual(CREATOR_PROFILE_CONTRACT.enums.permissions, ["LIVE_STREAM_PERMISSION", "SELF_SALE_PERMISSION", "ADD_AFFILIATE_PERMISSION"]);
  assert.deepEqual(CREATOR_PROFILE_CONTRACT.enums.userTypes, ["TIKTOK_SHOP_OFFICIAL_ACCOUNT", "TIKTOK_MARKETING_ACCOUNT", "TIKTOK_SHOP_CREATOR"]);
  assert.deepEqual(CREATOR_PROFILE_CONTRACT.endpointErrorCodes, [16015006, 16015007, 16501011, 16504002, 36009002]);
  assert.equal(CREATOR_PROFILE_CONTRACT.numericRateLimit, null);
  assert.ok(Object.isFrozen(CREATOR_PROFILE_CONTRACT));
  assert.ok(Object.isFrozen(CREATOR_PROFILE_CONTRACT.request));
  assert.ok(Object.isFrozen(CREATOR_PROFILE_CONTRACT.enums.permissions));
  assert.throws(() => CREATOR_PROFILE_CONTRACT.enums.permissions.push("unknown"));
}

function testNormalizationAndDiscarding() {
  const profile = normalizeCreatorProfileResponse(response({
    avatar: {}, username: TEXT,
    selection_region: TEXT, register_region: TEXT, seller_type: "LOCAL",
    permissions: ["LIVE_STREAM_PERMISSION", "SELF_SALE_PERMISSION", "ADD_AFFILIATE_PERMISSION"],
    user_type: "TIKTOK_SHOP_CREATOR", future_field: "discarded"
  }));
  assert.equal(Object.getPrototypeOf(profile), null);
  assert.deepEqual(Object.keys(profile), ["creatorUserId", "selectionRegion", "registerRegion", "sellerType", "permissions", "userType"]);
  assert.deepEqual({ ...profile }, {
    creatorUserId: TEXT, selectionRegion: TEXT, registerRegion: TEXT, sellerType: "LOCAL",
    permissions: ["LIVE_STREAM_PERMISSION", "SELF_SALE_PERMISSION", "ADD_AFFILIATE_PERMISSION"], userType: "TIKTOK_SHOP_CREATOR"
  });
  assert.ok(Object.isFrozen(profile));
  assert.ok(Object.isFrozen(profile.permissions));
  assert.equal("avatar" in profile, false);
  assert.equal("username" in profile, false);
  assert.equal("message" in profile, false);
  assert.equal("requestId" in profile, false);
  assert.equal("futureField" in profile, false);
  assert.throws(() => profile.permissions.push("LIVE_STREAM_PERMISSION"));

  const emptyPermissions = normalizeCreatorProfileResponse(response({ permissions: [] }));
  assert.deepEqual(emptyPermissions.permissions, []);
  assert.ok(Object.isFrozen(emptyPermissions.permissions));
  const absentOptionalFields = normalizeCreatorProfileResponse(response());
  assert.equal(absentOptionalFields.selectionRegion, null);
  assert.equal(absentOptionalFields.registerRegion, null);
  assert.equal(absentOptionalFields.sellerType, null);
  assert.equal(absentOptionalFields.userType, null);
  for (const permission of CREATOR_PROFILE_CONTRACT.enums.permissions)
    assert.deepEqual(normalizeCreatorProfileResponse(response({ permissions: [permission] })).permissions, [permission]);
  for (const sellerType of CREATOR_PROFILE_CONTRACT.enums.sellerTypes)
    assert.equal(normalizeCreatorProfileResponse(response({ seller_type: sellerType })).sellerType, sellerType);
  for (const userType of CREATOR_PROFILE_CONTRACT.enums.userTypes)
    assert.equal(normalizeCreatorProfileResponse(response({ user_type: userType })).userType, userType);
}

function testFailureContainment() {
  assertCode(() => normalizeCreatorProfileResponse(response({}, { code: 36009002, message: TEXT, request_id: TEXT })), "creator_profile_api_error");
  for (const item of [null, [], TEXT, {}, { code: "0", data: {} }, { code: 0, data: null }, { code: 0, data: [] }, { code: 0, data: {} }, { code: 0, data: { creator_user_id: "" } }, { code: 0, data: { creator_user_id: 1 } }, { code: 0, data: { creator_user_id: TEXT, permissions: TEXT } }, { code: 0, data: { creator_user_id: TEXT, permissions: [TEXT] } }, { code: 0, data: { creator_user_id: TEXT, seller_type: TEXT } }, { code: 0, data: { creator_user_id: TEXT, user_type: TEXT } }, { code: 0, data: { creator_user_id: TEXT, selection_region: 1 } }]) {
    assertCode(() => normalizeCreatorProfileResponse(item), "invalid_creator_profile_response");
  }
}

function testRegistryReview() {
  assert.equal(CAPABILITY_REGISTRY.length, 5);
  assert.equal(CAPABILITY_REGISTRY.reduce((sum, item) => sum + item.endpoints.length, 0), 29);
  const endpoint = getEndpoint("creator.affiliate.info", "get-creator-profile");
  assert.equal(endpoint.contractVersion, "202405");
  assert.equal(endpoint.documentationState, "contract_reviewed_official_markdown");
  assert.equal(endpoint.classification, "future_read_only_candidate");
  for (const scope of CAPABILITY_REGISTRY) for (const item of scope.endpoints) assert.equal(item.runtimeAllowed, false);
  assert.equal(isRuntimeAllowed("creator.affiliate.info", "get-creator-profile"), false);
}

function testStaticSafetyAndDormancy() {
  const root = path.join(__dirname, "..");
  const moduleName = "tiktok-shop-affiliate-creator-profile-contract";
  const modulePath = path.join(root, `lib/${moduleName}.js`);
  const source = fs.readFileSync(modulePath, "utf8");
  assert.doesNotMatch(source, /https?:\/\//i);
  assert.doesNotMatch(source, /fetch\s*\(|axios|https?\.request|WebSocket|oauth|access_token|refresh_token|authorization_code|process\.env|withDatabase|cache|logger|console\.|retry|\bsql`/i);
  assert.doesNotMatch(source, /\b(?:INSERT\s+INTO|UPDATE\s+[\w."]+\s+SET|DELETE\s+FROM|UPSERT\s+INTO|MERGE\s+INTO|TRUNCATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE|GRANT\s+\w+\s+ON|REVOKE\s+\w+\s+ON|CALL\s+[\w."]+|DO\s+\$\$)\b/i);
  assert.doesNotMatch(source, /2025-10-01|sync_runs|videos|connected_tiktok_accounts/i);
  const consumers = [];
  for (const directory of [path.join(root, "api"), path.join(root, "lib")]) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (!entry.name.endsWith(".js")) continue;
      const target = path.join(directory, entry.name);
      if (target !== modulePath && fs.readFileSync(target, "utf8").includes(moduleName)) consumers.push(target);
    }
  }
  assert.deepEqual(consumers, []);
}

[testStaticContract, testNormalizationAndDiscarding, testFailureContainment, testRegistryReview, testStaticSafetyAndDormancy].forEach((test) => test());
console.log("TikTok Shop Affiliate Creator profile contract tests passed.");
