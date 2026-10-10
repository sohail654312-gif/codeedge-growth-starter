-- Growth Starter Phase 2.3: PREPARE an isolated PostgreSQL gateway principal.
-- This principal is intentionally NOLOGIN (and has NO PASSWORD).
-- The eventual application password/SSL setup MUST be done through a
-- dedicated backend secret-entry path, never from GitHub SQL/CI/logs.
BEGIN;
DO $body$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='growth_starter_runtime') THEN
    CREATE ROLE growth_starter_runtime NOLOGIN NOINHERIT NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname='growth_starter_runtime' AND rolcanlogin=false AND rolsuper=false
      AND rolbypassrls=false AND rolinherit=false
      AND rolcreatedb=false AND rolcreaterole=false AND rolreplication=false
  ) THEN
    RAISE EXCEPTION 'Restricted runtime role privileges differ from required NOLOGIN profile.';
  END IF;
END $body$;
-- In Postgres 16+ role grants have INHERIT / SET options.
-- postgres is an ADMIN (but not a SET member) of growth_starter_reader.
-- Do NOT enable SET for postgres, and do not grant direct table access.
GRANT growth_starter_reader TO growth_starter_runtime
  WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;
REVOKE ALL ON SCHEMA growth_starter FROM growth_starter_runtime;
REVOKE ALL ON ALL TABLES IN SCHEMA growth_starter FROM growth_starter_runtime;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA growth_starter FROM growth_starter_runtime;
-- No anonymous/authenticated grants, no external login and no public policies.
COMMIT;
