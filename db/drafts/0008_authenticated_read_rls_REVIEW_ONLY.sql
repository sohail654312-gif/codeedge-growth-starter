-- PHASE 3.2 SECURITY REVIEW DRAFT. NOT AN APPROVED MIGRATION.
-- NEVER APPLY TO HOSTED SUPABASE WITHOUT INDEPENDENT REVIEW + OWNER APPROVAL.
-- Requires Supabase-managed trusted PostgREST JWT context for auth.uid().
-- Bare direct-PostgreSQL GUC claims can be forged: NEVER expose authenticated
-- database role or run this using a direct SQL client for end-user requests.
-- Transaction-neutral so disposable CI can wrap in BEGIN/ROLLBACK.
-- Only READS are granted; approval, invitation and media writes remain denied.
-- Supabase Auth's authenticated/anon roles and auth.uid() must already exist.

ALTER TABLE growth_starter.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_starter.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_starter.work_requests ENABLE ROW LEVEL SECURITY;

-- All three policies use the user identity installed by Supabase PostgREST
-- AFTER validating the bearer JWT. Never use user_metadata or a query actor ID.
-- Membership policy references no other RLS table: no RLS recursion.
CREATE POLICY gs32_membership_self_read ON growth_starter.memberships
 FOR SELECT TO authenticated
 USING (
   (SELECT auth.uid()) IS NOT NULL
   AND state = 'active'
   AND user_id = (SELECT auth.uid())::text
 );

CREATE POLICY gs32_active_workspace_read ON growth_starter.workspaces
 FOR SELECT TO authenticated
 USING (
   (SELECT auth.uid()) IS NOT NULL
   AND state = 'active'
   AND (
     owner_user_id = (SELECT auth.uid())::text
     OR EXISTS (
       SELECT 1 FROM growth_starter.memberships m
       WHERE m.workspace_id = workspaces.id
         AND m.user_id = (SELECT auth.uid())::text
         AND m.owner_user_id = workspaces.owner_user_id
         AND m.state = 'active'
         AND m.role IN ('agency_admin','staff','client')
     )
   )
 );

-- Workspace visibility is computed through its RLS policy. When membership
-- is revoked, the workspace and its requests become invisible immediately.
CREATE POLICY gs32_active_workspace_requests_read ON growth_starter.work_requests
 FOR SELECT TO authenticated
 USING (
   (SELECT auth.uid()) IS NOT NULL
   AND EXISTS (
     SELECT 1 FROM growth_starter.workspaces w
     WHERE w.id = work_requests.workspace_id AND w.state = 'active'
   )
 );

-- Prevent implicit table-wide and future accidental grants. Use column-only
-- SELECT to match the exact Phase 3.1 REST fields. No INSERT/UPDATE/DELETE.
REVOKE ALL ON SCHEMA growth_starter FROM anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA growth_starter FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA growth_starter FROM anon, authenticated;
GRANT USAGE ON SCHEMA growth_starter TO authenticated;
GRANT SELECT (id,owner_user_id,state) ON growth_starter.workspaces TO authenticated;
GRANT SELECT (workspace_id,user_id,owner_user_id,role,state)
 ON growth_starter.memberships TO authenticated;
GRANT SELECT (id,workspace_id,title,kind,status,version,updated_at)
 ON growth_starter.work_requests TO authenticated;

-- NO grants to anon, PUBLIC, reader/runtime, service_role or browser for
-- media, audit, invitations, delete outbox, report drafts or privileged SQL.
-- schema exposure, HTTPS hosting, security cutover: STILL DISABLED.
