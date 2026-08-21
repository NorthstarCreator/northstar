"use strict";

const config = require("../../../../lib/tiktok-shop-affiliate-creator-runtime-config");
const state = require("../../../../lib/tiktok-shop-affiliate-creator-runtime-state");
const database = require("../../../../lib/tiktok-shop-affiliate-creator-runtime-db");
const client = require("../../../../lib/tiktok-shop-affiliate-creator-runtime-tiktok-client");
const persistence = require("../../../../lib/tiktok-shop-affiliate-creator-runtime-persistence");
const service = require("../../../../lib/tiktok-shop-affiliate-creator-runtime-service");
const PREVIEW_DIAGNOSTIC_BRANCH = "sandbox/tiktok-sandbox-integration";

function send(res, status, value) { res.statusCode = status; res.setHeader("Cache-Control", "private, no-store, max-age=0"); res.setHeader("Content-Type", "application/json; charset=utf-8"); res.end(JSON.stringify(value)); }
function isPreviewDiagnostic(env = process.env) { return env.VERCEL_ENV === "preview" && env.VERCEL_GIT_COMMIT_REF === PREVIEW_DIAGNOSTIC_BRANCH; }
function previewDiagnosticStage(env = process.env) { return isPreviewDiagnostic(env) ? config.diagnosticStage(env) : null; }
function stageError(stage) { const error = new Error("affiliate_creator_runtime_unavailable"); error.stage = stage; return error; }
function defaultService() { const values = config.read(); let runtimeDatabase; try { runtimeDatabase = database.create({ databaseUrl: values.databaseUrl }); } catch { throw stageError("database_initialization"); } return service.create({ config: { read: () => values }, state, createDatabase: () => runtimeDatabase, createTikTokClient: client.create, createPersistence: persistence.create }); }
function logStage(stage) { console.info(`affiliate_creator_preview_stage=${stage}`); }
function createHandler(dependencies = {}) {
  const createService = dependencies.createService || defaultService;
  const diagnosticStage = dependencies.diagnosticStage || previewDiagnosticStage;
  const previewDiagnostic = dependencies.previewDiagnostic || isPreviewDiagnostic;
  return async function handler(req, res) {
    if (req.method !== "GET") { res.setHeader("Allow", "GET"); return send(res, 405, { error: "affiliate_creator_runtime_unavailable" }); }
    const configuredStage = diagnosticStage();
    if (configuredStage) { logStage(configuredStage); return send(res, 404, { error: "affiliate_creator_runtime_unavailable" }); }
    try {
      const result = await createService().start();
      res.statusCode = 302; res.setHeader("Location", result.redirect); res.setHeader("Cache-Control", "private, no-store, max-age=0"); res.setHeader("Pragma", "no-cache"); res.setHeader("Referrer-Policy", "no-referrer"); return res.end();
    } catch (error) { if (previewDiagnostic()) logStage(error && error.stage === "database_initialization" ? "database_initialization" : "authorization_start_database_call"); return send(res, 404, { error: "affiliate_creator_runtime_unavailable" }); }
  };
}
module.exports = createHandler(); module.exports.createHandler = createHandler; module.exports.previewDiagnosticStage = previewDiagnosticStage; module.exports.config = { runtime: "nodejs" };
