async function readPersistedTikTokDashboard(sql, openId) {
  const accountRows = await sql`
    SELECT ca.id, ca.display_name
    FROM connected_tiktok_accounts cta
    JOIN creator_accounts ca ON ca.id = cta.account_id
    WHERE cta.tiktok_open_id = ${openId}
      AND cta.disconnected_at IS NULL
    LIMIT 1
  `;
  const account = accountRows[0] || null;
  if (!account) return { account: null, videos: [], accountMetricSnapshots: [], lastSuccessfulSyncAt: null };

  const videos = await sql`
    SELECT
      v.tiktok_video_id AS id,
      v.title,
      v.caption AS video_description,
      v.duration_seconds AS duration,
      v.cover_image_url,
      v.video_url AS share_url,
      v.embed_link,
      v.published_at,
      metrics.view_count,
      metrics.like_count,
      metrics.comment_count,
      metrics.share_count,
      metrics.save_count,
      metrics.average_watch_time_seconds,
      metrics.completion_rate,
      metrics.followers_gained
    FROM videos v
    LEFT JOIN LATERAL (
      SELECT
        vms.view_count,
        vms.like_count,
        vms.comment_count,
        vms.share_count,
        vms.save_count,
        vms.average_watch_time_seconds,
        vms.completion_rate,
        vms.followers_gained
      FROM video_metric_snapshots vms
      JOIN sync_runs sr ON sr.id = vms.sync_run_id
      WHERE vms.video_id = v.id
        AND sr.status = 'succeeded'
      ORDER BY vms.snapshot_at DESC, vms.created_at DESC
      LIMIT 1
    ) metrics ON true
    WHERE v.account_id = ${account.id}::uuid
      AND v.published_at >= TIMESTAMPTZ '2025-10-01 00:00:00+00'
    ORDER BY v.published_at DESC, v.tiktok_video_id DESC
  `;

  const accountMetricSnapshots = await sql`
    SELECT
      ams.snapshot_at,
      ams.follower_count,
      ams.following_count,
      ams.likes_count,
      ams.video_count,
      sr.status AS sync_status
    FROM account_metric_snapshots ams
    JOIN sync_runs sr ON sr.id = ams.sync_run_id
    WHERE ams.account_id = ${account.id}::uuid
      AND sr.status = 'succeeded'
    ORDER BY ams.snapshot_at ASC, ams.created_at ASC
  `;

  const successfulSyncRows = await sql`
    SELECT sr.finished_at
    FROM sync_runs sr
    WHERE sr.account_id = ${account.id}::uuid
      AND sr.platform = 'tiktok'
      AND sr.sync_type IN ('initial_display_api', 'incremental_display_api')
      AND sr.status = 'succeeded'
      AND sr.finished_at IS NOT NULL
    ORDER BY sr.finished_at DESC
    LIMIT 1
  `;

  return {
    account,
    videos,
    accountMetricSnapshots,
    lastSuccessfulSyncAt: successfulSyncRows[0]?.finished_at || null
  };
}

module.exports = { readPersistedTikTokDashboard };
