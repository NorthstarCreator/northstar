const { createBlockedProviderAdapter } = require("../revenue-provider-contract");

module.exports = createBlockedProviderAdapter({
  sourceCode: "tiktok_go",
  displayName: "TikTok GO"
});
