import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import pg from 'pg';
if(!process.env.TEST_DATABASE_URL)throw Error('Disposable PostgreSQL required, not Supabase.');
const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,max:2});
test('review-only session role can check auth session membership, not read unrelated auth fields or write',async()=>{
 const c=await pool.connect();
 try{
  await c.query('CREATE SCHEMA IF NOT EXISTS auth');
  await c.query('CREATE TABLE IF NOT EXISTS auth.users(id uuid primary key,deleted_at timestamptz,banned_until timestamptz,email text)');
  await c.query('CREATE TABLE IF NOT EXISTS auth.sessions(id uuid primary key,user_id uuid references auth.users(id),not_after timestamptz,ip inet)');
  await c.query('CREATE SCHEMA IF NOT EXISTS growth_starter');
  await c.query('BEGIN');
  try{
   await c.query('ALTER TABLE auth.sessions ADD COLUMN IF NOT EXISTS gs_test_private inet');
   await c.query(readFileSync('db/drafts/0010_session_checker_minimal_auth_columns_REVIEW_ONLY.sql','utf8'));
   const a='f39d2e94-f1f0-4cd9-8bfa-0983be1434ab',sid='f49d2e94-f1f0-4cd9-8bfa-0983be1434ab';
   await c.query('INSERT INTO auth.users(id,email) VALUES($1,$2) ON CONFLICT (id) DO NOTHING',[a,'fictional@example.invalid']);
   await c.query('INSERT INTO auth.sessions(id,user_id) VALUES($1,$2) ON CONFLICT (id) DO NOTHING',[sid,a]);
   await c.query('SAVEPOINT reader_scope');
   try{
    await c.query('SET LOCAL ROLE growth_starter_session_checker');
    const ok=await c.query('SELECT id::text,user_id::text,not_after FROM auth.sessions WHERE id=$1::uuid',[sid]);
    assert.equal(ok.rows[0].id,sid);
    await c.query('SAVEPOINT denied_sensitive');
    await assert.rejects(c.query('SELECT email FROM auth.users'),e=>e.code==='42501');
    await c.query('ROLLBACK TO SAVEPOINT denied_sensitive');await c.query('RELEASE SAVEPOINT denied_sensitive');
    await c.query('SAVEPOINT denied_session_ip');
    await assert.rejects(c.query('SELECT gs_test_private FROM auth.sessions'),e=>e.code==='42501');
    await c.query('ROLLBACK TO SAVEPOINT denied_session_ip');await c.query('RELEASE SAVEPOINT denied_session_ip');
    await c.query('SAVEPOINT denied_write');
    await assert.rejects(c.query('DELETE FROM auth.sessions'),e=>e.code==='25006'||e.code==='42501');
    await c.query('ROLLBACK TO SAVEPOINT denied_write');await c.query('RELEASE SAVEPOINT denied_write');
   }finally{await c.query('ROLLBACK TO SAVEPOINT reader_scope');await c.query('RELEASE SAVEPOINT reader_scope');}
   // The checker must reject silently broadened *column-level* rights.
   // This is an actual PostgreSQL privilege mutation inside disposable ROLLBACK.
   const extrasSql=`SELECT
      (SELECT COALESCE(jsonb_agg(a.attname ORDER BY a.attname),'[]'::jsonb)
       FROM pg_attribute a WHERE a.attrelid='auth.users'::regclass
         AND a.attnum>0 AND NOT a.attisdropped
         AND a.attname NOT IN ('id','deleted_at','banned_until')
         AND has_column_privilege('growth_starter_session_checker',a.attrelid,a.attname,'SELECT')) AS extras`;
   assert.deepEqual((await c.query(extrasSql)).rows[0].extras,[]);
   await c.query('GRANT SELECT(email) ON auth.users TO growth_starter_session_checker');
   assert.deepEqual((await c.query(extrasSql)).rows[0].extras,['email']);
   await c.query('REVOKE SELECT(email) ON auth.users FROM growth_starter_session_checker');
   assert.deepEqual((await c.query(extrasSql)).rows[0].extras,[]);
   await c.query('DELETE FROM auth.sessions WHERE id=$1',[sid]);
   await c.query('SET LOCAL ROLE growth_starter_session_checker');
   const revoked=await c.query('SELECT id FROM auth.sessions WHERE id=$1',[sid]);
   assert.deepEqual(revoked.rows,[]);
  }finally{await c.query('ROLLBACK');}
 }finally{c.release();await pool.end();}
});
