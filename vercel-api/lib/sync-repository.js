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

module.exports = {
  normalizeTikTokVideoForDatabase,
  nullableNumber,
  rollbackFirstImport
};
