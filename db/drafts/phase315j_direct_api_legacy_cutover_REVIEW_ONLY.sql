-- PHASE 3.15J — REVIEW-ONLY POST-REPLACEMENT CUTOVER, DO NOT APPLY.
-- Intended target ONLY codeedge-growth-starter-staging / dbppeymhsemvghbvuvof.
-- May disable the original staging gateway. No automatic hosted execution.
-- Statements are transaction-neutral: the authorized operator MUST wrap
-- BEGIN; snapshot ACLs; run these statements; run assertions; COMMIT/ROLLBACK.
-- Prerequisites: signed fictional A/B/C through replacement passed,
-- Data API exposed-schema configuration independently inspected, owner signed
-- exact migration approval, independent security review and backup verified.
--
-- Table-level REVOKE alone does NOT revoke column-level SELECT privileges.
-- Explicit column revocation below is essential to eliminate bypass.

REVOKE SELECT(id,owner_user_id,state)
  ON growth_starter.workspaces FROM authenticated;
REVOKE SELECT(workspace_id,user_id,owner_user_id,role,state)
  ON growth_starter.memberships FROM authenticated;
REVOKE SELECT(id,workspace_id,title,kind,status,version,updated_at)
  ON growth_starter.work_requests FROM authenticated;

REVOKE SELECT ON TABLE growth_starter.workspaces,
  growth_starter.memberships,growth_starter.work_requests
  FROM authenticated,anon,service_role;
REVOKE USAGE ON SCHEMA growth_starter FROM authenticated,anon,service_role;

-- Eliminate the old caller-supplied-actor routines. Never leave a direct REST
-- route to a postgres-owned SECURITY DEFINER accepting untrusted identity.
REVOKE ALL ON FUNCTION growth_starter.staging_list_workspaces(text)
  FROM PUBLIC,anon,authenticated,service_role,
  growth_starter_reader,growth_starter_runtime;
REVOKE ALL ON FUNCTION growth_starter.staging_list_requests(text,text,integer)
  FROM PUBLIC,anon,authenticated,service_role,
  growth_starter_reader,growth_starter_runtime;
REVOKE ALL ON FUNCTION growth_starter.staging_session_active(text,text,text)
  FROM PUBLIC,anon,authenticated,service_role,
  growth_starter_reader,growth_starter_runtime;
REVOKE growth_starter_reader FROM growth_starter_runtime;

-- Additional required hosted action OUTSIDE SQL:
-- Dashboard -> Data API -> Exposed schemas: remove growth_starter only after
-- checking legitimate dependencies (or disable Data API if safe).
-- Do NOT assume pgrst.db_schemas in a SQL editor reflects this setting.
-- These REVOKEs do not themselves certify Dashboard, GraphQL, Storage or
-- JWT expiration behavior. Negative tests with real signed fictional users
-- are mandatory after applying the approved cutover.
