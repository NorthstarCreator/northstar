-- NorthStar controlled first-import review gate.
-- This migration creates metadata and review functions only. It inserts no
-- creator, TikTok, sandbox, mock, demo, or browser-local records.

CREATE TABLE first_import_controls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tiktok_open_id text NOT NULL UNIQUE,
  account_id uuid REFERENCES creator_accounts(id) ON DELETE SET NULL,
  sync_run_id uuid NOT NULL UNIQUE REFERENCES sync_runs(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'approved', 'rolled_back')),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX first_import_controls_account_idx ON first_import_controls (account_id);

CREATE OR REPLACE FUNCTION approve_first_import(p_sync_run_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  resulting_status text;
BEGIN
  UPDATE first_import_controls fic
  SET status = 'approved',
      reviewed_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
  FROM sync_runs sr
  WHERE fic.sync_run_id = p_sync_run_id
    AND fic.status = 'pending_review'
    AND sr.id = fic.sync_run_id
    AND sr.status IN ('succeeded', 'partial')
  RETURNING fic.status INTO resulting_status;

  IF resulting_status IS NULL THEN
    RAISE EXCEPTION 'first_import_not_pending_or_reviewable';
  END IF;

  RETURN resulting_status;
END;
$$;

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
  IF NOT EXISTS (
    SELECT 1 FROM first_import_controls
    WHERE sync_run_id = p_sync_run_id AND status = 'pending_review'
  ) THEN
    RAISE EXCEPTION 'first_import_not_pending';
  END IF;

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

  UPDATE first_import_controls
  SET status = 'rolled_back',
      reviewed_at = CURRENT_TIMESTAMP,
      account_id = NULL,
      updated_at = CURRENT_TIMESTAMP
  WHERE sync_run_id = p_sync_run_id;

  RETURN QUERY SELECT
    deleted_video_snapshots,
    deleted_account_snapshots,
    deleted_videos,
    deleted_connected_accounts,
    deleted_creator_accounts;
END;
$$;
