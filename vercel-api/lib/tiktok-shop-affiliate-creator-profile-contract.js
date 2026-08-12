"use strict";

class CreatorProfileContractError extends Error {
  constructor(code) {
    super(code);
    this.name = "CreatorProfileContractError";
    this.code = code;
  }
}

function freeze(value) {
  if (Array.isArray(value)) value.forEach(freeze);
  else if (value && typeof value === "object") Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

const CREATOR_PROFILE_CONTRACT = freeze({
  version: "202405",
  method: "GET",
  relativePath: "/affiliate_creator/202405/profiles",
  permittedScope: "creator.affiliate.info",
  documentedAlternativeScopes: ["creator.video.write"],
  runtimeAllowed: false,
  request: {
    headerNames: ["content-type", "x-tts-access-token"],
    queryFields: freeze({
      app_key: "string",
      sign: "string",
      timestamp: "integer_unix_timestamp_utc"
    }),
    body: null
  },
  response: {
    envelopeFields: ["code", "message", "request_id", "data"],
    dataFields: freeze({
      avatar: freeze(["width", "height", "url"]),
      username: "string",
      selection_region: "string",
      register_region: "string",
      seller_type: "enum",
      permissions: "array",
      user_type: "enum",
      creator_user_id: "string"
    })
  },
  enums: freeze({
    sellerTypes: ["CROSS_BORDER", "LOCAL"],
    permissions: ["LIVE_STREAM_PERMISSION", "SELF_SALE_PERMISSION", "ADD_AFFILIATE_PERMISSION"],
    userTypes: ["TIKTOK_SHOP_OFFICIAL_ACCOUNT", "TIKTOK_MARKETING_ACCOUNT", "TIKTOK_SHOP_CREATOR"]
  }),
  endpointErrorCodes: [16015006, 16015007, 16501011, 16504002, 36009002],
  numericRateLimit: null
});

function invalid() {
  throw new CreatorProfileContractError("invalid_creator_profile_response");
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function optionalText(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") invalid();
  return value;
}

function enumValue(value, allowed) {
  const text = optionalText(value);
  if (text !== null && !allowed.includes(text)) invalid();
  return text;
}

function normalizeCreatorProfileResponse(response) {
  if (!isPlainObject(response) || !Number.isSafeInteger(response.code)) invalid();
  if (response.code !== 0) throw new CreatorProfileContractError("creator_profile_api_error");
  if (!isPlainObject(response.data)) invalid();

  const creatorUserId = response.data.creator_user_id;
  if (typeof creatorUserId !== "string" || creatorUserId.length === 0) invalid();
  const permissions = response.data.permissions;
  if (permissions !== undefined && !Array.isArray(permissions)) invalid();
  const normalizedPermissions = (permissions || []).map((permission) => {
    if (typeof permission !== "string" || !CREATOR_PROFILE_CONTRACT.enums.permissions.includes(permission)) invalid();
    return permission;
  });

  return Object.freeze(Object.assign(Object.create(null), {
    creatorUserId,
    selectionRegion: optionalText(response.data.selection_region),
    registerRegion: optionalText(response.data.register_region),
    sellerType: enumValue(response.data.seller_type, CREATOR_PROFILE_CONTRACT.enums.sellerTypes),
    permissions: Object.freeze(normalizedPermissions),
    userType: enumValue(response.data.user_type, CREATOR_PROFILE_CONTRACT.enums.userTypes)
  }));
}

module.exports = {
  CreatorProfileContractError,
  CREATOR_PROFILE_CONTRACT,
  normalizeCreatorProfileResponse
};
