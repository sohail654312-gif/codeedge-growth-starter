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
  const catalogSql=readFileSync('db/reviews/phase315s_auth_bridge_catalog_READ_ONLY.sql','utf8');
  async function inspectCatalog(){
   const result=await db.query(catalogSql);
   const selected=Array.isArray(result)?result.find(part=>part.command==='SELECT'):result;
   assert.ok(selected?.rows?.[0]?.snapshot,'read-only catalog must return one snapshot');
   return selected.rows[0].snapshot;
  }
  const absent=await inspectCatalog();
  assert.equal(absent.checksPassed,false);
  assert.ok(absent.failedChecks.includes('bridge_exists'));
  await db.query(bridgeSql);
  const healthy=await inspectCatalog();
  assert.equal(healthy.checksPassed,true,JSON.stringify(healthy.failedChecks));
  assert.deepEqual(healthy.failedChecks,[]);
  async function expectCatalogFailure(check){
   const report=await inspectCatalog();
   assert.equal(report.checksPassed,false,check);
   assert.ok(report.failedChecks.includes(check),JSON.stringify(report.failedChecks));
  }
  // NOINHERIT on the checker does not prevent an unrelated member from SET ROLE.
  // Even without direct ACL grants, that member can assume the checker authority.
  await db.query('GRANT growth_starter_session_checker TO gs315s_untrusted');
  await expectCatalogFailure('checker_has_no_members');
  const membership=(await db.query("SELECT pg_has_role('gs315s_untrusted','growth_starter_session_checker','SET') AS can_set")).rows[0];
  assert.equal(membership.can_set,true,'unexpected member can assume checker role');
  await db.query('REVOKE growth_starter_session_checker FROM gs315s_untrusted');
  // A non-API member of the SECURITY DEFINER function owner can SET ROLE
  // into that owner. This must be rejected even without any direct bridge ACL.
  await db.query('GRANT gs_test TO gs315s_untrusted');
  await expectCatalogFailure('owner_has_no_members');
  const ownerMembership=(await db.query("SELECT pg_has_role('gs315s_untrusted','gs_test','SET') AS can_set")).rows[0];
  assert.equal(ownerMembership.can_set,true,'unexpected member can assume function owner');
  await db.query('REVOKE gs_test FROM gs315s_untrusted');
  // A distinct schema owner controls namespace DDL even while the privileged
  // function remains owned by gs_test. The catalog must deny this drift.
  await db.query('ALTER SCHEMA growth_starter_auth_bridge OWNER TO gs315s_untrusted');
  await expectCatalogFailure('schema_owner_matches_function_owner');
  await db.query('ALTER SCHEMA growth_starter_auth_bridge OWNER TO gs_test');
  // Non-API principals must not gain direct private bridge grants either.
  await db.query('GRANT USAGE ON SCHEMA growth_starter_auth_bridge TO gs315s_untrusted');
  await expectCatalogFailure('schema_acl_restricted');
  await db.query('REVOKE USAGE ON SCHEMA growth_starter_auth_bridge FROM gs315s_untrusted');
  // CREATE is a distinct namespace privilege: a role without USAGE must not
  // be able to introduce private-schema objects; nor may the checker do so.
  await db.query('GRANT CREATE ON SCHEMA growth_starter_auth_bridge TO gs315s_untrusted');
  await expectCatalogFailure('schema_no_external_create');
  await db.query('REVOKE CREATE ON SCHEMA growth_starter_auth_bridge FROM gs315s_untrusted');
  await db.query('GRANT CREATE ON SCHEMA growth_starter_auth_bridge TO growth_starter_session_checker');
  await expectCatalogFailure('schema_no_external_create');
  await db.query('REVOKE CREATE ON SCHEMA growth_starter_auth_bridge FROM growth_starter_session_checker');
  // A new routine receives default PUBLIC EXECUTE. The checker already has
  // private-schema USAGE, so an unreviewed definer could expose synthetic Auth.
  await db.query(`CREATE FUNCTION growth_starter_auth_bridge.unreviewed_probe()
    RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = ''
    AS $probe$ SELECT count(*)::integer FROM auth.users $probe// Disposable PostgreSQL 17 proof; synthetic Auth schema ONLY; not a hosted auth acceptance test.
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
  const catalogSql=readFileSync('db/reviews/phase315s_auth_bridge_catalog_READ_ONLY.sql','utf8');
  async function inspectCatalog(){
   const result=await db.query(catalogSql);
   const selected=Array.isArray(result)?result.find(part=>part.command==='SELECT'):result;
   assert.ok(selected?.rows?.[0]?.snapshot,'read-only catalog must return one snapshot');
   return selected.rows[0].snapshot;
  }
  const absent=await inspectCatalog();
  assert.equal(absent.checksPassed,false);
  assert.ok(absent.failedChecks.includes('bridge_exists'));
  await db.query(bridgeSql);
  const healthy=await inspectCatalog();
  assert.equal(healthy.checksPassed,true,JSON.stringify(healthy.failedChecks));
  assert.deepEqual(healthy.failedChecks,[]);
  async function expectCatalogFailure(check){
   const report=await inspectCatalog();
   assert.equal(report.checksPassed,false,check);
   assert.ok(report.failedChecks.includes(check),JSON.stringify(report.failedChecks));
  }
  // NOINHERIT on the checker does not prevent an unrelated member from SET ROLE.
  // Even without direct ACL grants, that member can assume the checker authority.
  await db.query('GRANT growth_starter_session_checker TO gs315s_untrusted');
  await expectCatalogFailure('checker_has_no_members');
  const membership=(await db.query("SELECT pg_has_role('gs315s_untrusted','growth_starter_session_checker','SET') AS can_set")).rows[0];
  assert.equal(membership.can_set,true,'unexpected member can assume checker role');
  await db.query('REVOKE growth_starter_session_checker FROM gs315s_untrusted');
  // A non-API member of the SECURITY DEFINER function owner can SET ROLE
  // into that owner. This must be rejected even without any direct bridge ACL.
  await db.query('GRANT gs_test TO gs315s_untrusted');
  await expectCatalogFailure('owner_has_no_members');
  const ownerMembership=(await db.query("SELECT pg_has_role('gs315s_untrusted','gs_test','SET') AS can_set")).rows[0];
  assert.equal(ownerMembership.can_set,true,'unexpected member can assume function owner');
  await db.query('REVOKE gs_test FROM gs315s_untrusted');
  // A distinct schema owner controls namespace DDL even while the privileged
  // function remains owned by gs_test. The catalog must deny this drift.
  await db.query('ALTER SCHEMA growth_starter_auth_bridge OWNER TO gs315s_untrusted');
  await expectCatalogFailure('schema_owner_matches_function_owner');
  await db.query('ALTER SCHEMA growth_starter_auth_bridge OWNER TO gs_test');
  // Non-API principals must not gain direct private bridge grants either.
  await db.query('GRANT USAGE ON SCHEMA growth_starter_auth_bridge TO gs315s_untrusted');
  await expectCatalogFailure('schema_acl_restricted');
  await db.query('REVOKE USAGE ON SCHEMA growth_starter_auth_bridge FROM gs315s_untrusted');
  // CREATE is a distinct namespace privilege: a role without USAGE must not
  // be able to introduce private-schema objects; nor may the checker do so.
  await db.query('GRANT CREATE ON SCHEMA growth_starter_auth_bridge TO gs315s_untrusted');
  await expectCatalogFailure('schema_no_external_create');
  await db.query('REVOKE CREATE ON SCHEMA growth_starter_auth_bridge FROM gs315s_untrusted');
  await db.query('GRANT CREATE ON SCHEMA growth_starter_auth_bridge TO growth_starter_session_checker');
  await expectCatalogFailure('schema_no_external_create');
  await db.query('REVOKE CREATE ON SCHEMA growth_starter_auth_bridge FROM growth_starter_session_checker');
);
  await db.query('SET ROLE growth_starter_session_checker');
  try{
   const probe=(await db.query('SELECT growth_starter_auth_bridge.unreviewed_probe() AS total')).rows[0];
   assert.equal(probe.total,2,'unreviewed definer is callable via default PUBLIC EXECUTE');
  }finally{await db.query('RESET ROLE');}
  await expectCatalogFailure('schema_only_expected_routine');
  await db.query('DROP FUNCTION growth_starter_auth_bridge.unreviewed_probe()');
  await db.query('GRANT EXECUTE ON FUNCTION growth_starter_auth_bridge.exact_pair_snapshot(uuid,uuid) TO gs315s_untrusted');
  await expectCatalogFailure('function_acl_restricted');
  await db.query('REVOKE EXECUTE ON FUNCTION growth_starter_auth_bridge.exact_pair_snapshot(uuid,uuid) FROM gs315s_untrusted');
  await db.query('GRANT USAGE ON SCHEMA growth_starter_auth_bridge TO growth_starter_session_checker WITH GRANT OPTION');
  await expectCatalogFailure('checker_no_grant_option');
  await db.query('REVOKE GRANT OPTION FOR USAGE ON SCHEMA growth_starter_auth_bridge FROM growth_starter_session_checker');
  await db.query('GRANT EXECUTE ON FUNCTION growth_starter_auth_bridge.exact_pair_snapshot(uuid,uuid) TO growth_starter_session_checker WITH GRANT OPTION');
  await expectCatalogFailure('checker_no_grant_option');
  await db.query('REVOKE GRANT OPTION FOR EXECUTE ON FUNCTION growth_starter_auth_bridge.exact_pair_snapshot(uuid,uuid) FROM growth_starter_session_checker');
  // Detect effective grants and drift AFTER installation; do not mutate hosted state.
  await db.query('GRANT USAGE ON SCHEMA growth_starter_auth_bridge TO anon');
  await expectCatalogFailure('api_no_bridge_access');
  await db.query('REVOKE USAGE ON SCHEMA growth_starter_auth_bridge FROM anon');
  await db.query('GRANT EXECUTE ON FUNCTION growth_starter_auth_bridge.exact_pair_snapshot(uuid,uuid) TO PUBLIC');
  await expectCatalogFailure('public_no_function_execute');
  await db.query('REVOKE EXECUTE ON FUNCTION growth_starter_auth_bridge.exact_pair_snapshot(uuid,uuid) FROM PUBLIC');
  await db.query('ALTER FUNCTION growth_starter_auth_bridge.exact_pair_snapshot(uuid,uuid) SECURITY INVOKER');
  await expectCatalogFailure('security_definer');
  await db.query('ALTER FUNCTION growth_starter_auth_bridge.exact_pair_snapshot(uuid,uuid) SECURITY DEFINER');
  await db.query('ALTER FUNCTION growth_starter_auth_bridge.exact_pair_snapshot(uuid,uuid) SET search_path TO public');
  await expectCatalogFailure('empty_search_path');
  await db.query("ALTER FUNCTION growth_starter_auth_bridge.exact_pair_snapshot(uuid,uuid) SET search_path TO ''");
  await db.query('GRANT growth_starter_session_checker TO authenticator');
  await expectCatalogFailure('checker_not_api_reachable');
  await db.query('REVOKE growth_starter_session_checker FROM authenticator');
  await db.query('GRANT SELECT ON auth.sessions TO growth_starter_session_checker');
  await expectCatalogFailure('checker_no_raw_auth');
  await db.query('REVOKE SELECT ON auth.sessions FROM growth_starter_session_checker');
  await db.query('GRANT SELECT (id) ON auth.sessions TO growth_starter_session_checker');
  await expectCatalogFailure('checker_no_raw_auth');
  await db.query('REVOKE SELECT (id) ON auth.sessions FROM growth_starter_session_checker');
  await db.query('ALTER ROLE growth_starter_session_checker LOGIN');
  await expectCatalogFailure('checker_restricted');
  await db.query('ALTER ROLE growth_starter_session_checker NOLOGIN');
  await db.query('ALTER FUNCTION growth_starter_auth_bridge.exact_pair_snapshot(uuid,uuid) OWNER TO authenticator');
  await expectCatalogFailure('owner_not_api_reachable');
  await db.query('ALTER FUNCTION growth_starter_auth_bridge.exact_pair_snapshot(uuid,uuid) OWNER TO gs_test');
  assert.equal((await inspectCatalog()).checksPassed,true,'all synthetic drift must be reverted');
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
