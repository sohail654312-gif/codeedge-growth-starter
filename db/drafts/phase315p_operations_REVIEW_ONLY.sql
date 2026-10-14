-- REVIEW_ONLY. PostgreSQL 17. No hosted execution authorized.
-- Requires exact 0001 + Phase O + K + M dependency bundle (see manifest).
-- No LOGIN/password, managed Auth grant, exposed-schema setting or legacy revoke.
BEGIN;
DO $$ BEGIN
 IF current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR to_regprocedure('growth_starter_private.session_context(text)') IS NULL
 OR to_regclass('growth_starter.operation_receipts') IS NULL
 OR EXISTS(SELECT FROM pg_roles WHERE rolname IN('gs315p_writer','gs315p_ops_owner'))
 THEN RAISE EXCEPTION 'Phase P baseline mismatch'; END IF;
END $$;
CREATE ROLE gs315p_writer NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE gs315p_ops_owner NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
GRANT USAGE ON SCHEMA growth_starter_private TO gs315p_writer,gs315p_ops_owner;
GRANT USAGE ON SCHEMA growth_starter TO gs315p_ops_owner;
GRANT EXECUTE ON FUNCTION growth_starter_private.session_context(text) TO gs315p_writer,gs315p_ops_owner;
GRANT SELECT ON growth_starter.workspaces,growth_starter.memberships,growth_starter.work_requests,
 growth_starter.business_profiles,growth_starter.request_notes,growth_starter.operation_receipts,
 growth_starter.audit_events,growth_starter.media,growth_starter.media_delete_outbox TO gs315p_ops_owner;
GRANT INSERT ON growth_starter.workspaces,growth_starter.work_requests,growth_starter.business_profiles,
 growth_starter.request_notes,growth_starter.operation_receipts,growth_starter.audit_events,
 growth_starter.media_delete_outbox TO gs315p_ops_owner;
GRANT UPDATE(fields,version,updated_at) ON growth_starter.business_profiles TO gs315p_ops_owner;
GRANT UPDATE(status,version,reviewed_by,decided_by,updated_at,assigned_to,due_date)
 ON growth_starter.work_requests TO gs315p_ops_owner;
GRANT UPDATE(state,revoked_at,updated_at) ON growth_starter.memberships TO gs315p_ops_owner;
GRANT UPDATE(consent_state,lifecycle) ON growth_starter.media TO gs315p_ops_owner;
GRANT USAGE ON SEQUENCE growth_starter.request_notes_id_seq,growth_starter.audit_events_id_seq,
 growth_starter.media_delete_outbox_id_seq TO gs315p_ops_owner;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['workspaces','memberships','work_requests','business_profiles',
 'request_notes','operation_receipts','audit_events','media','media_delete_outbox'] LOOP
  EXECUTE format('ALTER TABLE growth_starter.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE growth_starter.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY gs315p_select ON growth_starter.%I FOR SELECT TO gs315p_ops_owner USING(true)',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['workspaces','work_requests','business_profiles','request_notes',
 'operation_receipts','audit_events','media_delete_outbox'] LOOP
  EXECUTE format('CREATE POLICY gs315p_insert ON growth_starter.%I FOR INSERT TO gs315p_ops_owner WITH CHECK(true)',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['business_profiles','work_requests','memberships','media'] LOOP
  EXECUTE format('CREATE POLICY gs315p_update ON growth_starter.%I FOR UPDATE TO gs315p_ops_owner USING(true) WITH CHECK(true)',t);
 END LOOP;
END $$;
-- Internal helpers are INVOKER and have no runtime/browser EXECUTE. Tenant
-- predicates are enforced by fixed DEFINER entrypoints, not caller GUCs.
CREATE FUNCTION growth_starter_private.op_actor(p_token text,p_ws text,p_roles text[])
 RETURNS TABLE(actor text,role text,owner_id text) LANGUAGE plpgsql VOLATILE SECURITY INVOKER
 SET search_path=pg_catalog,pg_temp AS $$
 DECLARE u text; o text; r text;
 BEGIN
 SELECT c.user_id::text INTO u FROM growth_starter_private.session_context(p_token) c;
 IF p_ws IS NULL OR p_ws !~ '^ws_[A-Za-z0-9_-]{8,128}$' THEN
  RAISE EXCEPTION 'operation denied' USING ERRCODE='28000'; END IF;
 -- Session shared lock -> workspace exclusive advisory lock -> business row.
 -- The workspace lock also serializes membership updates and idempotency keys.
 PERFORM pg_advisory_xact_lock(hashtextextended('growth-starter:k:workspace:'||p_ws,0));
 SELECT w.owner_user_id INTO o FROM growth_starter.workspaces w WHERE w.id=p_ws AND w.state='active';
 IF o IS NULL OR p_ws<>'ws_'||o THEN RAISE EXCEPTION 'operation denied' USING ERRCODE='28000'; END IF;
 IF u=o THEN r:='owner'; ELSE
  SELECT m.role INTO r FROM growth_starter.memberships m WHERE m.workspace_id=p_ws
  AND m.user_id=u AND m.owner_user_id=o AND m.state='active';
 END IF;
 IF r IS NULL OR NOT r=ANY(p_roles) THEN RAISE EXCEPTION 'operation denied' USING ERRCODE='28000'; END IF;
 RETURN QUERY SELECT u,r,o;
 END $$;
CREATE FUNCTION growth_starter_private.op_receipt(p_ws text,p_actor text,p_key text,p_payload jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $$
 DECLARE old growth_starter.operation_receipts; d text;
 BEGIN
 IF p_key IS NULL OR p_key !~ '^[A-Za-z0-9_-]{16,80}$' OR p_payload IS NULL
 OR octet_length(p_payload::text)>8192 THEN RAISE EXCEPTION 'invalid operation' USING ERRCODE='22023'; END IF;
 d:=encode(sha256(convert_to(p_payload::text,'UTF8')),'hex');
 SELECT * INTO old FROM growth_starter.operation_receipts WHERE workspace_id=p_ws AND actor_user_id=p_actor AND idempotency_key=p_key;
 IF FOUND THEN
  IF old.payload_digest<>d THEN RAISE EXCEPTION 'idempotency conflict' USING ERRCODE='23505'; END IF;
  RETURN old.result;
 END IF;
 RETURN NULL;
 END $$;
CREATE FUNCTION growth_starter_private.op_finish(p_ws text,p_actor text,p_key text,p_payload jsonb,p_result jsonb,p_action text,p_target text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $$
 BEGIN
 INSERT INTO growth_starter.operation_receipts(workspace_id,actor_user_id,idempotency_key,payload_digest,result)
 VALUES(p_ws,p_actor,p_key,encode(sha256(convert_to(p_payload::text,'UTF8')),'hex'),p_result);
 INSERT INTO growth_starter.audit_events(workspace_id,actor_user_id,action,target,happened_at)
 VALUES(p_ws,p_actor,p_action,p_target,clock_timestamp());
 RETURN p_result;
 END $$;
CREATE FUNCTION growth_starter_private.op_request_json(r growth_starter.work_requests)
 RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $$
 SELECT jsonb_build_object('id',r.id,'workspaceId',r.workspace_id,'title',r.title,'kind',r.kind,
 'status',r.status,'version',r.version,'reviewedBy',r.reviewed_by,'decidedBy',r.decided_by,
 'notes',r.notes,'assignedTo',r.assigned_to,'dueDate',r.due_date,
 'updatedAt',floor(extract(epoch FROM r.updated_at)*1000)::bigint,
 'cursorAt',to_char(r.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) $$;
CREATE FUNCTION growth_starter_private.op_text(v text,lo integer,hi integer)
 RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $$
 SELECT v IS NOT NULL AND length(v) BETWEEN lo AND hi AND v=btrim(v)
 AND v !~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]' $$;

CREATE FUNCTION growth_starter_private.ops_onboard(p_token text)
 RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 DECLARE u text; ws text; s text;
 BEGIN
 SELECT c.user_id::text INTO u FROM growth_starter_private.session_context(p_token) c;
 ws:='ws_'||u;
 PERFORM pg_advisory_xact_lock(hashtextextended('growth-starter:k:workspace:'||ws,0));
 SELECT state INTO s FROM growth_starter.workspaces WHERE id=ws;
 IF FOUND AND s<>'active' THEN RAISE EXCEPTION 'operation denied' USING ERRCODE='28000'; END IF;
 INSERT INTO growth_starter.workspaces(id,owner_user_id) VALUES(ws,u) ON CONFLICT(id) DO NOTHING;
 IF FOUND THEN INSERT INTO growth_starter.audit_events(workspace_id,actor_user_id,action,target)
 VALUES(ws,u,'workspace.created',ws); END IF;
 RETURN jsonb_build_object('workspaceId',ws,'ownerUserId',u,'role','owner');
 END $$;
CREATE FUNCTION growth_starter_private.ops_authorize(p_token text,p_ws text)
 RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 DECLARE a record; BEGIN
 SELECT * INTO a FROM growth_starter_private.op_actor(p_token,p_ws,ARRAY['owner','agency_admin','staff','client']);
 RETURN jsonb_build_object('workspaceId',p_ws,'userId',a.actor,'ownerUserId',a.owner_id,'role',a.role);
 END $$;
CREATE FUNCTION growth_starter_private.ops_profile_read(p_token text,p_ws text)
 RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 DECLARE result jsonb; BEGIN
 PERFORM growth_starter_private.op_actor(p_token,p_ws,ARRAY['owner','agency_admin','staff','client']);
 SELECT jsonb_build_object('fields',fields,'version',version) INTO result FROM growth_starter.business_profiles WHERE workspace_id=p_ws;
 RETURN coalesce(result,jsonb_build_object('fields',NULL,'version',0));
 END $$;
CREATE FUNCTION growth_starter_private.ops_workspaces(p_token text)
 RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 DECLARE u text; ws text; a record; result jsonb:='[]'::jsonb; title text;
 BEGIN
 SELECT c.user_id::text INTO u FROM growth_starter_private.session_context(p_token) c;
 FOR ws IN SELECT w.id FROM growth_starter.workspaces w WHERE w.state='active' AND
 (w.owner_user_id=u OR EXISTS(SELECT FROM growth_starter.memberships m WHERE m.workspace_id=w.id AND m.user_id=u AND m.state='active'))
 ORDER BY w.id LIMIT 25 LOOP
  BEGIN
   SELECT * INTO a FROM growth_starter_private.op_actor(p_token,ws,ARRAY['owner','agency_admin','staff','client']);
   SELECT fields->>'name' INTO title FROM growth_starter.business_profiles WHERE workspace_id=ws;
   result:=result||jsonb_build_array(jsonb_build_object('workspaceId',ws,'role',a.role,'name',coalesce(title,CASE WHEN a.role='owner' THEN 'Your workspace' ELSE 'Shared workspace' END)));
  EXCEPTION WHEN SQLSTATE '28000' THEN CONTINUE;
  END;
 END LOOP;
 RETURN jsonb_build_object('workspaces',result);
 END $$;
CREATE FUNCTION growth_starter_private.ops_profile_save(p_token text,p_ws text,p_key text,p_fields jsonb,p_version integer)
 RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 DECLARE a record; payload jsonb; old jsonb; v integer; result jsonb;
 BEGIN
 SELECT * INTO a FROM growth_starter_private.op_actor(p_token,p_ws,ARRAY['owner','agency_admin','staff','client']);
 IF p_fields IS NULL OR jsonb_typeof(p_fields)<>'object' OR octet_length(p_fields::text)>4096
 OR (SELECT count(*) FROM jsonb_object_keys(p_fields))<>5
 OR NOT p_fields ?& ARRAY['name','industry','city','website','goal']
 OR EXISTS(SELECT FROM jsonb_each(p_fields) x WHERE jsonb_typeof(x.value)<>'string')
 OR NOT growth_starter_private.op_text(p_fields->>'name',1,90)
 OR NOT growth_starter_private.op_text(p_fields->>'industry',1,60)
 OR NOT growth_starter_private.op_text(p_fields->>'city',1,90)
 OR NOT growth_starter_private.op_text(p_fields->>'website',0,250)
 OR NOT growth_starter_private.op_text(p_fields->>'goal',0,240)
 OR (p_fields->>'website'<>'' AND p_fields->>'website' !~ '^https://[^/@[:space:]]+')
 OR p_version IS NULL OR p_version<0 THEN RAISE EXCEPTION 'invalid profile' USING ERRCODE='22023'; END IF;
 payload:=jsonb_build_object('op','profile','fields',p_fields,'version',p_version);
 old:=growth_starter_private.op_receipt(p_ws,a.actor,p_key,payload); IF old IS NOT NULL THEN RETURN old; END IF;
 SELECT version INTO v FROM growth_starter.business_profiles WHERE workspace_id=p_ws FOR UPDATE;
 IF coalesce(v,0)<>p_version THEN RAISE EXCEPTION 'version conflict' USING ERRCODE='23505'; END IF;
 INSERT INTO growth_starter.business_profiles(workspace_id,fields,version) VALUES(p_ws,p_fields,p_version+1)
 ON CONFLICT(workspace_id) DO UPDATE SET fields=EXCLUDED.fields,version=EXCLUDED.version,updated_at=clock_timestamp();
 result:=jsonb_build_object('fields',p_fields,'version',p_version+1);
 RETURN growth_starter_private.op_finish(p_ws,a.actor,p_key,payload,result,'profile.saved',p_ws);
 END $$;
CREATE FUNCTION growth_starter_private.ops_request_create(p_token text,p_ws text,p_key text,p_title text,p_kind text,p_notes text)
 RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 DECLARE a record; payload jsonb; old jsonb; r growth_starter.work_requests;
 BEGIN
 SELECT * INTO a FROM growth_starter_private.op_actor(p_token,p_ws,ARRAY['owner','agency_admin','staff','client']);
 IF NOT growth_starter_private.op_text(p_title,1,100) OR NOT growth_starter_private.op_text(p_notes,0,600)
 OR p_kind IS NULL OR p_kind NOT IN('Website update','Social content','Local SEO','Other') THEN
 RAISE EXCEPTION 'invalid request' USING ERRCODE='22023'; END IF;
 payload:=jsonb_build_object('op','create','title',p_title,'kind',p_kind,'notes',p_notes);
 old:=growth_starter_private.op_receipt(p_ws,a.actor,p_key,payload); IF old IS NOT NULL THEN RETURN old; END IF;
 INSERT INTO growth_starter.work_requests(workspace_id,id,title,kind,notes,created_by)
 VALUES(p_ws,gen_random_uuid()::text,p_title,p_kind,p_notes,a.actor) RETURNING * INTO r;
 RETURN growth_starter_private.op_finish(p_ws,a.actor,p_key,payload,growth_starter_private.op_request_json(r),'request.created',r.id);
 END $$;
CREATE FUNCTION growth_starter_private.ops_request_assign(p_token text,p_ws text,p_key text,p_id text,p_assignee text,p_due text,p_version integer)
 RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 DECLARE a record; payload jsonb; old jsonb; r growth_starter.work_requests;
 BEGIN
 SELECT * INTO a FROM growth_starter_private.op_actor(p_token,p_ws,ARRAY['owner','agency_admin']);
 IF p_due IS NOT NULL AND (p_due !~ '^\d{4}-\d{2}-\d{2}$' OR to_char(p_due::date,'YYYY-MM-DD')<>p_due) THEN
 RAISE EXCEPTION 'invalid date' USING ERRCODE='22023'; END IF;
 IF p_assignee IS NOT NULL AND p_assignee<>a.owner_id AND NOT EXISTS(SELECT FROM growth_starter.memberships
 WHERE workspace_id=p_ws AND user_id=p_assignee AND owner_user_id=a.owner_id AND state='active' AND role IN('agency_admin','staff')) THEN
 RAISE EXCEPTION 'operation denied' USING ERRCODE='28000'; END IF;
 payload:=jsonb_build_object('op','assign','id',p_id,'assignee',p_assignee,'due',p_due,'version',p_version);
 old:=growth_starter_private.op_receipt(p_ws,a.actor,p_key,payload); IF old IS NOT NULL THEN RETURN old; END IF;
 SELECT * INTO r FROM growth_starter.work_requests WHERE workspace_id=p_ws AND id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'request missing' USING ERRCODE='P0002'; END IF;
 IF p_version IS NULL OR r.version<>p_version OR r.status='Completed' THEN RAISE EXCEPTION 'version conflict' USING ERRCODE='23505'; END IF;
 UPDATE growth_starter.work_requests SET assigned_to=p_assignee,due_date=p_due,version=version+1,updated_at=clock_timestamp()
 WHERE workspace_id=p_ws AND id=p_id RETURNING * INTO r;
 RETURN growth_starter_private.op_finish(p_ws,a.actor,p_key,payload,growth_starter_private.op_request_json(r),'request.assigned',p_id);
 END $$;
CREATE FUNCTION growth_starter_private.op_transition(p_token text,p_ws text,p_key text,p_id text,p_status text,p_version integer,p_note text,p_decision boolean)
 RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $$
 DECLARE a record; payload jsonb; old jsonb; r growth_starter.work_requests;
 BEGIN
 SELECT * INTO a FROM growth_starter_private.op_actor(p_token,p_ws,
 CASE WHEN p_decision THEN ARRAY['owner','client'] ELSE ARRAY['owner','agency_admin','staff'] END);
 IF p_status IS NULL OR p_version IS NULL OR p_version<0 OR NOT growth_starter_private.op_text(p_note,0,600) THEN
 RAISE EXCEPTION 'invalid transition' USING ERRCODE='22023'; END IF;
 payload:=jsonb_build_object('op',CASE WHEN p_decision THEN 'decision' ELSE 'review' END,'id',p_id,'status',p_status,'version',p_version,'note',p_note);
 old:=growth_starter_private.op_receipt(p_ws,a.actor,p_key,payload); IF old IS NOT NULL THEN RETURN old; END IF;
 SELECT * INTO r FROM growth_starter.work_requests WHERE workspace_id=p_ws AND id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'request missing' USING ERRCODE='P0002'; END IF;
 IF r.version<>p_version THEN RAISE EXCEPTION 'version conflict' USING ERRCODE='23505'; END IF;
 IF p_decision THEN
  IF r.status<>'Awaiting approval' OR p_status NOT IN('Approved','Changes requested') THEN
   RAISE EXCEPTION 'transition conflict' USING ERRCODE='23505'; END IF;
 ELSE
  IF NOT ((r.status IN('Requested','Changes requested') AND p_status='In progress')
   OR (r.status='In progress' AND p_status='Awaiting approval') OR (r.status='Approved' AND p_status='Completed')) THEN
   RAISE EXCEPTION 'transition conflict' USING ERRCODE='23505'; END IF;
 END IF;
 UPDATE growth_starter.work_requests SET status=p_status,version=version+1,updated_at=clock_timestamp(),
 reviewed_by=CASE WHEN p_decision THEN reviewed_by ELSE a.actor END,
 decided_by=CASE WHEN p_decision THEN a.actor ELSE decided_by END
 WHERE workspace_id=p_ws AND id=p_id RETURNING * INTO r;
 IF p_note<>'' THEN INSERT INTO growth_starter.request_notes(workspace_id,request_id,actor_user_id,note)
 VALUES(p_ws,p_id,a.actor,p_note); END IF;
 RETURN growth_starter_private.op_finish(p_ws,a.actor,p_key,payload,growth_starter_private.op_request_json(r),
 CASE WHEN p_decision THEN 'request.decision' ELSE 'request.review' END,p_id);
 END $$;
CREATE FUNCTION growth_starter_private.ops_request_review(p_token text,p_ws text,p_key text,p_id text,p_status text,p_version integer)
 RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT growth_starter_private.op_transition(p_token,p_ws,p_key,p_id,p_status,p_version,'',false) $$;
CREATE FUNCTION growth_starter_private.ops_request_decide(p_token text,p_ws text,p_key text,p_id text,p_status text,p_version integer,p_note text)
 RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT growth_starter_private.op_transition(p_token,p_ws,p_key,p_id,p_status,p_version,p_note,true) $$;
CREATE FUNCTION growth_starter_private.ops_requests_page(p_token text,p_ws text,p_status text,p_kind text,p_assignee text,p_at timestamptz,p_id text,p_limit integer)
 RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 DECLARE result jsonb; BEGIN
 PERFORM growth_starter_private.op_actor(p_token,p_ws,ARRAY['owner','agency_admin','staff','client']);
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 51 OR (p_at IS NULL)<>(p_id IS NULL)
 OR (p_at IS NOT NULL AND NOT isfinite(p_at))
 OR (p_status IS NOT NULL AND p_status NOT IN('Requested','In progress','Awaiting approval','Approved','Changes requested','Completed'))
 OR (p_kind IS NOT NULL AND p_kind NOT IN('Website update','Social content','Local SEO','Other')) THEN
 RAISE EXCEPTION 'invalid page' USING ERRCODE='22023'; END IF;
 SELECT coalesce(jsonb_agg(growth_starter_private.op_request_json(q) ORDER BY q.updated_at DESC,q.id DESC),'[]'::jsonb) INTO result
 FROM (SELECT r.* FROM growth_starter.work_requests r WHERE workspace_id=p_ws
 AND (p_status IS NULL OR r.status=p_status) AND (p_kind IS NULL OR r.kind=p_kind)
 AND (p_assignee IS NULL OR r.assigned_to=p_assignee) AND (p_at IS NULL OR (r.updated_at,r.id)<(p_at,p_id))
 ORDER BY r.updated_at DESC,r.id DESC LIMIT p_limit) q;
 RETURN result;
 END $$;
CREATE FUNCTION growth_starter_private.ops_request_detail(p_token text,p_ws text,p_id text)
 RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 DECLARE r growth_starter.work_requests; notes jsonb; BEGIN
 PERFORM growth_starter_private.op_actor(p_token,p_ws,ARRAY['owner','agency_admin','staff','client']);
 SELECT * INTO r FROM growth_starter.work_requests WHERE workspace_id=p_ws AND id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'request missing' USING ERRCODE='P0002'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.id::bigint DESC),'[]'::jsonb) INTO notes
 FROM (SELECT id::text,actor_user_id AS "actorId",note,created_at AS "createdAt"
 FROM growth_starter.request_notes WHERE workspace_id=p_ws AND request_id=p_id ORDER BY id DESC LIMIT 50) q;
 RETURN growth_starter_private.op_request_json(r)||jsonb_build_object('notesHistory',notes,'historyLimit',50);
 END $$;
CREATE FUNCTION growth_starter_private.ops_history_page(p_token text,p_ws text,p_before bigint,p_limit integer)
 RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 DECLARE result jsonb; BEGIN
 PERFORM growth_starter_private.op_actor(p_token,p_ws,ARRAY['owner','agency_admin']);
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 51 OR p_before<=0 THEN RAISE EXCEPTION 'invalid page' USING ERRCODE='22023'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.id::bigint DESC),'[]'::jsonb) INTO result FROM
 (SELECT id::text,actor_user_id AS "actorId",action,target,happened_at AS "at" FROM growth_starter.audit_events
 WHERE workspace_id=p_ws AND (p_before IS NULL OR id<p_before) ORDER BY id DESC LIMIT p_limit) q;
 RETURN result;
 END $$;
CREATE FUNCTION growth_starter_private.ops_member_revoke(p_token text,p_ws text,p_key text,p_user text)
 RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 DECLARE a record; payload jsonb; old jsonb; result jsonb; BEGIN
 SELECT * INTO a FROM growth_starter_private.op_actor(p_token,p_ws,ARRAY['owner']);
 IF p_user IS NULL OR p_user=a.actor THEN RAISE EXCEPTION 'operation denied' USING ERRCODE='28000'; END IF;
 payload:=jsonb_build_object('op','revoke','user',p_user);
 old:=growth_starter_private.op_receipt(p_ws,a.actor,p_key,payload); IF old IS NOT NULL THEN RETURN old; END IF;
 UPDATE growth_starter.memberships SET state='revoked',revoked_at=clock_timestamp(),updated_at=clock_timestamp()
 WHERE workspace_id=p_ws AND user_id=p_user AND owner_user_id=a.owner_id AND state='active';
 IF NOT FOUND THEN RAISE EXCEPTION 'member missing' USING ERRCODE='P0002'; END IF;
 result:=jsonb_build_object('revoked',true);
 RETURN growth_starter_private.op_finish(p_ws,a.actor,p_key,payload,result,'membership.revoked',p_user);
 END $$;
CREATE FUNCTION growth_starter_private.ops_media_read(p_token text,p_ws text,p_id text)
 RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 DECLARE result jsonb; BEGIN
 PERFORM growth_starter_private.op_actor(p_token,p_ws,ARRAY['owner','agency_admin','staff','client']);
 SELECT jsonb_build_object('storage_key',storage_key,'content_type',content_type) INTO result FROM growth_starter.media
 WHERE workspace_id=p_ws AND id=p_id AND lifecycle='stored' AND consent_state='approved' AND scan_state='clean' AND declared_rights;
 IF result IS NULL THEN RAISE EXCEPTION 'media denied' USING ERRCODE='28000'; END IF;
 RETURN result; -- Server-only key. Transport never emits a public storage URL.
 END $$;
CREATE FUNCTION growth_starter_private.ops_media_delete(p_token text,p_ws text,p_key text,p_id text)
 RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 DECLARE a record; payload jsonb; old jsonb; storage text; result jsonb; BEGIN
 SELECT * INTO a FROM growth_starter_private.op_actor(p_token,p_ws,ARRAY['owner','agency_admin']);
 payload:=jsonb_build_object('op','media.delete','id',p_id);
 old:=growth_starter_private.op_receipt(p_ws,a.actor,p_key,payload); IF old IS NOT NULL THEN RETURN old; END IF;
 UPDATE growth_starter.media SET lifecycle='delete_pending',consent_state='withdrawn'
 WHERE workspace_id=p_ws AND id=p_id AND lifecycle='stored' RETURNING storage_key INTO storage;
 IF NOT FOUND THEN RAISE EXCEPTION 'media conflict' USING ERRCODE='23505'; END IF;
 INSERT INTO growth_starter.media_delete_outbox(workspace_id,media_id,storage_key) VALUES(p_ws,p_id,storage)
 ON CONFLICT(workspace_id,media_id) DO NOTHING;
 result:=jsonb_build_object('queued',true,'mediaId',p_id);
 RETURN growth_starter_private.op_finish(p_ws,a.actor,p_key,payload,result,'media.delete_queued',p_id);
 END $$;
CREATE FUNCTION growth_starter_private.ops_automation_authorize(p_token text,p_ws text)
 RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 DECLARE a record; BEGIN
 SELECT * INTO a FROM growth_starter_private.op_actor(p_token,p_ws,ARRAY['owner']);
 RETURN jsonb_build_object('workspaceId',p_ws,'userId',a.actor,'role',a.role,'mode','sandbox_only');
 END $$;
-- Lock direct Codeedge session changes too. No Auth-managed object is touched.
CREATE FUNCTION growth_starter_private.lock_session_writer()
 RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $$
 BEGIN
 IF TG_OP='UPDATE' AND (OLD.id<>NEW.id OR OLD.user_id<>NEW.user_id OR OLD.provider_session_id<>NEW.provider_session_id OR OLD.secret_sha256<>NEW.secret_sha256) THEN
 RAISE EXCEPTION 'session identity immutable'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('growth-starter:k:session:'||OLD.id::text,0));
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
 END $$;
CREATE TRIGGER gs315p_session_writer BEFORE UPDATE OR DELETE ON growth_starter_private.codeedge_sessions
 FOR EACH ROW EXECUTE FUNCTION growth_starter_private.lock_session_writer();
-- Revoke Supabase explicit default grants as well as PUBLIC. Internal functions
-- can only be invoked by the NOLOGIN operation owner; runtime has exact ops_*.
DO $$ DECLARE f record; r text; BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='growth_starter_private' AND (p.proname LIKE 'ops_%' OR p.proname LIKE 'op_%' OR p.proname='lock_session_writer') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',f.signature);
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
   IF EXISTS(SELECT FROM pg_roles WHERE rolname=r) THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I',f.signature,r); END IF;
  END LOOP;
  IF f.proname<>'lock_session_writer' THEN
   EXECUTE format('ALTER FUNCTION %s OWNER TO gs315p_ops_owner',f.signature);
   IF f.proname LIKE 'ops_%' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO gs315p_writer',f.signature); END IF;
  END IF;
 END LOOP;
END $$;
COMMIT;
