/**
 * Phase 3.15K: exact review-only SQL on disposable PostgreSQL17 only.
 * Creates ephemeral login credential for synthetic tests, never hosted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {readFileSync} from 'node:fs';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
if(!process.env.TEST_DATABASE_URL||
 /supabase\.co|supabase\.com/i.test(process.env.TEST_DATABASE_URL))
 throw Error('Only throwaway PostgreSQL17 accepted; no hosted Supabase.');
const admin=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,max:4});
const A='a315c2e9-f1f0-4cd9-8bfa-0983be1434ab';
const B='b315c2e9-f1f0-4cd9-8bfa-0983be1434ab';
const C='c315c2e9-f1f0-4cd9-8bfa-0983be1434ab';
const WA='ws_'+A,WB='ws_'+B;
const roles=['gs315k_gateway','gs315k_read_owner','gs315k_revoke_owner'];
function hash(id,secret){
 return createHash('sha256').update('codeedge-growth-starter:session:v1\0')
  .update(id).update('\0').update(secret).digest('hex');
}
function sessionFor(id,user){
 const secret=randomBytes(32).toString('base64url');
 return {id,user,secret,token:'ce1.'+id+'.'+secret};
}
const denied=e=>e?.code==='28000';
const perm=e=>e?.code==='42501';
const read=(pool,session,ws,limit=20)=>pool.query(
 'SELECT * FROM growth_starter_private.read_requests($1,$2,$3)',
 [session,ws,limit]).then(x=>x.rows);
const revoke=(pool,session)=>pool.query(
 'SELECT growth_starter_private.revoke_session($1) AS revoked',
 [session]).then(x=>x.rows[0].revoked);
test('Phase 3.15K exact hosted draft: private gateway function boundaries and rollback lockdown',async()=>{
 const version=Number((await admin.query('SHOW server_version_num')).rows[0].server_version_num);
 assert.ok(version>=170000&&version<180000);
 const migration=readFileSync('db/drafts/phase315k_private_sessions_REVIEW_ONLY.sql','utf8');
 // The synthetic test explicitly uses a COPY of source SQL inside a
 // temporary database, never Supabase migration actions.
 await admin.query(readFileSync('db/migrations/0001_growth_starter.sql','utf8'));
 let privateReady=false,gateway;
 try{
  await admin.query(migration);
  privateReady=true;
  const baseline=(await admin.query(readFileSync(
   'db/reviews/phase315k_private_schema_assertions_READ_ONLY.sql','utf8'))).rows[0];
  assert.equal(baseline.safe_roles,3);
  assert.equal(baseline.sessions_exist,true);
  assert.equal(baseline.flows_exist,true);
  assert.equal(baseline.gateway_session_table_read,false);
  assert.equal(baseline.gateway_business_table_read,false);
  assert.equal(baseline.gateway_can_read_function,true);
  assert.equal(baseline.gateway_can_revoke_function,true);
  assert.equal(baseline.private_policies,6);
  assert.equal(baseline.owned_definer_functions,2);
  // Standalone throwaway PG doesn't have Supabase built-in anon and
  // authenticated roles; if absent, identity checks are replaced with
  // strict PUBLIC grants and no schema USAGE grants in this environment.
  for(const name of roles){
   const row=(await admin.query('SELECT rolcanlogin,rolsuper,rolbypassrls,rolinherit '+
    'FROM pg_roles WHERE rolname=$1',[name])).rows[0];
   assert.deepEqual(row,{rolcanlogin:false,rolsuper:false,rolbypassrls:false,rolinherit:false});
  }
  const password=randomBytes(32).toString('base64url');
  await admin.query("ALTER ROLE gs315k_gateway LOGIN PASSWORD '"+password+"'");
  const url=new URL(process.env.TEST_DATABASE_URL);
  url.username='gs315k_gateway';url.password=password;
  gateway=new pg.Pool({connectionString:url.toString(),max:3});
  const credentials=[
   sessionFor('d315c2e9-f1f0-4cd9-8bfa-0983be1434ab',A),
   sessionFor('e315c2e9-f1f0-4cd9-8bfa-0983be1434ab',B),
   sessionFor('f315c2e9-f1f0-4cd9-8bfa-0983be1434ab',C)
  ];
  await admin.query('INSERT INTO growth_starter.workspaces(id,owner_user_id) VALUES($1,$2),($3,$4)',[WA,A,WB,B]);
  await admin.query("INSERT INTO growth_starter.work_requests(workspace_id,id,title,kind) VALUES($1,'k_req_a','A fictional','Other'),($2,'k_req_b','B fictional','Local SEO')",[WA,WB]);
  await admin.query("INSERT INTO growth_starter.memberships(workspace_id,user_id,owner_user_id,role,created_by) VALUES($1,$2,$3,'staff',$3)",[WA,C,A]);
  for(const c of credentials)await admin.query(
   'INSERT INTO growth_starter_private.codeedge_sessions '+
   '(id,user_id,secret_sha256,provider_session_id,one_time_grant_id,expires_at) '+
   'VALUES($1,$2,$3,$4,$5,$6)',
   [c.id,c.user,hash(c.id,c.secret),randomUUID(),
    randomBytes(32).toString('base64url'),new Date(Date.now()+900000)]
  );
  const [sa,sb,sc]=credentials;
  assert.deepEqual((await read(gateway,sa.token,WA)).map(x=>x.id),['k_req_a']);
  assert.deepEqual((await read(gateway,sb.token,WB)).map(x=>x.id),['k_req_b']);
  assert.deepEqual((await read(gateway,sc.token,WA)).map(x=>x.id),['k_req_a']);
  await assert.rejects(read(gateway,sa.token,WB),denied);
  await assert.rejects(read(gateway,sb.token,WA),denied);
  await assert.rejects(read(gateway,sc.token,WB),denied);
  await assert.rejects(read(gateway,sa.token.slice(0,-1)+'X',WA),denied);
  await assert.rejects(read(gateway,sa.token,WA,100),denied);
  await assert.rejects(gateway.query('SELECT title FROM growth_starter.work_requests'),perm);
  await assert.rejects(gateway.query('SELECT secret_sha256 FROM growth_starter_private.codeedge_sessions'),perm);
  await assert.rejects(gateway.query('UPDATE growth_starter_private.codeedge_sessions SET revoked_at=now()'),perm);
  await assert.rejects(gateway.query('SET ROLE gs315k_read_owner'),perm);
  await assert.rejects(gateway.query('SELECT * FROM growth_starter_private.fresh_login_flows'),perm);
  // Logout must serialize behind an existing protected read.
  const reader=await gateway.connect();
  try{
   await reader.query('BEGIN');
   assert.equal((await reader.query('SELECT * FROM growth_starter_private.read_requests($1,$2,$3)',
    [sa.token,WA,20])).rowCount,1);
   let finished=false;
   const pending=revoke(gateway,sa.token).then(x=>{finished=true;return x;});
   await new Promise(r=>setTimeout(r,125));
   assert.equal(finished,false);
   await reader.query('COMMIT');
   assert.equal(await pending,true);
  }finally{await reader.query('ROLLBACK').catch(()=>{});reader.release();}
  await assert.rejects(read(gateway,sa.token,WA),denied);
  // Membership is evaluated fresh per request.
  await admin.query("UPDATE growth_starter.memberships SET state='revoked',revoked_at=now() "+
    'WHERE workspace_id=$1 AND user_id=$2',[WA,C]);
  await assert.rejects(read(gateway,sc.token,WA),denied);
  await admin.query("UPDATE growth_starter.workspaces SET state='suspended' WHERE id=$1",[WB]);
  await assert.rejects(read(gateway,sb.token,WB),denied);
  // Rehearse security-first lockdown. Existing sessions stay but no server
  // identity has EXECUTE rights, and the login is disabled.
  await admin.query(readFileSync('db/drafts/phase315k_lockdown_REVIEW_ONLY.sql','utf8'));
  assert.equal((await admin.query("SELECT has_function_privilege('gs315k_gateway',"+
    "'growth_starter_private.read_requests(text,text,integer)','EXECUTE') AS ok")).rows[0].ok,false);
  assert.equal((await admin.query("SELECT rolcanlogin FROM pg_roles "+
    "WHERE rolname='gs315k_gateway'")).rows[0].rolcanlogin,false);
  await assert.rejects(read(gateway,sc.token,WA),perm);
 }finally{
  if(gateway)await gateway.end();
  if(privateReady)await admin.query('DROP SCHEMA growth_starter_private CASCADE');
  for(const name of [...roles].reverse()){
   const found=(await admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[name])).rowCount>0;
   if(found){
    await admin.query('DROP OWNED BY '+name+' CASCADE');
    await admin.query('DROP ROLE '+name);
   }
  }
  await admin.end();
 }
});
