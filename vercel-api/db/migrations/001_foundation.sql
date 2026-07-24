-- NorthStar database foundation for Neon Postgres.
-- This migration creates schema only. It intentionally inserts no creator,
-- sandbox, mock, demo, local-browser, TikTok, or revenue records.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE application_environment (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  environment text NOT NULL CHECK (environment IN ('production', 'sandbox', 'development')),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE creator_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL DEFAULT 'tiktok' CHECK (platform IN ('tiktok')),
  slug text NOT NULL,
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disconnected', 'archived')),
  first_seen_sync_run_id uuid,
  last_seen_sync_run_id uuid,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT creator_accounts_no_all_accounts CHECK (lower(slug) NOT IN ('all-accounts', 'all_accounts', 'all accounts')),
  CONSTRAINT creator_accounts_slug_unique UNIQUE (platform, slug)
);

CREATE TABLE sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES creator_accounts(id) ON DELETE SET NULL,
  platform text NOT NULL DEFAULT 'tiktok' CHECK (platform IN ('tiktok', 'csv', 'manual')),
  sync_type text NOT NULL CHECK (sync_type IN ('initial_display_api', 'incremental_display_api', 'csv_upload', 'manual_capture', 'rollback')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'succeeded', 'failed', 'partial', 'rolled_back')),
  cutoff_start_at timestamptz NOT NULL DEFAULT TIMESTAMPTZ '2025-10-01 00:00:00+00',
  started_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at timestamptz,
  profile_records_upserted integer NOT NULL DEFAULT 0 CHECK (profile_records_upserted >= 0),
  videos_inserted integer NOT NULL DEFAULT 0 CHECK (videos_inserted >= 0),
  videos_updated integer NOT NULL DEFAULT 0 CHECK (videos_updated >= 0),
  videos_skipped_before_cutoff integer NOT NULL DEFAULT 0 CHECK (videos_skipped_before_cutoff >= 0),
  account_metric_snapshots_created integer NOT NULL DEFAULT 0 CHECK (account_metric_snapshots_created >= 0),
  video_metric_snapshots_created integer NOT NULL DEFAULT 0 CHECK (video_metric_snapshots_created >= 0),
  error_count integer NOT NULL DEFAULT 0 CHECK (error_count >= 0),
  safe_error_code text,
  safe_error_message text,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT sync_runs_cutoff_not_before_live_start CHECK (cutoff_start_at >= TIMESTAMPTZ '2025-10-01 00:00:00+00')
);

ALTER TABLE creator_accounts
  ADD CONSTRAINT creator_accounts_first_seen_sync_run_fk
  FOREIGN KEY (first_seen_sync_run_id) REFERENCES sync_runs(id) ON DELETE SET NULL;

ALTER TABLE creator_accounts
  ADD CONSTRAINT creator_accounts_last_seen_sync_run_fk
  FOREIGN KEY (last_seen_sync_run_id) REFERENCES sync_runs(id) ON DELETE SET NULL;

CREATE TABLE connected_tiktok_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES creator_accounts(id) ON DELETE CASCADE,
  tiktok_open_id text NOT NULL,
  tiktok_union_id text,
  display_name text,
  avatar_url text,
  granted_scopes text[] NOT NULL DEFAULT '{}',
  follower_count bigint CHECK (follower_count IS NULL OR follower_count >= 0),
  following_count bigint CHECK (following_count IS NULL OR following_count >= 0),
  likes_count bigint CHECK (likes_count IS NULL OR likes_count >= 0),
  video_count bigint CHECK (video_count IS NULL OR video_count >= 0),
  connected_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  disconnected_at timestamptz,
  first_seen_sync_run_id uuid REFERENCES sync_runs(id) ON DELETE SET NULL,
  last_seen_sync_run_id uuid REFERENCES sync_runs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT connected_tiktok_accounts_open_id_unique UNIQUE (tiktok_open_id),
  CONSTRAINT connected_tiktok_accounts_account_unique UNIQUE (account_id)
);

CREATE TABLE sync_run_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_run_id uuid NOT NULL REFERENCES sync_runs(id) ON DELETE CASCADE,
  account_id uuid REFERENCES creator_accounts(id) ON DELETE SET NULL,
  stage text NOT NULL,
  record_type text,
  external_id text,
  safe_error_code text NOT NULL,
  safe_error_message text,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES creator_accounts(id) ON DELETE CASCADE,
  platform text NOT NULL DEFAULT 'tiktok' CHECK (platform IN ('tiktok')),
  tiktok_video_id text NOT NULL,
  video_url text,
  embed_link text,
  cover_image_url text,
  title text,
  caption text,
  duration_seconds integer CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  published_at timestamptz NOT NULL,
  is_shop_video boolean,
  first_seen_sync_run_id uuid NOT NULL REFERENCES sync_runs(id) ON DELETE RESTRICT,
  last_seen_sync_run_id uuid NOT NULL REFERENCES sync_runs(id) ON DELETE RESTRICT,
  first_seen_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT videos_tiktok_video_unique UNIQUE (platform, tiktok_video_id),
  CONSTRAINT videos_published_after_live_cutoff CHECK (published_at >= TIMESTAMPTZ '2025-10-01 00:00:00+00')
);

CREATE TABLE account_metric_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES creator_accounts(id) ON DELETE CASCADE,
  connected_tiktok_account_id uuid REFERENCES connected_tiktok_accounts(id) ON DELETE SET NULL,
  sync_run_id uuid NOT NULL REFERENCES sync_runs(id) ON DELETE CASCADE,
  snapshot_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  follower_count bigint CHECK (follower_count IS NULL OR follower_count >= 0),
  following_count bigint CHECK (following_count IS NULL OR following_count >= 0),
  likes_count bigint CHECK (likes_count IS NULL OR likes_count >= 0),
  video_count bigint CHECK (video_count IS NULL OR video_count >= 0),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT account_metric_snapshots_once_per_sync UNIQUE (sync_run_id, account_id)
);

CREATE TABLE video_metric_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  sync_run_id uuid NOT NULL REFERENCES sync_runs(id) ON DELETE CASCADE,
  snapshot_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  view_count bigint CHECK (view_count IS NULL OR view_count >= 0),
  like_count bigint CHECK (like_count IS NULL OR like_count >= 0),
  comment_count bigint CHECK (comment_count IS NULL OR comment_count >= 0),
  share_count bigint CHECK (share_count IS NULL OR share_count >= 0),
  save_count bigint CHECK (save_count IS NULL OR save_count >= 0),
  average_watch_time_seconds numeric(12, 3) CHECK (average_watch_time_seconds IS NULL OR average_watch_time_seconds >= 0),
  completion_rate numeric(7, 4) CHECK (completion_rate IS NULL OR completion_rate >= 0),
  followers_gained bigint CHECK (followers_gained IS NULL OR followers_gained >= 0),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT video_metric_snapshots_once_per_sync UNIQUE (sync_run_id, video_id)
);

CREATE TABLE revenue_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  display_name text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('tiktok_shop', 'creator_rewards', 'tiktok_go', 'csv', 'manual', 'other')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX sync_runs_account_started_idx ON sync_runs (account_id, started_at DESC);
CREATE INDEX sync_run_errors_sync_run_idx ON sync_run_errors (sync_run_id, created_at DESC);
CREATE INDEX videos_account_published_idx ON videos (account_id, published_at DESC);
CREATE INDEX videos_first_seen_sync_run_idx ON videos (first_seen_sync_run_id);
CREATE INDEX account_metric_snapshots_account_snapshot_idx ON account_metric_snapshots (account_id, snapshot_at DESC);
CREATE INDEX video_metric_snapshots_video_snapshot_idx ON video_metric_snapshots (video_id, snapshot_at DESC);

CREATE OR REPLACE FUNCTION rollback_first_import(p_sync_run_id uuid)
RETURNS TABLE (
  video_metric_snapshots_deleted integer,
  account_metric_snapshots_deleted integer,
  videos_deleted integer,
  connected_accounts_deleted integer,
  creator_accounts_deleted integer
)
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_video_snapshots integer := 0;
  deleted_account_snapshots integer := 0;
  deleted_videos integer := 0;
  deleted_connected_accounts integer := 0;
  deleted_creator_accounts integer := 0;
BEGIN
  DELETE FROM video_metric_snapshots WHERE sync_run_id = p_sync_run_id;
  GET DIAGNOSTICS deleted_video_snapshots = ROW_COUNT;

  DELETE FROM account_metric_snapshots WHERE sync_run_id = p_sync_run_id;
  GET DIAGNOSTICS deleted_account_snapshots = ROW_COUNT;

  DELETE FROM videos
  WHERE first_seen_sync_run_id = p_sync_run_id
    AND last_seen_sync_run_id = p_sync_run_id;
  GET DIAGNOSTICS deleted_videos = ROW_COUNT;

  DELETE FROM connected_tiktok_accounts
  WHERE first_seen_sync_run_id = p_sync_run_id
    AND last_seen_sync_run_id = p_sync_run_id;
  GET DIAGNOSTICS deleted_connected_accounts = ROW_COUNT;

  DELETE FROM creator_accounts ca
  WHERE ca.first_seen_sync_run_id = p_sync_run_id
    AND ca.last_seen_sync_run_id = p_sync_run_id
    AND NOT EXISTS (SELECT 1 FROM videos v WHERE v.account_id = ca.id)
    AND NOT EXISTS (SELECT 1 FROM connected_tiktok_accounts cta WHERE cta.account_id = ca.id)
    AND NOT EXISTS (SELECT 1 FROM account_metric_snapshots ams WHERE ams.account_id = ca.id);
  GET DIAGNOSTICS deleted_creator_accounts = ROW_COUNT;

  UPDATE sync_runs
  SET status = 'rolled_back',
      finished_at = COALESCE(finished_at, CURRENT_TIMESTAMP),
      updated_at = CURRENT_TIMESTAMP
  WHERE id = p_sync_run_id;

  RETURN QUERY SELECT
    deleted_video_snapshots,
    deleted_account_snapshots,
    deleted_videos,
    deleted_connected_accounts,
    deleted_creator_accounts;
END;
$$;
