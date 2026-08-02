-- NorthStar TikTok Shop Affiliate Creator import-control foundation.
--
-- Prerequisite: 003_source_import_policies.sql.
-- This migration is DDL only. It creates no connections, policies, imports,
-- creator records, provider records, credentials, tokens, codes, cursors,
-- payloads, demo data, or revenue data. It does not enable an integration.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.source_import_policies') IS NULL THEN
    RAISE EXCEPTION 'migration_003_source_import_policies_required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'source_import_policies_source_code_check'
      AND conrelid = 'public.source_import_policies'::regclass
      AND contype = 'c'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'source_import_policies_import_range_mode_check'
      AND conrelid = 'public.source_import_policies'::regclass
      AND contype = 'c'
  ) THEN
    RAISE EXCEPTION 'migration_003_constraints_required';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.creator_accounts
    WHERE lower(btrim(slug)) IN (
      'all',
      'all-accounts',
      'all_accounts',
      'all accounts',
      'allaccounts'
    )
  ) THEN
    RAISE EXCEPTION 'migration_004_legacy_all_accounts_aliases_present';
  END IF;
END;
$$;

ALTER TABLE public.creator_accounts
  ADD CONSTRAINT creator_accounts_no_affiliate_calculated_aliases CHECK (
    lower(btrim(slug)) NOT IN (
      'all',
      'all-accounts',
      'all_accounts',
      'all accounts',
      'allaccounts'
    )
  );

ALTER TABLE public.source_import_policies
  DROP CONSTRAINT source_import_policies_source_code_check,
  DROP CONSTRAINT source_import_policies_import_range_mode_check;

ALTER TABLE public.source_import_policies
  ADD COLUMN requested_start_date date,
  ADD CONSTRAINT source_import_policies_source_code_check CHECK (source_code IN (
    'tiktok_display_api',
    'tiktok_shop',
    'tiktok_shop_affiliate_creator',
    'creator_rewards',
    'tiktok_go'
  )),
  ADD CONSTRAINT source_import_policies_import_range_mode_check CHECK (import_range_mode IN (
    'all_available',
    'specific_date',
    'start_date',
    'authorization_forward'
  )),
  ADD CONSTRAINT source_import_policies_affiliate_mode_check CHECK (
    source_code <> 'tiktok_shop_affiliate_creator'
    OR import_range_mode IN ('start_date', 'all_available')
  ),
  ADD CONSTRAINT source_import_policies_affiliate_start_date_check CHECK (
    source_code <> 'tiktok_shop_affiliate_creator'
    OR (
      import_range_mode = 'start_date'
      AND requested_start_date IS NOT NULL
      AND requested_start_at IS NULL
      AND effective_start_at IS NOT NULL
    )
    OR (
      import_range_mode = 'all_available'
      AND requested_start_date IS NULL
      AND requested_start_at IS NULL
      AND effective_start_at IS NULL
    )
  ),
  ADD CONSTRAINT source_import_policies_affiliate_timezone_check CHECK (
    source_code <> 'tiktok_shop_affiliate_creator'
    OR (
      length(btrim(reporting_timezone)) BETWEEN 1 AND 100
      AND reporting_timezone = btrim(reporting_timezone)
    )
  ),
  ADD CONSTRAINT source_import_policies_id_account_source_unique
    UNIQUE (id, account_id, source_code);

CREATE TABLE public.affiliate_creator_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.creator_accounts(id) ON DELETE CASCADE,
  provider_code text NOT NULL DEFAULT 'tiktok_shop_affiliate_creator'
    CHECK (provider_code = 'tiktok_shop_affiliate_creator'),
  provider_creator_open_id text,
  user_type smallint CHECK (user_type IS NULL OR user_type = 1),
  state text NOT NULL DEFAULT 'disabled' CHECK (state IN (
    'disabled',
    'pending',
    'authorized',
    'expired',
    'revoked',
    'error'
  )),
  granted_scopes text[] NOT NULL DEFAULT '{}',
  authorized_at timestamptz,
  access_expires_at timestamptz,
  refresh_expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT affiliate_creator_connections_account_provider_unique
    UNIQUE (account_id, provider_code),
  CONSTRAINT affiliate_creator_connections_id_account_provider_unique
    UNIQUE (id, account_id, provider_code),
  CONSTRAINT affiliate_creator_connections_identity_bounded CHECK (
    provider_creator_open_id IS NULL
    OR (
      length(provider_creator_open_id) BETWEEN 1 AND 200
      AND provider_creator_open_id = btrim(provider_creator_open_id)
    )
  ),
  CONSTRAINT affiliate_creator_connections_scopes_allowlisted CHECK (
    granted_scopes <@ ARRAY[
      'creator.affiliate.info',
      'creator.data.live.read.public',
      'creator.affiliate.share_link.read',
      'creator.affiliate_collaboration.read',
      'creator.showcase.read'
    ]::text[]
  ),
  CONSTRAINT affiliate_creator_connections_authorized_identity_required CHECK (
    state <> 'authorized'
    OR (
      provider_creator_open_id IS NOT NULL
      AND user_type = 1
      AND authorized_at IS NOT NULL
    )
  ),
  CONSTRAINT affiliate_creator_connections_expiry_order_check CHECK (
    access_expires_at IS NULL
    OR refresh_expires_at IS NULL
    OR access_expires_at <= refresh_expires_at
  ),
  CONSTRAINT affiliate_creator_connections_revoked_time_required CHECK (
    state <> 'revoked' OR revoked_at IS NOT NULL
  )
);

CREATE UNIQUE INDEX affiliate_creator_connections_provider_identity_unique
  ON public.affiliate_creator_connections (provider_code, provider_creator_open_id)
  WHERE provider_creator_open_id IS NOT NULL;

CREATE INDEX affiliate_creator_connections_account_state_idx
  ON public.affiliate_creator_connections (account_id, state);

CREATE TABLE public.affiliate_creator_import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.creator_accounts(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL,
  policy_id uuid NOT NULL,
  provider_code text NOT NULL DEFAULT 'tiktok_shop_affiliate_creator'
    CHECK (provider_code = 'tiktok_shop_affiliate_creator'),
  operation_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN (
    'planned',
    'blocked',
    'awaiting_approval',
    'ready',
    'running',
    'succeeded',
    'partial',
    'failed',
    'cancelled',
    'rolled_back'
  )),
  is_first_import boolean NOT NULL DEFAULT false,
  first_import_status text NOT NULL DEFAULT 'not_required' CHECK (first_import_status IN (
    'not_required',
    'pending_review',
    'approved',
    'rolled_back',
    'blocked'
  )),
  range_mode text NOT NULL CHECK (range_mode IN ('start_date', 'all_available')),
  requested_start_date date,
  reporting_timezone text NOT NULL,
  window_start_at timestamptz,
  window_end_at timestamptz NOT NULL,
  started_at timestamptz,
  completed_at timestamptz,
  approved_at timestamptz,
  rolled_back_at timestamptz,
  safe_error_code text,
  safe_error_stage text,
  page_count integer NOT NULL DEFAULT 0 CHECK (page_count >= 0),
  received_count bigint NOT NULL DEFAULT 0 CHECK (received_count >= 0),
  mapped_count bigint NOT NULL DEFAULT 0 CHECK (mapped_count >= 0),
  inserted_count bigint NOT NULL DEFAULT 0 CHECK (inserted_count >= 0),
  updated_count bigint NOT NULL DEFAULT 0 CHECK (updated_count >= 0),
  duplicate_count bigint NOT NULL DEFAULT 0 CHECK (duplicate_count >= 0),
  skipped_count bigint NOT NULL DEFAULT 0 CHECK (skipped_count >= 0),
  unknown_field_count bigint NOT NULL DEFAULT 0 CHECK (unknown_field_count >= 0),
  error_count bigint NOT NULL DEFAULT 0 CHECK (error_count >= 0),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT affiliate_creator_import_runs_connection_fk
    FOREIGN KEY (connection_id, account_id, provider_code)
    REFERENCES public.affiliate_creator_connections (id, account_id, provider_code)
    ON DELETE RESTRICT,
  CONSTRAINT affiliate_creator_import_runs_policy_fk
    FOREIGN KEY (policy_id, account_id, provider_code)
    REFERENCES public.source_import_policies (id, account_id, source_code)
    ON DELETE RESTRICT,
  CONSTRAINT affiliate_creator_import_runs_id_account_unique
    UNIQUE (id, account_id),
  CONSTRAINT affiliate_creator_import_runs_idempotency_unique
    UNIQUE (account_id, provider_code, idempotency_key),
  CONSTRAINT affiliate_creator_import_runs_idempotency_format CHECK (
    idempotency_key ~ '^affiliate-import:v1:[0-9a-f]{64}$'
  ),
  CONSTRAINT affiliate_creator_import_runs_timezone_bounded CHECK (
    length(btrim(reporting_timezone)) BETWEEN 1 AND 100
    AND reporting_timezone = btrim(reporting_timezone)
  ),
  CONSTRAINT affiliate_creator_import_runs_range_check CHECK (
    (
      range_mode = 'start_date'
      AND requested_start_date IS NOT NULL
      AND window_start_at IS NOT NULL
      AND window_start_at < window_end_at
    )
    OR (
      range_mode = 'all_available'
      AND requested_start_date IS NULL
      AND window_start_at IS NULL
    )
  ),
  CONSTRAINT affiliate_creator_import_runs_first_import_check CHECK (
    (is_first_import AND first_import_status <> 'not_required')
    OR (NOT is_first_import AND first_import_status = 'not_required')
  ),
  CONSTRAINT affiliate_creator_import_runs_first_import_timestamps_check CHECK (
    (first_import_status <> 'approved' OR approved_at IS NOT NULL)
    AND (first_import_status <> 'rolled_back' OR rolled_back_at IS NOT NULL)
  ),
  CONSTRAINT affiliate_creator_import_runs_first_import_state_check CHECK (
    (first_import_status <> 'approved' OR status IN ('succeeded', 'partial'))
    AND (first_import_status <> 'rolled_back' OR status = 'rolled_back')
    AND (status <> 'rolled_back' OR (is_first_import AND first_import_status = 'rolled_back'))
  ),
  CONSTRAINT affiliate_creator_import_runs_completion_check CHECK (
    status NOT IN ('succeeded', 'partial', 'failed', 'cancelled', 'rolled_back')
    OR completed_at IS NOT NULL
  ),
  CONSTRAINT affiliate_creator_import_runs_reconciliation_check CHECK (
    status NOT IN ('succeeded', 'partial')
    OR (
      received_count = mapped_count + skipped_count
      AND mapped_count = inserted_count + updated_count + duplicate_count
    )
  ),
  CONSTRAINT affiliate_creator_import_runs_safe_error_code CHECK (
    safe_error_code IS NULL OR safe_error_code ~ '^[a-z][a-z0-9_]{0,99}$'
  ),
  CONSTRAINT affiliate_creator_import_runs_safe_error_stage CHECK (
    safe_error_stage IS NULL OR safe_error_stage ~ '^[a-z][a-z0-9_]{0,99}$'
  )
);

CREATE INDEX affiliate_creator_import_runs_account_created_idx
  ON public.affiliate_creator_import_runs (account_id, created_at DESC);

CREATE INDEX affiliate_creator_import_runs_account_status_idx
  ON public.affiliate_creator_import_runs (account_id, status, created_at DESC);

CREATE INDEX affiliate_creator_import_runs_policy_idx
  ON public.affiliate_creator_import_runs (policy_id, created_at DESC);

CREATE TABLE public.affiliate_creator_import_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.creator_accounts(id) ON DELETE CASCADE,
  import_run_id uuid NOT NULL,
  operation text NOT NULL CHECK (operation IN (
    'get_creator_profile',
    'search_creator_affiliate_orders',
    'search_creator_target_collaborations',
    'search_open_collaboration_products',
    'get_open_collaboration_products_by_id',
    'get_sample_application_detail',
    'get_showcase_products',
    'get_live_core_stats',
    'get_live_view_trends'
  )),
  page_number integer NOT NULL CHECK (page_number >= 1),
  status text NOT NULL DEFAULT 'planned' CHECK (status IN (
    'planned',
    'running',
    'completed',
    'failed'
  )),
  provider_request_id_hash text,
  input_page_token_hash text,
  next_page_token_hash text,
  received_count bigint NOT NULL DEFAULT 0 CHECK (received_count >= 0),
  mapped_count bigint NOT NULL DEFAULT 0 CHECK (mapped_count >= 0),
  skipped_count bigint NOT NULL DEFAULT 0 CHECK (skipped_count >= 0),
  unknown_field_count bigint NOT NULL DEFAULT 0 CHECK (unknown_field_count >= 0),
  safe_error_code text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT affiliate_creator_import_pages_run_fk
    FOREIGN KEY (import_run_id, account_id)
    REFERENCES public.affiliate_creator_import_runs (id, account_id)
    ON DELETE CASCADE,
  CONSTRAINT affiliate_creator_import_pages_run_operation_page_unique
    UNIQUE (import_run_id, operation, page_number),
  CONSTRAINT affiliate_creator_import_pages_request_hash CHECK (
    provider_request_id_hash IS NULL OR provider_request_id_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT affiliate_creator_import_pages_input_hash CHECK (
    input_page_token_hash IS NULL OR input_page_token_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT affiliate_creator_import_pages_next_hash CHECK (
    next_page_token_hash IS NULL OR next_page_token_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT affiliate_creator_import_pages_token_progress_check CHECK (
    input_page_token_hash IS NULL
    OR next_page_token_hash IS NULL
    OR input_page_token_hash <> next_page_token_hash
  ),
  CONSTRAINT affiliate_creator_import_pages_reconciliation_check CHECK (
    status <> 'completed' OR received_count = mapped_count + skipped_count
  ),
  CONSTRAINT affiliate_creator_import_pages_completion_check CHECK (
    status NOT IN ('completed', 'failed') OR completed_at IS NOT NULL
  ),
  CONSTRAINT affiliate_creator_import_pages_safe_error_code CHECK (
    safe_error_code IS NULL OR safe_error_code ~ '^[a-z][a-z0-9_]{0,99}$'
  )
);

CREATE UNIQUE INDEX affiliate_creator_import_pages_input_token_unique
  ON public.affiliate_creator_import_pages (import_run_id, operation, input_page_token_hash)
  WHERE input_page_token_hash IS NOT NULL;

CREATE UNIQUE INDEX affiliate_creator_import_pages_next_token_unique
  ON public.affiliate_creator_import_pages (import_run_id, operation, next_page_token_hash)
  WHERE next_page_token_hash IS NOT NULL;

CREATE INDEX affiliate_creator_import_pages_run_status_idx
  ON public.affiliate_creator_import_pages (import_run_id, status, page_number);

CREATE TABLE public.affiliate_creator_import_run_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.creator_accounts(id) ON DELETE CASCADE,
  import_run_id uuid NOT NULL,
  sequence_number integer NOT NULL CHECK (sequence_number >= 1),
  event_type text NOT NULL CHECK (event_type IN (
    'run_planned',
    'run_blocked',
    'approval_requested',
    'run_approved',
    'run_started',
    'page_completed',
    'run_succeeded',
    'run_partially_succeeded',
    'run_failed',
    'run_cancelled',
    'run_rolled_back'
  )),
  actor_type text NOT NULL CHECK (actor_type IN ('system', 'operator', 'provider')),
  safe_status_code text,
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT affiliate_creator_import_run_events_run_fk
    FOREIGN KEY (import_run_id, account_id)
    REFERENCES public.affiliate_creator_import_runs (id, account_id)
    ON DELETE CASCADE,
  CONSTRAINT affiliate_creator_import_run_events_sequence_unique
    UNIQUE (import_run_id, sequence_number),
  CONSTRAINT affiliate_creator_import_run_events_safe_status CHECK (
    safe_status_code IS NULL OR safe_status_code ~ '^[a-z][a-z0-9_]{0,99}$'
  )
);

CREATE INDEX affiliate_creator_import_run_events_run_time_idx
  ON public.affiliate_creator_import_run_events (import_run_id, occurred_at);

CREATE OR REPLACE FUNCTION public.validate_affiliate_creator_import_run_policy()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.source_import_policies policy
    WHERE policy.id = NEW.policy_id
      AND policy.account_id = NEW.account_id
      AND policy.source_code = NEW.provider_code
      AND policy.import_range_mode = NEW.range_mode
      AND policy.requested_start_date IS NOT DISTINCT FROM NEW.requested_start_date
      AND policy.reporting_timezone = NEW.reporting_timezone
      AND policy.effective_start_at IS NOT DISTINCT FROM NEW.window_start_at
      AND policy.status IN ('approved', 'active')
  ) THEN
    RAISE EXCEPTION 'affiliate_creator_import_policy_mismatch';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER affiliate_creator_import_runs_policy_match
BEFORE INSERT OR UPDATE ON public.affiliate_creator_import_runs
FOR EACH ROW
EXECUTE FUNCTION public.validate_affiliate_creator_import_run_policy();

CREATE OR REPLACE FUNCTION public.prevent_affiliate_creator_import_identity_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NEW.id <> OLD.id
    OR NEW.account_id <> OLD.account_id
    OR NEW.connection_id <> OLD.connection_id
    OR NEW.policy_id <> OLD.policy_id
    OR NEW.provider_code <> OLD.provider_code
    OR NEW.operation_id <> OLD.operation_id
    OR NEW.idempotency_key <> OLD.idempotency_key
    OR NEW.range_mode <> OLD.range_mode
    OR NEW.requested_start_date IS DISTINCT FROM OLD.requested_start_date
    OR NEW.reporting_timezone <> OLD.reporting_timezone
    OR NEW.window_start_at IS DISTINCT FROM OLD.window_start_at
    OR NEW.window_end_at <> OLD.window_end_at
    OR NEW.is_first_import <> OLD.is_first_import
  THEN
    RAISE EXCEPTION 'affiliate_creator_import_identity_immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER affiliate_creator_import_runs_identity_immutable
BEFORE UPDATE ON public.affiliate_creator_import_runs
FOR EACH ROW
EXECUTE FUNCTION public.prevent_affiliate_creator_import_identity_update();

CREATE OR REPLACE FUNCTION public.validate_affiliate_creator_import_run_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
    AND NOT (
      (OLD.status = 'planned' AND NEW.status IN (
        'blocked', 'awaiting_approval', 'ready', 'cancelled'
      ))
      OR (OLD.status = 'awaiting_approval' AND NEW.status IN (
        'blocked', 'ready', 'cancelled'
      ))
      OR (OLD.status = 'ready' AND NEW.status IN (
        'blocked', 'running', 'cancelled'
      ))
      OR (OLD.status = 'running' AND NEW.status IN (
        'succeeded', 'partial', 'failed', 'cancelled'
      ))
      OR (OLD.status IN ('succeeded', 'partial') AND NEW.status = 'rolled_back')
    )
  THEN
    RAISE EXCEPTION 'affiliate_creator_import_run_transition_invalid';
  END IF;

  IF NEW.first_import_status IS DISTINCT FROM OLD.first_import_status
    AND NOT (
      (OLD.first_import_status = 'pending_review'
        AND NEW.first_import_status IN ('approved', 'blocked', 'rolled_back'))
      OR (OLD.first_import_status = 'approved'
        AND NEW.first_import_status = 'rolled_back')
    )
  THEN
    RAISE EXCEPTION 'affiliate_creator_first_import_transition_invalid';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER affiliate_creator_import_runs_lifecycle_forward_only
BEFORE UPDATE ON public.affiliate_creator_import_runs
FOR EACH ROW
EXECUTE FUNCTION public.validate_affiliate_creator_import_run_transition();

CREATE OR REPLACE FUNCTION public.validate_affiliate_creator_import_page_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
    AND NOT (
      (OLD.status = 'planned' AND NEW.status IN ('running', 'failed'))
      OR (OLD.status = 'running' AND NEW.status IN ('completed', 'failed'))
    )
  THEN
    RAISE EXCEPTION 'affiliate_creator_import_page_transition_invalid';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER affiliate_creator_import_pages_lifecycle_forward_only
BEFORE UPDATE ON public.affiliate_creator_import_pages
FOR EACH ROW
EXECUTE FUNCTION public.validate_affiliate_creator_import_page_transition();

CREATE TABLE public.affiliate_creator_account_erasure_authorizations (
  transaction_id bigint NOT NULL,
  account_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT affiliate_creator_account_erasure_authorizations_pk
    PRIMARY KEY (transaction_id, account_id)
);

REVOKE ALL ON TABLE public.affiliate_creator_account_erasure_authorizations FROM PUBLIC;

CREATE TABLE public.affiliate_creator_account_erasure_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  safe_reason_code text NOT NULL CHECK (
    safe_reason_code ~ '^[a-z][a-z0-9_]{0,99}$'
  ),
  run_events_deleted bigint NOT NULL CHECK (run_events_deleted >= 0),
  pages_deleted bigint NOT NULL CHECK (pages_deleted >= 0),
  runs_deleted bigint NOT NULL CHECK (runs_deleted >= 0),
  connections_deleted bigint NOT NULL CHECK (connections_deleted >= 0),
  policies_deleted bigint NOT NULL CHECK (policies_deleted >= 0),
  occurred_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE FUNCTION public.prevent_affiliate_creator_import_event_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE'
    AND EXISTS (
      SELECT 1
      FROM public.affiliate_creator_account_erasure_authorizations erasure_gate
      WHERE erasure_gate.transaction_id = txid_current()
        AND erasure_gate.account_id = OLD.account_id
    )
  THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'affiliate_creator_import_event_immutable';
END;
$$;

CREATE TRIGGER affiliate_creator_import_run_events_append_only
BEFORE UPDATE OR DELETE ON public.affiliate_creator_import_run_events
FOR EACH ROW
EXECUTE FUNCTION public.prevent_affiliate_creator_import_event_change();

CREATE OR REPLACE FUNCTION public.prevent_affiliate_creator_erasure_receipt_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'affiliate_creator_erasure_receipt_immutable';
END;
$$;

CREATE TRIGGER affiliate_creator_account_erasure_receipts_append_only
BEFORE UPDATE OR DELETE ON public.affiliate_creator_account_erasure_receipts
FOR EACH ROW
EXECUTE FUNCTION public.prevent_affiliate_creator_erasure_receipt_change();

CREATE OR REPLACE FUNCTION public.erase_affiliate_creator_control_data(
  p_account_id uuid,
  p_expected_slug text,
  p_safe_reason_code text
)
RETURNS TABLE (
  erasure_receipt_id uuid,
  run_events_deleted bigint,
  pages_deleted bigint,
  runs_deleted bigint,
  connections_deleted bigint,
  policies_deleted bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  actual_slug text;
  receipt_id uuid := gen_random_uuid();
  deleted_run_events bigint := 0;
  deleted_pages bigint := 0;
  deleted_runs bigint := 0;
  deleted_connections bigint := 0;
  deleted_policies bigint := 0;
BEGIN
  IF p_account_id IS NULL
    OR p_expected_slug IS NULL
    OR p_expected_slug = ''
    OR p_safe_reason_code IS NULL
    OR p_safe_reason_code !~ '^[a-z][a-z0-9_]{0,99}$'
  THEN
    RAISE EXCEPTION 'affiliate_creator_erasure_request_invalid';
  END IF;

  SELECT account.slug
  INTO actual_slug
  FROM public.creator_accounts account
  WHERE account.id = p_account_id
  FOR UPDATE;

  IF actual_slug IS NULL OR actual_slug <> p_expected_slug THEN
    RAISE EXCEPTION 'affiliate_creator_erasure_account_mismatch';
  END IF;

  IF lower(btrim(actual_slug)) IN (
    'all', 'all-accounts', 'all_accounts', 'all accounts', 'allaccounts'
  ) THEN
    RAISE EXCEPTION 'affiliate_creator_erasure_exact_account_required';
  END IF;

  INSERT INTO public.affiliate_creator_account_erasure_authorizations (
    transaction_id,
    account_id
  ) VALUES (
    txid_current(),
    p_account_id
  );

  DELETE FROM public.affiliate_creator_import_run_events
  WHERE account_id = p_account_id;
  GET DIAGNOSTICS deleted_run_events = ROW_COUNT;

  DELETE FROM public.affiliate_creator_import_pages
  WHERE account_id = p_account_id;
  GET DIAGNOSTICS deleted_pages = ROW_COUNT;

  DELETE FROM public.affiliate_creator_import_runs
  WHERE account_id = p_account_id;
  GET DIAGNOSTICS deleted_runs = ROW_COUNT;

  DELETE FROM public.affiliate_creator_connections
  WHERE account_id = p_account_id;
  GET DIAGNOSTICS deleted_connections = ROW_COUNT;

  DELETE FROM public.source_import_policies
  WHERE account_id = p_account_id
    AND source_code = 'tiktok_shop_affiliate_creator';
  GET DIAGNOSTICS deleted_policies = ROW_COUNT;

  DELETE FROM public.affiliate_creator_account_erasure_authorizations
  WHERE transaction_id = txid_current()
    AND account_id = p_account_id;

  INSERT INTO public.affiliate_creator_account_erasure_receipts (
    id,
    safe_reason_code,
    run_events_deleted,
    pages_deleted,
    runs_deleted,
    connections_deleted,
    policies_deleted
  ) VALUES (
    receipt_id,
    p_safe_reason_code,
    deleted_run_events,
    deleted_pages,
    deleted_runs,
    deleted_connections,
    deleted_policies
  );

  RETURN QUERY SELECT
    receipt_id,
    deleted_run_events,
    deleted_pages,
    deleted_runs,
    deleted_connections,
    deleted_policies;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_affiliate_creator_import_run_policy() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_affiliate_creator_import_identity_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_affiliate_creator_import_run_transition() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_affiliate_creator_import_page_transition() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_affiliate_creator_import_event_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_affiliate_creator_erasure_receipt_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.erase_affiliate_creator_control_data(
  uuid,
  text,
  text
) FROM PUBLIC;

COMMIT;
