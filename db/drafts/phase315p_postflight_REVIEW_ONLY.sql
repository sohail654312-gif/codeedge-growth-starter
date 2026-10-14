-- REVIEW_ONLY assertions inside the uncommitted approved migration transaction.
-- No LOGIN credentials or Dashboard/Auth acceptance is established by this SQL.
DO $$ DECLARE r record; f record; BEGIN
 FOR r IN SELECT * FROM pg_roles WHERE rolname IN('gs315p_writer','gs315p_ops_owner') LOOP
  IF r.rolsuper OR r.rolinherit OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication
  OR r.rolcanlogin OR EXISTS(SELECT FROM pg_auth_members WHERE member=r.oid) THEN
   RAISE EXCEPTION 'unsafe Phase P role: %',r.rolname; END IF;
 END LOOP;
 IF (SELECT count(*) FROM pg_roles WHERE rolname IN('gs315p_writer','gs315p_ops_owner'))<>2 THEN RAISE EXCEPTION 'missing Phase P roles'; END IF;
 IF has_schema_privilege('gs315p_writer','growth_starter','USAGE') OR has_schema_privilege('gs315p_writer','growth_starter_private','CREATE') THEN
 RAISE EXCEPTION 'writer schema boundary failed'; END IF;
 IF EXISTS(SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname IN('growth_starter','growth_starter_private','auth') AND c.relkind IN('r','p','v','m','f')
 AND (has_any_column_privilege('gs315p_writer',c.oid,'SELECT,INSERT,UPDATE,REFERENCES') OR has_table_privilege('gs315p_writer',c.oid,'DELETE,TRUNCATE,TRIGGER'))) THEN
 RAISE EXCEPTION 'writer direct table access'; END IF;
 IF EXISTS(SELECT FROM pg_roles b WHERE b.rolname IN('anon','authenticated','service_role') AND
 (has_schema_privilege(b.oid,'growth_starter_private','USAGE') OR EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='growth_starter_private' AND has_function_privilege(b.oid,p.oid,'EXECUTE')))) THEN RAISE EXCEPTION 'browser private API remains'; END IF;
 FOR f IN SELECT p.*,o.rolname AS owner FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles o ON o.oid=p.proowner
 WHERE n.nspname='growth_starter_private' AND left(p.proname,4)='ops_' LOOP
  IF NOT f.prosecdef OR f.owner<>'gs315p_ops_owner' OR f.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']
  OR NOT has_function_privilege('gs315p_writer',f.oid,'EXECUTE') THEN RAISE EXCEPTION 'unsafe fixed operation: %',f.proname; END IF;
 END LOOP;
 IF EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='growth_starter_private' AND EXISTS(SELECT FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
 WHERE a.grantee=0 AND a.privilege_type='EXECUTE')) THEN RAISE EXCEPTION 'private PUBLIC EXECUTE remains'; END IF;
END $$;
