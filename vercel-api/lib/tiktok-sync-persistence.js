const { expectedDatabaseEnvironment, withDatabase } = require("./db");
const repository = require("./sync-repository");
const { getUserInfo, listVideosSinceCutoff } = require("./tiktok");
const { acquireSyncLock, releaseSyncLock } = require("./sync-lock");

function persistenceEnabled(env = process.env) {
  return String(env.NORTHSTAR_PERSIST_SYNC_ENABLED || "").trim().toLowerCase() === "true";
}

function assertSandboxPersistenceEnvironment(env = process.env) {
  if (!persistenceEnabled(env)) {
    throw safeError("persistence_disabled");
  }
  if (String(env.NORTHSTAR_ENV || "").trim().toLowerCase() !== "tiktok_sandbox") {
    throw safeError("persistence_environment_rejected");
  }
  if (expectedDatabaseEnvironment(env) !== "sandbox") {
    throw safeError("persistence_database_environment_rejected");
  }
}

function requiredVideoPageLimit(env = process.env) {
  const raw = String(env.TIKTOK_VIDEO_SYNC_MAX_PAGES || "").trim();
  if (!/^\d+$/.test(raw)) throw safeError("invalid_video_sync_page_limit");
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw safeError("invalid_video_sync_page_limit");
  }
  return value;
}

function firstImportArmed(env = process.env) {
  return String(env.NORTHSTAR_FIRST_IMPORT_ARMED || "").trim().toLowerCase() === "true";
}

function assertFirstImportAuthorization(openId, env = process.env) {
  if (!firstImportArmed(env)) throw safeError("first_import_not_armed");
  const expectedOpenId = String(env.NORTHSTAR_FIRST_IMPORT_OPEN_ID || "").trim();
  if (!expectedOpenId || String(openId) !== expectedOpenId) {
    throw safeError("first_import_account_rejected");
  }
}

function safeError(code) {
  const error = new Error("TikTok persistence is unavailable.");
  error.code = code;
  return error;
}

const SAFE_VIDEO_FETCH_ERRORS = Object.freeze({
  tiktok_api_rate_limited: {
    code: "video_fetch_rate_limited",
    message: "TikTok temporarily limited video requests after retry attempts."
  },
  tiktok_api_temporarily_unavailable: {
    code: "video_fetch_temporarily_unavailable",
    message: "TikTok video data was temporarily unavailable after retry attempts."
  },
  tiktok_api_network_error: {
    code: "video_fetch_network_error",
    message: "TikTok video data could not be reached after retry attempts."
  },
  tiktok_api_authorization_failed: {
    code: "video_fetch_authorization_failed",
    message: "TikTok authorization no longer permits the requested video data."
  },
  tiktok_api_request_rejected: {
    code: "video_fetch_request_rejected",
    message: "TikTok rejected the video data request."
  },
  tiktok_video_pagination_stalled: {
    code: "video_fetch_pagination_stalled",
    message: "TikTok video pagination did not advance."
  }
});

function safeStageError(stageCode, cause) {
  const mapped = stageCode === "video_fetch_failed"
    ? SAFE_VIDEO_FETCH_ERRORS[cause?.code]
    : null;
  const error = safeError(mapped?.code || stageCode);
  error.safeMessage = mapped?.message || null;
  return error;
}

function safeErrorCode(error, fallback = "sync_failed") {
  return String(error?.code || fallback).replace(/[^a-z0-9_]/gi, "_").slice(0, 80) || fallback;
}

function privacySafeSyncLogger(details) {
  console.error(JSON.stringify({
    syncRunId: String(details.syncRunId),
    stage: String(details.stage),
    safeErrorCode: String(details.safeErrorCode),
    safeErrorMessage: details.safeErrorMessage ? String(details.safeErrorMessage) : null
  }));
}

async function runSyncStage(stageCode, callback) {
  try {
    return await callback();
  } catch (error) {
    throw safeStageError(stageCode, error);
  }
}

async function runPersistentTikTokSync(options = {}) {
  const env = options.env || process.env;
  assertSandboxPersistenceEnvironment(env);
  const maxPages = requiredVideoPageLimit(env);
  const deps = {
    withDatabase,
    repository,
    getUserInfo,
    listVideosSinceCutoff,
    acquireSyncLock,
    releaseSyncLock,
    logSyncFailure: privacySafeSyncLogger,
    ...options.deps
  };

  const profile = await deps.getUserInfo(options.accessToken);
  if (!profile?.open_id) throw safeError("missing_tiktok_open_id");
  const openId = String(profile.open_id);
  const lock = await deps.acquireSyncLock(openId, { env });
  if (!lock) throw safeError("sync_in_progress");

  try {
    return await deps.withDatabase(async (sql) => {
      const control = await deps.repository.getFirstImportControl(sql, openId);
      if (control?.status === "pending_review") throw safeError("first_import_pending_review");
      if (control?.status === "rolled_back") throw safeError("first_import_rolled_back");
      const isFirstImport = !control;
      if (isFirstImport) {
        assertFirstImportAuthorization(openId, env);
        await deps.repository.assertCreatorDataEmpty(sql);
      }

      const run = await deps.repository.createSyncRun(sql);
      const syncRunId = run.id;
      if (isFirstImport) {
        await deps.repository.createFirstImportControl(sql, openId, syncRunId);
      }
      let accountId = null;
      const counts = {
        videosInserted: 0,
        videosUpdated: 0,
        videosSkippedBeforeCutoff: 0,
        accountMetricSnapshotsCreated: 0,
        videoMetricSnapshotsCreated: 0,
        errorCount: 0
      };
      let failureStage = "account_upsert";

      try {
        const existing = await deps.repository.findConnectedAccount(sql, openId);
        const account = await deps.repository.upsertTikTokAccount(
          sql,
          profile,
          syncRunId,
          Array.isArray(options.scopes) ? options.scopes : []
        );
        accountId = account.accountId;
        await deps.repository.attachAccountToSyncRun(sql, syncRunId, accountId, !existing);
        if (isFirstImport) {
          await deps.repository.attachAccountToFirstImportControl(sql, syncRunId, accountId);
        }

        failureStage = "account_snapshot";
        if (await runSyncStage("account_snapshot_failed", () => deps.repository.insertAccountMetricSnapshot(
          sql, profile, syncRunId, accountId, account.connectedTikTokAccountId
        ))) {
          counts.accountMetricSnapshotsCreated += 1;
        }

        failureStage = "video_fetch";
        const page = await runSyncStage("video_fetch_failed", () => deps.listVideosSinceCutoff(options.accessToken, {
          maxPages
        }));
        counts.videosSkippedBeforeCutoff = Number(page.skippedBeforeCutoff || 0);

        failureStage = "video_persistence";
        for (const video of page.videos || []) {
          try {
            const saved = await deps.repository.upsertVideo(sql, video, syncRunId, accountId);
            if (saved.inserted) counts.videosInserted += 1;
            else counts.videosUpdated += 1;
            if (await deps.repository.insertVideoMetricSnapshot(sql, saved.videoId, syncRunId, saved.metrics)) {
              counts.videoMetricSnapshotsCreated += 1;
            }
          } catch (error) {
            counts.errorCount += 1;
            await deps.repository.recordSyncError(sql, syncRunId, {
              accountId,
              stage: "video_persistence",
              recordType: "video",
              externalId: video?.id ? String(video.id) : null,
              code: safeErrorCode(error, "video_persistence_failed")
            });
          }
        }

        if (page.truncated) {
          counts.errorCount += 1;
          await deps.repository.recordSyncError(sql, syncRunId, {
            accountId,
            stage: "video_pagination",
            recordType: "video_page",
            code: "pagination_limit_reached"
          });
        }

        failureStage = "sync_completion";
        await deps.repository.finishSyncRun(sql, syncRunId, {
          ...counts,
          status: counts.errorCount > 0 ? "partial" : "succeeded",
          safeErrorCode: page.truncated ? "pagination_limit_reached" : null
        });

        return {
          profile,
          page,
          syncRunId,
          counts,
          firstImportStatus: isFirstImport ? "pending_review" : "approved"
        };
      } catch (error) {
        const code = safeErrorCode(error);
        const safeMessage = error?.safeMessage || null;
        deps.logSyncFailure({
          syncRunId,
          stage: failureStage,
          safeErrorCode: code,
          safeErrorMessage: safeMessage
        });
        try {
          await deps.repository.recordSyncError(sql, syncRunId, {
            accountId,
            stage: failureStage,
            code,
            message: safeMessage
          });
          await deps.repository.finishSyncRun(sql, syncRunId, {
            ...counts,
            errorCount: counts.errorCount + 1,
            status: "failed",
            safeErrorCode: code,
            safeErrorMessage: safeMessage
          });
        } catch (recordingError) {
          // The original failure remains authoritative; no sensitive detail is emitted.
        }
        throw safeError(code);
      }
    }, env);
  } finally {
    try {
      await deps.releaseSyncLock(lock, { env });
    } catch (_error) {
      // Expiration is the fallback; lock storage details remain private.
    }
  }
}

module.exports = {
  persistenceEnabled,
  assertSandboxPersistenceEnvironment,
  requiredVideoPageLimit,
  firstImportArmed,
  assertFirstImportAuthorization,
  safeErrorCode,
  safeStageError,
  privacySafeSyncLogger,
  runSyncStage,
  runPersistentTikTokSync
};
