-- REVIEW ONLY. DO NOT APPLY to hosted Supabase without explicit owner
-- approval and an independent assessment of protected auth schema grants.
-- Externally unreachable, dedicated PostgreSQL LOGIN for immediate session
-- revocation proof. No password or login enabled by this file.
-- The owner must approve secret manager injection and ALTER ROLE LOGIN
-- separately; never grant this role to app/browser/PostgREST/public.
DO $role$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='growth_starter_session_checker') THEN
  CREATE ROLE growth_starter_session_checker NOLOGIN NOINHERIT NOCREATEDB
   NOCREATEROLE NOSUPERUSER NOBYPASSRLS;
 END IF;
END $role$;
REVOKE ALL ON SCHEMA growth_starter FROM growth_starter_session_checker;
GRANT USAGE ON SCHEMA auth TO growth_starter_session_checker;
GRANT SELECT(id,user_id,not_after) ON auth.sessions TO growth_starter_session_checker;
GRANT SELECT(id,deleted_at,banned_until) ON auth.users TO growth_starter_session_checker;
-- No full-table SELECT on auth.sessions or auth.users; never grant write,
-- SECURITY DEFINER EXECUTE, growth_starter table access or SET ROLE.
-- Before enabling LOGIN, run independent privilege audit.
