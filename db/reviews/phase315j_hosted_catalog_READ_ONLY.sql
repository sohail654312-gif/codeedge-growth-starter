-- PHASE 3.15J — READ ONLY, hosted staging catalog snapshot.
-- Captures no passwords, session tokens or private customer rows.
-- Null local PostgREST GUC does NOT prove effective exposed schemas.
SELECT
 (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n
  ON n.oid=c.relnamespace
  WHERE n.nspname='growth_starter' AND c.relkind IN('r','p') AND c.relrowsecurity
 ) AS rls_tables,
 (SELECT count(*)::int FROM pg_policies WHERE schemaname='growth_starter') AS policies,
 has_schema_privilege('authenticated','growth_starter','USAGE') AS authenticated_schema_usage,
 has_column_privilege('authenticated','growth_starter.workspaces','id','SELECT') AS authenticated_workspace_column,
 has_column_privilege('authenticated','growth_starter.memberships','user_id','SELECT') AS authenticated_membership_column,
 has_column_privilege('authenticated','growth_starter.work_requests','title','SELECT') AS authenticated_request_column,
 pg_has_role('growth_starter_runtime','growth_starter_reader','SET') AS runtime_can_set_old_reader,
 (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='growth_starter'
   AND p.proname IN('staging_list_workspaces','staging_list_requests','staging_session_active')
   AND p.prosecdef AND has_function_privilege('growth_starter_reader',p.oid,'EXECUTE')
 ) AS old_privileged_functions,
 (SELECT count(*)::int FROM information_schema.column_privileges
  WHERE table_schema='growth_starter' AND grantee='authenticated'
    AND privilege_type='SELECT') AS authenticated_column_grant_rows,
 (SELECT coalesce(json_agg(json_build_object(
    'table',tablename,'name',policyname,'roles',roles,'qual',qual)), '[]'::json)
  FROM pg_policies WHERE schemaname='growth_starter') AS rls_predicates,
 current_setting('pgrst.db_schemas',true) AS local_postgrest_schema_setting;
