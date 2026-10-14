-- PHASE 3.15K — READ ONLY post-provision review (no secrets/user rows).
SELECT
 (SELECT count(*)::int FROM pg_roles WHERE rolname IN
  ('gs315k_gateway','gs315k_read_owner','gs315k_revoke_owner')
   AND NOT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls) AS safe_roles,
 to_regclass('growth_starter_private.codeedge_sessions') IS NOT NULL AS sessions_exist,
 to_regclass('growth_starter_private.fresh_login_flows') IS NOT NULL AS flows_exist,
 has_table_privilege('gs315k_gateway','growth_starter_private.codeedge_sessions','SELECT') AS gateway_session_table_read,
 has_table_privilege('gs315k_gateway','growth_starter.work_requests','SELECT') AS gateway_business_table_read,
 has_function_privilege('gs315k_gateway',
  'growth_starter_private.read_requests(text,text,integer)','EXECUTE') AS gateway_can_read_function,
 has_function_privilege('gs315k_gateway',
  'growth_starter_private.revoke_session(text)','EXECUTE') AS gateway_can_revoke_function,
 has_function_privilege('authenticated',
  'growth_starter_private.read_requests(text,text,integer)','EXECUTE') AS authenticated_function_execute,
 has_function_privilege('anon',
  'growth_starter_private.read_requests(text,text,integer)','EXECUTE') AS anonymous_function_execute,
 (SELECT count(*)::int FROM pg_policies WHERE schemaname='growth_starter_private') AS private_policies,
 (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='growth_starter_private' AND p.prosecdef
  AND pg_get_userbyid(p.proowner) IN('gs315k_read_owner','gs315k_revoke_owner')) AS owned_definer_functions;
