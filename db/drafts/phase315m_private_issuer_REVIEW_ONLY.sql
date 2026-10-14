-- REVIEW ONLY. Apply after the exact Phase 3.15K private migration, only to
-- dbppeymhsemvghbvuvof after independent review and consolidated owner approval.
-- No hosted LOGIN, password, Auth schema grant or legacy cutover is performed.
BEGIN;
DO $$ BEGIN
 IF current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR to_regclass('growth_starter_private.fresh_login_flows') IS NULL
 OR EXISTS(SELECT FROM pg_roles WHERE rolname IN('gs315m_issuer','gs315m_issue_owner'))
 THEN RAISE EXCEPTION 'Unexpected private issuer baseline'; END IF;
END $$;
CREATE ROLE gs315m_issuer NOLOGIN NOINHERIT NOBYPASSRLS NOSUPERUSER
 NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE gs315m_issue_owner NOLOGIN NOINHERIT NOBYPASSRLS NOSUPERUSER
 NOCREATEDB NOCREATEROLE NOREPLICATION;
ALTER TABLE growth_starter_private.fresh_login_flows
 ADD COLUMN email_sha256 text CHECK(email_sha256 ~ '^[0-9a-f]{64}$'),
 ADD COLUMN issued_at timestamptz;
GRANT USAGE ON SCHEMA growth_starter_private TO gs315m_issuer,gs315m_issue_owner;
GRANT SELECT,INSERT,UPDATE ON growth_starter_private.fresh_login_flows TO gs315m_issue_owner;
GRANT INSERT ON growth_starter_private.codeedge_sessions TO gs315m_issue_owner;
CREATE POLICY gs315m_flow_select ON growth_starter_private.fresh_login_flows
 FOR SELECT TO gs315m_issue_owner USING(true);
CREATE POLICY gs315m_flow_insert ON growth_starter_private.fresh_login_flows
 FOR INSERT TO gs315m_issue_owner WITH CHECK(true);
CREATE POLICY gs315m_flow_consume ON growth_starter_private.fresh_login_flows
 FOR UPDATE TO gs315m_issue_owner USING(true) WITH CHECK(true);
CREATE POLICY gs315m_session_issue ON growth_starter_private.codeedge_sessions
 FOR INSERT TO gs315m_issue_owner WITH CHECK(true);

CREATE FUNCTION growth_starter_private.begin_login(
 p_state text,p_binding text,p_verifier text,p_grant text,p_email text)
 RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
 SET search_path=pg_catalog,pg_temp AS $$
 BEGIN
 IF p_state IS NULL OR p_state !~ '^[0-9a-f]{64}$'
 OR p_binding IS NULL OR p_binding !~ '^[0-9a-f]{64}$'
 OR p_verifier IS NULL OR p_verifier !~ '^[A-Za-z0-9_-]{43}$'
 OR p_grant IS NULL OR p_grant !~ '^[A-Za-z0-9_-]{43}$'
 OR p_email IS NULL OR p_email !~ '^[0-9a-f]{64}$'
 THEN RAISE EXCEPTION 'login denied' USING ERRCODE='28000'; END IF;
 -- Bounded server-side admission; failed provider calls cannot flood the store.
 PERFORM pg_advisory_xact_lock(hashtextextended('growth-starter:m:login-admission',0));
 IF EXISTS(SELECT FROM growth_starter_private.fresh_login_flows
   WHERE email_sha256=p_email AND created_at>clock_timestamp()-interval '60 seconds')
 OR (SELECT count(*) FROM growth_starter_private.fresh_login_flows
   WHERE expires_at>clock_timestamp())>=1000
 THEN RAISE EXCEPTION 'login unavailable' USING ERRCODE='54000'; END IF;
 INSERT INTO growth_starter_private.fresh_login_flows
  (state_hash,binding_hash,pkce_verifier,one_time_grant_id,email_sha256,expires_at)
 VALUES(p_state,p_binding,p_verifier,p_grant,p_email,clock_timestamp()+interval '5 minutes');
 RETURN true;
 END $$;

CREATE FUNCTION growth_starter_private.consume_login(p_state text,p_binding text)
 RETURNS TABLE(pkce_verifier text,one_time_grant_id text,email_sha256 text)
 LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 BEGIN
 IF p_state IS NULL OR p_state !~ '^[0-9a-f]{64}$'
 OR p_binding IS NULL OR p_binding !~ '^[0-9a-f]{64}$'
 THEN RAISE EXCEPTION 'login denied' USING ERRCODE='28000'; END IF;
 RETURN QUERY UPDATE growth_starter_private.fresh_login_flows f
 SET consumed_at=clock_timestamp()
 WHERE f.state_hash=p_state AND f.binding_hash=p_binding
 AND f.consumed_at IS NULL AND f.expires_at>clock_timestamp()
 RETURNING f.pkce_verifier,f.one_time_grant_id,f.email_sha256;
 IF NOT FOUND THEN RAISE EXCEPTION 'login denied' USING ERRCODE='28000'; END IF;
 END $$;

-- Only the isolated trusted PKCE issuer can call this function. The public
-- gateway cannot submit actor IDs or mint sessions; the issuer must verify
-- the exchanged original bearer with Supabase before supplying these fields.
CREATE FUNCTION growth_starter_private.issue_session(
 p_grant text,p_email text,p_user uuid,p_provider uuid,p_id uuid,p_hash text,p_until timestamptz)
 RETURNS timestamptz LANGUAGE plpgsql VOLATILE SECURITY DEFINER
 SET search_path=pg_catalog,pg_temp AS $$
 BEGIN
 IF p_grant IS NULL OR p_grant !~ '^[A-Za-z0-9_-]{43}$'
 OR p_email IS NULL OR p_email !~ '^[0-9a-f]{64}$'
 OR p_user IS NULL OR p_provider IS NULL OR p_id IS NULL
 OR p_hash IS NULL OR p_hash !~ '^[0-9a-f]{64}$'
 OR p_until IS NULL OR p_until<=clock_timestamp()
 OR p_until>clock_timestamp()+interval '30 minutes'
 THEN RAISE EXCEPTION 'login denied' USING ERRCODE='28000'; END IF;
 UPDATE growth_starter_private.fresh_login_flows f SET issued_at=clock_timestamp(),pkce_verifier=repeat('0',43)
 WHERE f.one_time_grant_id=p_grant AND f.email_sha256=p_email
 AND f.consumed_at>clock_timestamp()-interval '2 minutes'
 AND f.expires_at>clock_timestamp() AND f.issued_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'login denied' USING ERRCODE='28000'; END IF;
 INSERT INTO growth_starter_private.codeedge_sessions
  (id,secret_sha256,user_id,provider_session_id,one_time_grant_id,expires_at)
 VALUES(p_id,p_hash,p_user,p_provider,p_grant,p_until);
 RETURN p_until;
 END $$;

GRANT SELECT(provider_session_id) ON growth_starter_private.codeedge_sessions TO gs315k_read_owner;
CREATE FUNCTION growth_starter_private.session_context(p_token text)
 RETURNS TABLE(user_id uuid,provider_session_id uuid,expires_at timestamptz)
 LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 DECLARE sid uuid; hash_hex text;
 BEGIN
 IF p_token IS NULL OR length(p_token)>128 OR
 p_token !~ '^ce1\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[A-Za-z0-9_-]{43}$'
 THEN RAISE EXCEPTION 'session denied' USING ERRCODE='28000'; END IF;
 sid:=split_part(p_token,'.',2)::uuid;
 hash_hex:=encode(sha256(convert_to('codeedge-growth-starter:session:v1','UTF8')||decode('00','hex')||
 convert_to(sid::text,'UTF8')||decode('00','hex')||convert_to(split_part(p_token,'.',3),'UTF8')),'hex');
 PERFORM pg_advisory_xact_lock_shared(hashtextextended('growth-starter:k:session:'||sid::text,0));
 RETURN QUERY SELECT s.user_id,s.provider_session_id,s.expires_at
 FROM growth_starter_private.codeedge_sessions s
 WHERE s.id=sid AND s.secret_sha256=hash_hex AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp();
 IF NOT FOUND THEN RAISE EXCEPTION 'session denied' USING ERRCODE='28000'; END IF;
 END $$;

-- Enforce the same locking protocol even for preexisting authorized writers.
-- These are invoker triggers with no elevated data permissions.
CREATE FUNCTION growth_starter_private.lock_workspace_writer()
 RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $$
 BEGIN
 IF TG_OP='UPDATE' AND OLD.id<>NEW.id THEN
   RAISE EXCEPTION 'workspace identity immutable'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('growth-starter:k:workspace:'||OLD.id,0));
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
 END $$;
CREATE FUNCTION growth_starter_private.lock_membership_writer()
 RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $$
 DECLARE ws text;
 BEGIN
 IF TG_OP='UPDATE' AND (OLD.workspace_id<>NEW.workspace_id OR OLD.user_id<>NEW.user_id) THEN
  RAISE EXCEPTION 'membership identity immutable'; END IF;
 IF TG_OP='INSERT' THEN ws:=NEW.workspace_id; ELSE ws:=OLD.workspace_id; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('growth-starter:k:workspace:'||ws,0));
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
 END $$;
CREATE TRIGGER gs315m_workspace_writer BEFORE UPDATE OR DELETE ON growth_starter.workspaces
 FOR EACH ROW EXECUTE FUNCTION growth_starter_private.lock_workspace_writer();
CREATE TRIGGER gs315m_membership_writer BEFORE INSERT OR UPDATE OR DELETE ON growth_starter.memberships
 FOR EACH ROW EXECUTE FUNCTION growth_starter_private.lock_membership_writer();

REVOKE ALL ON FUNCTION growth_starter_private.begin_login(text,text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION growth_starter_private.consume_login(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION growth_starter_private.issue_session(text,text,uuid,uuid,uuid,text,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION growth_starter_private.session_context(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION growth_starter_private.lock_workspace_writer() FROM PUBLIC;
REVOKE ALL ON FUNCTION growth_starter_private.lock_membership_writer() FROM PUBLIC;
ALTER FUNCTION growth_starter_private.begin_login(text,text,text,text,text) OWNER TO gs315m_issue_owner;
ALTER FUNCTION growth_starter_private.consume_login(text,text) OWNER TO gs315m_issue_owner;
ALTER FUNCTION growth_starter_private.issue_session(text,text,uuid,uuid,uuid,text,timestamptz) OWNER TO gs315m_issue_owner;
ALTER FUNCTION growth_starter_private.session_context(text) OWNER TO gs315k_read_owner;
GRANT EXECUTE ON FUNCTION growth_starter_private.begin_login(text,text,text,text,text),
 growth_starter_private.consume_login(text,text),
 growth_starter_private.issue_session(text,text,uuid,uuid,uuid,text,timestamptz) TO gs315m_issuer;
GRANT EXECUTE ON FUNCTION growth_starter_private.session_context(text) TO gs315k_gateway;
-- Supabase can give newly created objects explicit default browser grants;
-- revoking PUBLIC alone does not remove those role-specific grants.
DO $$ DECLARE r text; BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF EXISTS(SELECT FROM pg_roles WHERE rolname=r) THEN
   EXECUTE format('REVOKE ALL ON SCHEMA growth_starter_private FROM %I',r);
   EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA growth_starter_private FROM %I',r);
   EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA growth_starter_private FROM %I',r);
   EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA growth_starter_private FROM %I',r);
  END IF;
 END LOOP;
END $$;
COMMIT;
