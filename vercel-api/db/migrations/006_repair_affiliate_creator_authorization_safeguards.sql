-- NorthStar Affiliate Creator authorization safeguard compatibility validation.
--
-- Migration 005's three overlength authored identifiers are stored by
-- PostgreSQL at their 63-byte physical names. This migration performs no
-- repair DDL: it fails closed unless the already-created safeguards are
-- present, validated/enabled, and structurally exact.

BEGIN;

DO $validation$
DECLARE
  timestamp_definition text;
  state_definition text;
BEGIN
  IF pg_catalog.to_regclass('public.affiliate_creator_connections') IS NULL THEN
    RAISE EXCEPTION 'migration_005_authorization_schema_required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure_row
    WHERE procedure_row.oid =
        'public.validate_affiliate_creator_authorization_transition()'::pg_catalog.regprocedure
      AND procedure_row.prokind = 'f'
      AND procedure_row.pronargs = 0
      AND procedure_row.prorettype = 'pg_catalog.trigger'::pg_catalog.regtype
  ) THEN
    RAISE EXCEPTION 'migration_005_authorization_transition_function_required';
  END IF;

  SELECT regexp_replace(
    lower(pg_catalog.pg_get_constraintdef(constraint_row.oid, true)),
    '([[:space:]()]|::text)',
    '',
    'g'
  ) INTO timestamp_definition
  FROM pg_catalog.pg_constraint AS constraint_row
  WHERE constraint_row.conrelid =
        'public.affiliate_creator_connections'::pg_catalog.regclass
    AND constraint_row.contype = 'c'
    AND constraint_row.conname =
        'affiliate_creator_connections_authorization_timestamp_order_che'
    AND constraint_row.convalidated;

  IF (SELECT count(*)
      FROM pg_catalog.pg_constraint AS constraint_row
      WHERE constraint_row.conname =
          'affiliate_creator_connections_authorization_timestamp_order_che') <> 1
    OR timestamp_definition IS DISTINCT FROM
      $timestamp_expected$checkauthorization_started_atisnullorcallback_received_atisnullorauthorization_started_at<=callback_received_atandcallback_received_atisnullortoken_validated_atisnullorcallback_received_at<=token_validated_atandtoken_validated_atisnullorlast_refresh_attempted_atisnullortoken_validated_at<=last_refresh_attempted_atandlast_refresh_attempted_atisnullorlast_refresh_succeeded_atisnullorlast_refresh_attempted_at<=last_refresh_succeeded_atandauthorization_started_atisnullorreauthorization_required_atisnullorauthorization_started_at<=reauthorization_required_atandauthorization_started_atisnullorauthorized_atisnullorauthorization_started_at<=authorized_atandauthorization_started_atisnullorrevoked_atisnullorauthorization_started_at<=revoked_atandlast_refresh_succeeded_atisnullorlast_refresh_attempted_atisnotnull$timestamp_expected$ THEN
    RAISE EXCEPTION 'migration_006_timestamp_order_constraint_not_exact';
  END IF;

  SELECT regexp_replace(
    lower(pg_catalog.pg_get_constraintdef(constraint_row.oid, true)),
    '([[:space:]()]|::text)',
    '',
    'g'
  ) INTO state_definition
  FROM pg_catalog.pg_constraint AS constraint_row
  WHERE constraint_row.conrelid =
        'public.affiliate_creator_connections'::pg_catalog.regclass
    AND constraint_row.contype = 'c'
    AND constraint_row.conname =
        'affiliate_creator_connections_authorization_state_timestamps_ch'
    AND constraint_row.convalidated;

  IF (SELECT count(*)
      FROM pg_catalog.pg_constraint AS constraint_row
      WHERE constraint_row.conname =
          'affiliate_creator_connections_authorization_state_timestamps_ch') <> 1
    OR state_definition IS DISTINCT FROM
      $state_expected$checkauthorization_state<>'authorization_pending'orauthorization_started_atisnotnullandauthorization_state<>'callback_received'orauthorization_started_atisnotnullandcallback_received_atisnotnullandauthorization_state<>allarray['authorized_limited','authorized_ready']orauthorization_started_atisnotnullandcallback_received_atisnotnullandtoken_validated_atisnotnullandauthorized_atisnotnullandauthorization_state<>'refresh_required'orauthorization_started_atisnotnullandcallback_received_atisnotnullandtoken_validated_atisnotnullandauthorized_atisnotnullandlast_refresh_attempted_atisnotnullandauthorization_state<>'reauthorization_required'orreauthorization_required_atisnotnullandauthorization_state<>'deauthorized'orrevoked_atisnotnull$state_expected$ THEN
    RAISE EXCEPTION 'migration_006_state_timestamps_constraint_not_exact';
  END IF;

  IF (SELECT count(*)
      FROM pg_catalog.pg_trigger AS trigger_row
      WHERE trigger_row.tgname =
          'affiliate_creator_connections_authorization_lifecycle_forward_o') <> 1
    OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_trigger AS trigger_row
      JOIN pg_catalog.pg_class AS relation_row ON relation_row.oid = trigger_row.tgrelid
      JOIN pg_catalog.pg_namespace AS namespace_row ON namespace_row.oid = relation_row.relnamespace
      WHERE trigger_row.tgname =
          'affiliate_creator_connections_authorization_lifecycle_forward_o'
        AND relation_row.oid =
          'public.affiliate_creator_connections'::pg_catalog.regclass
        AND namespace_row.nspname = 'public'
        AND NOT trigger_row.tgisinternal
        AND trigger_row.tgenabled IN ('O', 'A', 'R')
        AND trigger_row.tgtype = 19
        AND trigger_row.tgfoid =
          'public.validate_affiliate_creator_authorization_transition()'::pg_catalog.regprocedure
        AND trigger_row.tgargs = ''::bytea
    ) THEN
    RAISE EXCEPTION 'migration_006_lifecycle_trigger_not_exact';
  END IF;
END;
$validation$;

COMMIT;
