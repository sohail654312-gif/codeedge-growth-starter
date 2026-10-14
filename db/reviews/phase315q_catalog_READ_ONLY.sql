-- PHASE 3.15Q. READ ONLY, metadata only. Never copy Auth users/sessions or secrets.
-- Run only after confirming the intended staging project in Supabase Dashboard.
-- The returned row is not authenticated evidence of the project or API settings.
-- Data API exposed schemas, signed REST/GraphQL denial, and provider logout
-- semantics CANNOT be established by this SQL. Verify separately.
BEGIN TRANSACTION READ ONLY;
WITH expected_roles(role_name) AS (
 VALUES ('gs315m_issuer'),('gs315k_gateway'),('gs315p_writer'),
        ('growth_starter_session_checker')
), role_report AS (
 SELECT e.role_name,r.oid IS NOT NULL AS exists,r.rolcanlogin AS can_login
 FROM expected_roles e LEFT JOIN pg_roles r ON r.rolname=e.role_name
), existing_tables AS (
 SELECT c.oid,c.relrowsecurity,n.nspname
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE c.relkind IN ('r','p') AND n.nspname IN ('growth_starter','growth_starter_private')
), legacy_functions AS (
 SELECT p.oid,p.prosecdef
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='growth_starter'
  AND p.proname IN ('staging_list_workspaces','staging_list_requests','staging_session_active')
)
SELECT jsonb_build_object(
 'schemaVersion',1,
 'snapshotKind','growth_starter_staging_catalog',
 'databaseMajor',(current_setting('server_version_num')::int / 10000),
 'migrationVersions',(SELECT COALESCE(jsonb_agg(m.version::text ORDER BY m.version::text),'[]'::jsonb)
                      FROM supabase_migrations.schema_migrations m),
 'privateSchemaExists',(SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='growth_starter_private')),
 'roles',(SELECT jsonb_object_agg(role_name,jsonb_build_object('exists',exists,'canLogin',can_login))
          FROM role_report),
 'checkerAuthSchemaUsage',(SELECT has_schema_privilege(r.oid,'auth','USAGE')
                             FROM pg_roles r WHERE rolname='growth_starter_session_checker'),
 'legacyDefinerCount',(SELECT count(*)::int FROM legacy_functions WHERE prosecdef),
 'legacyReaderCallableCount',(SELECT count(*)::int FROM legacy_functions l
                               CROSS JOIN pg_roles r WHERE r.rolname='growth_starter_reader'
                                AND l.prosecdef AND has_function_privilege(r.oid,l.oid,'EXECUTE')),
 'runtimeCanSetOldReader',(SELECT pg_has_role(runtime.oid,reader.oid,'SET')
                            FROM pg_roles runtime CROSS JOIN pg_roles reader
                            WHERE runtime.rolname='growth_starter_runtime'
                              AND reader.rolname='growth_starter_reader'),
 'authenticatedColumnGrants',(SELECT count(*)::int FROM information_schema.column_privileges
                                WHERE table_schema='growth_starter'
                                  AND grantee='authenticated' AND privilege_type='SELECT'),
 'authenticatedSchemaUsage',has_schema_privilege('authenticated','growth_starter','USAGE'),
 'growthTables',(SELECT count(*)::int FROM existing_tables WHERE nspname='growth_starter'),
 'growthTablesWithoutRls',(SELECT count(*)::int FROM existing_tables
                             WHERE nspname='growth_starter' AND NOT relrowsecurity),
 'privateTables',(SELECT count(*)::int FROM existing_tables WHERE nspname='growth_starter_private'),
 'privateTablesWithoutRls',(SELECT count(*)::int FROM existing_tables
                              WHERE nspname='growth_starter_private' AND NOT relrowsecurity)
) AS snapshot;
COMMIT;
