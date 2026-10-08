import { DomainError } from './core.mjs';
import { createStagingGateway } from './staging-gateway.mjs';

// Intentionally fixed queries: this connection cannot run arbitrary SQL from
// the app or accept a caller-generated SQL fragment.
const workspacesSQL = 'SELECT workspace_id, role FROM growth_starter.staging_list_workspaces($1)';
const requestsSQL = 'SELECT id, workspace_id, title, kind, status, version, updated_at FROM growth_starter.staging_list_requests($1,$2,$3)';
const sessionSQL = 'SELECT growth_starter.staging_session_active($1,$2,$3) AS active';

function fail() {
  throw new DomainError('Restricted staging PostgreSQL runtime required.', 503);
}

function isSafeSubject(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(value);
}

/**
 * Establishes a privilege-checked read boundary before opening an HTTP server.
 * rawPool must authenticate as a distinct, non-owner LOGIN with SET permission
 * to growth_starter_reader; admin/superuser/service-role pools fail closed.
 *
 * No unrestricted pool/query handle is returned to HTTP route handlers.
 */
export async function createRestrictedStagingPool({ rawPool }) {
  if (!rawPool || typeof rawPool.connect !== 'function') fail();
  const conn = await rawPool.connect();
  try {
    const query = `
      SELECT
        current_user AS database_login,
        session_user AS authenticated_login,
        r.rolcanlogin, r.rolsuper, r.rolbypassrls, r.rolcreatedb,
        r.rolcreaterole, r.rolreplication, r.rolinherit,
        pg_has_role(current_user, 'growth_starter_reader', 'SET') AS can_set_reader,
        has_database_privilege(current_user, current_database(), 'CREATE') AS can_create_db_objects,
        has_schema_privilege(current_user, 'growth_starter', 'CREATE') AS can_create_schema_objects,
        EXISTS (
          SELECT 1 FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid
          WHERE n.nspname='growth_starter' AND c.relkind IN ('r','p','v','m','f')
          AND (has_table_privilege(current_user,c.oid,'SELECT')
            OR has_table_privilege(current_user,c.oid,'INSERT')
            OR has_table_privilege(current_user,c.oid,'UPDATE')
            OR has_table_privilege(current_user,c.oid,'DELETE'))
        ) AS direct_table_access,
        rr.rolcanlogin AS reader_can_login,
        rr.rolsuper AS reader_super,
        rr.rolbypassrls AS reader_bypassrls,
        rr.rolcreaterole AS reader_create_role,
        rr.rolcreatedb AS reader_create_db,
        rr.rolinherit AS reader_inherit,
        has_schema_privilege('growth_starter_reader','growth_starter','CREATE') AS reader_can_create,
        EXISTS (
          SELECT 1 FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid
          WHERE n.nspname='growth_starter' AND c.relkind IN ('r','p','v','m','f')
          AND (has_table_privilege('growth_starter_reader',c.oid,'SELECT')
            OR has_table_privilege('growth_starter_reader',c.oid,'INSERT')
            OR has_table_privilege('growth_starter_reader',c.oid,'UPDATE')
            OR has_table_privilege('growth_starter_reader',c.oid,'DELETE'))
        ) AS reader_direct_table_access,
        EXISTS (
          SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
          WHERE n.nspname='growth_starter'
          AND has_function_privilege('growth_starter_reader',p.oid,'EXECUTE')
          AND NOT (
            COALESCE(p.oid=to_regprocedure('growth_starter.staging_list_workspaces(text)'),false)
            OR COALESCE(p.oid=to_regprocedure('growth_starter.staging_list_requests(text,text,integer)'),false)
            OR COALESCE(p.oid=to_regprocedure('growth_starter.staging_session_active(text,text,text)'),false)
          )
        ) AS reader_extra_functions
      FROM pg_roles r CROSS JOIN pg_roles rr
      WHERE r.rolname=current_user AND rr.rolname='growth_starter_reader'
    `;
    const result = await conn.query(query);
    const r = result.rows?.[0];
    if (!r || !r.rolcanlogin || r.database_login !== r.authenticated_login ||
        r.database_login === 'growth_starter_reader' ||
        r.rolsuper || r.rolbypassrls || r.rolcreatedb ||
        r.rolcreaterole || r.rolreplication || r.rolinherit ||
        !r.can_set_reader || r.can_create_db_objects ||
        r.can_create_schema_objects || r.direct_table_access ||
        r.reader_can_login || r.reader_super || r.reader_bypassrls ||
        r.reader_create_role || r.reader_create_db || r.reader_inherit ||
        r.reader_can_create || r.reader_direct_table_access ||
        r.reader_extra_functions) fail();

    // Prove the runtime can only enter the reader role for read-only statements.
    await conn.query('BEGIN READ ONLY');
    await conn.query('SET LOCAL ROLE growth_starter_reader');
    const effective = await conn.query('SELECT current_user AS role_name');
    if (effective.rows?.[0]?.role_name !== 'growth_starter_reader') fail();
    await conn.query('COMMIT');
  } catch (caught) {
    try { await conn.query('ROLLBACK'); } catch {}
    if (caught instanceof DomainError) throw caught;
    fail();
  } finally {
    conn.release();
  }

  return Object.freeze({
    capabilities: Object.freeze({ restrictedNonOwner: true, readOnly: true }),
    async query(sql, args) {
      if (sql === workspacesSQL) {
        if (!Array.isArray(args) || args.length !== 1 || !isSafeSubject(args[0])) fail();
      } else if (sql === requestsSQL) {
        if (!Array.isArray(args) || args.length !== 3 || !isSafeSubject(args[0]) ||
            typeof args[1] !== 'string' || !/^ws_[A-Za-z0-9_-]{8,128}$/.test(args[1]) ||
            !Number.isInteger(args[2]) || args[2] < 1 || args[2] > 50) fail();
      } else if (sql === sessionSQL) {
        const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if(!Array.isArray(args) || args.length!==3 ||
           !uuid.test(args[0] || '') || !uuid.test(args[1] || '') ||
           typeof args[2]!=='string' || args[2].length>254 ||
           !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(args[2])) fail();
      } else fail();

      const client = await rawPool.connect();
      try {
        await client.query('BEGIN READ ONLY');
        await client.query('SET LOCAL ROLE growth_starter_reader');
        await client.query("SET LOCAL statement_timeout = '2000ms'");
        await client.query("SET LOCAL idle_in_transaction_session_timeout = '3000ms'");
        const result = await client.query(sql, args);
        await client.query('COMMIT');
        return result;
      } catch (caught) {
        try { await client.query('ROLLBACK'); } catch {}
        throw caught;
      } finally {
        client.release();
      }
    }
  });
}

/** Fails before opening any listening socket unless real DB privileges verify. */
export async function createRestrictedStagingGateway({ rawPool, identityVerifier, allowedOrigin }) {
  if (!identityVerifier || typeof identityVerifier.verifyAuthorization !== 'function') fail();
  const pool = await createRestrictedStagingPool({ rawPool });
  return createStagingGateway({ pool, identityVerifier, allowedOrigin });
}
