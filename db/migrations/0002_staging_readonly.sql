-- Phase 2.2: separate, restricted, read-only staging gateway.
-- Safe only in isolated staging. Does NOT modify existing pilot/production data.
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'growth_starter_reader') THEN
    CREATE ROLE growth_starter_reader NOLOGIN NOINHERIT NOBYPASSRLS;
  END IF;
END $$;

-- Reject inherited/premature table and sequence access for this role.
REVOKE ALL ON SCHEMA growth_starter FROM growth_starter_reader;
REVOKE ALL ON ALL TABLES IN SCHEMA growth_starter FROM growth_starter_reader;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA growth_starter FROM growth_starter_reader;
GRANT USAGE ON SCHEMA growth_starter TO growth_starter_reader;

-- SECURITY DEFINER routines are narrowly scoped read boundaries. Their actor
-- argument MUST be derived from a verified, revocation-checked server session,
-- never from request JSON/query strings. They do not independently verify JWTs.
CREATE OR REPLACE FUNCTION growth_starter.staging_list_workspaces(p_actor text)
RETURNS TABLE(workspace_id text, role text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, growth_starter
AS $function$
 SELECT ws.id, 'owner'::text
 FROM growth_starter.workspaces ws
 WHERE p_actor ~ '^[A-Za-z0-9_-]{8,128}$'
   AND ws.owner_user_id = p_actor AND ws.state='active'
 UNION ALL
 SELECT ws.id, m.role
 FROM growth_starter.memberships m
 JOIN growth_starter.workspaces ws ON ws.id=m.workspace_id
 WHERE p_actor ~ '^[A-Za-z0-9_-]{8,128}$'
   AND m.user_id=p_actor AND m.state='active'
   AND ws.state='active' AND m.owner_user_id=ws.owner_user_id
   AND m.role IN ('agency_admin','staff','client')
 ORDER BY 1
 LIMIT 25
$function$;

CREATE OR REPLACE FUNCTION growth_starter.staging_list_requests(p_actor text, p_workspace text, p_limit integer DEFAULT 20)
RETURNS TABLE(id text, workspace_id text, title text, kind text, status text, version integer, updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, growth_starter
AS $function$
 SELECT r.id, r.workspace_id, r.title, r.kind, r.status, r.version, r.updated_at
 FROM growth_starter.work_requests r
 JOIN growth_starter.workspaces ws ON ws.id=r.workspace_id
 WHERE p_actor ~ '^[A-Za-z0-9_-]{8,128}$'
   AND p_workspace = r.workspace_id
   AND p_limit BETWEEN 1 AND 50
   AND ws.state='active'
   AND (
     ws.owner_user_id=p_actor
     OR EXISTS (
       SELECT 1 FROM growth_starter.memberships m
       WHERE m.workspace_id=ws.id
         AND m.user_id=p_actor AND m.state='active'
         AND m.owner_user_id=ws.owner_user_id
         AND m.role IN ('agency_admin','staff','client')
     )
   )
 ORDER BY r.updated_at DESC, r.id
 LIMIT p_limit
$function$;

REVOKE ALL ON FUNCTION growth_starter.staging_list_workspaces(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION growth_starter.staging_list_requests(text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION growth_starter.staging_list_workspaces(text) TO growth_starter_reader;
GRANT EXECUTE ON FUNCTION growth_starter.staging_list_requests(text,text,integer) TO growth_starter_reader;

-- No CONNECT, LOGIN, schema CREATE, SELECT on arbitrary rows, data writes or
-- migration privilege is granted. A separately provisioned LOGIN role must be
-- made a member of growth_starter_reader by a DB administrator out-of-band.
COMMIT;
