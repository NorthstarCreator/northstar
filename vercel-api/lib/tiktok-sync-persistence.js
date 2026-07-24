const { expectedDatabaseEnvironment, withDatabase } = require("./db");
const repository = require("./sync-repository");
const { getUserInfo, listVideosSinceCutoff } = require("./tiktok");

function persistenceEnabled(env = process.env) {
  return String(env.NORTHSTAR_PERSIST_SYNC_ENABLED || "").trim().toLowerCase() === "true";
}

function assertSandboxPersistenceEnvironment(env = process.env) {
  if (String(env.NORTHSTAR_ENV || "").trim().toLowerCase() !== "tiktok_sandbox") {
    throw safeError("persistence_environment_rejected");
  }
  if (expectedDatabaseEnvironment(env) !== "sandbox") {
    throw safeError("persistence_database_environment_rejected");
  }
}

function safeError(code) {
  const error = new Error("TikTok persistence is unavailable.");
  error.code = code;
  return error;
}

function safeErrorCode(error, fallback = "sync_failed") {
  return String(error?.code || fallback).replace(/[^a-z0-9_]/gi, "_").slice(0, 80) || fallback;
}

async function runPersistentTikTokSync(options = {}) {
  const env = options.env || process.env;
  assertSandboxPersistenceEnvironment(env);
  const deps = {
    withDatabase,
    repository,
    getUserInfo,
    listVideosSinceCutoff,
    ...options.deps
  };

  return deps.withDatabase(async (sql) => {
    const run = await deps.repository.createSyncRun(sql);
    const syncRunId = run.id;
    let accountId = null;
    const counts = {
      videosInserted: 0,
      videosUpdated: 0,
      videosSkippedBeforeCutoff: 0,
      accountMetricSnapshotsCreated: 0,
      videoMetricSnapshotsCreated: 0,
      errorCount: 0
    };

    try {
      const profile = await deps.getUserInfo(options.accessToken);
      if (!profile?.open_id) throw safeError("missing_tiktok_open_id");

      const existing = await deps.repository.findConnectedAccount(sql, String(profile.open_id));
      const account = await deps.repository.upsertTikTokAccount(
        sql,
        profile,
        syncRunId,
        Array.isArray(options.scopes) ? options.scopes : []
      );
      accountId = account.accountId;
      await deps.repository.attachAccountToSyncRun(sql, syncRunId, accountId, !existing);

      if (await deps.repository.insertAccountMetricSnapshot(
        sql,
        profile,
        syncRunId,
        accountId,
        account.connectedTikTokAccountId
      )) {
        counts.accountMetricSnapshotsCreated += 1;
      }

      const page = await deps.listVideosSinceCutoff(options.accessToken, {
        maxPages: options.maxPages
      });
      counts.videosSkippedBeforeCutoff = Number(page.skippedBeforeCutoff || 0);

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

      await deps.repository.finishSyncRun(sql, syncRunId, {
        ...counts,
        status: counts.errorCount > 0 ? "partial" : "succeeded",
        safeErrorCode: page.truncated ? "pagination_limit_reached" : null
      });

      return { profile, page, syncRunId, counts };
    } catch (error) {
      const code = safeErrorCode(error);
      try {
        await deps.repository.recordSyncError(sql, syncRunId, {
          accountId,
          stage: "sync",
          code
        });
        await deps.repository.finishSyncRun(sql, syncRunId, {
          ...counts,
          errorCount: counts.errorCount + 1,
          status: "failed",
          safeErrorCode: code
        });
      } catch (recordingError) {
        // The original failure remains authoritative; no sensitive detail is emitted.
      }
      throw safeError(code);
    }
  }, env);
}

module.exports = {
  persistenceEnabled,
  assertSandboxPersistenceEnvironment,
  safeErrorCode,
  runPersistentTikTokSync
};
