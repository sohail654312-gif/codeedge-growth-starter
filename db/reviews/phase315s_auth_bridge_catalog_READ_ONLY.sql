-- Phase 3.15S Auth bridge catalog inspection ONLY. No Auth rows, tokens or secrets.
-- Run on an explicitly approved target with read-only catalog access; no hosted
-- access, project identity, exposed-schema setting or provider lifecycle is proved.
-- A PASS is a necessary source/SQL privilege condition, NOT production acceptance.
BEGIN TRANSACTION READ ONLY;
WITH bridge AS (
 SELECT p.oid, p.proowner, p.prosecdef, p.proconfig, p.proacl,
        n.oid AS schema_oid, n.nspacl, n.nspowner
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE p.oid=to_regprocedure('growth_starter_auth_bridge.exact_pair_snapshot(uuid,uuid)')
   AND n.nspname='growth_starter_auth_bridge'
), checker AS (
 SELECT * FROM pg_roles WHERE rolname='growth_starter_session_checker'
), api AS (
 SELECT oid,rolname FROM pg_roles
 WHERE rolname IN ('anon','authenticated','service_role','authenticator')
), auth_objs AS (
 SELECT to_regnamespace('auth') AS schema_oid,
        to_regclass('auth.sessions') AS sessions_oid,
        to_regclass('auth.users') AS users_oid
), facts AS (
 SELECT
  EXISTS(SELECT 1 FROM bridge) AS bridge_exists,
  EXISTS(SELECT 1 FROM checker) AS checker_exists,
  (SELECT count(*)=4 FROM api) AS api_roles_exist,
  (SELECT schema_oid IS NOT NULL AND sessions_oid IS NOT NULL
          AND users_oid IS NOT NULL FROM auth_objs) AS auth_objects_exist,
  COALESCE((SELECT NOT rolcanlogin AND NOT rolinherit AND NOT rolsuper
      AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb
      AND NOT rolreplication FROM checker),false) AS checker_restricted,
  COALESCE((SELECT prosecdef FROM bridge),false) AS security_definer,
  COALESCE((SELECT EXISTS(SELECT 1 FROM unnest(proconfig) AS cfg
      WHERE cfg IN ('search_path=','search_path=""')) FROM bridge),false) AS empty_search_path,
  COALESCE((SELECT has_schema_privilege(b.proowner,a.schema_oid,'USAGE')
      AND has_table_privilege(b.proowner,a.sessions_oid,'SELECT')
      AND has_table_privilege(b.proowner,a.users_oid,'SELECT')
      FROM bridge b CROSS JOIN auth_objs a),false) AS owner_can_read_auth,
  NOT EXISTS(SELECT 1 FROM bridge b CROSS JOIN checker c
      WHERE b.proowner=c.oid) AS owner_not_checker,
  NOT EXISTS(SELECT 1 FROM api a CROSS JOIN bridge b
      WHERE a.oid=b.proowner OR pg_has_role(a.oid,b.proowner,'USAGE')
      OR pg_has_role(a.oid,b.proowner,'SET')) AS owner_not_api_reachable,
  COALESCE((SELECT has_schema_privilege(c.oid,b.schema_oid,'USAGE')
      AND has_function_privilege(c.oid,b.oid,'EXECUTE')
      FROM checker c CROSS JOIN bridge b),false) AS checker_has_narrow_access,
  COALESCE((SELECT NOT has_schema_privilege(c.oid,a.schema_oid,'USAGE')
      AND NOT has_table_privilege(c.oid,a.sessions_oid,'SELECT')
      AND NOT has_table_privilege(c.oid,a.users_oid,'SELECT')
      FROM checker c CROSS JOIN auth_objs a),false) AS checker_no_raw_auth,
  NOT EXISTS(SELECT 1 FROM api a CROSS JOIN checker c
      WHERE pg_has_role(a.oid,c.oid,'USAGE') OR pg_has_role(a.oid,c.oid,'SET'))
      AS checker_not_api_reachable,
  NOT EXISTS(SELECT 1 FROM api a CROSS JOIN bridge b
      WHERE has_schema_privilege(a.oid,b.schema_oid,'USAGE')
         OR has_function_privilege(a.oid,b.oid,'EXECUTE')) AS api_no_bridge_access,
  NOT EXISTS(SELECT 1 FROM bridge b,
      LATERAL aclexplode(COALESCE(b.nspacl,acldefault('n',b.nspowner))) acl
      WHERE acl.grantee=0 AND acl.privilege_type='USAGE') AS public_no_schema_usage,
  NOT EXISTS(SELECT 1 FROM bridge b,
      LATERAL aclexplode(COALESCE(b.proacl,acldefault('f',b.proowner))) acl
      WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE') AS public_no_function_execute
), checks AS (
 SELECT v.name,COALESCE(v.ok,false) AS ok
 FROM facts f CROSS JOIN LATERAL (VALUES
  ('bridge_exists',f.bridge_exists),
  ('checker_exists',f.checker_exists),
  ('api_roles_exist',f.api_roles_exist),
  ('auth_objects_exist',f.auth_objects_exist),
  ('checker_restricted',f.checker_restricted),
  ('security_definer',f.security_definer),
  ('empty_search_path',f.empty_search_path),
  ('owner_can_read_auth',f.owner_can_read_auth),
  ('owner_not_checker',f.owner_not_checker),
  ('owner_not_api_reachable',f.owner_not_api_reachable),
  ('checker_has_narrow_access',f.checker_has_narrow_access),
  ('checker_no_raw_auth',f.checker_no_raw_auth),
  ('checker_not_api_reachable',f.checker_not_api_reachable),
  ('api_no_bridge_access',f.api_no_bridge_access),
  ('public_no_schema_usage',f.public_no_schema_usage),
  ('public_no_function_execute',f.public_no_function_execute)
 ) AS v(name,ok)
)
SELECT jsonb_build_object(
 'schemaVersion',1,
 'snapshotKind','growth_starter_auth_bridge_catalog_read_only',
 'bridgeOwner',(SELECT r.rolname FROM bridge b JOIN pg_roles r ON r.oid=b.proowner),
 'checksPassed',(SELECT bool_and(ok) FROM checks),
 'failedChecks',(SELECT COALESCE(jsonb_agg(name ORDER BY name)
    FILTER (WHERE NOT ok),'[]'::jsonb) FROM checks)
) AS snapshot;
COMMIT;
