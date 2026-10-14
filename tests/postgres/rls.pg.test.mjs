import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import pg from 'pg';
const {Pool}=pg;
if(!process.env.TEST_DATABASE_URL)throw Error('Disposable TEST_DATABASE_URL required; never run RLS probes on real staging data.');
const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL,max:3});
const tables=['workspaces','memberships','invitations','work_requests','media','media_delete_outbox','audit_events'];
before(async()=>{
  for (const migration of ['0001_growth_starter.sql','0002_staging_readonly.sql','0003_staging_default_deny_rls.sql']) {
    await pool.query(readFileSync('db/migrations/'+migration,'utf8'));
  }
  await pool.query("INSERT INTO growth_starter.workspaces(id,owner_user_id) VALUES ('ws_rls_only_test_owner_123','rls_only_test_owner_123') ON CONFLICT (id) DO NOTHING");
  await pool.query('CREATE ROLE gs_rls_probe NOLOGIN NOINHERIT NOBYPASSRLS');
  // Deliberately grant read/write privileges in disposable CI ONLY to prove
  // that RLS still denies actual rows when permissions drift.
  await pool.query('GRANT USAGE ON SCHEMA growth_starter TO gs_rls_probe');
  await pool.query('GRANT SELECT, INSERT, UPDATE, DELETE ON growth_starter.workspaces TO gs_rls_probe');
});
after(async()=>{await pool.end();});
test('every Growth Starter table has RLS on and no policies',async()=>{
  const result=await pool.query(`SELECT c.relname, c.relrowsecurity,
   (SELECT count(*)::int FROM pg_policies p WHERE p.schemaname='growth_starter' AND p.tablename=c.relname) AS policies
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='growth_starter' AND c.relkind IN ('r','p') ORDER BY c.relname`);
  assert.equal(result.rows.length,7);
  assert.deepEqual(result.rows.map(r=>r.relname).sort(),tables.slice().sort());
  for(const row of result.rows){assert.equal(row.relrowsecurity,true,row.relname);assert.equal(row.policies,0,row.relname);}
});
test('default-deny RLS blocks SELECT, INSERT and DELETE even with temporary table grants',async()=>{
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM growth_starter.workspaces WHERE owner_user_id='rls_only_test_owner_123'")).rows[0].n,1);
  const conn=await pool.connect();
  try{
    await conn.query('BEGIN');
    await conn.query('SET LOCAL ROLE gs_rls_probe');
    assert.equal((await conn.query('SELECT count(*)::int AS n FROM growth_starter.workspaces')).rows[0].n,0);
    assert.equal((await conn.query("DELETE FROM growth_starter.workspaces WHERE id='ws_rls_only_test_owner_123'")).rowCount,0);
    await assert.rejects(conn.query("INSERT INTO growth_starter.workspaces(id,owner_user_id) VALUES ('ws_rls_only_test_forged_123','rls_only_test_forged_123')"),e=>e.code==='42501');
  }finally{
    try{await conn.query('ROLLBACK');}finally{conn.release();}
  }
});
