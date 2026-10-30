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
  -- Any incoming owner-role grant can let a non-API member SET ROLE to the
  -- SECURITY DEFINER owner. A direct incoming edge also covers indirect paths.
  -- No owner-role memberships are approved in this review-only catalog.
  NOT EXISTS(SELECT 1 FROM pg_auth_members m JOIN bridge b ON m.roleid=b.proowner)
      AS owner_has_no_members,
  -- A separate namespace owner can change private-schema DDL and grants.
  -- This review-only bridge requires one vetted owner for schema and function.
  COALESCE((SELECT b.nspowner=b.proowner FROM bridge b),false)
      AS schema_owner_matches_function_owner,
  COALESCE((SELECT has_schema_privilege(c.oid,b.schema_oid,'USAGE')
      AND has_function_privilege(c.oid,b.oid,'EXECUTE')
      FROM checker c CROSS JOIN bridge b),false) AS checker_has_narrow_access,
  COALESCE((SELECT NOT has_schema_privilege(c.oid,a.schema_oid,'USAGE')
      AND NOT has_table_privilege(c.oid,a.sessions_oid,'SELECT')
      AND NOT has_table_privilege(c.oid,a.users_oid,'SELECT')
      AND NOT EXISTS(SELECT 1 FROM pg_attribute col
          WHERE col.attrelid IN (a.sessions_oid,a.users_oid)
            AND col.attnum>0 AND NOT col.attisdropped
            AND has_column_privilege(c.oid,col.attrelid,col.attnum,'SELECT'))
      FROM checker c CROSS JOIN auth_objs a),false) AS checker_no_raw_auth,
  -- NOLOGIN/NOINHERIT and denial of SELECT do not prohibit direct Auth writes.
  -- Fail closed on Auth namespace CREATE, relation DML/DDL privileges, and
  -- column-level INSERT/UPDATE/REFERENCES (which table checks can miss).
  (NOT EXISTS(SELECT 1 FROM checker c CROSS JOIN auth_objs a
      WHERE has_schema_privilege(c.oid,a.schema_oid,'CREATE'))
   AND NOT EXISTS(SELECT 1 FROM checker c
      JOIN pg_namespace n ON n.nspname='auth'
      JOIN pg_class rel ON rel.relnamespace=n.oid
      WHERE rel.relkind IN ('r','p','v','f','m')
        AND (has_table_privilege(c.oid,rel.oid,'INSERT')
          OR has_table_privilege(c.oid,rel.oid,'UPDATE')
          OR has_table_privilege(c.oid,rel.oid,'DELETE')
          OR has_table_privilege(c.oid,rel.oid,'TRUNCATE')
          OR has_table_privilege(c.oid,rel.oid,'REFERENCES')
          OR has_table_privilege(c.oid,rel.oid,'TRIGGER')))
   AND NOT EXISTS(SELECT 1 FROM checker c
      JOIN pg_namespace n ON n.nspname='auth'
      JOIN pg_class rel ON rel.relnamespace=n.oid
      JOIN pg_attribute col ON col.attrelid=rel.oid
      WHERE rel.relkind IN ('r','p','v','f','m')
        AND col.attnum>0 AND NOT col.attisdropped
        AND (has_column_privilege(c.oid,rel.oid,col.attnum,'INSERT')
          OR has_column_privilege(c.oid,rel.oid,col.attnum,'UPDATE')
          OR has_column_privilege(c.oid,rel.oid,col.attnum,'REFERENCES'))))
      AS checker_no_auth_write,
  NOT EXISTS(SELECT 1 FROM api a CROSS JOIN checker c
      WHERE pg_has_role(a.oid,c.oid,'USAGE') OR pg_has_role(a.oid,c.oid,'SET'))
      AS checker_not_api_reachable,
  -- NOINHERIT on the checker does not prevent a member role from SET ROLE.
  -- Until a separately reviewed runtime role is approved, no membership is safe.
  NOT EXISTS(SELECT 1 FROM pg_auth_members m JOIN checker c ON m.roleid=c.oid)
      AS checker_has_no_members,
  -- NOINHERIT does not prevent SET ROLE to a parent role. A checker granted
  -- membership in an Auth-reading role could assume its privileges.
  -- No outgoing checker memberships are approved in this review-only design.
  NOT EXISTS(SELECT 1 FROM pg_auth_members m JOIN checker c ON m.member=c.oid)
      AS checker_has_no_parent_roles,
  NOT EXISTS(SELECT 1 FROM api a CROSS JOIN bridge b
      WHERE has_schema_privilege(a.oid,b.schema_oid,'USAGE')
         OR has_function_privilege(a.oid,b.oid,'EXECUTE')) AS api_no_bridge_access,
  -- A non-API role must not receive a separate route to the private bridge.
  NOT EXISTS(SELECT 1 FROM bridge b CROSS JOIN checker c
      CROSS JOIN LATERAL aclexplode(COALESCE(b.nspacl,acldefault('n',b.nspowner))) acl
      WHERE acl.privilege_type='USAGE'
        AND acl.grantee NOT IN (b.nspowner,c.oid)) AS schema_acl_restricted,
  -- CREATE on the private namespace lets a non-owner introduce objects even
  -- without USAGE. Only the vetted schema owner may hold CREATE authority.
  NOT EXISTS(SELECT 1 FROM bridge b
      CROSS JOIN LATERAL aclexplode(COALESCE(b.nspacl,acldefault('n',b.nspowner))) acl
      WHERE acl.privilege_type='CREATE' AND acl.grantee<>b.nspowner)
      AS schema_no_external_create,
  -- The checker has schema USAGE; an extra SECURITY DEFINER routine
  -- can inherit PUBLIC EXECUTE and expose Auth data without changing the
  -- reviewed exact-pair function's ACL. Only that exact routine is approved.
  NOT EXISTS(SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='growth_starter_auth_bridge'
        AND p.oid IS DISTINCT FROM
            to_regprocedure('growth_starter_auth_bridge.exact_pair_snapshot(uuid,uuid)'))
      AS schema_only_expected_routine,
  -- A definer-owned view can read Auth as its owner, then expose rows to
  -- the checker through a direct SELECT grant. No relation belongs here.
  NOT EXISTS(SELECT 1 FROM pg_class rel
      JOIN pg_namespace n ON n.oid=rel.relnamespace
      WHERE n.nspname='growth_starter_auth_bridge')
      AS schema_no_unreviewed_relations,
  NOT EXISTS(SELECT 1 FROM bridge b CROSS JOIN checker c
      CROSS JOIN LATERAL aclexplode(COALESCE(b.proacl,acldefault('f',b.proowner))) acl
      WHERE acl.privilege_type='EXECUTE'
        AND acl.grantee NOT IN (b.proowner,c.oid)) AS function_acl_restricted,
  -- The checker may call the function but must not delegate its authority.
  (NOT EXISTS(SELECT 1 FROM bridge b CROSS JOIN checker c
      CROSS JOIN LATERAL aclexplode(COALESCE(b.nspacl,acldefault('n',b.nspowner))) acl
      WHERE acl.grantee=c.oid AND acl.is_grantable)
   AND NOT EXISTS(SELECT 1 FROM bridge b CROSS JOIN checker c
      CROSS JOIN LATERAL aclexplode(COALESCE(b.proacl,acldefault('f',b.proowner))) acl
      WHERE acl.grantee=c.oid AND acl.is_grantable)) AS checker_no_grant_option,
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
  ('owner_has_no_members',f.owner_has_no_members),
  ('schema_owner_matches_function_owner',f.schema_owner_matches_function_owner),
  ('checker_has_narrow_access',f.checker_has_narrow_access),
  ('checker_no_raw_auth',f.checker_no_raw_auth),
  ('checker_no_auth_write',f.checker_no_auth_write),
  ('checker_not_api_reachable',f.checker_not_api_reachable),
  ('checker_has_no_members',f.checker_has_no_members),
  ('checker_has_no_parent_roles',f.checker_has_no_parent_roles),
  ('api_no_bridge_access',f.api_no_bridge_access),
  ('schema_acl_restricted',f.schema_acl_restricted),
  ('schema_no_external_create',f.schema_no_external_create),
  ('schema_only_expected_routine',f.schema_only_expected_routine),
  ('schema_no_unreviewed_relations',f.schema_no_unreviewed_relations),
  ('function_acl_restricted',f.function_acl_restricted),
  ('checker_no_grant_option',f.checker_no_grant_option),
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
