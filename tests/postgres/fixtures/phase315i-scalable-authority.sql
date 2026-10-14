-- Phase 3.15I: DISPOSABLE PostgreSQL 17 fixture. Never deploy to Supabase.
-- Caller is gs315i_gateway LOGIN. NO direct table access or caller actor ID.
-- Two fixed-purpose SECURITY DEFINER routines have different NOLOGIN owners.
BEGIN;
CREATE ROLE gs315i_read_owner NOLOGIN NOINHERIT NOBYPASSRLS NOSUPERUSER
 NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE gs315i_revoke_owner NOLOGIN NOINHERIT NOBYPASSRLS NOSUPERUSER
 NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE SCHEMA gs315i;
REVOKE ALL ON SCHEMA gs315i FROM PUBLIC;
GRANT USAGE ON SCHEMA gs315i TO gs315i_read_owner,gs315i_revoke_owner,gs315i_gateway;
CREATE TABLE gs315i.sessions(
 id uuid PRIMARY KEY,
 user_id text NOT NULL,
 secret_sha256 text NOT NULL CHECK (secret_sha256 ~ '^[0-9a-f]{64}$'),
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz
);
CREATE TABLE gs315i.workspaces(
 id text PRIMARY KEY,
 owner_user_id text NOT NULL,
 state text NOT NULL DEFAULT 'active' CHECK(state IN ('active','suspended'))
);
CREATE TABLE gs315i.memberships(
 workspace_id text NOT NULL REFERENCES gs315i.workspaces(id),
 user_id text NOT NULL,
 owner_user_id text NOT NULL,
 role text NOT NULL CHECK(role IN ('staff','client','agency_admin')),
 state text NOT NULL DEFAULT 'active' CHECK(state IN ('active','revoked')),
 PRIMARY KEY(workspace_id,user_id)
);
CREATE TABLE gs315i.requests(
 id text PRIMARY KEY,
 workspace_id text NOT NULL REFERENCES gs315i.workspaces(id),
 title text NOT NULL,
 confidential_note text NOT NULL DEFAULT 'never-return'
);
REVOKE ALL ON ALL TABLES IN SCHEMA gs315i FROM PUBLIC;
ALTER TABLE gs315i.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gs315i.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE gs315i.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE gs315i.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE gs315i.sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE gs315i.workspaces FORCE ROW LEVEL SECURITY;
ALTER TABLE gs315i.memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE gs315i.requests FORCE ROW LEVEL SECURITY;
GRANT SELECT(id,user_id,secret_sha256,expires_at,revoked_at)
 ON gs315i.sessions TO gs315i_read_owner;
GRANT SELECT(id,owner_user_id,state) ON gs315i.workspaces TO gs315i_read_owner;
GRANT SELECT(workspace_id,user_id,owner_user_id,role,state)
 ON gs315i.memberships TO gs315i_read_owner;
GRANT SELECT(id,workspace_id,title) ON gs315i.requests TO gs315i_read_owner;
GRANT SELECT(id,secret_sha256,revoked_at)
 ON gs315i.sessions TO gs315i_revoke_owner;
GRANT UPDATE(revoked_at) ON gs315i.sessions TO gs315i_revoke_owner;
CREATE POLICY gs315i_read_sessions ON gs315i.sessions
 FOR SELECT TO gs315i_read_owner USING (true);
CREATE POLICY gs315i_revoke_sessions_read ON gs315i.sessions
 FOR SELECT TO gs315i_revoke_owner USING (true);
CREATE POLICY gs315i_revoke_sessions_write ON gs315i.sessions
 FOR UPDATE TO gs315i_revoke_owner USING (true) WITH CHECK(true);
CREATE POLICY gs315i_read_workspaces ON gs315i.workspaces
 FOR SELECT TO gs315i_read_owner USING (true);
CREATE POLICY gs315i_read_memberships ON gs315i.memberships
 FOR SELECT TO gs315i_read_owner USING (true);
CREATE POLICY gs315i_read_requests ON gs315i.requests
 FOR SELECT TO gs315i_read_owner USING (true);

CREATE FUNCTION gs315i.read_requests(p_token text,p_workspace text)
 RETURNS TABLE(request_id text,workspace_id text,title text)
 LANGUAGE plpgsql VOLATILE SECURITY DEFINER
 SET search_path=pg_catalog,pg_temp
 AS $safe$
 DECLARE
  session_id uuid;
  hash_hex text;
  actor_id text;
  owner_id text;
  allowed_member boolean;
 BEGIN
  IF p_token IS NULL OR length(p_token)>128 OR
    p_token !~ '^ce1\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[A-Za-z0-9_-]{43}$'
    OR p_workspace IS NULL OR p_workspace !~ '^ws_[A-Za-z0-9_-]{8,128}$'
  THEN
   RAISE EXCEPTION 'session denied' USING ERRCODE='28000';
  END IF;
  session_id := split_part(p_token,'.',2)::uuid;
  hash_hex := encode(sha256(convert_to(
    'codeedge-growth-starter:session:v1'||chr(0)||session_id::text||chr(0)||
    split_part(p_token,'.',3),'UTF8')),'hex');
  PERFORM pg_advisory_xact_lock_shared(
    hashtextextended('gs315i:session:'||session_id::text,0));
  SELECT s.user_id INTO actor_id
   FROM gs315i.sessions s
   WHERE s.id=session_id AND s.secret_sha256=hash_hex
     AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp();
  IF actor_id IS NULL THEN
   RAISE EXCEPTION 'session denied' USING ERRCODE='28000';
  END IF;
  PERFORM pg_advisory_xact_lock_shared(
   hashtextextended('gs315i:workspace:'||p_workspace,0));
  SELECT ws.owner_user_id INTO owner_id
   FROM gs315i.workspaces ws
   WHERE ws.id=p_workspace AND ws.state='active';
  IF owner_id IS NULL THEN
   RAISE EXCEPTION 'session denied' USING ERRCODE='28000';
  END IF;
  IF actor_id<>owner_id THEN
   PERFORM pg_advisory_xact_lock_shared(
    hashtextextended('gs315i:member:'||p_workspace||':'||actor_id,0));
   SELECT EXISTS(SELECT 1 FROM gs315i.memberships m
    WHERE m.workspace_id=p_workspace AND m.user_id=actor_id
      AND m.owner_user_id=owner_id AND m.state='active'
      AND m.role IN ('agency_admin','staff','client')) INTO allowed_member;
   IF NOT allowed_member THEN
    RAISE EXCEPTION 'session denied' USING ERRCODE='28000';
   END IF;
  END IF;
  RETURN QUERY SELECT r.id,r.workspace_id,r.title
   FROM gs315i.requests r WHERE r.workspace_id=p_workspace
   ORDER BY r.id LIMIT 20;
 END
 $safe$;

CREATE FUNCTION gs315i.revoke_session(p_token text)
 RETURNS boolean
 LANGUAGE plpgsql VOLATILE SECURITY DEFINER
 SET search_path=pg_catalog,pg_temp
 AS $safe$
 DECLARE
  session_id uuid;
  hash_hex text;
  existing_revocation timestamptz;
 BEGIN
  IF p_token IS NULL OR length(p_token)>128 OR
   p_token !~ '^ce1\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[A-Za-z0-9_-]{43}$'
  THEN
   RAISE EXCEPTION 'session denied' USING ERRCODE='28000';
  END IF;
  session_id := split_part(p_token,'.',2)::uuid;
  hash_hex := encode(sha256(convert_to(
    'codeedge-growth-starter:session:v1'||chr(0)||session_id::text||chr(0)||
    split_part(p_token,'.',3),'UTF8')),'hex');
  PERFORM pg_advisory_xact_lock(
    hashtextextended('gs315i:session:'||session_id::text,0));
  SELECT s.revoked_at INTO existing_revocation
   FROM gs315i.sessions s WHERE s.id=session_id AND s.secret_sha256=hash_hex;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'session denied' USING ERRCODE='28000';
  END IF;
  IF existing_revocation IS NULL THEN
   UPDATE gs315i.sessions s SET revoked_at=clock_timestamp()
    WHERE s.id=session_id AND s.secret_sha256=hash_hex
      AND s.revoked_at IS NULL;
   IF NOT FOUND THEN
    RAISE EXCEPTION 'session unavailable' USING ERRCODE='40001';
   END IF;
  END IF;
  RETURN true;
 END
 $safe$;

-- Defaults are PUBLIC EXECUTE; narrow this before making the fixture visible.
REVOKE ALL ON FUNCTION gs315i.read_requests(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION gs315i.revoke_session(text) FROM PUBLIC;
ALTER FUNCTION gs315i.read_requests(text,text) OWNER TO gs315i_read_owner;
ALTER FUNCTION gs315i.revoke_session(text) OWNER TO gs315i_revoke_owner;
GRANT EXECUTE ON FUNCTION gs315i.read_requests(text,text) TO gs315i_gateway;
GRANT EXECUTE ON FUNCTION gs315i.revoke_session(text) TO gs315i_gateway;
COMMIT;
