-- Phase 2.2 staging defense-in-depth: enable RLS with NO policies.
-- Do not execute against Business OS, MVP, Finance Suite or production.
-- Database owners and SECURITY DEFINER functions may still bypass RLS;
-- privileged server connections and the gateway identity boundary need review.
BEGIN;
ALTER TABLE growth_starter.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_starter.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_starter.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_starter.work_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_starter.media ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_starter.media_delete_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_starter.audit_events ENABLE ROW LEVEL SECURITY;
-- No USING, WITH CHECK, public, anon, authenticated or service_role policy/grant.
COMMIT;
