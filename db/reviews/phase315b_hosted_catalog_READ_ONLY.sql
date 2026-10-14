-- Phase 3.15B: READ-ONLY provider compatibility inspection.
-- Only run on codeedge-growth-starter-staging. No usernames, sessions,
-- passwords, patient data, tokens, role edits, DDL, or privilege changes.
-- SQL readback cannot determine the Dashboard's effective Data API exposure.
SELECT
 (SELECT rolcanlogin FROM pg_roles WHERE rolname='growth_starter_session_checker') AS checker_login,
 has_schema_privilege('growth_starter_session_checker','auth','USAGE') AS checker_auth_schema,
 (SELECT count(*)::integer FROM
  (VALUES ('auth.sessions','id'),('auth.sessions','user_id'),
   ('auth.sessions','not_after'),('auth.users','id'),
   ('auth.users','banned_until'),('auth.users','deleted_at')) AS c(tab,col)
  WHERE has_column_privilege('growth_starter_session_checker',c.tab,c.col,'SELECT')
 ) AS checker_required_auth_columns,
 has_table_privilege('growth_starter_session_checker','auth.sessions','SELECT') AS checker_full_sessions_select,
 has_table_privilege('growth_starter_session_checker','auth.users','SELECT') AS checker_full_users_select,
 pg_has_role('growth_starter_session_checker','growth_starter_reader','SET') AS checker_can_set_reader,
 pg_has_role('growth_starter_runtime','growth_starter_reader','SET') AS runtime_can_set_reader,
 (SELECT count(*)::integer
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='growth_starter'
    AND p.proname IN ('staging_list_workspaces','staging_list_requests','staging_session_active')
    AND p.prosecdef
    AND has_function_privilege('growth_starter_reader',p.oid,'EXECUTE')
 ) AS privileged_legacy_paths,
 (SELECT count(*)::integer FROM pg_policies WHERE schemaname='growth_starter') AS policy_count,
 (SELECT count(*)::integer FROM pg_class c
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='growth_starter'
    AND c.relkind IN ('r','p') AND c.relrowsecurity
 ) AS rls_table_count,
 current_setting('pgrst.db_schemas',true) AS pgrst_exposed_schemas_guc;
