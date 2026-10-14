/**
 * Phase 3.15A — disposable PostgreSQL privilege-boundary experiment.
 *
 * This deliberately uses a synthetic auth-like schema, NOT managed Supabase
 * auth. It proves ordinary PostgreSQL column grants alone cannot be used
 * without schema USAGE, and verifies the proposed least-privilege envelope
 * inside one rolled-back transaction. It does NOT authorize a hosted grant.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
if(!process.env.TEST_DATABASE_URL)throw Error('Disposable PostgreSQL required; never connect to hosted Supabase.');
const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,max:1});
const ROLE='gs315a_disposable_checker';
const SCHEMA='gs315a_auth_fixture';
const USER='f39d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const SESSION='f49d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const FOREIGN='529d2e94-f1f0-4cd9-8bfa-0983be1434ab';

test('schema USAGE is required in addition to six column grants; no broad rights escape',async()=>{
 const c=await pool.connect();
 try{
  await c.query('BEGIN');
  try{
   await c.query(`CREATE SCHEMA ${SCHEMA}`);
   await c.query(`CREATE TABLE ${SCHEMA}.users(
     id uuid PRIMARY KEY,deleted_at timestamptz,banned_until timestamptz,
     email text NOT NULL)`);
   await c.query(`CREATE TABLE ${SCHEMA}.sessions(
     id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES ${SCHEMA}.users(id),
     not_after timestamptz,ip inet)`);
   await c.query(`REVOKE ALL ON SCHEMA ${SCHEMA} FROM PUBLIC`);
   await c.query(`REVOKE ALL ON ALL TABLES IN SCHEMA ${SCHEMA} FROM PUBLIC`);
   await c.query(`CREATE ROLE ${ROLE} NOLOGIN NOINHERIT NOSUPERUSER
     NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION`);
   await c.query(`GRANT SELECT(id,user_id,not_after)
      ON ${SCHEMA}.sessions TO ${ROLE}`);
   await c.query(`GRANT SELECT(id,deleted_at,banned_until)
      ON ${SCHEMA}.users TO ${ROLE}`);
   await c.query(`INSERT INTO ${SCHEMA}.users(id,email)
      VALUES($1,'fictional@invalid.example'),($2,'other@invalid.example')`,[USER,FOREIGN]);
   await c.query(`INSERT INTO ${SCHEMA}.sessions(id,user_id)
      VALUES($1,$2)`,[SESSION,USER]);
   const before=(await c.query(`SELECT
      r.rolcanlogin AS can_login,r.rolsuper AS superuser,
      r.rolbypassrls AS bypass_rls,r.rolinherit AS inherits,
      has_schema_privilege($1,${"'"+SCHEMA+"'"},'USAGE') AS schema_usage,
      has_column_privilege($1,${"'"+SCHEMA+".sessions'"},'id','SELECT') AS id_column,
      has_column_privilege($1,${"'"+SCHEMA+".users'"},'banned_until','SELECT') AS banned_column,
      has_table_privilege($1,${"'"+SCHEMA+".sessions'"},'SELECT') AS whole_session_table
     FROM pg_roles r WHERE r.rolname=$1`,[ROLE])).rows[0];
   assert.equal(before.can_login,false);
   assert.equal(before.superuser,false);
   assert.equal(before.bypass_rls,false);
   assert.equal(before.inherits,false);
   assert.equal(before.schema_usage,false);
   assert.equal(before.id_column,true);
   assert.equal(before.banned_column,true);
   assert.equal(before.whole_session_table,false);

   // A role with only column grants CANNOT query the table.
   await c.query('SAVEPOINT missing_schema_usage');
   await c.query(`SET LOCAL ROLE ${ROLE}`);
   await assert.rejects(c.query(`SELECT id FROM ${SCHEMA}.sessions`),
     error=>error.code==='42501');
   await c.query('ROLLBACK TO SAVEPOINT missing_schema_usage');
   await c.query('RELEASE SAVEPOINT missing_schema_usage');

   // Ordinary Postgres permits minimal USAGE without widening column SELECT.
   await c.query(`GRANT USAGE ON SCHEMA ${SCHEMA} TO ${ROLE}`);
   await c.query('SAVEPOINT narrow_reader');
   await c.query(`SET LOCAL ROLE ${ROLE}`);
   const owner=await c.query(`SELECT s.id::text AS sid
     FROM ${SCHEMA}.sessions s JOIN ${SCHEMA}.users u ON u.id=s.user_id
     WHERE s.id=$1::uuid AND s.user_id=$2::uuid LIMIT 1`,[SESSION,USER]);
   assert.equal(owner.rows[0]?.sid,SESSION);
   const wrong=await c.query(`SELECT s.id::text AS sid
     FROM ${SCHEMA}.sessions s JOIN ${SCHEMA}.users u ON u.id=s.user_id
     WHERE s.id=$1::uuid AND s.user_id=$2::uuid LIMIT 1`,[SESSION,FOREIGN]);
   assert.deepEqual(wrong.rows,[]);

   for(const [name,query] of [
    ['private_email',`SELECT email FROM ${SCHEMA}.users`],
    ['session_ip',`SELECT ip FROM ${SCHEMA}.sessions`],
    ['full_session_row',`SELECT * FROM ${SCHEMA}.sessions`],
    ['write_session',`DELETE FROM ${SCHEMA}.sessions`]
   ]){
    await c.query('SAVEPOINT deny_'+name);
    await assert.rejects(c.query(query),error=>error.code==='42501',
      name+' must remain inaccessible');
    await c.query('ROLLBACK TO SAVEPOINT deny_'+name);
    await c.query('RELEASE SAVEPOINT deny_'+name);
   }
   await c.query('ROLLBACK TO SAVEPOINT narrow_reader');
   await c.query('RELEASE SAVEPOINT narrow_reader');

   // LOGIN toggling is a separate, controlled operation; it does not
   // implicitly grant table or schema privileges. No password is set.
   await c.query(`ALTER ROLE ${ROLE} LOGIN`);
   const login=(await c.query(`SELECT rolcanlogin,rolsuper,rolbypassrls
      FROM pg_roles WHERE rolname=$1`,[ROLE])).rows[0];
   assert.equal(login.rolcanlogin,true);
   assert.equal(login.rolsuper,false);
   assert.equal(login.rolbypassrls,false);
   assert.equal((await c.query(`SELECT has_table_privilege($1,
      '${SCHEMA}.sessions','SELECT') AS allowed`,[ROLE])).rows[0].allowed,false);
   await c.query(`ALTER ROLE ${ROLE} NOLOGIN`);

   // Simulate revocation by deleting the fictional session as fixture owner.
   await c.query(`DELETE FROM ${SCHEMA}.sessions WHERE id=$1`,[SESSION]);
   await c.query('SAVEPOINT revoked_session');
   await c.query(`SET LOCAL ROLE ${ROLE}`);
   const revoked=await c.query(`SELECT id FROM ${SCHEMA}.sessions WHERE id=$1`,[SESSION]);
   assert.deepEqual(revoked.rows,[]);
   await c.query('ROLLBACK TO SAVEPOINT revoked_session');
   await c.query('RELEASE SAVEPOINT revoked_session');
  }finally{await c.query('ROLLBACK');}
 }finally{c.release();await pool.end();}
});
