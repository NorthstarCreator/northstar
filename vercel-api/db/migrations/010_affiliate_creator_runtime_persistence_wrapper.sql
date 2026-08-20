-- Runtime-only completion boundary for the dormant Affiliate Creator flow.
BEGIN;

DO $migration_guard$
BEGIN
  IF pg_catalog.to_regprocedure('public.persist_affiliate_creator_authorization(uuid,uuid,int8,int8,text,text,int2,text[],timestamptz,timestamptz,timestamptz,int2,text,text,int2,text,text,text,int2,text,text,int2,text,text,text)') IS NULL
    OR pg_catalog.to_regprocedure('public.accept_affiliate_creator_authorization_callback(uuid,int8,text,timestamptz)') IS NULL
    OR pg_catalog.to_regclass('public.affiliate_creator_runtime_account_bindings') IS NULL THEN
    RAISE EXCEPTION 'affiliate_creator_runtime_persistence_prerequisites_required';
  END IF;
END;
$migration_guard$;

CREATE FUNCTION public.complete_affiliate_creator_runtime_authorization(
  p_connection_id pg_catalog.uuid,
  p_expected_authorization_revision pg_catalog.int8,
  p_expected_credential_revision pg_catalog.int8,
  p_authorization_state pg_catalog.text,
  p_provider_creator_open_id pg_catalog.text,
  p_user_type pg_catalog.int2,
  p_granted_scopes pg_catalog.text[],
  p_authorized_at pg_catalog.timestamptz,
  p_access_expires_at pg_catalog.timestamptz,
  p_refresh_expires_at pg_catalog.timestamptz,
  p_access_envelope_version pg_catalog.int2,
  p_access_envelope_algorithm pg_catalog.text,
  p_access_envelope_key_reference pg_catalog.text,
  p_access_envelope_aad_version pg_catalog.int2,
  p_access_envelope_initialization_vector pg_catalog.text,
  p_access_envelope_ciphertext pg_catalog.text,
  p_access_envelope_authentication_tag pg_catalog.text,
  p_refresh_envelope_version pg_catalog.int2,
  p_refresh_envelope_algorithm pg_catalog.text,
  p_refresh_envelope_key_reference pg_catalog.text,
  p_refresh_envelope_aad_version pg_catalog.int2,
  p_refresh_envelope_initialization_vector pg_catalog.text,
  p_refresh_envelope_ciphertext pg_catalog.text,
  p_refresh_envelope_authentication_tag pg_catalog.text
)
RETURNS pg_catalog.void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $runtime_persist$
DECLARE
  runtime_role_oid pg_catalog.oid;
  session_role_oid pg_catalog.oid;
  bound_account_id pg_catalog.uuid;
  binding_count pg_catalog.int8;
  connection_count pg_catalog.int8;
BEGIN
  SELECT role_row.oid INTO runtime_role_oid
  FROM pg_catalog.pg_roles AS role_row
  WHERE role_row.rolname = 'northstar_affiliate_creator_runtime';
  SELECT SESSION_USER::pg_catalog.regrole::pg_catalog.oid INTO session_role_oid;

  IF runtime_role_oid IS NULL OR session_role_oid <> runtime_role_oid THEN
    RAISE EXCEPTION 'affiliate_creator_runtime_session_invalid';
  END IF;

  SELECT count(*) INTO binding_count
  FROM public.affiliate_creator_runtime_account_bindings AS binding_row
  WHERE binding_row.runtime_role_oid = runtime_role_oid
    AND binding_row.provider_code = 'tiktok_shop_affiliate_creator';

  SELECT binding_row.account_id INTO bound_account_id
  FROM public.affiliate_creator_runtime_account_bindings AS binding_row
  WHERE binding_row.runtime_role_oid = runtime_role_oid
    AND binding_row.provider_code = 'tiktok_shop_affiliate_creator';

  IF binding_count <> 1 OR bound_account_id IS NULL THEN
    RAISE EXCEPTION 'affiliate_creator_runtime_binding_invalid';
  END IF;

  SELECT count(*) INTO connection_count
  FROM public.affiliate_creator_connections AS connection_row
  WHERE connection_row.id = p_connection_id
    AND connection_row.account_id = bound_account_id
    AND connection_row.provider_code = 'tiktok_shop_affiliate_creator'
    AND connection_row.authorization_state = 'callback_received'
    AND connection_row.authorization_revision = p_expected_authorization_revision
    AND connection_row.credential_revision = p_expected_credential_revision
    AND connection_row.callback_received_at IS NOT NULL;

  IF connection_count <> 1 THEN
    RAISE EXCEPTION 'affiliate_creator_runtime_persistence_state_invalid';
  END IF;

  PERFORM public.persist_affiliate_creator_authorization(
    p_connection_id, bound_account_id,
    p_expected_authorization_revision, p_expected_credential_revision,
    p_authorization_state, p_provider_creator_open_id, p_user_type,
    p_granted_scopes, p_authorized_at, p_access_expires_at, p_refresh_expires_at,
    p_access_envelope_version, p_access_envelope_algorithm,
    p_access_envelope_key_reference, p_access_envelope_aad_version,
    p_access_envelope_initialization_vector, p_access_envelope_ciphertext,
    p_access_envelope_authentication_tag, p_refresh_envelope_version,
    p_refresh_envelope_algorithm, p_refresh_envelope_key_reference,
    p_refresh_envelope_aad_version, p_refresh_envelope_initialization_vector,
    p_refresh_envelope_ciphertext, p_refresh_envelope_authentication_tag
  );
END;
$runtime_persist$;

REVOKE ALL ON FUNCTION public.complete_affiliate_creator_runtime_authorization(
  pg_catalog.uuid, pg_catalog.int8, pg_catalog.int8, pg_catalog.text,
  pg_catalog.text, pg_catalog.int2, pg_catalog.text[], pg_catalog.timestamptz,
  pg_catalog.timestamptz, pg_catalog.timestamptz, pg_catalog.int2,
  pg_catalog.text, pg_catalog.text, pg_catalog.int2, pg_catalog.text,
  pg_catalog.text, pg_catalog.text, pg_catalog.int2, pg_catalog.text,
  pg_catalog.text, pg_catalog.int2, pg_catalog.text, pg_catalog.text,
  pg_catalog.text
) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.persist_affiliate_creator_authorization(
  pg_catalog.uuid, pg_catalog.uuid, pg_catalog.int8, pg_catalog.int8,
  pg_catalog.text, pg_catalog.text, pg_catalog.int2, pg_catalog.text[],
  pg_catalog.timestamptz, pg_catalog.timestamptz, pg_catalog.timestamptz,
  pg_catalog.int2, pg_catalog.text, pg_catalog.text, pg_catalog.int2,
  pg_catalog.text, pg_catalog.text, pg_catalog.text, pg_catalog.int2,
  pg_catalog.text, pg_catalog.text, pg_catalog.int2, pg_catalog.text,
  pg_catalog.text, pg_catalog.text
) FROM northstar_affiliate_creator_runtime;
GRANT EXECUTE ON FUNCTION public.complete_affiliate_creator_runtime_authorization(
  pg_catalog.uuid, pg_catalog.int8, pg_catalog.int8, pg_catalog.text,
  pg_catalog.text, pg_catalog.int2, pg_catalog.text[], pg_catalog.timestamptz,
  pg_catalog.timestamptz, pg_catalog.timestamptz, pg_catalog.int2,
  pg_catalog.text, pg_catalog.text, pg_catalog.int2, pg_catalog.text,
  pg_catalog.text, pg_catalog.text, pg_catalog.int2, pg_catalog.text,
  pg_catalog.text, pg_catalog.int2, pg_catalog.text, pg_catalog.text,
  pg_catalog.text
) TO northstar_affiliate_creator_runtime;

COMMIT;
