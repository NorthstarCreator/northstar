const tiktokShop = require("./tiktok-shop");
const creatorRewards = require("./creator-rewards");
const tiktokGo = require("./tiktok-go");

const adapters = Object.freeze({
  [tiktokShop.sourceCode]: tiktokShop,
  [creatorRewards.sourceCode]: creatorRewards,
  [tiktokGo.sourceCode]: tiktokGo
});

function providerAdapter(sourceCode) {
  return adapters[String(sourceCode || "").trim()] || null;
}

module.exports = { adapters, providerAdapter };
