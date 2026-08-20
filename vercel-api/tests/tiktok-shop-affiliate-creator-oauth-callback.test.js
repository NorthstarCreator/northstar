"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createHandler } = require("../api/auth/tiktok-shop/affiliate-creator/callback");

const root = path.join(__dirname, "..");
const callbackPath = path.join(root, "api", "auth", "tiktok-shop", "affiliate-creator", "callback.js");
const state = "A".repeat(43);
function response() { return { headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(body = "") { this.body = body; } }; }
async function invoke(handler, url) { const res = response(); await handler({ method: "GET", url }, res); return res; }

async function testDisabledAndParameterBoundaries() {
  delete process.env.NORTHSTAR_AFFILIATE_CREATOR_RUNTIME_ENABLED;
  const disabled = await invoke(createHandler(), `/?state=${state}&code=code`);
  assert.equal(disabled.statusCode, 404); assert.equal(disabled.body.includes(state), false);
  const handler = createHandler({ createService: () => ({ async callback() { throw new Error("should not run"); } }) });
  for (const url of ["/?code=x", `/?state=${state}`, `/?state=${state}&code=x&code=y`, `/?state=${state}&code=x&unexpected=y`]) {
    const result = await invoke(handler, url); assert.equal(result.statusCode, 400); assert.equal(result.body.includes(state), false);
  }
}

function testNoLegacyCallbackDependencies() {
  const source = fs.readFileSync(callbackPath, "utf8");
  assert.match(source, /tiktok-shop-affiliate-creator-runtime-service/);
  assert.doesNotMatch(source, /requireSession|oauth-state|token-store|redis|upstash|session|withDatabase|process\.env|console\.|logger/i);
  assert.match(source, /runtime: "nodejs"/);
}

(async () => { await testDisabledAndParameterBoundaries(); testNoLegacyCallbackDependencies(); console.log("TikTok Shop Affiliate Creator OAuth callback tests passed."); })().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
