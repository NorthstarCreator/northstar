const { createBlockedProviderAdapter } = require("../revenue-provider-contract");

module.exports = createBlockedProviderAdapter({
  sourceCode: "tiktok_shop",
  displayName: "TikTok Shop"
});
