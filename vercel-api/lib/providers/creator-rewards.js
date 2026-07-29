const { createBlockedProviderAdapter } = require("../revenue-provider-contract");

module.exports = createBlockedProviderAdapter({
  sourceCode: "creator_rewards",
  displayName: "Creator Rewards"
});
