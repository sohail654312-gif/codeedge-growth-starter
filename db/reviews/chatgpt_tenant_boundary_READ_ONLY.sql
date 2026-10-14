-- INDEPENDENT TENANT QA: READ-ONLY METADATA ONLY.
-- Target: codeedge-growth-starter-staging (dbppeymhsemvghbvuvof).
-- NO application rows, Auth users/sessions, credentials, SET ROLE or DDL.
-- Not a certification of Data API exposure or hosted signed-user isolation.
WITH tab AS (
 SELECT c.relname AS name, c.relrowsecurity AS rls, c.relforcerowsecurity AS "forceRls"
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='growth_starter' AND c.relkind IN ('r','p')
), pol AS (
 SELECT tablename AS "table", policyname AS name, cmd,
   roles::text AS roles, qual
 FROM pg_policies WHERE schemaname='growth_starter'
), fn AS (
 SELECT p.proname AS name,p.prosecdef AS "securityDefiner",
   pg_get_userbyid(p.proowner) AS owner,
   has_function_privilege('growth_starter_reader',p.oid,'EXECUTE') AS "readerExecute",
   has_function_privilege('authenticated',p.oid,'EXECUTE') AS "authenticatedExecute",
   has_function_privilege('anon',p.oid,'EXECUTE') AS "anonExecute"
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='growth_starter'
)
SELECT jsonb_build_object(
 'tables',(SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.name),'[]'::jsonb) FROM tab t),
 'policies',(SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p."table",p.name),'[]'::jsonb) FROM pol p),
 'legacyFunctions',(SELECT COALESCE(jsonb_agg(to_jsonb(f) ORDER BY f.name),'[]'::jsonb) FROM fn f),
 'authenticatedSchemaUsage',has_schema_privilege('authenticated','growth_starter','USAGE'),
 'authenticatedColumnSelectCount',(SELECT count(*)::int FROM information_schema.column_privileges
  WHERE table_schema='growth_starter' AND grantee='authenticated' AND privilege_type='SELECT'),
 'runtimeCanSetLegacyReader',pg_has_role('growth_starter_runtime','growth_starter_reader','SET'),
 'privateSchemaPresent',to_regnamespace('growth_starter_private') IS NOT NULL,
 'dashboardExposureVerified',false,
 'signedHostedTenantTestsPassed',false
) AS snapshot;
