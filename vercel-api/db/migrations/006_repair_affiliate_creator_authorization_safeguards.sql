-- NorthStar Affiliate Creator authorization safeguard forward repair.
--
-- Prerequisite: the exact Migration 005 authorization-credential schema, with
-- no Affiliate Creator control-plane rows. This repair is intentionally
-- non-idempotent: it fails closed unless precisely the two named constraints
-- and one lifecycle trigger are absent and every prerequisite remains intact.

BEGIN;

DO $repair$
BEGIN
  IF pg_catalog.to_regclass('public.creator_accounts') IS NULL
    OR pg_catalog.to_regclass('public.source_import_policies') IS NULL
    OR pg_catalog.to_regclass('public.affiliate_creator_connections') IS NULL
    OR pg_catalog.to_regclass('public.affiliate_creator_import_runs') IS NULL
    OR pg_catalog.to_regclass('public.affiliate_creator_import_pages') IS NULL
    OR pg_catalog.to_regclass('public.affiliate_creator_import_run_events') IS NULL
    OR pg_catalog.to_regclass('public.affiliate_creator_account_erasure_authorizations') IS NULL
    OR pg_catalog.to_regclass('public.affiliate_creator_account_erasure_receipts') IS NULL
    OR pg_catalog.to_regclass('public.affiliate_creator_connection_credentials') IS NULL
    OR pg_catalog.to_regclass('public.affiliate_creator_authorization_events') IS NULL THEN
    RAISE EXCEPTION 'migration_005_authorization_schema_required';
  END IF;

  IF (SELECT count(*)
      FROM pg_catalog.pg_attribute attribute
      WHERE attribute.attrelid = 'public.affiliate_creator_connections'::pg_catalog.regclass
        AND attribute.attname = ANY (ARRAY[
          'authorization_state', 'authorization_revision', 'credential_revision',
          'authorization_started_at', 'callback_received_at', 'token_validated_at',
          'last_refresh_attempted_at', 'last_refresh_succeeded_at',
          'reauthorization_required_at', 'authorized_at', 'revoked_at'
        ]::text[])
        AND attribute.attnum > 0
        AND NOT attribute.attisdropped) <> 11 THEN
    RAISE EXCEPTION 'migration_005_authorization_columns_required';
  END IF;

  IF (SELECT count(*)
      FROM pg_catalog.pg_constraint constraint
      WHERE constraint.conrelid = 'public.affiliate_creator_connections'::pg_catalog.regclass
        AND constraint.contype = 'c'
        AND constraint.convalidated
        AND constraint.conname = ANY (ARRAY[
          'affiliate_creator_connections_authorization_state_check',
          'affiliate_creator_connections_authorization_revision_check',
          'affiliate_creator_connections_credential_revision_check',
          'affiliate_creator_connections_authorized_facts_check',
          'affiliate_creator_connections_callback_time_check',
          'affiliate_creator_connections_deauthorized_time_check'
        ]::text[])) <> 6 THEN
    RAISE EXCEPTION 'migration_005_existing_authorization_constraints_required';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint constraint
    WHERE constraint.conrelid = 'public.affiliate_creator_connections'::pg_catalog.regclass
      AND constraint.conname = ANY (ARRAY[
        'affiliate_creator_connections_authorization_timestamp_order_check',
        'affiliate_creator_connections_authorization_state_timestamps_check'
      ]::text[])
  ) THEN
    RAISE EXCEPTION 'migration_006_target_constraints_already_present';
  END IF;

  IF (SELECT count(*)
      FROM pg_catalog.pg_trigger trigger
      JOIN pg_catalog.pg_class relation ON relation.oid = trigger.tgrelid
      JOIN pg_catalog.pg_namespace namespace ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname = 'public'
        AND NOT trigger.tgisinternal
        AND trigger.tgenabled IN ('O', 'A', 'R')
        AND trigger.tgname = ANY (ARRAY[
          'affiliate_creator_import_runs_policy_match',
          'affiliate_creator_import_runs_identity_immutable',
          'affiliate_creator_import_runs_lifecycle_forward_only',
          'affiliate_creator_import_pages_lifecycle_forward_only',
          'affiliate_creator_import_run_events_append_only',
          'affiliate_creator_account_erasure_receipts_append_only',
          'affiliate_creator_connection_credentials_identity_immutable',
          'affiliate_creator_connections_credential_coherence',
          'affiliate_creator_connection_credentials_coherence',
          'affiliate_creator_authorization_events_sequence_enforced',
          'affiliate_creator_authorization_events_append_only'
        ]::text[])) <> 11 THEN
    RAISE EXCEPTION 'migration_005_existing_authorization_triggers_required';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger trigger
    WHERE trigger.tgrelid = 'public.affiliate_creator_connections'::pg_catalog.regclass
      AND NOT trigger.tgisinternal
      AND trigger.tgname = 'affiliate_creator_connections_authorization_lifecycle_forward_only'
  ) THEN
    RAISE EXCEPTION 'migration_006_target_trigger_already_present';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc procedure
    WHERE procedure.oid = 'public.validate_affiliate_creator_authorization_transition()'::pg_catalog.regprocedure
      AND procedure.prokind = 'f'
      AND procedure.pronargs = 0
      AND procedure.prorettype = 'pg_catalog.trigger'::pg_catalog.regtype
  ) THEN
    RAISE EXCEPTION 'migration_005_authorization_transition_function_required';
  END IF;

  IF (SELECT count(*)
      FROM pg_catalog.pg_proc procedure
      WHERE procedure.oid = ANY (ARRAY[
        'public.validate_affiliate_creator_import_run_policy()'::pg_catalog.regprocedure,
        'public.prevent_affiliate_creator_import_identity_update()'::pg_catalog.regprocedure,
        'public.validate_affiliate_creator_import_run_transition()'::pg_catalog.regprocedure,
        'public.validate_affiliate_creator_import_page_transition()'::pg_catalog.regprocedure,
        'public.prevent_affiliate_creator_import_event_change()'::pg_catalog.regprocedure,
        'public.prevent_affiliate_creator_erasure_receipt_change()'::pg_catalog.regprocedure,
        'public.validate_affiliate_creator_authorization_transition()'::pg_catalog.regprocedure,
        'public.validate_affiliate_creator_credential_mutation()'::pg_catalog.regprocedure,
        'public.validate_affiliate_creator_connection_credential_coherence()'::pg_catalog.regprocedure,
        'public.prepare_affiliate_creator_authorization_event()'::pg_catalog.regprocedure,
        'public.prevent_affiliate_creator_authorization_event_change()'::pg_catalog.regprocedure,
        'public.erase_affiliate_creator_control_data(uuid,text,text)'::pg_catalog.regprocedure
      ])) <> 12 THEN
    RAISE EXCEPTION 'migration_005_authorization_functions_required';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc procedure
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(procedure.proacl, pg_catalog.acldefault('f', procedure.proowner))
    ) privilege
    WHERE procedure.oid = 'public.erase_affiliate_creator_control_data(uuid,text,text)'::pg_catalog.regprocedure
      AND privilege.grantee = 0
      AND privilege.privilege_type = 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'migration_004_erasure_function_public_execution_present';
  END IF;

  IF EXISTS (SELECT 1 FROM public.source_import_policies)
    OR EXISTS (SELECT 1 FROM public.affiliate_creator_connections)
    OR EXISTS (SELECT 1 FROM public.affiliate_creator_import_runs)
    OR EXISTS (SELECT 1 FROM public.affiliate_creator_import_pages)
    OR EXISTS (SELECT 1 FROM public.affiliate_creator_import_run_events)
    OR EXISTS (SELECT 1 FROM public.affiliate_creator_connection_credentials)
    OR EXISTS (SELECT 1 FROM public.affiliate_creator_authorization_events)
    OR EXISTS (SELECT 1 FROM public.affiliate_creator_account_erasure_authorizations)
    OR EXISTS (SELECT 1 FROM public.affiliate_creator_account_erasure_receipts) THEN
    RAISE EXCEPTION 'migration_006_nonempty_affiliate_creator_state_requires_review';
  END IF;
END;
$repair$;

ALTER TABLE public.affiliate_creator_connections
  ADD CONSTRAINT affiliate_creator_connections_authorization_timestamp_order_check CHECK (
    (authorization_started_at IS NULL OR callback_received_at IS NULL
      OR authorization_started_at <= callback_received_at)
    AND (callback_received_at IS NULL OR token_validated_at IS NULL
      OR callback_received_at <= token_validated_at)
    AND (token_validated_at IS NULL OR last_refresh_attempted_at IS NULL
      OR token_validated_at <= last_refresh_attempted_at)
    AND (last_refresh_attempted_at IS NULL OR last_refresh_succeeded_at IS NULL
      OR last_refresh_attempted_at <= last_refresh_succeeded_at)
    AND (authorization_started_at IS NULL OR reauthorization_required_at IS NULL
      OR authorization_started_at <= reauthorization_required_at)
    AND (authorization_started_at IS NULL OR authorized_at IS NULL
      OR authorization_started_at <= authorized_at)
    AND (authorization_started_at IS NULL OR revoked_at IS NULL
      OR authorization_started_at <= revoked_at)
    AND (last_refresh_succeeded_at IS NULL OR last_refresh_attempted_at IS NOT NULL)
  ),
  ADD CONSTRAINT affiliate_creator_connections_authorization_state_timestamps_check CHECK (
    (authorization_state <> 'authorization_pending'
      OR authorization_started_at IS NOT NULL)
    AND (authorization_state <> 'callback_received'
      OR (authorization_started_at IS NOT NULL AND callback_received_at IS NOT NULL))
    AND (authorization_state NOT IN ('authorized_limited', 'authorized_ready')
      OR (
        authorization_started_at IS NOT NULL
        AND callback_received_at IS NOT NULL
        AND token_validated_at IS NOT NULL
        AND authorized_at IS NOT NULL
      ))
    AND (authorization_state <> 'refresh_required'
      OR (
        authorization_started_at IS NOT NULL
        AND callback_received_at IS NOT NULL
        AND token_validated_at IS NOT NULL
        AND authorized_at IS NOT NULL
        AND last_refresh_attempted_at IS NOT NULL
      ))
    AND (authorization_state <> 'reauthorization_required'
      OR reauthorization_required_at IS NOT NULL)
    AND (authorization_state <> 'deauthorized'
      OR revoked_at IS NOT NULL)
  );

CREATE TRIGGER affiliate_creator_connections_authorization_lifecycle_forward_only
BEFORE UPDATE ON public.affiliate_creator_connections
FOR EACH ROW
EXECUTE FUNCTION public.validate_affiliate_creator_authorization_transition();

DO $verification$
BEGIN
  IF (SELECT count(*)
      FROM pg_catalog.pg_constraint constraint
      WHERE constraint.conrelid = 'public.affiliate_creator_connections'::pg_catalog.regclass
        AND constraint.contype = 'c'
        AND constraint.convalidated
        AND constraint.conname = ANY (ARRAY[
          'affiliate_creator_connections_authorization_timestamp_order_check',
          'affiliate_creator_connections_authorization_state_timestamps_check'
        ]::text[])) <> 2 THEN
    RAISE EXCEPTION 'migration_006_repaired_constraints_not_validated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger trigger
    WHERE trigger.tgrelid = 'public.affiliate_creator_connections'::pg_catalog.regclass
      AND NOT trigger.tgisinternal
      AND trigger.tgname = 'affiliate_creator_connections_authorization_lifecycle_forward_only'
      AND trigger.tgenabled IN ('O', 'A', 'R')
      AND trigger.tgfoid = 'public.validate_affiliate_creator_authorization_transition()'::pg_catalog.regprocedure
  ) THEN
    RAISE EXCEPTION 'migration_006_repaired_trigger_not_enabled';
  END IF;
END;
$verification$;

COMMIT;
