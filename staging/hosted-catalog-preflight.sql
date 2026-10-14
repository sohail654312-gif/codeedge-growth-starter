-- PHASE 3.3C LIVE DATABASE PREFLIGHT: READ ONLY / NO DDL OR DML.
-- Run from an approved Supabase management SQL read-only session (privileged
-- enough to inspect auth counts). Do NOT use a client JWT or expose the output
-- to the frontend. NEVER execute a proposed GRANT/REVOKE from this file.
--
-- This is evidence about current grants and RLS metadata, NOT evidence that
-- PostgREST verified a real JWT or that the server can do immediate revocation.
SELECT
  current_database() AS database_name,
  (SELECT count(*)::integer FROM pg_tables WHERE schemaname='growth_starter') AS growth_starter_tables,
  (SELECT count(*)::integer FROM pg_tables WHERE schemaname='growth_starter' AND rowsecurity) AS rls_enabled_tables,
  (SELECT count(*)::integer FROM pg_policies WHERE schemaname='growth_starter') AS installed_policies,
  (SELECT count(*)::integer FROM auth.users) AS auth_users,
  (SELECT count(*)::integer FROM auth.sessions) AS auth_sessions,
  (SELECT count(*)::integer FROM growth_starter.workspaces) AS workspace_records,
  (SELECT count(*)::integer FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
   WHERE n.nspname='growth_starter' AND p.prosecdef) AS security_definer_functions,
  has_function_privilege('growth_starter_reader',
   'growth_starter.staging_list_workspaces(text)','EXECUTE') AS legacy_reader_can_list_any_actor,
  has_function_privilege('growth_starter_reader',
   'growth_starter.staging_list_requests(text,text,integer)','EXECUTE') AS legacy_reader_can_read_any_actor,
  has_schema_privilege('authenticated','growth_starter','USAGE') AS authenticated_can_use_schema,
  has_any_column_privilege('authenticated','growth_starter.workspaces','SELECT') AS authenticated_can_select_workspace_columns,
  has_any_column_privilege('authenticated','growth_starter.memberships','SELECT') AS authenticated_can_select_membership_columns,
  has_any_column_privilege('authenticated','growth_starter.work_requests','SELECT') AS authenticated_can_select_request_columns,
  (SELECT count(*)::integer FROM pg_roles
   WHERE rolname IN ('growth_starter_reader','growth_starter_runtime') AND rolcanlogin) AS restricted_roles_with_login;
-- For a reviewed replacement, verify actual policy *expressions* separately
-- from pg_policies and test as real Auth users; policy count alone proves nothing.
-- A SQL claim set_config() test alone does not cryptographically validate JWTs.
