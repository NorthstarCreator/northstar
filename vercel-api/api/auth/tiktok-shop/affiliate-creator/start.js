"use strict";

const config = require("../../../../lib/tiktok-shop-affiliate-creator-runtime-config");
const state = require("../../../../lib/tiktok-shop-affiliate-creator-runtime-state");
const database = require("../../../../lib/tiktok-shop-affiliate-creator-runtime-db");
const client = require("../../../../lib/tiktok-shop-affiliate-creator-runtime-tiktok-client");
const persistence = require("../../../../lib/tiktok-shop-affiliate-creator-runtime-persistence");
const service = require("../../../../lib/tiktok-shop-affiliate-creator-runtime-service");

function send(res, status, value) { res.statusCode = status; res.setHeader("Cache-Control", "private, no-store, max-age=0"); res.setHeader("Content-Type", "application/json; charset=utf-8"); res.end(JSON.stringify(value)); }
function createHandler(dependencies = {}) {
  const createService = dependencies.createService || (() => { const values = config.read(); return service.create({ config: { read: () => values }, state, createDatabase: database.create, createTikTokClient: client.create, createPersistence: persistence.create }); });
  return async function handler(req, res) {
    if (req.method !== "GET") { res.setHeader("Allow", "GET"); return send(res, 405, { error: "affiliate_creator_runtime_unavailable" }); }
    try {
      const result = await createService().start();
      res.statusCode = 302; res.setHeader("Location", result.redirect); res.setHeader("Cache-Control", "private, no-store, max-age=0"); res.setHeader("Pragma", "no-cache"); res.setHeader("Referrer-Policy", "no-referrer"); return res.end();
    } catch { return send(res, 404, { error: "affiliate_creator_runtime_unavailable" }); }
  };
}
module.exports = createHandler(); module.exports.createHandler = createHandler; module.exports.config = { runtime: "nodejs" };
