-- NorthStar TikTok Shop Affiliate Creator authorization-credential foundation.
--
-- Prerequisite: 004_affiliate_creator_import_control.sql.
-- This local, unexecuted migration is schema-only. It creates no connection,
-- authorization, token, credential, import, provider request, or grant.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.affiliate_creator_connections') IS NULL
    OR to_regclass('public.affiliate_creator_account_erasure_authorizations') IS NULL
    OR to_regclass('public.affiliate_creator_account_erasure_receipts') IS NULL THEN
    RAISE EXCEPTION 'migration_004_affiliate_creator_control_required';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.creator_accounts
    WHERE lower(btrim(slug)) IN (
      'all', 'all-accounts', 'all_accounts', 'all accounts', 'allaccounts'
    )
  ) THEN
    RAISE EXCEPTION 'migration_005_legacy_all_accounts_aliases_present';
  END IF;
  IF EXISTS (SELECT 1 FROM public.affiliate_creator_connections) THEN
    RAISE EXCEPTION 'migration_005_existing_connections_require_review';
  END IF;
  IF to_regclass('public.affiliate_creator_connection_credentials') IS NOT NULL
    OR to_regclass('public.affiliate_creator_authorization_events') IS NOT NULL THEN
    RAISE EXCEPTION 'migration_005_objects_already_present';
  END IF;
END;
$$;

ALTER TABLE public.affiliate_creator_connections
  ADD COLUMN authorization_state text NOT NULL DEFAULT 'not_authorized',
  ADD COLUMN authorization_revision bigint NOT NULL DEFAULT 0,
  ADD COLUMN credential_revision bigint NOT NULL DEFAULT 0,
  ADD COLUMN authorization_started_at timestamptz,
  ADD COLUMN callback_received_at timestamptz,
  ADD COLUMN token_validated_at timestamptz,
  ADD COLUMN last_refresh_attempted_at timestamptz,
  ADD COLUMN last_refreshed_at timestamptz,
  ADD COLUMN reauthorization_required_at timestamptz,
  ADD COLUMN deauthorized_at timestamptz,
  ADD CONSTRAINT affiliate_creator_connections_authorization_state_check CHECK (
    authorization_state IN (
      'not_authorized',
      'authorization_pending',
      'callback_received',
      'authorized_limited',
      'authorized_ready',
      'refresh_required',
      'reauthorization_required',
      'deauthorized'
    )
  ),
  ADD CONSTRAINT affiliate_creator_connections_authorization_revision_check
    CHECK (authorization_revision >= 0),
  ADD CONSTRAINT affiliate_creator_connections_credential_revision_check
    CHECK (credential_revision >= 0),
  ADD CONSTRAINT affiliate_creator_connections_authorized_facts_check CHECK (
    authorization_state NOT IN ('authorized_limited', 'authorized_ready', 'refresh_required')
    OR (
      provider_creator_open_id IS NOT NULL
      AND user_type = 1
      AND authorized_at IS NOT NULL
      AND token_validated_at IS NOT NULL
      AND access_expires_at IS NOT NULL
      AND granted_scopes @> ARRAY['creator.affiliate.info']::text[]
    )
  ),
  ADD CONSTRAINT affiliate_creator_connections_callback_time_check CHECK (
    authorization_state <> 'callback_received' OR callback_received_at IS NOT NULL
  ),
  ADD CONSTRAINT affiliate_creator_connections_deauthorized_time_check CHECK (
    authorization_state <> 'deauthorized' OR deauthorized_at IS NOT NULL
  );

CREATE TABLE public.affiliate_creator_connection_credentials (
  connection_id uuid NOT NULL,
  account_id uuid NOT NULL,
  provider_code text NOT NULL DEFAULT 'tiktok_shop_affiliate_creator'
    CHECK (provider_code = 'tiktok_shop_affiliate_creator'),
  purpose text NOT NULL CHECK (purpose IN ('access', 'refresh')),
  credential_revision bigint NOT NULL CHECK (credential_revision > 0),
  envelope_version smallint NOT NULL CHECK (envelope_version = 1),
  envelope_algorithm text NOT NULL CHECK (envelope_algorithm = 'A256GCM'),
  envelope_key_reference text NOT NULL CHECK (
    envelope_key_reference ~ '^affiliate-creator-(sandbox|production)-v[1-9][0-9]*$'
    AND length(envelope_key_reference) <= 96
  ),
  envelope_aad_version smallint NOT NULL CHECK (envelope_aad_version = 1),
  envelope_initialization_vector text NOT NULL CHECK (
    envelope_initialization_vector ~ '^[A-Za-z0-9_-]{16}$'
  ),
  envelope_ciphertext text NOT NULL CHECK (
    envelope_ciphertext ~ '^[A-Za-z0-9_-]+$'
    AND length(envelope_ciphertext) <= 16384
  ),
  envelope_authentication_tag text NOT NULL CHECK (
    envelope_authentication_tag ~ '^[A-Za-z0-9_-]{22}$'
  ),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (connection_id, purpose),
  CONSTRAINT affiliate_creator_connection_credentials_connection_fk
    FOREIGN KEY (connection_id, account_id, provider_code)
    REFERENCES public.affiliate_creator_connections (id, account_id, provider_code)
    ON DELETE CASCADE
);

CREATE INDEX affiliate_creator_connection_credentials_account_idx
  ON public.affiliate_creator_connection_credentials (account_id, connection_id);

CREATE TABLE public.affiliate_creator_authorization_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL,
  account_id uuid NOT NULL,
  provider_code text NOT NULL DEFAULT 'tiktok_shop_affiliate_creator'
    CHECK (provider_code = 'tiktok_shop_affiliate_creator'),
  authorization_revision bigint NOT NULL CHECK (authorization_revision >= 0),
  event_type text NOT NULL CHECK (event_type IN (
    'authorization_started',
    'callback_accepted',
    'token_validated',
    'token_expiring',
    'token_expired',
    'refresh_succeeded',
    'refresh_failed',
    'scopes_reduced',
    'all_access_removed',
    'authorization_restarted'
  )),
  authorization_state text NOT NULL CHECK (authorization_state IN (
    'not_authorized',
    'authorization_pending',
    'callback_received',
    'authorized_limited',
    'authorized_ready',
    'refresh_required',
    'reauthorization_required',
    'deauthorized'
  )),
  safe_status_code text CHECK (
    safe_status_code IS NULL OR safe_status_code ~ '^[a-z][a-z0-9_]{0,99}$'
  ),
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT affiliate_creator_authorization_events_connection_fk
    FOREIGN KEY (connection_id, account_id, provider_code)
    REFERENCES public.affiliate_creator_connections (id, account_id, provider_code)
    ON DELETE CASCADE,
  CONSTRAINT affiliate_creator_authorization_events_revision_unique
    UNIQUE (connection_id, authorization_revision)
);

CREATE INDEX affiliate_creator_authorization_events_account_time_idx
  ON public.affiliate_creator_authorization_events (account_id, occurred_at);

CREATE OR REPLACE FUNCTION public.validate_affiliate_creator_authorization_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NEW.authorization_state IS DISTINCT FROM OLD.authorization_state
    AND NOT (
      (OLD.authorization_state = 'not_authorized'
        AND NEW.authorization_state = 'authorization_pending')
      OR (OLD.authorization_state = 'authorization_pending'
        AND NEW.authorization_state IN ('callback_received', 'deauthorized'))
      OR (OLD.authorization_state = 'callback_received'
        AND NEW.authorization_state IN ('authorized_limited', 'authorized_ready', 'reauthorization_required', 'deauthorized'))
      OR (OLD.authorization_state = 'authorized_limited'
        AND NEW.authorization_state IN ('authorized_ready', 'refresh_required', 'reauthorization_required', 'deauthorized'))
      OR (OLD.authorization_state = 'authorized_ready'
        AND NEW.authorization_state IN ('refresh_required', 'reauthorization_required', 'deauthorized'))
      OR (OLD.authorization_state = 'refresh_required'
        AND NEW.authorization_state IN ('authorized_limited', 'authorized_ready', 'reauthorization_required', 'deauthorized'))
      OR (OLD.authorization_state = 'reauthorization_required'
        AND NEW.authorization_state IN ('authorization_pending', 'deauthorized'))
      OR (OLD.authorization_state = 'deauthorized'
        AND NEW.authorization_state = 'authorization_pending')
    ) THEN
    RAISE EXCEPTION 'affiliate_creator_authorization_transition_invalid';
  END IF;
  IF NEW.authorization_revision < OLD.authorization_revision
    OR NEW.authorization_revision > OLD.authorization_revision + 1
    OR NEW.credential_revision < OLD.credential_revision
    OR NEW.credential_revision > OLD.credential_revision + 1
    OR (
      NEW.authorization_state IS DISTINCT FROM OLD.authorization_state
      AND NEW.authorization_revision <> OLD.authorization_revision + 1
    )
    OR (
      NEW.credential_revision <> OLD.credential_revision
      AND NEW.authorization_revision <> OLD.authorization_revision + 1
    ) THEN
    RAISE EXCEPTION 'affiliate_creator_authorization_revision_invalid';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER affiliate_creator_connections_authorization_lifecycle_forward_only
BEFORE UPDATE ON public.affiliate_creator_connections
FOR EACH ROW
EXECUTE FUNCTION public.validate_affiliate_creator_authorization_transition();

CREATE OR REPLACE FUNCTION public.prevent_affiliate_creator_authorization_event_change()
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
    ) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'affiliate_creator_authorization_event_immutable';
END;
$$;

CREATE TRIGGER affiliate_creator_authorization_events_append_only
BEFORE UPDATE OR DELETE ON public.affiliate_creator_authorization_events
FOR EACH ROW
EXECUTE FUNCTION public.prevent_affiliate_creator_authorization_event_change();

ALTER TABLE public.affiliate_creator_account_erasure_receipts
  ADD COLUMN authorization_events_deleted bigint NOT NULL DEFAULT 0
    CHECK (authorization_events_deleted >= 0),
  ADD COLUMN credentials_deleted bigint NOT NULL DEFAULT 0
    CHECK (credentials_deleted >= 0);

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
  deleted_authorization_events bigint := 0;
  deleted_credentials bigint := 0;
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

  SELECT account.slug INTO actual_slug
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

  INSERT INTO public.affiliate_creator_account_erasure_authorizations (transaction_id, account_id)
  VALUES (txid_current(), p_account_id);

  DELETE FROM public.affiliate_creator_authorization_events WHERE account_id = p_account_id;
  GET DIAGNOSTICS deleted_authorization_events = ROW_COUNT;
  DELETE FROM public.affiliate_creator_connection_credentials WHERE account_id = p_account_id;
  GET DIAGNOSTICS deleted_credentials = ROW_COUNT;
  DELETE FROM public.affiliate_creator_import_run_events WHERE account_id = p_account_id;
  GET DIAGNOSTICS deleted_run_events = ROW_COUNT;
  DELETE FROM public.affiliate_creator_import_pages WHERE account_id = p_account_id;
  GET DIAGNOSTICS deleted_pages = ROW_COUNT;
  DELETE FROM public.affiliate_creator_import_runs WHERE account_id = p_account_id;
  GET DIAGNOSTICS deleted_runs = ROW_COUNT;
  DELETE FROM public.affiliate_creator_connections WHERE account_id = p_account_id;
  GET DIAGNOSTICS deleted_connections = ROW_COUNT;
  DELETE FROM public.source_import_policies
  WHERE account_id = p_account_id AND source_code = 'tiktok_shop_affiliate_creator';
  GET DIAGNOSTICS deleted_policies = ROW_COUNT;

  DELETE FROM public.affiliate_creator_account_erasure_authorizations
  WHERE transaction_id = txid_current() AND account_id = p_account_id;

  INSERT INTO public.affiliate_creator_account_erasure_receipts (
    id, safe_reason_code, authorization_events_deleted, credentials_deleted,
    run_events_deleted, pages_deleted, runs_deleted, connections_deleted, policies_deleted
  ) VALUES (
    receipt_id, p_safe_reason_code, deleted_authorization_events, deleted_credentials,
    deleted_run_events, deleted_pages, deleted_runs, deleted_connections, deleted_policies
  );

  RETURN QUERY SELECT receipt_id, deleted_run_events, deleted_pages, deleted_runs,
    deleted_connections, deleted_policies;
END;
$$;

REVOKE ALL ON TABLE public.affiliate_creator_connection_credentials FROM PUBLIC;
REVOKE ALL ON TABLE public.affiliate_creator_authorization_events FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_affiliate_creator_authorization_transition() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_affiliate_creator_authorization_event_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.erase_affiliate_creator_control_data(uuid, text, text) FROM PUBLIC;

COMMIT;
