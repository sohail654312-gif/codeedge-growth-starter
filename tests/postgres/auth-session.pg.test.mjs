import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import pg from 'pg';
const {Pool}=pg;
if(!process.env.TEST_DATABASE_URL)throw Error('Only disposable GitHub PostgreSQL is supported');
const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL,max:4});
const owner='329d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const session='539d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const other='729d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const email='synthetic@unit.invalid';
before(async()=>{
  await pool.query(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE IF NOT EXISTS auth.users (
      id uuid PRIMARY KEY, email text, email_confirmed_at timestamptz,
      deleted_at timestamptz, is_anonymous boolean DEFAULT false, banned_until timestamptz
    );
    CREATE TABLE IF NOT EXISTS auth.sessions (
      id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id),
      not_after timestamptz
    );
    REVOKE ALL ON SCHEMA auth FROM PUBLIC;
    REVOKE ALL ON ALL TABLES IN SCHEMA auth FROM PUBLIC;
  `);
  await pool.query(`INSERT INTO auth.users(id,email,email_confirmed_at)
    VALUES($1,$2,now()),($3,'other@unit.invalid',now())
    ON CONFLICT (id) DO NOTHING`,[owner,email,other]);
  await pool.query(`INSERT INTO auth.sessions(id,user_id,not_after)
    VALUES($1,$2,now()+INTERVAL '1 hour')
    ON CONFLICT (id) DO NOTHING`,[session,owner]);
  for(const file of ['0001_growth_starter.sql','0002_staging_readonly.sql',
    '0003_staging_default_deny_rls.sql','0004_prepare_runtime_role.sql',
    '0005_staging_auth_session_probe.sql']){
    await pool.query(readFileSync('db/migrations/'+file,'utf8'));
  }
});
after(async()=>{await pool.end();});
test('reader may call boolean session probe but cannot read auth.users/sessions',async()=>{
  const conn=await pool.connect();
  try {
    await conn.query('BEGIN READ ONLY');
    await conn.query('SET LOCAL ROLE growth_starter_reader');
    const ok=await conn.query('SELECT growth_starter.staging_session_active($1,$2,$3) AS active',
      [owner,session,email]);
    assert.equal(ok.rows[0].active,true);
    await assert.rejects(conn.query('SELECT id,email FROM auth.users'),e=>e.code==='42501');
    await conn.query('ROLLBACK');
  }finally{conn.release();}
});
test('provider subject/session/email mismatch and unknown session fail closed',async()=>{
  const call=async(id,sid,mail)=>(
    await pool.query('SELECT growth_starter.staging_session_active($1,$2,$3) AS active',
      [id,sid,mail])).rows[0].active;
  assert.equal(await call(owner,session,email),true);
  assert.equal(await call(other,session,email),false);
  assert.equal(await call(owner,session,'fake@unit.invalid'),false);
  assert.equal(await call(owner,other,email),false);
  assert.equal(await call('bad',session,email),false);
});
test('session expiry or confirmed-email downgrade causes immediate denial',async()=>{
  await pool.query("UPDATE auth.sessions SET not_after=now()-interval '1 minute' WHERE id=$1",[session]);
  const run=()=>pool.query('SELECT growth_starter.staging_session_active($1,$2,$3) AS active',[owner,session,email]);
  assert.equal((await run()).rows[0].active,false);
  await pool.query("UPDATE auth.sessions SET not_after=now()+interval '1 hour' WHERE id=$1",[session]);
  await pool.query('UPDATE auth.users SET email_confirmed_at=NULL WHERE id=$1',[owner]);
  assert.equal((await run()).rows[0].active,false);
  await pool.query('UPDATE auth.users SET email_confirmed_at=now(),banned_until=now()+interval \'1 day\' WHERE id=$1',[owner]);
  assert.equal((await run()).rows[0].active,false);
});
test('session deletion (revocation) denies even with still valid JWT',async()=>{
  await pool.query("UPDATE auth.users SET banned_until=NULL WHERE id=$1",[owner]);
  await pool.query('DELETE FROM auth.sessions WHERE id=$1',[session]);
  const check=await pool.query('SELECT growth_starter.staging_session_active($1,$2,$3) AS active',[owner,session,email]);
  assert.equal(check.rows[0].active,false);
});
test('auth probe cannot be called by an arbitrary non-reader role',async()=>{
  await pool.query('CREATE ROLE gs_auth_untrusted_probe NOLOGIN');
  const r=await pool.query(`SELECT
    has_function_privilege('growth_starter_reader','growth_starter.staging_session_active(text,text,text)','EXECUTE') AS reader,
    has_function_privilege('gs_auth_untrusted_probe','growth_starter.staging_session_active(text,text,text)','EXECUTE') AS untrusted`);
  assert.equal(r.rows[0].reader,true);
  assert.equal(r.rows[0].untrusted,false);
});
