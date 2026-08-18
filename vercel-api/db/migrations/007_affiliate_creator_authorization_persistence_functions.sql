-- NorthStar Affiliate Creator authorization persistence writers.
--
-- This local, unexecuted migration creates an intentionally ungranted,
-- SECURITY DEFINER persistence boundary. It has no application grant, route,
-- token exchange, provider request, or runtime wiring.

BEGIN;

DO $migration_guard$
DECLARE
  required_column_count pg_catalog.integer;
  timestamp_definition pg_catalog.text;
  state_definition pg_catalog.text;
BEGIN
  IF pg_catalog.to_regclass('public.affiliate_creator_connections') IS NULL
    OR pg_catalog.to_regclass('public.affiliate_creator_connection_credentials') IS NULL
    OR pg_catalog.to_regclass('public.affiliate_creator_authorization_events') IS NULL
    OR pg_catalog.to_regclass('public.affiliate_creator_account_erasure_authorizations') IS NULL
    OR pg_catalog.to_regclass('public.affiliate_creator_account_erasure_receipts') IS NULL THEN
    RAISE EXCEPTION 'affiliate_creator_persistence_schema_required';
  END IF;

  SELECT pg_catalog.count(*) INTO required_column_count
  FROM pg_catalog.pg_attribute AS attribute_row
  WHERE attribute_row.attrelid = 'public.affiliate_creator_connections'::pg_catalog.regclass
    AND attribute_row.attnum > 0
    AND NOT attribute_row.attisdropped
    AND attribute_row.attname IN (
      'id', 'account_id', 'provider_code', 'provider_creator_open_id', 'user_type',
      'state', 'granted_scopes', 'authorized_at', 'access_expires_at',
      'refresh_expires_at', 'revoked_at', 'authorization_state',
      'authorization_revision', 'credential_revision', 'authorization_started_at',
      'callback_received_at', 'token_validated_at', 'last_refresh_attempted_at',
      'last_refresh_succeeded_at', 'reauthorization_required_at'
    );
  IF required_column_count <> 20 THEN
    RAISE EXCEPTION 'affiliate_creator_persistence_schema_required';
  END IF;

  SELECT pg_catalog.regexp_replace(
    pg_catalog.lower(pg_catalog.pg_get_constraintdef(catalog_constraint.oid, true)),
    '([[:space:]()]|::text)', '', 'g'
  ) INTO timestamp_definition
  FROM pg_catalog.pg_constraint AS catalog_constraint
  WHERE catalog_constraint.conrelid =
        'public.affiliate_creator_connections'::pg_catalog.regclass
    AND catalog_constraint.contype = 'c'
    AND catalog_constraint.convalidated
    AND catalog_constraint.conname =
        'affiliate_creator_connections_authorization_timestamp_order_che';

  SELECT pg_catalog.regexp_replace(
    pg_catalog.lower(pg_catalog.pg_get_constraintdef(catalog_constraint.oid, true)),
    '([[:space:]()]|::text)', '', 'g'
  ) INTO state_definition
  FROM pg_catalog.pg_constraint AS catalog_constraint
  WHERE catalog_constraint.conrelid =
        'public.affiliate_creator_connections'::pg_catalog.regclass
    AND catalog_constraint.contype = 'c'
    AND catalog_constraint.convalidated
    AND catalog_constraint.conname =
        'affiliate_creator_connections_authorization_state_timestamps_ch';

  IF timestamp_definition IS DISTINCT FROM
      $timestamp_expected$checkauthorization_started_atisnullorcallback_received_atisnullorauthorization_started_at<=callback_received_atandcallback_received_atisnullortoken_validated_atisnullorcallback_received_at<=token_validated_atandtoken_validated_atisnullorlast_refresh_attempted_atisnullortoken_validated_at<=last_refresh_attempted_atandlast_refresh_attempted_atisnullorlast_refresh_succeeded_atisnullorlast_refresh_attempted_at<=last_refresh_succeeded_atandauthorization_started_atisnullorreauthorization_required_atisnullorauthorization_started_at<=reauthorization_required_atandauthorization_started_atisnullorauthorized_atisnullorauthorization_started_at<=authorized_atandauthorization_started_atisnullorrevoked_atisnullorauthorization_started_at<=revoked_atandlast_refresh_succeeded_atisnullorlast_refresh_attempted_atisnotnull$timestamp_expected$
    OR state_definition IS DISTINCT FROM
      $state_expected$checkauthorization_state<>'authorization_pending'orauthorization_started_atisnotnullandauthorization_state<>'callback_received'orauthorization_started_atisnotnullandcallback_received_atisnotnullandauthorization_state<>allarray['authorized_limited','authorized_ready']orauthorization_started_atisnotnullandcallback_received_atisnotnullandtoken_validated_atisnotnullandauthorized_atisnotnullandauthorization_state<>'refresh_required'orauthorization_started_atisnotnullandcallback_received_atisnotnullandtoken_validated_atisnotnullandauthorized_atisnotnullandlast_refresh_attempted_atisnotnullandauthorization_state<>'reauthorization_required'orreauthorization_required_atisnotnullandauthorization_state<>'deauthorized'orrevoked_atisnotnull$state_expected$ THEN
    RAISE EXCEPTION 'affiliate_creator_persistence_safeguards_required';
  END IF;

  IF (SELECT pg_catalog.count(*) FROM pg_catalog.pg_constraint AS catalog_constraint
      WHERE catalog_constraint.conrelid = 'public.affiliate_creator_connections'::pg_catalog.regclass
        AND catalog_constraint.contype = 'c'
        AND catalog_constraint.convalidated
        AND catalog_constraint.conname IN (
          'affiliate_creator_connections_authorization_timestamp_order_che',
          'affiliate_creator_connections_authorization_state_timestamps_ch'
        )) <> 2
    OR (SELECT pg_catalog.count(*) FROM pg_catalog.pg_trigger AS trigger_row
        WHERE trigger_row.tgrelid = 'public.affiliate_creator_connections'::pg_catalog.regclass
          AND trigger_row.tgname = 'affiliate_creator_connections_authorization_lifecycle_forward_o'
          AND NOT trigger_row.tgisinternal
          AND trigger_row.tgenabled IN ('O', 'A', 'R')
          AND trigger_row.tgtype = 19
          AND trigger_row.tgfoid =
            'public.validate_affiliate_creator_authorization_transition()'::pg_catalog.regprocedure
          AND trigger_row.tgargs = ''::pg_catalog.bytea) <> 1 THEN
    RAISE EXCEPTION 'affiliate_creator_persistence_safeguards_required';
  END IF;

  IF (SELECT pg_catalog.count(*) FROM pg_catalog.pg_trigger AS trigger_row
      WHERE NOT trigger_row.tgisinternal
        AND trigger_row.tgenabled IN ('O', 'A', 'R')
        AND (trigger_row.tgrelid, trigger_row.tgname) IN (
          ('public.affiliate_creator_connection_credentials'::pg_catalog.regclass,
            'affiliate_creator_connection_credentials_identity_immutable'),
          ('public.affiliate_creator_connections'::pg_catalog.regclass,
            'affiliate_creator_connections_credential_coherence'),
          ('public.affiliate_creator_connection_credentials'::pg_catalog.regclass,
            'affiliate_creator_connection_credentials_coherence'),
          ('public.affiliate_creator_authorization_events'::pg_catalog.regclass,
            'affiliate_creator_authorization_events_sequence_enforced'),
          ('public.affiliate_creator_authorization_events'::pg_catalog.regclass,
            'affiliate_creator_authorization_events_append_only')
        )) <> 5 THEN
    RAISE EXCEPTION 'affiliate_creator_persistence_safeguards_required';
  END IF;

  IF pg_catalog.to_regprocedure('public.validate_affiliate_creator_credential_mutation()') IS NULL
    OR pg_catalog.to_regprocedure('public.validate_affiliate_creator_connection_credential_coherence()') IS NULL
    OR pg_catalog.to_regprocedure('public.prepare_affiliate_creator_authorization_event()') IS NULL
    OR pg_catalog.to_regprocedure('public.prevent_affiliate_creator_authorization_event_change()') IS NULL
    OR pg_catalog.to_regprocedure('public.erase_affiliate_creator_control_data(uuid,text,text)') IS NULL THEN
    RAISE EXCEPTION 'affiliate_creator_persistence_functions_required';
  END IF;

  IF pg_catalog.has_function_privilege('public',
      'public.erase_affiliate_creator_control_data(uuid,text,text)'::pg_catalog.regprocedure,
      'EXECUTE')
    OR pg_catalog.has_function_privilege('public',
      'public.validate_affiliate_creator_authorization_transition()'::pg_catalog.regprocedure,
      'EXECUTE')
    OR pg_catalog.has_function_privilege('public',
      'public.validate_affiliate_creator_credential_mutation()'::pg_catalog.regprocedure,
      'EXECUTE')
    OR pg_catalog.has_function_privilege('public',
      'public.validate_affiliate_creator_connection_credential_coherence()'::pg_catalog.regprocedure,
      'EXECUTE')
    OR pg_catalog.has_function_privilege('public',
      'public.prepare_affiliate_creator_authorization_event()'::pg_catalog.regprocedure,
      'EXECUTE')
    OR pg_catalog.has_function_privilege('public',
      'public.prevent_affiliate_creator_authorization_event_change()'::pg_catalog.regprocedure,
      'EXECUTE') THEN
    RAISE EXCEPTION 'affiliate_creator_persistence_public_privilege_invalid';
  END IF;

  IF EXISTS (SELECT 1 FROM public.affiliate_creator_connections)
    OR EXISTS (SELECT 1 FROM public.affiliate_creator_connection_credentials)
    OR EXISTS (SELECT 1 FROM public.affiliate_creator_authorization_events) THEN
    RAISE EXCEPTION 'affiliate_creator_persistence_empty_baseline_required';
  END IF;
END;
$migration_guard$;

CREATE FUNCTION public.persist_affiliate_creator_authorization(
  p_connection_id pg_catalog.uuid,
  p_account_id pg_catalog.uuid,
  p_expected_authorization_revision pg_catalog.bigint,
  p_expected_credential_revision pg_catalog.bigint,
  p_authorization_state pg_catalog.text,
  p_provider_creator_open_id pg_catalog.text,
  p_user_type pg_catalog.smallint,
  p_granted_scopes pg_catalog.text[],
  p_authorized_at pg_catalog.timestamptz,
  p_access_expires_at pg_catalog.timestamptz,
  p_refresh_expires_at pg_catalog.timestamptz,
  p_access_envelope_version pg_catalog.smallint,
  p_access_envelope_algorithm pg_catalog.text,
  p_access_envelope_key_reference pg_catalog.text,
  p_access_envelope_aad_version pg_catalog.smallint,
  p_access_envelope_initialization_vector pg_catalog.text,
  p_access_envelope_ciphertext pg_catalog.text,
  p_access_envelope_authentication_tag pg_catalog.text,
  p_refresh_envelope_version pg_catalog.smallint,
  p_refresh_envelope_algorithm pg_catalog.text,
  p_refresh_envelope_key_reference pg_catalog.text,
  p_refresh_envelope_aad_version pg_catalog.smallint,
  p_refresh_envelope_initialization_vector pg_catalog.text,
  p_refresh_envelope_ciphertext pg_catalog.text,
  p_refresh_envelope_authentication_tag pg_catalog.text
)
RETURNS pg_catalog.void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $persist$
DECLARE
  current_authorization_state pg_catalog.text;
  current_authorization_revision pg_catalog.bigint;
  current_credential_revision pg_catalog.bigint;
  current_callback_received_at pg_catalog.timestamptz;
BEGIN
  IF p_connection_id IS NULL OR p_account_id IS NULL
    OR p_expected_authorization_revision < 0 OR p_expected_credential_revision < 0
    OR p_authorization_state NOT IN ('authorized_limited', 'authorized_ready')
    OR p_provider_creator_open_id IS NULL
    OR pg_catalog.length(p_provider_creator_open_id) NOT BETWEEN 1 AND 200
    OR p_provider_creator_open_id <> pg_catalog.btrim(p_provider_creator_open_id)
    OR p_user_type <> 1
    OR p_granted_scopes IS NULL
    OR NOT p_granted_scopes @> ARRAY['creator.affiliate.info']::pg_catalog.text[]
    OR NOT p_granted_scopes <@ ARRAY[
      'creator.affiliate.info', 'creator.data.live.read.public',
      'creator.affiliate.share_link.read', 'creator.affiliate_collaboration.read',
      'creator.showcase.read'
    ]::pg_catalog.text[]
    OR p_authorized_at IS NULL OR p_access_expires_at IS NULL
    OR p_access_expires_at <= p_authorized_at
    OR (p_refresh_expires_at IS NOT NULL AND p_refresh_expires_at <= p_access_expires_at)
    OR p_access_envelope_version <> 1 OR p_refresh_envelope_version <> 1
    OR p_access_envelope_algorithm <> 'A256GCM' OR p_refresh_envelope_algorithm <> 'A256GCM'
    OR p_access_envelope_aad_version <> 1 OR p_refresh_envelope_aad_version <> 1
    OR p_access_envelope_key_reference !~ '^affiliate-creator-sandbox-v[1-9][0-9]*$'
    OR p_refresh_envelope_key_reference !~ '^affiliate-creator-sandbox-v[1-9][0-9]*$'
    OR pg_catalog.length(p_access_envelope_key_reference) > 96
    OR pg_catalog.length(p_refresh_envelope_key_reference) > 96
    OR p_access_envelope_initialization_vector !~ '^[A-Za-z0-9_-]{16}$'
    OR p_refresh_envelope_initialization_vector !~ '^[A-Za-z0-9_-]{16}$'
    OR p_access_envelope_ciphertext !~ '^[A-Za-z0-9_-]+$'
    OR p_refresh_envelope_ciphertext !~ '^[A-Za-z0-9_-]+$'
    OR pg_catalog.length(p_access_envelope_ciphertext) > 16384
    OR pg_catalog.length(p_refresh_envelope_ciphertext) > 16384
    OR p_access_envelope_authentication_tag !~ '^[A-Za-z0-9_-]{22}$'
    OR p_refresh_envelope_authentication_tag !~ '^[A-Za-z0-9_-]{22}$' THEN
    RAISE EXCEPTION 'affiliate_creator_authorization_request_invalid';
  END IF;

  SELECT connection_row.authorization_state, connection_row.authorization_revision,
    connection_row.credential_revision, connection_row.callback_received_at
  INTO current_authorization_state, current_authorization_revision, current_credential_revision,
    current_callback_received_at
  FROM public.affiliate_creator_connections AS connection_row
  WHERE connection_row.id = p_connection_id
    AND connection_row.account_id = p_account_id
    AND connection_row.provider_code = 'tiktok_shop_affiliate_creator'
  FOR UPDATE;

  IF NOT FOUND OR current_authorization_state <> 'callback_received'
    OR current_authorization_revision <> p_expected_authorization_revision
    OR current_credential_revision <> p_expected_credential_revision
    OR current_callback_received_at IS NULL
    OR p_authorized_at < current_callback_received_at
    OR EXISTS (SELECT 1 FROM public.affiliate_creator_connection_credentials AS credential_row
               WHERE credential_row.connection_id = p_connection_id) THEN
    RAISE EXCEPTION 'affiliate_creator_authorization_compare_and_swap_failed';
  END IF;

  UPDATE public.affiliate_creator_connections AS connection_row
  SET state = 'authorized',
    authorization_state = p_authorization_state,
    authorization_revision = p_expected_authorization_revision + 1,
    credential_revision = p_expected_credential_revision + 1,
    provider_creator_open_id = p_provider_creator_open_id,
    user_type = p_user_type,
    granted_scopes = p_granted_scopes,
    authorized_at = p_authorized_at,
    token_validated_at = p_authorized_at,
    access_expires_at = p_access_expires_at,
    refresh_expires_at = p_refresh_expires_at,
    revoked_at = NULL,
    updated_at = CURRENT_TIMESTAMP
  WHERE connection_row.id = p_connection_id
    AND connection_row.account_id = p_account_id
    AND connection_row.provider_code = 'tiktok_shop_affiliate_creator';

  INSERT INTO public.affiliate_creator_connection_credentials (
    connection_id, account_id, provider_code, purpose, credential_revision,
    envelope_version, envelope_algorithm, envelope_key_reference, envelope_aad_version,
    envelope_initialization_vector, envelope_ciphertext, envelope_authentication_tag
  ) VALUES
    (p_connection_id, p_account_id, 'tiktok_shop_affiliate_creator', 'access',
      p_expected_credential_revision + 1, p_access_envelope_version,
      p_access_envelope_algorithm, p_access_envelope_key_reference,
      p_access_envelope_aad_version, p_access_envelope_initialization_vector,
      p_access_envelope_ciphertext, p_access_envelope_authentication_tag),
    (p_connection_id, p_account_id, 'tiktok_shop_affiliate_creator', 'refresh',
      p_expected_credential_revision + 1, p_refresh_envelope_version,
      p_refresh_envelope_algorithm, p_refresh_envelope_key_reference,
      p_refresh_envelope_aad_version, p_refresh_envelope_initialization_vector,
      p_refresh_envelope_ciphertext, p_refresh_envelope_authentication_tag);

  INSERT INTO public.affiliate_creator_authorization_events (
    connection_id, account_id, provider_code, authorization_revision,
    event_type, authorization_state, event_sequence, safe_status_code, occurred_at
  ) VALUES (
    p_connection_id, p_account_id, 'tiktok_shop_affiliate_creator',
    p_expected_authorization_revision + 1, 'token_validated', p_authorization_state,
    0, 'token_validated', p_authorized_at
  );
END;
$persist$;

CREATE FUNCTION public.replace_affiliate_creator_credentials_after_refresh(
  p_connection_id pg_catalog.uuid,
  p_account_id pg_catalog.uuid,
  p_expected_authorization_revision pg_catalog.bigint,
  p_expected_credential_revision pg_catalog.bigint,
  p_authorization_state pg_catalog.text,
  p_granted_scopes pg_catalog.text[],
  p_refreshed_at pg_catalog.timestamptz,
  p_access_expires_at pg_catalog.timestamptz,
  p_refresh_expires_at pg_catalog.timestamptz,
  p_access_envelope_version pg_catalog.smallint,
  p_access_envelope_algorithm pg_catalog.text,
  p_access_envelope_key_reference pg_catalog.text,
  p_access_envelope_aad_version pg_catalog.smallint,
  p_access_envelope_initialization_vector pg_catalog.text,
  p_access_envelope_ciphertext pg_catalog.text,
  p_access_envelope_authentication_tag pg_catalog.text,
  p_refresh_envelope_version pg_catalog.smallint,
  p_refresh_envelope_algorithm pg_catalog.text,
  p_refresh_envelope_key_reference pg_catalog.text,
  p_refresh_envelope_aad_version pg_catalog.smallint,
  p_refresh_envelope_initialization_vector pg_catalog.text,
  p_refresh_envelope_ciphertext pg_catalog.text,
  p_refresh_envelope_authentication_tag pg_catalog.text
)
RETURNS pg_catalog.void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $refresh$
DECLARE
  current_authorization_state pg_catalog.text;
  current_authorization_revision pg_catalog.bigint;
  current_credential_revision pg_catalog.bigint;
  current_token_validated_at pg_catalog.timestamptz;
  current_last_refresh_attempted_at pg_catalog.timestamptz;
  changed_access_rows pg_catalog.integer;
  changed_refresh_rows pg_catalog.integer;
BEGIN
  IF p_connection_id IS NULL OR p_account_id IS NULL
    OR p_expected_authorization_revision < 0 OR p_expected_credential_revision < 0
    OR p_authorization_state NOT IN ('authorized_limited', 'authorized_ready')
    OR p_granted_scopes IS NULL
    OR NOT p_granted_scopes @> ARRAY['creator.affiliate.info']::pg_catalog.text[]
    OR NOT p_granted_scopes <@ ARRAY[
      'creator.affiliate.info', 'creator.data.live.read.public',
      'creator.affiliate.share_link.read', 'creator.affiliate_collaboration.read',
      'creator.showcase.read'
    ]::pg_catalog.text[]
    OR p_refreshed_at IS NULL OR p_access_expires_at IS NULL
    OR p_access_expires_at <= p_refreshed_at
    OR (p_refresh_expires_at IS NOT NULL AND p_refresh_expires_at <= p_access_expires_at)
    OR p_access_envelope_version <> 1 OR p_refresh_envelope_version <> 1
    OR p_access_envelope_algorithm <> 'A256GCM' OR p_refresh_envelope_algorithm <> 'A256GCM'
    OR p_access_envelope_aad_version <> 1 OR p_refresh_envelope_aad_version <> 1
    OR p_access_envelope_key_reference !~ '^affiliate-creator-sandbox-v[1-9][0-9]*$'
    OR p_refresh_envelope_key_reference !~ '^affiliate-creator-sandbox-v[1-9][0-9]*$'
    OR pg_catalog.length(p_access_envelope_key_reference) > 96
    OR pg_catalog.length(p_refresh_envelope_key_reference) > 96
    OR p_access_envelope_initialization_vector !~ '^[A-Za-z0-9_-]{16}$'
    OR p_refresh_envelope_initialization_vector !~ '^[A-Za-z0-9_-]{16}$'
    OR p_access_envelope_ciphertext !~ '^[A-Za-z0-9_-]+$'
    OR p_refresh_envelope_ciphertext !~ '^[A-Za-z0-9_-]+$'
    OR pg_catalog.length(p_access_envelope_ciphertext) > 16384
    OR pg_catalog.length(p_refresh_envelope_ciphertext) > 16384
    OR p_access_envelope_authentication_tag !~ '^[A-Za-z0-9_-]{22}$'
    OR p_refresh_envelope_authentication_tag !~ '^[A-Za-z0-9_-]{22}$' THEN
    RAISE EXCEPTION 'affiliate_creator_refresh_request_invalid';
  END IF;

  SELECT connection_row.authorization_state, connection_row.authorization_revision,
    connection_row.credential_revision, connection_row.token_validated_at,
    connection_row.last_refresh_attempted_at
  INTO current_authorization_state, current_authorization_revision, current_credential_revision,
    current_token_validated_at, current_last_refresh_attempted_at
  FROM public.affiliate_creator_connections AS connection_row
  WHERE connection_row.id = p_connection_id
    AND connection_row.account_id = p_account_id
    AND connection_row.provider_code = 'tiktok_shop_affiliate_creator'
  FOR UPDATE;

  IF NOT FOUND OR current_authorization_state <> 'refresh_required'
    OR current_authorization_revision <> p_expected_authorization_revision
    OR current_credential_revision <> p_expected_credential_revision
    OR current_token_validated_at IS NULL
    OR p_refreshed_at < current_token_validated_at
    OR (current_last_refresh_attempted_at IS NOT NULL
      AND p_refreshed_at < current_last_refresh_attempted_at) THEN
    RAISE EXCEPTION 'affiliate_creator_refresh_compare_and_swap_failed';
  END IF;

  UPDATE public.affiliate_creator_connection_credentials AS credential_row
  SET credential_revision = p_expected_credential_revision + 1,
    envelope_version = p_access_envelope_version,
    envelope_algorithm = p_access_envelope_algorithm,
    envelope_key_reference = p_access_envelope_key_reference,
    envelope_aad_version = p_access_envelope_aad_version,
    envelope_initialization_vector = p_access_envelope_initialization_vector,
    envelope_ciphertext = p_access_envelope_ciphertext,
    envelope_authentication_tag = p_access_envelope_authentication_tag,
    updated_at = CURRENT_TIMESTAMP
  WHERE credential_row.connection_id = p_connection_id
    AND credential_row.account_id = p_account_id
    AND credential_row.provider_code = 'tiktok_shop_affiliate_creator'
    AND credential_row.purpose = 'access';
  GET DIAGNOSTICS changed_access_rows = ROW_COUNT;

  UPDATE public.affiliate_creator_connection_credentials AS credential_row
  SET credential_revision = p_expected_credential_revision + 1,
    envelope_version = p_refresh_envelope_version,
    envelope_algorithm = p_refresh_envelope_algorithm,
    envelope_key_reference = p_refresh_envelope_key_reference,
    envelope_aad_version = p_refresh_envelope_aad_version,
    envelope_initialization_vector = p_refresh_envelope_initialization_vector,
    envelope_ciphertext = p_refresh_envelope_ciphertext,
    envelope_authentication_tag = p_refresh_envelope_authentication_tag,
    updated_at = CURRENT_TIMESTAMP
  WHERE credential_row.connection_id = p_connection_id
    AND credential_row.account_id = p_account_id
    AND credential_row.provider_code = 'tiktok_shop_affiliate_creator'
    AND credential_row.purpose = 'refresh';
  GET DIAGNOSTICS changed_refresh_rows = ROW_COUNT;

  IF changed_access_rows <> 1 OR changed_refresh_rows <> 1 THEN
    RAISE EXCEPTION 'affiliate_creator_refresh_credential_pair_required';
  END IF;

  UPDATE public.affiliate_creator_connections AS connection_row
  SET authorization_state = p_authorization_state,
    authorization_revision = p_expected_authorization_revision + 1,
    credential_revision = p_expected_credential_revision + 1,
    granted_scopes = p_granted_scopes,
    token_validated_at = p_refreshed_at,
    last_refresh_attempted_at = p_refreshed_at,
    last_refresh_succeeded_at = p_refreshed_at,
    access_expires_at = p_access_expires_at,
    refresh_expires_at = p_refresh_expires_at,
    updated_at = CURRENT_TIMESTAMP
  WHERE connection_row.id = p_connection_id
    AND connection_row.account_id = p_account_id
    AND connection_row.provider_code = 'tiktok_shop_affiliate_creator';

  INSERT INTO public.affiliate_creator_authorization_events (
    connection_id, account_id, provider_code, authorization_revision,
    event_type, authorization_state, event_sequence, safe_status_code, occurred_at
  ) VALUES (
    p_connection_id, p_account_id, 'tiktok_shop_affiliate_creator',
    p_expected_authorization_revision + 1, 'refresh_succeeded', p_authorization_state,
    0, 'refresh_succeeded', p_refreshed_at
  );
END;
$refresh$;

CREATE FUNCTION public.mark_affiliate_creator_refresh_invalid(
  p_connection_id pg_catalog.uuid,
  p_account_id pg_catalog.uuid,
  p_expected_authorization_revision pg_catalog.bigint,
  p_expected_credential_revision pg_catalog.bigint,
  p_occurred_at pg_catalog.timestamptz
)
RETURNS pg_catalog.void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $invalid_refresh$
DECLARE
  current_authorization_state pg_catalog.text;
  current_authorization_revision pg_catalog.bigint;
  current_credential_revision pg_catalog.bigint;
  current_authorization_started_at pg_catalog.timestamptz;
BEGIN
  IF p_connection_id IS NULL OR p_account_id IS NULL OR p_occurred_at IS NULL
    OR p_expected_authorization_revision < 0 OR p_expected_credential_revision < 0 THEN
    RAISE EXCEPTION 'affiliate_creator_refresh_request_invalid';
  END IF;

  SELECT connection_row.authorization_state, connection_row.authorization_revision,
    connection_row.credential_revision, connection_row.authorization_started_at
  INTO current_authorization_state, current_authorization_revision, current_credential_revision,
    current_authorization_started_at
  FROM public.affiliate_creator_connections AS connection_row
  WHERE connection_row.id = p_connection_id
    AND connection_row.account_id = p_account_id
    AND connection_row.provider_code = 'tiktok_shop_affiliate_creator'
  FOR UPDATE;

  IF NOT FOUND OR current_authorization_state <> 'refresh_required'
    OR current_authorization_revision <> p_expected_authorization_revision
    OR current_credential_revision <> p_expected_credential_revision
    OR current_authorization_started_at IS NULL
    OR p_occurred_at < current_authorization_started_at THEN
    RAISE EXCEPTION 'affiliate_creator_refresh_compare_and_swap_failed';
  END IF;

  DELETE FROM public.affiliate_creator_connection_credentials AS credential_row
  WHERE credential_row.connection_id = p_connection_id
    AND credential_row.account_id = p_account_id
    AND credential_row.provider_code = 'tiktok_shop_affiliate_creator';

  UPDATE public.affiliate_creator_connections AS connection_row
  SET authorization_state = 'reauthorization_required',
    authorization_revision = p_expected_authorization_revision + 1,
    reauthorization_required_at = p_occurred_at,
    updated_at = CURRENT_TIMESTAMP
  WHERE connection_row.id = p_connection_id
    AND connection_row.account_id = p_account_id
    AND connection_row.provider_code = 'tiktok_shop_affiliate_creator';

  INSERT INTO public.affiliate_creator_authorization_events (
    connection_id, account_id, provider_code, authorization_revision,
    event_type, authorization_state, event_sequence, safe_status_code, occurred_at
  ) VALUES (
    p_connection_id, p_account_id, 'tiktok_shop_affiliate_creator',
    p_expected_authorization_revision + 1, 'refresh_failed', 'reauthorization_required',
    0, 'refresh_failed', p_occurred_at
  );
END;
$invalid_refresh$;

CREATE FUNCTION public.deauthorize_affiliate_creator_connection(
  p_connection_id pg_catalog.uuid,
  p_account_id pg_catalog.uuid,
  p_expected_authorization_revision pg_catalog.bigint,
  p_expected_credential_revision pg_catalog.bigint,
  p_revoked_at pg_catalog.timestamptz
)
RETURNS pg_catalog.void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $deauthorize$
DECLARE
  current_authorization_state pg_catalog.text;
  current_authorization_revision pg_catalog.bigint;
  current_credential_revision pg_catalog.bigint;
  current_authorization_started_at pg_catalog.timestamptz;
BEGIN
  IF p_connection_id IS NULL OR p_account_id IS NULL OR p_revoked_at IS NULL
    OR p_expected_authorization_revision < 0 OR p_expected_credential_revision < 0 THEN
    RAISE EXCEPTION 'affiliate_creator_deauthorization_request_invalid';
  END IF;

  SELECT connection_row.authorization_state, connection_row.authorization_revision,
    connection_row.credential_revision, connection_row.authorization_started_at
  INTO current_authorization_state, current_authorization_revision, current_credential_revision,
    current_authorization_started_at
  FROM public.affiliate_creator_connections AS connection_row
  WHERE connection_row.id = p_connection_id
    AND connection_row.account_id = p_account_id
    AND connection_row.provider_code = 'tiktok_shop_affiliate_creator'
  FOR UPDATE;

  IF NOT FOUND
    OR current_authorization_state NOT IN (
      'authorization_pending', 'callback_received', 'authorized_limited',
      'authorized_ready', 'refresh_required', 'reauthorization_required'
    )
    OR current_authorization_revision <> p_expected_authorization_revision
    OR current_credential_revision <> p_expected_credential_revision
    OR current_authorization_started_at IS NULL
    OR p_revoked_at < current_authorization_started_at THEN
    RAISE EXCEPTION 'affiliate_creator_deauthorization_compare_and_swap_failed';
  END IF;

  DELETE FROM public.affiliate_creator_connection_credentials AS credential_row
  WHERE credential_row.connection_id = p_connection_id
    AND credential_row.account_id = p_account_id
    AND credential_row.provider_code = 'tiktok_shop_affiliate_creator';

  UPDATE public.affiliate_creator_connections AS connection_row
  SET state = 'revoked',
    authorization_state = 'deauthorized',
    authorization_revision = p_expected_authorization_revision + 1,
    revoked_at = p_revoked_at,
    updated_at = CURRENT_TIMESTAMP
  WHERE connection_row.id = p_connection_id
    AND connection_row.account_id = p_account_id
    AND connection_row.provider_code = 'tiktok_shop_affiliate_creator';

  INSERT INTO public.affiliate_creator_authorization_events (
    connection_id, account_id, provider_code, authorization_revision,
    event_type, authorization_state, event_sequence, safe_status_code, occurred_at
  ) VALUES (
    p_connection_id, p_account_id, 'tiktok_shop_affiliate_creator',
    p_expected_authorization_revision + 1, 'all_access_removed', 'deauthorized',
    0, 'all_access_removed', p_revoked_at
  );
END;
$deauthorize$;

REVOKE ALL ON FUNCTION public.persist_affiliate_creator_authorization(
  pg_catalog.uuid, pg_catalog.uuid, pg_catalog.bigint, pg_catalog.bigint,
  pg_catalog.text, pg_catalog.text, pg_catalog.smallint, pg_catalog.text[],
  pg_catalog.timestamptz, pg_catalog.timestamptz, pg_catalog.timestamptz,
  pg_catalog.smallint, pg_catalog.text, pg_catalog.text, pg_catalog.smallint,
  pg_catalog.text, pg_catalog.text, pg_catalog.text, pg_catalog.smallint,
  pg_catalog.text, pg_catalog.text, pg_catalog.smallint, pg_catalog.text,
  pg_catalog.text, pg_catalog.text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_affiliate_creator_credentials_after_refresh(
  pg_catalog.uuid, pg_catalog.uuid, pg_catalog.bigint, pg_catalog.bigint,
  pg_catalog.text, pg_catalog.text[], pg_catalog.timestamptz,
  pg_catalog.timestamptz, pg_catalog.timestamptz, pg_catalog.smallint,
  pg_catalog.text, pg_catalog.text, pg_catalog.smallint, pg_catalog.text,
  pg_catalog.text, pg_catalog.text, pg_catalog.smallint, pg_catalog.text,
  pg_catalog.text, pg_catalog.smallint, pg_catalog.text, pg_catalog.text,
  pg_catalog.text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_affiliate_creator_refresh_invalid(
  pg_catalog.uuid, pg_catalog.uuid, pg_catalog.bigint, pg_catalog.bigint,
  pg_catalog.timestamptz
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.deauthorize_affiliate_creator_connection(
  pg_catalog.uuid, pg_catalog.uuid, pg_catalog.bigint, pg_catalog.bigint,
  pg_catalog.timestamptz
) FROM PUBLIC;

COMMIT;
