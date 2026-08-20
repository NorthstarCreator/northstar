-- Trusted server-side AAD context accessor for the dormant Affiliate Creator runtime.
BEGIN;

DO $migration_guard$
DECLARE
  runtime_role_oid pg_catalog.oid;
BEGIN
  IF pg_catalog.to_regclass('public.affiliate_creator_runtime_account_bindings') IS NULL
    OR pg_catalog.to_regprocedure('public.complete_affiliate_creator_runtime_authorization(uuid,int8,int8,text,text,int2,text[],timestamptz,timestamptz,timestamptz,int2,text,text,int2,text,text,text,int2,text,text,int2,text,text,text)') IS NULL THEN
    RAISE EXCEPTION 'affiliate_creator_runtime_aad_prerequisites_required';
  END IF;

  SELECT role_row.oid INTO runtime_role_oid
  FROM pg_catalog.pg_roles AS role_row
  WHERE role_row.rolname = 'northstar_affiliate_creator_runtime';

  IF runtime_role_oid IS NULL OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS function_row
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(function_row.proacl, pg_catalog.acldefault('f'::pg_catalog."char", function_row.proowner))
    ) AS function_acl(grantor, grantee, privilege_type, is_grantable)
    WHERE function_row.oid = pg_catalog.to_regprocedure(
      'public.persist_affiliate_creator_authorization(uuid,uuid,int8,int8,text,text,int2,text[],timestamptz,timestamptz,timestamptz,int2,text,text,int2,text,text,text,int2,text,text,int2,text,text,text)'
    )
      AND function_acl.grantee = runtime_role_oid
      AND function_acl.privilege_type = 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'affiliate_creator_runtime_aad_prerequisites_required';
  END IF;
END;
$migration_guard$;

CREATE FUNCTION public.get_affiliate_creator_runtime_account_id()
RETURNS pg_catalog.uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $runtime_aad_context$
DECLARE
  runtime_role_oid pg_catalog.oid;
  session_role_oid pg_catalog.oid;
  binding_count pg_catalog.int8;
  bound_account_id pg_catalog.uuid;
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

  RETURN bound_account_id;
END;
$runtime_aad_context$;

REVOKE ALL ON FUNCTION public.get_affiliate_creator_runtime_account_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_affiliate_creator_runtime_account_id()
  TO northstar_affiliate_creator_runtime;

COMMIT;
