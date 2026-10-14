-- PHASE 3.15K — REVIEW-ONLY PRIVATE AUTHORIZATION SCHEMA.
-- Exact intended target: codeedge-growth-starter-staging dbppeymhsemvghbvuvof.
-- DDL IS NOT APPLIED TO THE HOSTED PROJECT.
--
-- Prerequisites: independent database review, exact owner approval,
-- backups, a nonproduction-disposable rehearsal, verified Data API exposure.
-- This script creates NOLOGIN roles, no gateway credentials, and no endpoints.
-- It does not change legacy grants, existing RLS policies, or client rows.
-- No LOGIN or EXECUTE is enabled outside the review boundary.
BEGIN;
DO $baseline$
BEGIN
 IF current_setting('server_version_num')::int < 170000
    OR to_regclass('growth_starter.workspaces') IS NULL
    OR to_regclass('growth_starter.memberships') IS NULL
    OR to_regclass('growth_starter.work_requests') IS NULL
 THEN RAISE EXCEPTION 'Unexpected Growth Starter schema/PostgreSQL version';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN (
     'gs315k_gateway','gs315k_read_owner','gs315k_revoke_owner'))
    OR to_regnamespace('growth_starter_private') IS NOT NULL
 THEN RAISE EXCEPTION 'Already provisioned or conflicting private schema';
 END IF;
END $baseline$;
CREATE ROLE gs315k_gateway NOLOGIN NOINHERIT NOBYPASSRLS
 NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE gs315k_read_owner NOLOGIN NOINHERIT NOBYPASSRLS
 NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE gs315k_revoke_owner NOLOGIN NOINHERIT NOBYPASSRLS
 NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;

CREATE SCHEMA growth_starter_private;
REVOKE ALL ON SCHEMA growth_starter_private FROM PUBLIC;
CREATE TABLE growth_starter_private.codeedge_sessions (
 id uuid PRIMARY KEY,
 secret_sha256 text NOT NULL UNIQUE
   CHECK (secret_sha256 ~ '^[0-9a-f]{64}$'),
 user_id uuid NOT NULL,
 provider_session_id uuid NOT NULL,
 one_time_grant_id text NOT NULL UNIQUE
  CHECK(one_time_grant_id ~ '^[A-Za-z0-9_-]{24,96}$'),
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE growth_starter_private.fresh_login_flows (
 state_hash text PRIMARY KEY CHECK(state_hash ~ '^[0-9a-f]{64}$'),
 binding_hash text NOT NULL CHECK(binding_hash ~ '^[0-9a-f]{64}$'),
 pkce_verifier text NOT NULL CHECK(pkce_verifier ~ '^[A-Za-z0-9_-]{43}$'),
 one_time_grant_id text NOT NULL UNIQUE
   CHECK(one_time_grant_id ~ '^[A-Za-z0-9_-]{43}$'),
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
REVOKE ALL ON ALL TABLES IN SCHEMA growth_starter_private FROM PUBLIC;
ALTER TABLE growth_starter_private.codeedge_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_starter_private.codeedge_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE growth_starter_private.fresh_login_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_starter_private.fresh_login_flows FORCE ROW LEVEL SECURITY;
-- No browser, anon, authenticated, service_role, or gateway grants on tables.

GRANT USAGE ON SCHEMA growth_starter_private
 TO gs315k_gateway,gs315k_read_owner,gs315k_revoke_owner;
GRANT USAGE ON SCHEMA growth_starter
 TO gs315k_read_owner;
GRANT SELECT(id,user_id,secret_sha256,expires_at,revoked_at)
 ON growth_starter_private.codeedge_sessions TO gs315k_read_owner;
GRANT SELECT(id,secret_sha256,revoked_at)
 ON growth_starter_private.codeedge_sessions TO gs315k_revoke_owner;
GRANT UPDATE(revoked_at)
 ON growth_starter_private.codeedge_sessions TO gs315k_revoke_owner;

GRANT SELECT(id,owner_user_id,state)
 ON growth_starter.workspaces TO gs315k_read_owner;
GRANT SELECT(workspace_id,user_id,owner_user_id,role,state)
 ON growth_starter.memberships TO gs315k_read_owner;
GRANT SELECT(id,workspace_id,title,kind,status,version,updated_at)
 ON growth_starter.work_requests TO gs315k_read_owner;

CREATE POLICY gs315k_session_read
 ON growth_starter_private.codeedge_sessions
 FOR SELECT TO gs315k_read_owner USING (true);
CREATE POLICY gs315k_session_revoke_read
 ON growth_starter_private.codeedge_sessions
 FOR SELECT TO gs315k_revoke_owner USING (true);
CREATE POLICY gs315k_session_revoke_write
 ON growth_starter_private.codeedge_sessions
 FOR UPDATE TO gs315k_revoke_owner USING (true) WITH CHECK(true);
-- NO policies for fresh_login_flows; do not enable real bootstrap here.
-- The fixed-purpose SECURITY DEFINER read owner has no login.
-- A later independent review must assess this allow-all *owner* SELECT
-- policy: the function predicates, not this policy, enforce user/tenant.
CREATE POLICY gs315k_ws_read ON growth_starter.workspaces
 FOR SELECT TO gs315k_read_owner USING (true);
CREATE POLICY gs315k_membership_read ON growth_starter.memberships
 FOR SELECT TO gs315k_read_owner USING (true);
CREATE POLICY gs315k_request_read ON growth_starter.work_requests
 FOR SELECT TO gs315k_read_owner USING (true);

CREATE FUNCTION growth_starter_private.read_requests(
 p_token text,p_workspace text,p_limit integer DEFAULT 20)
 RETURNS TABLE(
  id text,workspace_id text,title text,kind text,status text,
  version integer,updated_at timestamptz)
 LANGUAGE plpgsql VOLATILE SECURITY DEFINER
 SET search_path=pg_catalog,pg_temp
 AS $body$
 DECLARE sid uuid;hash_hex text;actor text;owner text;has_member boolean;
 BEGIN
  IF p_token IS NULL OR length(p_token)>128
    OR p_token !~ '^ce1\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[A-Za-z0-9_-]{43}$'
    OR p_workspace IS NULL OR p_workspace !~ '^ws_[A-Za-z0-9_-]{8,128}$'
    OR p_limit IS NULL OR p_limit<1 OR p_limit>50
  THEN RAISE EXCEPTION 'session denied' USING ERRCODE='28000';END IF;
  sid:=split_part(p_token,'.',2)::uuid;
  hash_hex:=encode(sha256(
    convert_to('codeedge-growth-starter:session:v1','UTF8') ||
    decode('00','hex') || convert_to(sid::text,'UTF8') ||
    decode('00','hex') || convert_to(split_part(p_token,'.',3),'UTF8')
  ),'hex');
  PERFORM pg_advisory_xact_lock_shared(
   hashtextextended('growth-starter:k:session:'||sid::text,0));
  SELECT s.user_id::text INTO actor
   FROM growth_starter_private.codeedge_sessions s
   WHERE s.id=sid AND s.secret_sha256=hash_hex
     AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp();
  IF actor IS NULL THEN
   RAISE EXCEPTION 'session denied' USING ERRCODE='28000';END IF;
  PERFORM pg_advisory_xact_lock_shared(
   hashtextextended('growth-starter:k:workspace:'||p_workspace,0));
  SELECT w.owner_user_id INTO owner
   FROM growth_starter.workspaces w
   WHERE w.id=p_workspace AND w.state='active';
  IF owner IS NULL THEN
   RAISE EXCEPTION 'session denied' USING ERRCODE='28000';END IF;
  IF actor<>owner THEN
   PERFORM pg_advisory_xact_lock_shared(
    hashtextextended('growth-starter:k:member:'||p_workspace||':'||actor,0));
   SELECT EXISTS(
    SELECT 1 FROM growth_starter.memberships m
    WHERE m.workspace_id=p_workspace AND m.user_id=actor
      AND m.owner_user_id=owner AND m.state='active'
      AND m.role IN('agency_admin','staff','client')
   ) INTO has_member;
   IF NOT has_member THEN
    RAISE EXCEPTION 'session denied' USING ERRCODE='28000';END IF;
  END IF;
  RETURN QUERY SELECT r.id,r.workspace_id,r.title,r.kind,r.status,
    r.version,r.updated_at FROM growth_starter.work_requests r
    WHERE r.workspace_id=p_workspace ORDER BY r.updated_at DESC,r.id
    LIMIT p_limit;
 END $body$;

CREATE FUNCTION growth_starter_private.revoke_session(p_token text)
 RETURNS boolean
 LANGUAGE plpgsql VOLATILE SECURITY DEFINER
 SET search_path=pg_catalog,pg_temp
 AS $body$
 DECLARE sid uuid;hash_hex text;existing timestamptz;
 BEGIN
  IF p_token IS NULL OR length(p_token)>128
    OR p_token !~ '^ce1\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[A-Za-z0-9_-]{43}$'
  THEN RAISE EXCEPTION 'session denied' USING ERRCODE='28000'; END IF;
  sid:=split_part(p_token,'.',2)::uuid;
  hash_hex:=encode(sha256(
    convert_to('codeedge-growth-starter:session:v1','UTF8') ||
    decode('00','hex') || convert_to(sid::text,'UTF8') ||
    decode('00','hex') || convert_to(split_part(p_token,'.',3),'UTF8')
  ),'hex');
  PERFORM pg_advisory_xact_lock(
   hashtextextended('growth-starter:k:session:'||sid::text,0));
  SELECT s.revoked_at INTO existing
   FROM growth_starter_private.codeedge_sessions s
   WHERE s.id=sid AND s.secret_sha256=hash_hex FOR UPDATE;
  IF NOT FOUND THEN
   RAISE EXCEPTION 'session denied' USING ERRCODE='28000'; END IF;
  IF existing IS NULL THEN
   UPDATE growth_starter_private.codeedge_sessions s
    SET revoked_at=clock_timestamp()
    WHERE s.id=sid AND s.secret_sha256=hash_hex AND s.revoked_at IS NULL;
   IF NOT FOUND THEN
    RAISE EXCEPTION 'session unavailable' USING ERRCODE='40001';END IF;
  END IF;
  RETURN true;
 END $body$;

-- PostgreSQL default PUBLIC EXECUTE must be removed BEFORE commit.
REVOKE ALL ON FUNCTION growth_starter_private.read_requests(text,text,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION growth_starter_private.revoke_session(text) FROM PUBLIC;
ALTER FUNCTION growth_starter_private.read_requests(text,text,integer) OWNER TO gs315k_read_owner;
ALTER FUNCTION growth_starter_private.revoke_session(text) OWNER TO gs315k_revoke_owner;
GRANT EXECUTE ON FUNCTION growth_starter_private.read_requests(text,text,integer) TO gs315k_gateway;
GRANT EXECUTE ON FUNCTION growth_starter_private.revoke_session(text) TO gs315k_gateway;

-- Critical: gateway remains NOLOGIN and fresh_login_flows has NO usable policy.
-- Real login issuance and private network placement remain UNBUILT.
-- ALL host-facing changes need separate, specific owner approval.
COMMIT;
