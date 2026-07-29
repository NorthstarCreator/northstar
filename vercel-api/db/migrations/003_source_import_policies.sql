-- NorthStar account- and source-scoped historical import policy foundation.
-- This migration creates policy metadata only. It inserts no creator, source,
-- TikTok, revenue, report, sandbox, mock, demo, or browser-local records.

CREATE TABLE source_import_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES creator_accounts(id) ON DELETE CASCADE,
  source_code text NOT NULL CHECK (source_code IN (
    'tiktok_display_api',
    'tiktok_shop',
    'creator_rewards',
    'tiktok_go'
  )),
  import_range_mode text NOT NULL CHECK (import_range_mode IN (
    'all_available',
    'specific_date',
    'authorization_forward'
  )),
  requested_start_at timestamptz,
  effective_start_at timestamptz,
  provider_earliest_available_at timestamptz,
  provider_latest_available_at timestamptz,
  reporting_timezone text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',
    'pending_approval',
    'approved',
    'active',
    'blocked',
    'archived'
  )),
  selected_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_at timestamptz,
  first_import_status text NOT NULL DEFAULT 'not_started' CHECK (first_import_status IN (
    'not_started',
    'pending_review',
    'approved',
    'rolled_back',
    'blocked'
  )),
  first_import_completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT source_import_policies_account_source_unique UNIQUE (account_id, source_code),
  CONSTRAINT source_import_policies_specific_date_required CHECK (
    import_range_mode <> 'specific_date' OR requested_start_at IS NOT NULL
  ),
  CONSTRAINT source_import_policies_provider_range_valid CHECK (
    provider_earliest_available_at IS NULL
    OR provider_latest_available_at IS NULL
    OR provider_earliest_available_at <= provider_latest_available_at
  ),
  CONSTRAINT source_import_policies_effective_range_valid CHECK (
    effective_start_at IS NULL
    OR provider_latest_available_at IS NULL
    OR effective_start_at <= provider_latest_available_at
  ),
  CONSTRAINT source_import_policies_approval_time_required CHECK (
    status NOT IN ('approved', 'active') OR approved_at IS NOT NULL
  ),
  CONSTRAINT source_import_policies_completion_time_required CHECK (
    first_import_status <> 'approved' OR first_import_completed_at IS NOT NULL
  )
);

CREATE INDEX source_import_policies_account_idx
  ON source_import_policies (account_id, source_code);

CREATE INDEX source_import_policies_status_idx
  ON source_import_policies (source_code, status);
