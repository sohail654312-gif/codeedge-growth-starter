-- PHASE 3.15K — SECURITY-FIRST RECOVERY DRAFT. DO NOT APPLY UNREVIEWED.
-- Fail closed after gateway/hosted acceptance failure. No restoration of the
-- unsafe legacy actor-definer functions or authenticated column grants.
-- DO NOT DROP PRIVATE SESSION TABLES WHILE TEST SESSIONS EXIST.
-- This is deliberately a non-destructive lockdown, not full DDL reversal.
BEGIN;
REVOKE EXECUTE ON FUNCTION growth_starter_private.read_requests(text,text,integer)
 FROM gs315k_gateway;
REVOKE EXECUTE ON FUNCTION growth_starter_private.revoke_session(text)
 FROM gs315k_gateway;
REVOKE USAGE ON SCHEMA growth_starter_private FROM gs315k_gateway;
ALTER ROLE gs315k_gateway NOLOGIN;
-- Hosted ingress must be disabled separately and connections terminated
-- through an independently approved operational procedure.
COMMIT;
