const { assertOnOrAfterLiveImportCutoff, toUtcIso } = require("./live-import-policy");

function normalizeTikTokVideoForDatabase(video, syncRunId, accountId) {
  assertOnOrAfterLiveImportCutoff(video);
  if (!video?.id) {
    const error = new Error("TikTok video ID is required.");
    error.code = "missing_tiktok_video_id";
    throw error;
  }
  const publishedAt = toUtcIso(video.create_time || video.publish_date || video.published_at);
  return {
    accountId,
    syncRunId,
    tiktokVideoId: String(video.id),
    videoUrl: video.share_url || null,
    embedLink: video.embed_link || null,
    coverImageUrl: video.cover_image_url || null,
    title: video.title || null,
    caption: video.video_description || video.caption || null,
    durationSeconds: Number.isFinite(Number(video.duration)) ? Number(video.duration) : null,
    publishedAt,
    metrics: {
      viewCount: nullableNumber(video.view_count),
      likeCount: nullableNumber(video.like_count),
      commentCount: nullableNumber(video.comment_count),
      shareCount: nullableNumber(video.share_count),
      saveCount: nullableNumber(video.save_count),
      averageWatchTimeSeconds: nullableNumber(video.average_watch_time_seconds),
      completionRate: nullableNumber(video.completion_rate),
      followersGained: nullableNumber(video.followers_gained)
    }
  };
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function rollbackFirstImport(sql, syncRunId) {
  const rows = await sql`
    SELECT *
    FROM rollback_first_import(${syncRunId}::uuid)
  `;
  return rows[0] || null;
}

async function createSyncRun(sql) {
  const rows = await sql`
    INSERT INTO sync_runs (platform, sync_type, status, cutoff_start_at)
    VALUES ('tiktok', 'initial_display_api', 'running', TIMESTAMPTZ '2025-10-01 00:00:00+00')
    RETURNING id
  `;
  return rows[0];
}

async function findConnectedAccount(sql, openId) {
  const rows = await sql`
    SELECT account_id
    FROM connected_tiktok_accounts
    WHERE tiktok_open_id = ${openId}
    LIMIT 1
  `;
  return rows[0] || null;
}

async function upsertTikTokAccount(sql, profile, syncRunId, scopes = []) {
  if (!profile?.open_id) {
    const error = new Error("TikTok open ID is required.");
    error.code = "missing_tiktok_open_id";
    throw error;
  }
  const openId = String(profile.open_id);
  const slug = `tiktok-${openId}`;
  const displayName = String(profile.display_name || "TikTok Creator").trim() || "TikTok Creator";
  const scopeList = scopes.map((scope) => String(scope).trim()).filter(Boolean).join(",");
  const accountRows = await sql`
    INSERT INTO creator_accounts (
      platform, slug, display_name, status, first_seen_sync_run_id, last_seen_sync_run_id
    )
    VALUES ('tiktok', ${slug}, ${displayName}, 'active', ${syncRunId}::uuid, ${syncRunId}::uuid)
    ON CONFLICT (platform, slug) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        status = 'active',
        last_seen_sync_run_id = EXCLUDED.last_seen_sync_run_id,
        updated_at = CURRENT_TIMESTAMP
    RETURNING id
  `;
  const accountId = accountRows[0].id;
  const connectedRows = await sql`
    INSERT INTO connected_tiktok_accounts (
      account_id, tiktok_open_id, tiktok_union_id, display_name, avatar_url,
      granted_scopes, follower_count, following_count, likes_count, video_count,
      first_seen_sync_run_id, last_seen_sync_run_id
    )
    VALUES (
      ${accountId}::uuid, ${openId}, ${profile.union_id || null}, ${displayName},
      ${profile.avatar_url || null}, string_to_array(${scopeList}, ','), ${nullableNumber(profile.follower_count)},
      ${nullableNumber(profile.following_count)}, ${nullableNumber(profile.likes_count)},
      ${nullableNumber(profile.video_count)}, ${syncRunId}::uuid, ${syncRunId}::uuid
    )
    ON CONFLICT (tiktok_open_id) DO UPDATE
    SET account_id = EXCLUDED.account_id,
        tiktok_union_id = EXCLUDED.tiktok_union_id,
        display_name = EXCLUDED.display_name,
        avatar_url = EXCLUDED.avatar_url,
        granted_scopes = EXCLUDED.granted_scopes,
        follower_count = EXCLUDED.follower_count,
        following_count = EXCLUDED.following_count,
        likes_count = EXCLUDED.likes_count,
        video_count = EXCLUDED.video_count,
        disconnected_at = NULL,
        last_seen_sync_run_id = EXCLUDED.last_seen_sync_run_id,
        updated_at = CURRENT_TIMESTAMP
    RETURNING id
  `;
  return { accountId, connectedTikTokAccountId: connectedRows[0].id };
}

async function attachAccountToSyncRun(sql, syncRunId, accountId, isInitial) {
  await sql`
    UPDATE sync_runs
    SET account_id = ${accountId}::uuid,
        sync_type = ${isInitial ? "initial_display_api" : "incremental_display_api"},
        profile_records_upserted = 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${syncRunId}::uuid
  `;
}

async function insertAccountMetricSnapshot(sql, profile, syncRunId, accountId, connectedTikTokAccountId) {
  const rows = await sql`
    INSERT INTO account_metric_snapshots (
      account_id, connected_tiktok_account_id, sync_run_id,
      follower_count, following_count, likes_count, video_count
    )
    VALUES (
      ${accountId}::uuid, ${connectedTikTokAccountId}::uuid, ${syncRunId}::uuid,
      ${nullableNumber(profile.follower_count)}, ${nullableNumber(profile.following_count)},
      ${nullableNumber(profile.likes_count)}, ${nullableNumber(profile.video_count)}
    )
    ON CONFLICT (sync_run_id, account_id) DO NOTHING
    RETURNING id
  `;
  return rows.length > 0;
}

async function upsertVideo(sql, video, syncRunId, accountId) {
  const normalized = normalizeTikTokVideoForDatabase(video, syncRunId, accountId);
  const existingRows = await sql`
    SELECT id
    FROM videos
    WHERE platform = 'tiktok' AND tiktok_video_id = ${normalized.tiktokVideoId}
    LIMIT 1
  `;
  const inserted = existingRows.length === 0;
  const rows = await sql`
    INSERT INTO videos (
      account_id, platform, tiktok_video_id, video_url, embed_link, cover_image_url,
      title, caption, duration_seconds, published_at,
      first_seen_sync_run_id, last_seen_sync_run_id
    )
    VALUES (
      ${accountId}::uuid, 'tiktok', ${normalized.tiktokVideoId}, ${normalized.videoUrl},
      ${normalized.embedLink}, ${normalized.coverImageUrl}, ${normalized.title},
      ${normalized.caption}, ${normalized.durationSeconds}, ${normalized.publishedAt}::timestamptz,
      ${syncRunId}::uuid, ${syncRunId}::uuid
    )
    ON CONFLICT (platform, tiktok_video_id) DO UPDATE
    SET account_id = EXCLUDED.account_id,
        video_url = EXCLUDED.video_url,
        embed_link = EXCLUDED.embed_link,
        cover_image_url = EXCLUDED.cover_image_url,
        title = EXCLUDED.title,
        caption = EXCLUDED.caption,
        duration_seconds = EXCLUDED.duration_seconds,
        published_at = EXCLUDED.published_at,
        last_seen_sync_run_id = EXCLUDED.last_seen_sync_run_id,
        last_seen_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    RETURNING id
  `;
  return { videoId: rows[0].id, inserted, metrics: normalized.metrics };
}

async function insertVideoMetricSnapshot(sql, videoId, syncRunId, metrics) {
  const rows = await sql`
    INSERT INTO video_metric_snapshots (
      video_id, sync_run_id, view_count, like_count, comment_count, share_count,
      save_count, average_watch_time_seconds, completion_rate, followers_gained
    )
    VALUES (
      ${videoId}::uuid, ${syncRunId}::uuid, ${metrics.viewCount}, ${metrics.likeCount},
      ${metrics.commentCount}, ${metrics.shareCount}, ${metrics.saveCount},
      ${metrics.averageWatchTimeSeconds}, ${metrics.completionRate}, ${metrics.followersGained}
    )
    ON CONFLICT (sync_run_id, video_id) DO NOTHING
    RETURNING id
  `;
  return rows.length > 0;
}

async function recordSyncError(sql, syncRunId, details = {}) {
  const code = String(details.code || "sync_record_failed").replace(/[^a-z0-9_]/gi, "_").slice(0, 80);
  await sql`
    INSERT INTO sync_run_errors (
      sync_run_id, account_id, stage, record_type, external_id, safe_error_code
    )
    VALUES (
      ${syncRunId}::uuid, ${details.accountId || null}::uuid, ${details.stage || "sync"},
      ${details.recordType || null}, ${details.externalId || null}, ${code}
    )
  `;
}

async function finishSyncRun(sql, syncRunId, result = {}) {
  await sql`
    UPDATE sync_runs
    SET status = ${result.status || "succeeded"},
        finished_at = CURRENT_TIMESTAMP,
        videos_inserted = ${result.videosInserted || 0},
        videos_updated = ${result.videosUpdated || 0},
        videos_skipped_before_cutoff = ${result.videosSkippedBeforeCutoff || 0},
        account_metric_snapshots_created = ${result.accountMetricSnapshotsCreated || 0},
        video_metric_snapshots_created = ${result.videoMetricSnapshotsCreated || 0},
        error_count = ${result.errorCount || 0},
        safe_error_code = ${result.safeErrorCode || null},
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${syncRunId}::uuid
  `;
}

module.exports = {
  normalizeTikTokVideoForDatabase,
  nullableNumber,
  rollbackFirstImport,
  createSyncRun,
  findConnectedAccount,
  upsertTikTokAccount,
  attachAccountToSyncRun,
  insertAccountMetricSnapshot,
  upsertVideo,
  insertVideoMetricSnapshot,
  recordSyncError,
  finishSyncRun
};
