// Disposable PostgreSQL 17 proof; synthetic Auth schema ONLY; not a hosted auth acceptance test.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import pg from 'pg';
const raw=process.env.TEST_DATABASE_URL;
if(!raw||process.env.GS315S_DISPOSABLE_ONLY!=='1')throw Error('Explicit disposable test marker required');
const u=new URL(raw);
if(!['127.0.0.1','localhost','::1','[::1]'].includes(u.hostname)||
 u.pathname!=='/gs_test'||u.username!=='gs_test'||/supabase/i.test(raw))
 throw Error('Refusing non-disposable PostgreSQL target');
const owner='329d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const other='729d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const sid='539d2e94-f1f0-4cd9-8bfa-0983be1434ab';
test('Phase 3.15S restricted exact-pair function grants no raw Auth access',async()=>{
 const db=new pg.Client({connectionString:raw});
 await db.connect();
 let roles=false;
 const denied=e=>e?.code==='42501';
 try{
  const ver=Number((await db.query('SHOW server_version_num')).rows[0].server_version_num);
  assert.ok(ver>=170000&&ver<180000);
  assert.equal((await db.query("SELECT to_regnamespace('auth') IS NULL AS clean")).rows[0].clean,true);
  await db.query('CREATE ROLE growth_starter_session_checker NOLOGIN NOINHERIT');
  await db.query('CREATE ROLE gs315s_untrusted NOLOGIN NOINHERIT');
  roles=true;
  for(const role of ['anon','authenticated','service_role','authenticator']){
   await db.query(`CREATE ROLE ${role} NOLOGIN NOINHERIT`);
  }
  await db.query('CREATE SCHEMA auth');
  await db.query('REVOKE ALL ON SCHEMA auth FROM PUBLIC');
  await db.query('CREATE TABLE auth.users(id uuid PRIMARY KEY,banned_until timestamptz,deleted_at timestamptz)');
  await db.query('CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid REFERENCES auth.users(id),not_after timestamptz)');
  await db.query('REVOKE ALL ON ALL TABLES IN SCHEMA auth FROM PUBLIC');
  await db.query('INSERT INTO auth.users(id) VALUES($1),($2)',[owner,other]);
  await db.query("INSERT INTO auth.sessions(id,user_id,not_after) VALUES($1,$2,now()+interval '1 hour')",[sid,owner]);
  const bridgeSql=readFileSync('db/drafts/phase315s_exact_auth_bridge_REVIEW_ONLY.sql','utf8');
  // A misconfigured LOGIN checker or API-role membership must deny installation.
  await db.query('ALTER ROLE growth_starter_session_checker LOGIN');
  await assert.rejects(db.query(bridgeSql),/Phase 3[.]15S baseline denied/);
  await db.query('ROLLBACK');
  await db.query('ALTER ROLE growth_starter_session_checker NOLOGIN');
  await db.query('GRANT growth_starter_session_checker TO authenticator');
  await assert.rejects(db.query(bridgeSql),/Phase 3[.]15S baseline denied/);
  await db.query('ROLLBACK');
  await db.query('REVOKE growth_starter_session_checker FROM authenticator');
  await db.query(bridgeSql);
  const f=(await db.query("SELECT has_schema_privilege('growth_starter_session_checker','auth','USAGE') AS auth_usage, "+
   "has_table_privilege('growth_starter_session_checker','auth.sessions','SELECT') AS sessions_read, "+
   "has_table_privilege('growth_starter_session_checker','auth.users','SELECT') AS users_read, "+
   "has_function_privilege('growth_starter_session_checker','growth_starter_auth_bridge.exact_pair_snapshot(uuid,uuid)','EXECUTE') AS checker_exec, "+
   "has_function_privilege('gs315s_untrusted','growth_starter_auth_bridge.exact_pair_snapshot(uuid,uuid)','EXECUTE') AS other_exec")).rows[0];
  assert.deepEqual(f,{auth_usage:false,sessions_read:false,users_read:false,checker_exec:true,other_exec:false});
  for(const role of ['anon','authenticated','service_role','authenticator']){
   const priv=(await db.query("SELECT has_schema_privilege($1,'growth_starter_auth_bridge','USAGE') AS schema_usage, "+
    "has_function_privilege($1,'growth_starter_auth_bridge.exact_pair_snapshot(uuid,uuid)','EXECUTE') AS function_exec",[role])).rows[0];
   assert.deepEqual(priv,{schema_usage:false,function_exec:false},`${role} must not reach the private bridge`);
  }
  await db.query('SET ROLE authenticator');
  try{await assert.rejects(db.query('SELECT * FROM growth_starter_auth_bridge.exact_pair_snapshot($1,$2)',[owner,sid]),denied);}
  finally{await db.query('RESET ROLE');}
  async function snap(user=owner,session=sid){
   await db.query('SET ROLE growth_starter_session_checker');
   try{return (await db.query('SELECT * FROM growth_starter_auth_bridge.exact_pair_snapshot($1,$2)',[user,session])).rows[0];}
   finally{await db.query('RESET ROLE');}
  }
  assert.equal((await snap()).pair_exists,true);
  assert.equal((await snap(other,sid)).pair_exists,false);
  assert.equal((await snap(owner,other)).pair_exists,false);
  // Model a provider-side orphan after identity deletion or schema drift.
  // The normal synthetic FK is removed ONLY inside this disposable database.
  await db.query('ALTER TABLE auth.sessions DROP CONSTRAINT sessions_user_id_fkey');
  const orphanUser='429d2e94-f1f0-4cd9-8bfa-0983be1434ab';
  const orphanSession='639d2e94-f1f0-4cd9-8bfa-0983be1434ab';
  await db.query("INSERT INTO auth.sessions(id,user_id,not_after) VALUES($1,$2,now()+interval '1 hour')",
    [orphanSession,orphanUser]);
  const orphan=await snap(orphanUser,orphanSession);
  assert.equal(orphan.pair_exists,false,'an orphan session must never count as a valid pair');
  assert.equal(orphan.session_not_after,null,'do not return expiry metadata for an orphan pair');
  await db.query('DELETE FROM auth.sessions WHERE id=$1',[orphanSession]);
  await db.query('SET ROLE growth_starter_session_checker');
  try{
   await assert.rejects(db.query('SELECT id FROM auth.sessions'),denied);
   await assert.rejects(db.query('SELECT id FROM auth.users'),denied);
  }finally{await db.query('RESET ROLE');}
  await db.query('SET ROLE gs315s_untrusted');
  try{await assert.rejects(db.query('SELECT * FROM growth_starter_auth_bridge.exact_pair_snapshot($1,$2)',[owner,sid]),denied);}
  finally{await db.query('RESET ROLE');}
  await db.query("UPDATE auth.users SET banned_until=now()+interval '1 day' WHERE id=$1",[owner]);
  assert.equal((await snap()).banned,true);
  await db.query('UPDATE auth.users SET banned_until=NULL,deleted_at=now() WHERE id=$1',[owner]);
  assert.equal((await snap()).deleted,true);
  await db.query('UPDATE auth.users SET deleted_at=NULL WHERE id=$1',[owner]);
  await db.query("UPDATE auth.sessions SET not_after=now()-interval '1 minute' WHERE id=$1",[sid]);
  const expired=await snap();
  assert.equal(expired.pair_exists,true); // caller MUST separately deny expired sessions
  assert.ok(new Date(expired.session_not_after).getTime()<Date.now());
  await db.query('DELETE FROM auth.sessions WHERE id=$1',[sid]);
  assert.equal((await snap()).pair_exists,false);
 }finally{
  await db.query('RESET ROLE').catch(()=>{});
  if(roles){
   await db.query('DROP SCHEMA IF EXISTS growth_starter_auth_bridge CASCADE').catch(()=>{});
   await db.query('DROP SCHEMA IF EXISTS auth CASCADE').catch(()=>{});
   for(const role of ['growth_starter_session_checker','gs315s_untrusted','anon','authenticated','service_role','authenticator']){
    await db.query('DROP OWNED BY '+role+' CASCADE').catch(()=>{});
    await db.query('DROP ROLE '+role).catch(()=>{});
   }
  }
  await db.end();
 }
});
