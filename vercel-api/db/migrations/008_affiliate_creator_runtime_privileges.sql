-- NorthStar Affiliate Creator runtime privilege boundary.
--
-- This migration never provisions, alters, credentials, or grants membership
-- to the runtime role. It is intentionally dormant until that exact role is
-- separately provisioned through a private provider-approved process.

BEGIN;

DO $runtime_privilege_guard$
DECLARE
  runtime_role_oid pg_catalog.oid;
  runtime_can_login pg_catalog.bool;
  runtime_inherit pg_catalog.bool;
  runtime_superuser pg_catalog.bool;
  runtime_createdb pg_catalog.bool;
  runtime_createrole pg_catalog.bool;
  runtime_replication pg_catalog.bool;
  runtime_bypassrls pg_catalog.bool;
BEGIN
  SELECT role_row.oid, role_row.rolcanlogin, role_row.rolinherit,
    role_row.rolsuper, role_row.rolcreatedb, role_row.rolcreaterole,
    role_row.rolreplication, role_row.rolbypassrls
  INTO runtime_role_oid, runtime_can_login, runtime_inherit,
    runtime_superuser, runtime_createdb, runtime_createrole,
    runtime_replication, runtime_bypassrls
  FROM pg_catalog.pg_roles AS role_row
  WHERE role_row.rolname = 'northstar_affiliate_creator_runtime';

  IF runtime_role_oid IS NULL THEN
    RAISE EXCEPTION 'affiliate_creator_runtime_role_required';
  END IF;

  IF NOT runtime_can_login OR runtime_inherit OR runtime_superuser
    OR runtime_createdb OR runtime_createrole OR runtime_replication
    OR runtime_bypassrls THEN
    RAISE EXCEPTION 'affiliate_creator_runtime_role_attributes_invalid';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_auth_members AS membership_row
    WHERE membership_row.member = runtime_role_oid
       OR membership_row.roleid = runtime_role_oid
  ) THEN
    RAISE EXCEPTION 'affiliate_creator_runtime_role_membership_invalid';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS class_row
    JOIN pg_catalog.pg_namespace AS namespace_row
      ON namespace_row.oid = class_row.relnamespace
    WHERE class_row.relowner = runtime_role_oid
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS function_row
    JOIN pg_catalog.pg_namespace AS namespace_row
      ON namespace_row.oid = function_row.pronamespace
    WHERE function_row.proowner = runtime_role_oid
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_namespace AS namespace_row
    WHERE namespace_row.nspname = 'public'
      AND namespace_row.nspowner = runtime_role_oid
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_database AS database_row
    WHERE database_row.datname = current_database()
      AND database_row.datdba = runtime_role_oid
  ) THEN
    RAISE EXCEPTION 'affiliate_creator_runtime_role_ownership_invalid';
  END IF;

  IF (SELECT count(*)
      FROM pg_catalog.pg_proc AS function_row
      JOIN pg_catalog.pg_namespace AS namespace_row
        ON namespace_row.oid = function_row.pronamespace
      WHERE namespace_row.nspname = 'public'
        AND function_row.proname IN (
          'persist_affiliate_creator_authorization',
          'replace_affiliate_creator_credentials_after_refresh',
          'mark_affiliate_creator_refresh_invalid',
          'deauthorize_affiliate_creator_connection'
        )) <> 4
    OR pg_catalog.to_regprocedure(
      'public.persist_affiliate_creator_authorization(uuid,uuid,int8,int8,text,text,int2,text[],timestamptz,timestamptz,timestamptz,int2,text,text,int2,text,text,text,int2,text,text,int2,text,text,text)'
    ) IS NULL
    OR pg_catalog.to_regprocedure(
      'public.replace_affiliate_creator_credentials_after_refresh(uuid,uuid,int8,int8,text,text[],timestamptz,timestamptz,timestamptz,int2,text,text,int2,text,text,text,int2,text,text,int2,text,text,text)'
    ) IS NULL
    OR pg_catalog.to_regprocedure(
      'public.mark_affiliate_creator_refresh_invalid(uuid,uuid,int8,int8,timestamptz)'
    ) IS NULL
    OR pg_catalog.to_regprocedure(
      'public.deauthorize_affiliate_creator_connection(uuid,uuid,int8,int8,timestamptz)'
    ) IS NULL
    OR (SELECT count(*)
        FROM pg_catalog.pg_proc AS function_row
        JOIN pg_catalog.pg_namespace AS namespace_row
          ON namespace_row.oid = function_row.pronamespace
        WHERE namespace_row.nspname = 'public'
          AND function_row.proname IN (
            'persist_affiliate_creator_authorization',
            'replace_affiliate_creator_credentials_after_refresh',
            'mark_affiliate_creator_refresh_invalid',
            'deauthorize_affiliate_creator_connection'
          )
          AND function_row.prosecdef
          AND 'search_path=pg_catalog, public, pg_temp' = ANY(
            COALESCE(function_row.proconfig, ARRAY[]::pg_catalog.text[])
          )) <> 4
    OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_proc AS function_row
      CROSS JOIN LATERAL pg_catalog.aclexplode(
        COALESCE(
          function_row.proacl,
          pg_catalog.acldefault('f'::pg_catalog."char", function_row.proowner)
        )
      ) AS function_acl(grantor, grantee, privilege_type, is_grantable)
      WHERE function_row.oid IN (
        pg_catalog.to_regprocedure('public.persist_affiliate_creator_authorization(uuid,uuid,int8,int8,text,text,int2,text[],timestamptz,timestamptz,timestamptz,int2,text,text,int2,text,text,text,int2,text,text,int2,text,text,text)'),
        pg_catalog.to_regprocedure('public.replace_affiliate_creator_credentials_after_refresh(uuid,uuid,int8,int8,text,text[],timestamptz,timestamptz,timestamptz,int2,text,text,int2,text,text,text,int2,text,text,int2,text,text,text)'),
        pg_catalog.to_regprocedure('public.mark_affiliate_creator_refresh_invalid(uuid,uuid,int8,int8,timestamptz)'),
        pg_catalog.to_regprocedure('public.deauthorize_affiliate_creator_connection(uuid,uuid,int8,int8,timestamptz)'),
        pg_catalog.to_regprocedure('public.erase_affiliate_creator_control_data(uuid,text,text)')
      )
        AND function_acl.grantee = 0
        AND function_acl.privilege_type = 'EXECUTE'
    ) THEN
    RAISE EXCEPTION 'affiliate_creator_runtime_persistence_boundary_required';
  END IF;

  IF (SELECT count(*) FROM pg_catalog.pg_constraint AS constraint_row
      WHERE constraint_row.conrelid = 'public.affiliate_creator_connections'::pg_catalog.regclass
        AND constraint_row.contype = 'c'
        AND constraint_row.convalidated
        AND constraint_row.conname IN (
          'affiliate_creator_connections_authorization_timestamp_order_che',
          'affiliate_creator_connections_authorization_state_timestamps_ch'
        )) <> 2
    OR (SELECT count(*) FROM pg_catalog.pg_trigger AS trigger_row
        WHERE trigger_row.tgrelid = 'public.affiliate_creator_connections'::pg_catalog.regclass
          AND trigger_row.tgname = 'affiliate_creator_connections_authorization_lifecycle_forward_o'
          AND NOT trigger_row.tgisinternal
          AND trigger_row.tgenabled IN ('O', 'A', 'R')
          AND trigger_row.tgtype = 19
          AND trigger_row.tgfoid =
            'public.validate_affiliate_creator_authorization_transition()'::pg_catalog.regprocedure
          AND trigger_row.tgargs = ''::pg_catalog.bytea) <> 1 THEN
    RAISE EXCEPTION 'affiliate_creator_runtime_safeguards_required';
  END IF;

  IF EXISTS (SELECT 1 FROM public.affiliate_creator_connections)
    OR EXISTS (SELECT 1 FROM public.affiliate_creator_connection_credentials)
    OR EXISTS (SELECT 1 FROM public.affiliate_creator_authorization_events)
    OR EXISTS (SELECT 1 FROM public.affiliate_creator_import_runs)
    OR EXISTS (SELECT 1 FROM public.affiliate_creator_import_pages)
    OR EXISTS (SELECT 1 FROM public.affiliate_creator_import_run_events) THEN
    RAISE EXCEPTION 'affiliate_creator_runtime_empty_baseline_required';
  END IF;

  IF (SELECT count(*) FILTER (
        WHERE constraint_row.conname IN (
          'sync_runs_cutoff_not_before_live_start',
          'videos_published_after_live_cutoff'
        ) AND constraint_row.convalidated
      ) FROM pg_catalog.pg_constraint AS constraint_row) <> 2 THEN
    RAISE EXCEPTION 'affiliate_creator_runtime_display_boundary_required';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_auth_members AS membership_row
    WHERE membership_row.member = runtime_role_oid
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_default_acl AS default_acl
    CROSS JOIN LATERAL pg_catalog.aclexplode(default_acl.defaclacl)
      AS default_acl_entry(grantor, grantee, privilege_type, is_grantable)
    WHERE default_acl.defaclrole = runtime_role_oid
       OR default_acl_entry.grantee = runtime_role_oid
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_class AS class_row
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(class_row.relacl, pg_catalog.acldefault(
        CASE class_row.relkind WHEN 'S' THEN 'S'::pg_catalog."char" ELSE 'r'::pg_catalog."char" END,
        class_row.relowner
      ))
    ) AS relation_acl(grantor, grantee, privilege_type, is_grantable)
    WHERE relation_acl.grantee = runtime_role_oid
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc AS function_row
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(function_row.proacl, pg_catalog.acldefault('f'::pg_catalog."char", function_row.proowner))
    ) AS function_acl(grantor, grantee, privilege_type, is_grantable)
    WHERE function_acl.grantee = runtime_role_oid
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_namespace AS namespace_row
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(namespace_row.nspacl, pg_catalog.acldefault('n'::pg_catalog."char", namespace_row.nspowner))
    ) AS namespace_acl(grantor, grantee, privilege_type, is_grantable)
    WHERE namespace_acl.grantee = runtime_role_oid
  ) THEN
    RAISE EXCEPTION 'affiliate_creator_runtime_existing_privileges_invalid';
  END IF;
END;
$runtime_privilege_guard$;

GRANT USAGE ON SCHEMA public TO northstar_affiliate_creator_runtime;
GRANT EXECUTE ON FUNCTION public.persist_affiliate_creator_authorization(
  pg_catalog.uuid, pg_catalog.uuid, pg_catalog.int8, pg_catalog.int8,
  pg_catalog.text, pg_catalog.text, pg_catalog.int2, pg_catalog.text[],
  pg_catalog.timestamptz, pg_catalog.timestamptz, pg_catalog.timestamptz,
  pg_catalog.int2, pg_catalog.text, pg_catalog.text, pg_catalog.int2,
  pg_catalog.text, pg_catalog.text, pg_catalog.text, pg_catalog.int2,
  pg_catalog.text, pg_catalog.text, pg_catalog.int2, pg_catalog.text,
  pg_catalog.text, pg_catalog.text
) TO northstar_affiliate_creator_runtime;
GRANT EXECUTE ON FUNCTION public.replace_affiliate_creator_credentials_after_refresh(
  pg_catalog.uuid, pg_catalog.uuid, pg_catalog.int8, pg_catalog.int8,
  pg_catalog.text, pg_catalog.text[], pg_catalog.timestamptz,
  pg_catalog.timestamptz, pg_catalog.timestamptz, pg_catalog.int2,
  pg_catalog.text, pg_catalog.text, pg_catalog.int2, pg_catalog.text,
  pg_catalog.text, pg_catalog.text, pg_catalog.int2, pg_catalog.text,
  pg_catalog.text, pg_catalog.int2, pg_catalog.text, pg_catalog.text,
  pg_catalog.text
) TO northstar_affiliate_creator_runtime;
GRANT EXECUTE ON FUNCTION public.mark_affiliate_creator_refresh_invalid(
  pg_catalog.uuid, pg_catalog.uuid, pg_catalog.int8, pg_catalog.int8,
  pg_catalog.timestamptz
) TO northstar_affiliate_creator_runtime;
GRANT EXECUTE ON FUNCTION public.deauthorize_affiliate_creator_connection(
  pg_catalog.uuid, pg_catalog.uuid, pg_catalog.int8, pg_catalog.int8,
  pg_catalog.timestamptz
) TO northstar_affiliate_creator_runtime;

DO $runtime_privilege_postcheck$
DECLARE
  runtime_role_oid pg_catalog.oid;
BEGIN
  SELECT role_row.oid INTO runtime_role_oid
  FROM pg_catalog.pg_roles AS role_row
  WHERE role_row.rolname = 'northstar_affiliate_creator_runtime';

  IF runtime_role_oid IS NULL
    OR EXISTS (
      SELECT 1 FROM pg_catalog.pg_class AS class_row
      CROSS JOIN LATERAL pg_catalog.aclexplode(
        COALESCE(class_row.relacl, pg_catalog.acldefault(
          CASE class_row.relkind WHEN 'S' THEN 'S'::pg_catalog."char" ELSE 'r'::pg_catalog."char" END,
          class_row.relowner
        ))
      ) AS relation_acl(grantor, grantee, privilege_type, is_grantable)
      WHERE relation_acl.grantee = runtime_role_oid
    ) OR (SELECT count(*) FROM pg_catalog.pg_namespace AS namespace_row
          CROSS JOIN LATERAL pg_catalog.aclexplode(
            COALESCE(namespace_row.nspacl, pg_catalog.acldefault('n'::pg_catalog."char", namespace_row.nspowner))
          ) AS namespace_acl(grantor, grantee, privilege_type, is_grantable)
          WHERE namespace_row.nspname = 'public'
            AND namespace_acl.grantee = runtime_role_oid
            AND namespace_acl.privilege_type = 'USAGE'
            AND NOT namespace_acl.is_grantable) <> 1
    OR EXISTS (
      SELECT 1 FROM pg_catalog.pg_namespace AS namespace_row
      CROSS JOIN LATERAL pg_catalog.aclexplode(
        COALESCE(namespace_row.nspacl, pg_catalog.acldefault('n'::pg_catalog."char", namespace_row.nspowner))
      ) AS namespace_acl(grantor, grantee, privilege_type, is_grantable)
      WHERE namespace_acl.grantee = runtime_role_oid
        AND (namespace_row.nspname <> 'public'
          OR namespace_acl.privilege_type <> 'USAGE'
          OR namespace_acl.is_grantable)
    ) OR (SELECT count(*) FROM pg_catalog.pg_proc AS function_row
          CROSS JOIN LATERAL pg_catalog.aclexplode(
            COALESCE(function_row.proacl, pg_catalog.acldefault('f'::pg_catalog."char", function_row.proowner))
          ) AS function_acl(grantor, grantee, privilege_type, is_grantable)
          WHERE function_acl.grantee = runtime_role_oid
            AND function_acl.privilege_type = 'EXECUTE'
            AND NOT function_acl.is_grantable
            AND function_row.oid IN (
              pg_catalog.to_regprocedure('public.persist_affiliate_creator_authorization(uuid,uuid,int8,int8,text,text,int2,text[],timestamptz,timestamptz,timestamptz,int2,text,text,int2,text,text,text,int2,text,text,int2,text,text,text)'),
              pg_catalog.to_regprocedure('public.replace_affiliate_creator_credentials_after_refresh(uuid,uuid,int8,int8,text,text[],timestamptz,timestamptz,timestamptz,int2,text,text,int2,text,text,text,int2,text,text,int2,text,text,text)'),
              pg_catalog.to_regprocedure('public.mark_affiliate_creator_refresh_invalid(uuid,uuid,int8,int8,timestamptz)'),
              pg_catalog.to_regprocedure('public.deauthorize_affiliate_creator_connection(uuid,uuid,int8,int8,timestamptz)')
            )) <> 4
    OR EXISTS (
      SELECT 1 FROM pg_catalog.pg_proc AS function_row
      CROSS JOIN LATERAL pg_catalog.aclexplode(
        COALESCE(function_row.proacl, pg_catalog.acldefault('f'::pg_catalog."char", function_row.proowner))
      ) AS function_acl(grantor, grantee, privilege_type, is_grantable)
      WHERE function_acl.grantee = runtime_role_oid
        AND (function_acl.privilege_type <> 'EXECUTE'
          OR function_acl.is_grantable
          OR function_row.oid NOT IN (
            pg_catalog.to_regprocedure('public.persist_affiliate_creator_authorization(uuid,uuid,int8,int8,text,text,int2,text[],timestamptz,timestamptz,timestamptz,int2,text,text,int2,text,text,text,int2,text,text,int2,text,text,text)'),
            pg_catalog.to_regprocedure('public.replace_affiliate_creator_credentials_after_refresh(uuid,uuid,int8,int8,text,text[],timestamptz,timestamptz,timestamptz,int2,text,text,int2,text,text,text,int2,text,text,int2,text,text,text)'),
            pg_catalog.to_regprocedure('public.mark_affiliate_creator_refresh_invalid(uuid,uuid,int8,int8,timestamptz)'),
            pg_catalog.to_regprocedure('public.deauthorize_affiliate_creator_connection(uuid,uuid,int8,int8,timestamptz)')
          ))
    ) OR EXISTS (
      SELECT 1 FROM pg_catalog.pg_proc AS function_row
      CROSS JOIN LATERAL pg_catalog.aclexplode(
        COALESCE(function_row.proacl, pg_catalog.acldefault('f'::pg_catalog."char", function_row.proowner))
      ) AS function_acl(grantor, grantee, privilege_type, is_grantable)
      WHERE function_row.oid = 'public.erase_affiliate_creator_control_data(uuid,text,text)'::pg_catalog.regprocedure
        AND function_acl.grantee = runtime_role_oid
        AND function_acl.privilege_type = 'EXECUTE'
    ) OR EXISTS (
      SELECT 1 FROM pg_catalog.pg_namespace AS namespace_row
      CROSS JOIN LATERAL pg_catalog.aclexplode(
        COALESCE(namespace_row.nspacl, pg_catalog.acldefault('n'::pg_catalog."char", namespace_row.nspowner))
      ) AS namespace_acl(grantor, grantee, privilege_type, is_grantable)
      WHERE namespace_row.nspname = 'public'
        AND namespace_acl.grantee = 0
        AND namespace_acl.privilege_type = 'CREATE'
    ) THEN
    RAISE EXCEPTION 'affiliate_creator_runtime_privilege_postcheck_failed';
  END IF;
END;
$runtime_privilege_postcheck$;

COMMIT;
