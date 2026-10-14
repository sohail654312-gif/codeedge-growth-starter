-- Phase 3.15F — READ ONLY, catalog-only fictional staging preflight.
-- Run ONLY against Growth Starter staging (dbppeymhsemvghbvuvof).
-- No Auth records, customer rows, secrets, JWT, session values, DDL or DML.
-- The PostgREST GUC is NOT definitive evidence of Dashboard API exposure.
SELECT
 current_setting('server_version') AS postgres_version,
 (SELECT COUNT(*)::integer FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='growth_starter' AND c.relkind IN ('r','p')) AS application_table_count,
 (SELECT COUNT(*)::integer FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='growth_starter' AND c.relkind IN ('r','p')
    AND c.relrowsecurity) AS rls_enabled_table_count,
 (SELECT COUNT(*)::integer FROM pg_policies WHERE schemaname='growth_starter') AS rls_policy_count,
 has_schema_privilege('anon','growth_starter','USAGE') AS anon_growth_schema_access,
 has_schema_privilege('authenticated','growth_starter','USAGE') AS authenticated_growth_schema_access,
 has_schema_privilege('service_role','growth_starter','USAGE') AS service_growth_schema_access,
 has_table_privilege('anon','growth_starter.work_requests','SELECT') AS anon_can_select_work_requests,
 has_table_privilege('authenticated','growth_starter.work_requests','SELECT') AS auth_role_full_work_requests_select,
 has_column_privilege('authenticated','growth_starter.work_requests','title','SELECT') AS auth_role_title_select,
 has_schema_privilege('growth_starter_session_checker','auth','USAGE') AS checker_auth_schema_access,
 (SELECT rolcanlogin FROM pg_roles WHERE rolname='growth_starter_session_checker') AS checker_can_login,
 pg_has_role('growth_starter_runtime','growth_starter_reader','SET') AS runtime_can_set_legacy_reader,
 (SELECT COUNT(*)::integer FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='growth_starter'
    AND p.proname IN ('staging_list_workspaces','staging_list_requests','staging_session_active')
    AND p.prosecdef AND has_function_privilege('growth_starter_reader',p.oid,'EXECUTE')) AS privileged_legacy_function_count,
 (to_regnamespace('growth_starter_private') IS NOT NULL) AS production_private_session_schema_exists,
 current_setting('pgrst.db_schemas',true) AS local_data_api_exposure_guc;
