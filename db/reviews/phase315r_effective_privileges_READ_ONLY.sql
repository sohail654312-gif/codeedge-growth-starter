-- PHASE 3.15R — REVIEW / READ ONLY. No patient/Auth data or secrets.
-- Intended ONLY for codeedge-growth-starter-staging (dbppeymhsemvghbvuvof).
-- This metadata cannot attest project identity, exposed schemas, provider
-- session revocation semantics, passwords, actual API denial or approvals.
BEGIN TRANSACTION READ ONLY;
WITH legacy AS (
 SELECT p.oid,p.proname,p.prosecdef
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='growth_starter' AND p.proname IN
 ('staging_list_workspaces','staging_list_requests','staging_session_active')
), tabs AS (
 SELECT c.oid,n.nspname,c.relrowsecurity,c.relforcerowsecurity
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname IN ('growth_starter','growth_starter_private') AND c.relkind IN ('r','p')
), role_catalog AS (
 SELECT r.oid,r.rolname,r.rolcanlogin,r.rolsuper,r.rolbypassrls,
  r.rolinherit,r.rolcreatedb,r.rolcreaterole,r.rolreplication
 FROM pg_roles r WHERE r.rolname IN (
 'growth_starter_reader','growth_starter_runtime','growth_starter_session_checker',
 'gs315m_issuer','gs315k_gateway','gs315p_writer','gs315p_ops_owner')
)
SELECT jsonb_build_object(
 'schemaVersion',2,'snapshotKind','growth_starter_privilege_cutover_catalog',
 'roles',(SELECT COALESCE(jsonb_object_agg(rolname,jsonb_build_object(
    'login',rolcanlogin,'super',rolsuper,'bypassRls',rolbypassrls,
    'inherit',rolinherit,'createDb',rolcreatedb,'createRole',rolcreaterole,
    'replication',rolreplication,'grantedRoles',(
       SELECT count(*)::int FROM pg_auth_members m WHERE m.member=role_catalog.oid))),'{}'::jsonb) FROM role_catalog),
 'legacyDefiners',(SELECT count(*)::int FROM legacy WHERE prosecdef),
 'legacyReaderExecutables',(SELECT count(*)::int FROM legacy l WHERE l.prosecdef AND EXISTS(
    SELECT 1 FROM role_catalog r WHERE r.rolname='growth_starter_reader'
      AND has_function_privilege(r.oid,l.oid,'EXECUTE'))),
 'legacyAuthenticatedExecutables',(SELECT count(*)::int FROM legacy l WHERE l.prosecdef
    AND has_function_privilege('authenticated',l.oid,'EXECUTE')),
 'legacyPublicExecutables',(SELECT count(*)::int FROM legacy l WHERE l.prosecdef
    AND has_function_privilege('public',l.oid,'EXECUTE')),
 'oldSetRole',(SELECT COALESCE((SELECT pg_has_role(runtime.oid,reader.oid,'SET')
    FROM role_catalog runtime CROSS JOIN role_catalog reader
    WHERE runtime.rolname='growth_starter_runtime' AND reader.rolname='growth_starter_reader'),false)),
 'authenticatedColumnSelects',(SELECT count(*)::int FROM information_schema.column_privileges
    WHERE table_schema='growth_starter' AND grantee='authenticated' AND privilege_type='SELECT'),
 'authenticatedSchemaUsage',has_schema_privilege('authenticated','growth_starter','USAGE'),
 'anonSchemaUsage',has_schema_privilege('anon','growth_starter','USAGE'),
 'authenticatedTableReads',(SELECT count(*)::int FROM tabs WHERE nspname='growth_starter'
    AND has_table_privilege('authenticated',oid,'SELECT')),
 'anonTableReads',(SELECT count(*)::int FROM tabs WHERE nspname='growth_starter'
    AND has_table_privilege('anon',oid,'SELECT')),
 'privateTableCount',(SELECT count(*)::int FROM tabs WHERE nspname='growth_starter_private'),
 'privateNotForcedRls',(SELECT count(*)::int FROM tabs WHERE nspname='growth_starter_private'
    AND (NOT relrowsecurity OR NOT relforcerowsecurity)),
 'anonPrivateSchemaUsage',(SELECT CASE WHEN EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='growth_starter_private')
    THEN has_schema_privilege('anon','growth_starter_private','USAGE') ELSE NULL END),
 'authenticatedPrivateSchemaUsage',(SELECT CASE WHEN EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='growth_starter_private')
    THEN has_schema_privilege('authenticated','growth_starter_private','USAGE') ELSE NULL END),
 'writerCanUsePrivateSchema',(SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM role_catalog WHERE rolname='gs315p_writer')
    OR NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='growth_starter_private')
    THEN NULL ELSE has_schema_privilege('gs315p_writer','growth_starter_private','USAGE') END),
 'writerCanReadRaw',(SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM role_catalog WHERE rolname='gs315p_writer')
    THEN NULL ELSE (SELECT count(*)::int FROM tabs t JOIN pg_attribute a ON a.attrelid=t.oid
      AND a.attnum>0 AND NOT a.attisdropped
      WHERE has_column_privilege('gs315p_writer',t.oid,a.attnum,'SELECT')) END),
 'writerCanMutateRaw',(SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM role_catalog WHERE rolname='gs315p_writer')
    THEN NULL ELSE (SELECT count(*)::int FROM tabs t
      WHERE has_table_privilege('gs315p_writer',t.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))+
      (SELECT count(*)::int FROM tabs t JOIN pg_attribute a ON a.attrelid=t.oid
      AND a.attnum>0 AND NOT a.attisdropped
      WHERE has_column_privilege('gs315p_writer',t.oid,a.attnum,'INSERT,UPDATE,REFERENCES')) END),
 'writerCanUseAuth',(SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM role_catalog WHERE rolname='gs315p_writer')
    THEN NULL ELSE has_schema_privilege('gs315p_writer','auth','USAGE') END),
 'writerCanCreatePublic',(SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM role_catalog WHERE rolname='gs315p_writer')
    THEN NULL ELSE has_schema_privilege('gs315p_writer','public','CREATE') END),
 'writerCanSetOwner',(SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM role_catalog WHERE rolname='gs315p_writer')
    OR NOT EXISTS(SELECT 1 FROM role_catalog WHERE rolname='gs315p_ops_owner')
    THEN NULL ELSE pg_has_role((SELECT oid FROM role_catalog WHERE rolname='gs315p_writer'),
      (SELECT oid FROM role_catalog WHERE rolname='gs315p_ops_owner'),'SET') END),
 'checkerCanUseAuth',(SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM role_catalog WHERE rolname='growth_starter_session_checker')
    THEN NULL ELSE has_schema_privilege('growth_starter_session_checker','auth','USAGE') END)
) AS snapshot;
COMMIT;
