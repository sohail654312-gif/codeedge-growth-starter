/**
 * Phase 3.15G — disposable PG17 *negative* least-privilege evidence.
 * SELECT FOR SHARE requires UPDATE privilege even for lock-only readers.
 * No hosted migrations or grants are ever issued.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import pg from 'pg';
if(!process.env.TEST_DATABASE_URL)throw Error('Disposable PostgreSQL only.');
const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,max:1});
const A='a315d2e9-f1f0-4cd9-8bfa-0983be1434ab';
const B='b315d2e9-f1f0-4cd9-8bfa-0983be1434ab';
const WA='ws_'+A,WB='ws_'+B;
const ROLE='gs315g_strict_read_only';
const TABLE='growth_starter.workspaces';
test('isolated PG17: RLS denies other tenants and FOR SHARE needs an UPDATE grant',async()=>{
 const c=await pool.connect();
 try{
  const vers=Number((await c.query('SHOW server_version_num')).rows[0].server_version_num);
  assert.ok(vers>=170000&&vers<180000);
  for(const f of ['0001_growth_starter.sql','0002_staging_readonly.sql','0003_staging_default_deny_rls.sql'])
   await c.query(readFileSync('db/migrations/'+f,'utf8'));
  await c.query('BEGIN');
  try{
   await c.query('INSERT INTO '+TABLE+'(id,owner_user_id) VALUES($1,$2),($3,$4)',[WA,A,WB,B]);
   await c.query('CREATE ROLE '+ROLE+' NOLOGIN NOINHERIT NOBYPASSRLS NOSUPERUSER NOCREATEROLE NOCREATEDB');
   await c.query('GRANT USAGE ON SCHEMA growth_starter TO '+ROLE);
   await c.query('GRANT SELECT(id,owner_user_id,state) ON '+TABLE+' TO '+ROLE);
   await c.query('CREATE POLICY gs315g_owned_workspace ON '+TABLE+
    ' FOR SELECT TO '+ROLE+' USING(id='+ "'" +WA+ "'" +')');
   const p=await c.query('SELECT rolsuper,rolbypassrls,rolcreaterole,rolcanlogin FROM pg_roles WHERE rolname=$1',[ROLE]);
   assert.deepEqual(Object.values(p.rows[0]),[false,false,false,false]);
   assert.equal((await c.query('SELECT pg_has_role($1,$2,$3) AS allowed',[ROLE,'authenticated','SET'])).rows[0].allowed,false);
   await c.query('SAVEPOINT as_reader');
   await c.query('SET LOCAL ROLE '+ROLE);
   assert.deepEqual((await c.query('SELECT id FROM '+TABLE+' ORDER BY id')).rows.map(x=>x.id),[WA]);
   assert.deepEqual((await c.query('SELECT id FROM '+TABLE+' WHERE id=$1',[WB])).rows,[]);
   await c.query('SAVEPOINT lock_attempt');
   await assert.rejects(c.query('SELECT id FROM '+TABLE+' WHERE id=$1 FOR SHARE',[WA]),
    e=>e.code==='42501','locking SELECT needs UPDATE privilege');
   await c.query('ROLLBACK TO SAVEPOINT lock_attempt');
   await c.query('RELEASE SAVEPOINT lock_attempt');
   await assert.rejects(c.query('SELECT * FROM '+TABLE),e=>e.code==='42501');
   await c.query('ROLLBACK TO SAVEPOINT as_reader');
   await c.query('RELEASE SAVEPOINT as_reader');
   // Even a seemingly harmless UPDATE(column) grant broadens SQL capability.
   // It must not be added blindly; demonstrate lock feasibility only in CI.
   await c.query('GRANT UPDATE(state) ON '+TABLE+' TO '+ROLE);
   await c.query('SAVEPOINT with_update_grant');
   await c.query('SET LOCAL ROLE '+ROLE);
   assert.deepEqual((await c.query('SELECT id FROM '+TABLE+' WHERE id=$1 FOR SHARE',[WA]))
    .rows.map(x=>x.id),[WA]);
   await c.query('SAVEPOINT write_attempt');
   await assert.rejects(c.query("UPDATE "+TABLE+" SET state='suspended' WHERE id=$1",[WA]),
    e=>e.code==='42501'||e.code==='44000',
    'RLS still denies UPDATE because no update policy is granted');
   await c.query('ROLLBACK TO SAVEPOINT write_attempt');
   await c.query('RELEASE SAVEPOINT write_attempt');
   await c.query('ROLLBACK TO SAVEPOINT with_update_grant');
   await c.query('RELEASE SAVEPOINT with_update_grant');
  }finally{await c.query('ROLLBACK');}
 }finally{c.release();await pool.end();}
});
