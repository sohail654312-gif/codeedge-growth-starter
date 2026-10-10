-- PHASE 3.0 CUTOVER REVIEW DRAFT. NOT a live migration.
-- Deliberately removes legacy postgres-owned SECURITY DEFINER entry points
-- from the restricted reader role. Existing gateway would STOP WORKING if
-- applied before a vetted replacement. Do not apply to hosted staging yet.
-- Statements are intentionally transaction-neutral so disposable acceptance
-- can wrap them in BEGIN / ROLLBACK. A future operator must wrap explicitly.
REVOKE ALL ON FUNCTION growth_starter.staging_list_workspaces(text)
  FROM PUBLIC, growth_starter_reader, growth_starter_runtime;
REVOKE ALL ON FUNCTION growth_starter.staging_list_requests(text,text,integer)
  FROM PUBLIC, growth_starter_reader, growth_starter_runtime;
DO $cutover$
BEGIN
  IF to_regprocedure('growth_starter.staging_session_active(text,text,text)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION growth_starter.staging_session_active(text,text,text)
      FROM PUBLIC, growth_starter_reader, growth_starter_runtime';
  END IF;
END $cutover$;
-- A future verified Supabase/PostgREST JWT + RLS path must be independently
-- authenticated and session-revocation-tested, not trusted based on PG GUCs.

-- Phase 3.5 review-only correction: NOINHERIT does not prevent SET ROLE.
-- Transactional privilege cutover MUST also remove the role-switch edge.
-- Apply only after the secure replacement has been accepted.
REVOKE growth_starter_reader FROM growth_starter_runtime;
