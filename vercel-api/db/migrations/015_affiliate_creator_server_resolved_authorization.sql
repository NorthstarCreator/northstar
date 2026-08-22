BEGIN;

DO $guard$
BEGIN
  IF pg_catalog.to_regprocedure('public.begin_affiliate_creator_authorization(uuid,text,timestamptz,timestamptz)') IS NULL
    OR pg_catalog.to_regprocedure('public.accept_affiliate_creator_authorization_callback(uuid,text,timestamptz)') IS NULL
    OR pg_catalog.to_regclass('public.affiliate_creator_connections') IS NULL
    OR pg_catalog.to_regclass('public.affiliate_creator_authorization_states') IS NULL
    OR pg_catalog.to_regclass('public.affiliate_creator_runtime_account_bindings') IS NULL
    OR pg_catalog.to_regprocedure('public.begin_affiliate_creator_authorization(text,timestamptz,timestamptz)') IS NOT NULL
    OR pg_catalog.to_regprocedure('public.accept_affiliate_creator_authorization_callback(text,timestamptz)') IS NOT NULL THEN
    RAISE EXCEPTION 'affiliate_creator_server_resolved_authorization_prerequisite_missing';
  END IF;
END;
$guard$;

DROP FUNCTION public.begin_affiliate_creator_authorization(pg_catalog.uuid, pg_catalog.text, pg_catalog.timestamptz, pg_catalog.timestamptz);
DROP FUNCTION public.accept_affiliate_creator_authorization_callback(pg_catalog.uuid, pg_catalog.text, pg_catalog.timestamptz);

CREATE FUNCTION public.begin_affiliate_creator_authorization(
  p_state_digest pg_catalog.text, p_expires_at pg_catalog.timestamptz,
  p_occurred_at pg_catalog.timestamptz
) RETURNS TABLE(connection_id pg_catalog.uuid, authorization_revision pg_catalog.int8, expires_at pg_catalog.timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $begin_authorization$
DECLARE account_uuid pg_catalog.uuid; resolved_connection_id pg_catalog.uuid; current_state pg_catalog.text; current_revision pg_catalog.int8; next_revision pg_catalog.int8; restarted pg_catalog.bool := false;
BEGIN
  SELECT binding_row.account_id INTO account_uuid FROM public.affiliate_creator_runtime_account_bindings AS binding_row JOIN pg_catalog.pg_roles AS role_row ON role_row.oid = binding_row.runtime_role_oid WHERE binding_row.runtime_role_oid = SESSION_USER::pg_catalog.regrole::pg_catalog.oid AND role_row.rolname = 'northstar_affiliate_creator_runtime';
  IF account_uuid IS NULL OR p_state_digest !~ '^[0-9a-f]{64}$' OR p_expires_at IS NULL OR p_occurred_at IS NULL OR p_expires_at <= p_occurred_at OR p_expires_at > p_occurred_at + INTERVAL '10 minutes' THEN RAISE EXCEPTION 'affiliate_creator_authorization_start_invalid'; END IF;
  SELECT connection_row.id, connection_row.authorization_state, connection_row.authorization_revision INTO resolved_connection_id, current_state, current_revision FROM public.affiliate_creator_connections AS connection_row WHERE connection_row.account_id = account_uuid AND connection_row.provider_code = 'tiktok_shop_affiliate_creator' FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.affiliate_creator_connections(account_id, provider_code, state, authorization_state, authorization_revision, credential_revision, authorization_started_at) VALUES (account_uuid, 'tiktok_shop_affiliate_creator', 'pending', 'authorization_pending', 1, 0, p_occurred_at) RETURNING id INTO resolved_connection_id; next_revision := 1;
  ELSIF current_state IN ('not_authorized', 'reauthorization_required', 'deauthorized') AND NOT EXISTS (SELECT 1 FROM public.affiliate_creator_connection_credentials AS credential_row WHERE credential_row.connection_id = resolved_connection_id) THEN
    next_revision := current_revision + 1; UPDATE public.affiliate_creator_connections SET state = 'pending', authorization_state = 'authorization_pending', authorization_revision = next_revision, authorization_started_at = p_occurred_at, callback_received_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = resolved_connection_id;
  ELSIF current_state = 'authorization_pending' AND NOT EXISTS (SELECT 1 FROM public.affiliate_creator_connection_credentials AS credential_row WHERE credential_row.connection_id = resolved_connection_id) AND NOT EXISTS (SELECT 1 FROM public.affiliate_creator_authorization_states AS state_row WHERE state_row.connection_id = resolved_connection_id AND state_row.expires_at > p_occurred_at) THEN
    next_revision := current_revision + 1; restarted := true; UPDATE public.affiliate_creator_connections SET authorization_revision = next_revision, authorization_started_at = p_occurred_at, callback_received_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = resolved_connection_id;
  ELSE RAISE EXCEPTION 'affiliate_creator_authorization_start_compare_and_swap_failed'; END IF;
  DELETE FROM public.affiliate_creator_authorization_states AS state_row WHERE state_row.connection_id = resolved_connection_id AND state_row.expires_at <= p_occurred_at;
  IF EXISTS (SELECT 1 FROM public.affiliate_creator_authorization_states AS state_row WHERE state_row.connection_id = resolved_connection_id) THEN RAISE EXCEPTION 'affiliate_creator_authorization_state_active'; END IF;
  INSERT INTO public.affiliate_creator_authorization_states(account_id, provider_code, connection_id, authorization_revision, state_digest, expires_at) VALUES (account_uuid, 'tiktok_shop_affiliate_creator', resolved_connection_id, next_revision, p_state_digest, p_expires_at);
  INSERT INTO public.affiliate_creator_authorization_events(connection_id, account_id, provider_code, authorization_revision, event_type, authorization_state, event_sequence, safe_status_code, occurred_at) VALUES (resolved_connection_id, account_uuid, 'tiktok_shop_affiliate_creator', next_revision, CASE WHEN restarted THEN 'authorization_restarted' ELSE 'authorization_started' END, 'authorization_pending', 0, CASE WHEN restarted THEN 'authorization_restarted' ELSE 'authorization_started' END, p_occurred_at);
  RETURN QUERY SELECT resolved_connection_id, next_revision, p_expires_at;
END;
$begin_authorization$;

CREATE FUNCTION public.accept_affiliate_creator_authorization_callback(
  p_state_digest pg_catalog.text, p_occurred_at pg_catalog.timestamptz
) RETURNS TABLE(connection_id pg_catalog.uuid, authorization_revision pg_catalog.int8, credential_revision pg_catalog.int8)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $accept_callback$
DECLARE account_uuid pg_catalog.uuid; resolved_connection_id pg_catalog.uuid; state_revision pg_catalog.int8; current_state pg_catalog.text; current_revision pg_catalog.int8; current_credential_revision pg_catalog.int8;
BEGIN
  SELECT binding_row.account_id INTO account_uuid FROM public.affiliate_creator_runtime_account_bindings AS binding_row JOIN pg_catalog.pg_roles AS role_row ON role_row.oid = binding_row.runtime_role_oid WHERE binding_row.runtime_role_oid = SESSION_USER::pg_catalog.regrole::pg_catalog.oid AND role_row.rolname = 'northstar_affiliate_creator_runtime';
  IF account_uuid IS NULL OR p_state_digest !~ '^[0-9a-f]{64}$' OR p_occurred_at IS NULL THEN RAISE EXCEPTION 'affiliate_creator_callback_invalid'; END IF;
  DELETE FROM public.affiliate_creator_authorization_states AS state_row WHERE state_row.account_id = account_uuid AND state_row.provider_code = 'tiktok_shop_affiliate_creator' AND state_row.state_digest = p_state_digest AND state_row.expires_at > p_occurred_at RETURNING connection_id, authorization_revision INTO resolved_connection_id, state_revision;
  IF NOT FOUND THEN RAISE EXCEPTION 'affiliate_creator_callback_state_invalid'; END IF;
  SELECT connection_row.authorization_state, connection_row.authorization_revision, connection_row.credential_revision INTO current_state, current_revision, current_credential_revision FROM public.affiliate_creator_connections AS connection_row WHERE connection_row.id = resolved_connection_id AND connection_row.account_id = account_uuid AND connection_row.provider_code = 'tiktok_shop_affiliate_creator' FOR UPDATE;
  IF NOT FOUND OR current_state <> 'authorization_pending' OR current_revision <> state_revision THEN RAISE EXCEPTION 'affiliate_creator_callback_compare_and_swap_failed'; END IF;
  UPDATE public.affiliate_creator_connections SET authorization_state = 'callback_received', authorization_revision = current_revision + 1, callback_received_at = p_occurred_at, updated_at = CURRENT_TIMESTAMP WHERE id = resolved_connection_id AND account_id = account_uuid;
  INSERT INTO public.affiliate_creator_authorization_events(connection_id, account_id, provider_code, authorization_revision, event_type, authorization_state, event_sequence, safe_status_code, occurred_at) VALUES (resolved_connection_id, account_uuid, 'tiktok_shop_affiliate_creator', current_revision + 1, 'callback_accepted', 'callback_received', 0, 'callback_accepted', p_occurred_at);
  RETURN QUERY SELECT resolved_connection_id, current_revision + 1, current_credential_revision;
END;
$accept_callback$;

REVOKE ALL ON FUNCTION public.begin_affiliate_creator_authorization(pg_catalog.text, pg_catalog.timestamptz, pg_catalog.timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_affiliate_creator_authorization_callback(pg_catalog.text, pg_catalog.timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.begin_affiliate_creator_authorization(pg_catalog.text, pg_catalog.timestamptz, pg_catalog.timestamptz) TO northstar_affiliate_creator_runtime;
GRANT EXECUTE ON FUNCTION public.accept_affiliate_creator_authorization_callback(pg_catalog.text, pg_catalog.timestamptz) TO northstar_affiliate_creator_runtime;

COMMIT;
