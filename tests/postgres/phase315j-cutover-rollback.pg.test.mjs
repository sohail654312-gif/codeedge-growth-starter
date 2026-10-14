/**
 * Phase 3.15J — disposable PostgreSQL 17 cutover/rollback rehearsal ONLY.
 * Tests the exact source-only REVOKE package with simulated PostgREST RLS.
 * No Supabase project or real access token is ever used.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import pg from 'pg';
if(!process.env.TEST_DATABASE_URL||
 /supabase\.co|supabase\.com/i.test(process.env.TEST_DATABASE_URL))
 throw Error('Disposable PostgreSQL17 only; NEVER hosted Supabase.');
const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,max:2});
const A='a39d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const B='b39d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const WA='ws_'+A,WB='ws_'+B;
async function as(c,role,subject,sql){
 await c.query('SAVEPOINT disposable_identity');
 try{
  await c.query('SET LOCAL ROLE '+role);
  await c.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[subject]);
  return await c.query(sql);
 }finally{
  await c.query('ROLLBACK TO SAVEPOINT disposable_identity');
  await c.query('RELEASE SAVEPOINT disposable_identity');
 }
}
const verifiedOld=async(c)=>({
 schema:(await c.query("SELECT has_schema_privilege('authenticated','growth_starter','USAGE') AS permitted")).rows[0].permitted,
 column:(await c.query("SELECT has_column_privilege('authenticated','growth_starter.work_requests','title','SELECT') AS permitted")).rows[0].permitted,
 oldRole:(await c.query("SELECT pg_has_role('growth_starter_runtime','growth_starter_reader','SET') AS permitted")).rows[0].permitted,
 oldFn:(await c.query("SELECT has_function_privilege('growth_starter_reader','growth_starter.staging_list_requests(text,text,integer)','EXECUTE') AS permitted")).rows[0].permitted,
 oldSession:(await c.query("SELECT has_function_privilege('growth_starter_reader','growth_starter.staging_session_active(text,text,text)','EXECUTE') AS permitted")).rows[0].permitted
});
test('post-replacement cutover revokes every old lane; SAVEPOINT restores original in disposable CI',async()=>{
 const c=await pool.connect();
 try{
  const version=Number((await c.query('SHOW server_version_num')).rows[0].server_version_num);
  assert.ok(version>=170000&&version<180000);
  for(const f of ['0001_growth_starter.sql','0002_staging_readonly.sql',
    '0003_staging_default_deny_rls.sql','0004_prepare_runtime_role.sql'])
   await c.query(readFileSync('db/migrations/'+f,'utf8'));
  await c.query('CREATE SCHEMA IF NOT EXISTS auth');
  await c.query("DO $$ BEGIN "+
   "IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF; "+
   "IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF; "+
   "IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF; "+
   "END $$");
  await c.query("CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS "+
   "$$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$");
  // The production session-probe references managed auth tables. Fixture
  // installs a harmless replacement of the same signature to test ACLs.
  await c.query("CREATE OR REPLACE FUNCTION growth_starter.staging_session_active(p_user text,p_session text,p_email text) "+
   "RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT false $$");
  await c.query('REVOKE ALL ON FUNCTION growth_starter.staging_session_active(text,text,text) FROM PUBLIC');
  await c.query('GRANT EXECUTE ON FUNCTION growth_starter.staging_session_active(text,text,text) TO growth_starter_reader');
  await c.query('BEGIN');
  try{
   await c.query('INSERT INTO growth_starter.workspaces(id,owner_user_id) VALUES($1,$2),($3,$4)',[WA,A,WB,B]);
   await c.query("INSERT INTO growth_starter.work_requests(workspace_id,id,title,kind) VALUES"+
    "($1,'cutover_a','A fictional','Other'),($2,'cutover_b','B fictional','Other')",[WA,WB]);
   await c.query(readFileSync('db/drafts/0008_authenticated_read_rls_REVIEW_ONLY.sql','utf8'));
   const before=await verifiedOld(c);
   assert.deepEqual(before,{schema:true,column:true,oldRole:true,oldFn:true,oldSession:true});
   // With a trusted *simulated* identity (NOT real JWT proof), original RLS
   // allows same-tenant data through the direct authenticated database role.
   const ownBefore=await as(c,'authenticated',A,
    'SELECT id FROM growth_starter.work_requests ORDER BY id');
   assert.deepEqual(ownBefore.rows.map(x=>x.id),['cutover_a']);
   const crossBefore=await as(c,'authenticated',B,
    "SELECT id FROM growth_starter.work_requests WHERE workspace_id='"+WA+"'");
   assert.deepEqual(crossBefore.rows,[],'workspace RLS filters other clients');
   await c.query('SAVEPOINT cutover_rehearsal');
   const assertion=readFileSync('db/drafts/phase315j_cutover_assertions_REVIEW_ONLY.sql','utf8');
   await c.query('SAVEPOINT pre_check');
   await assert.rejects(c.query(assertion),e=>e.code==='P0001');
   await c.query('ROLLBACK TO SAVEPOINT pre_check');
   await c.query('RELEASE SAVEPOINT pre_check');
   await c.query(readFileSync('db/drafts/phase315j_direct_api_legacy_cutover_REVIEW_ONLY.sql','utf8'));
   await c.query(assertion);
   const after=await verifiedOld(c);
   assert.deepEqual(after,{schema:false,column:false,oldRole:false,oldFn:false,oldSession:false});
   // The direct API's backing role cannot even SELECT permitted columns now.
   await assert.rejects(as(c,'authenticated',A,'SELECT id FROM growth_starter.work_requests'),
    e=>e.code==='42501');
   await assert.rejects(as(c,'growth_starter_reader',B,
    "SELECT id FROM growth_starter.staging_list_requests('"+B+"','"+WB+"',20)"),
    e=>e.code==='42501');
   // The schema cutover never grants additional access to the new gateway.
   assert.equal((await c.query("SELECT has_schema_privilege('growth_starter_runtime','growth_starter','USAGE') AS ok")).rows[0].ok,false);
   await c.query('ROLLBACK TO SAVEPOINT cutover_rehearsal');
   await c.query('RELEASE SAVEPOINT cutover_rehearsal');
   // Mechanically proving rollback IS NOT permission to reopen insecure old
   // grants in hosted staging, where rollback should retain deny-all.
   assert.deepEqual(await verifiedOld(c),before);
   assert.deepEqual((await as(c,'authenticated',A,'SELECT id FROM growth_starter.work_requests')).rows.map(x=>x.id),['cutover_a']);
  }finally{await c.query('ROLLBACK');}
 }finally{c.release();await pool.end();}
});
