import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {readFileSync} from 'node:fs';
import {randomBytes,randomUUID} from 'node:crypto';
import {createPhase315mPrivateRuntime} from '../../backend/phase315m-private-runtime.mjs';
import {createSupabasePkceHttpAdapter} from '../../backend/phase315g-supabase-pkce-adapter.mjs';
if(!process.env.TEST_DATABASE_URL||/supabase\.co|supabase\.com/i.test(process.env.TEST_DATABASE_URL))
 throw Error('Disposable PostgreSQL 17 only.');
const admin=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,max:4});
const A='a315f2e9-f1f0-4cd9-8bfa-0983be1434ab',B='b315f2e9-f1f0-4cd9-8bfa-0983be1434ab',C='c315f2e9-f1f0-4cd9-8bfa-0983be1434ab';
const WA='ws_'+A,WB='ws_'+B;
const APP='https://fictional.example.invalid',PROJECT='https://fictional-proj.supabase.co';
const roles=['gs315k_gateway','gs315k_read_owner','gs315k_revoke_owner','gs315m_issuer','gs315m_issue_owner'];
const perm=e=>e?.code==='42501';
const pause=ms=>new Promise(ok=>setTimeout(ok,ms));
const jwt=(user,sid)=>{
 const iat=Math.floor(Date.now()/1000),enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
 return enc({alg:'RS256'})+'.'+enc({iss:PROJECT+'/auth/v1',aud:'authenticated',role:'authenticated',
 sub:user,session_id:sid,iat,exp:iat+3600})+'.'+enc('synthetic-provider-signature');
};
async function loginPool(role){
 const password=randomBytes(32).toString('base64url');
 await admin.query('ALTER ROLE '+role+" LOGIN PASSWORD '"+password+"'");
 const url=new URL(process.env.TEST_DATABASE_URL);url.username=role;url.password=password;
 return new pg.Pool({connectionString:url.href,max:4});
}
test('Phase 3.15M exact restricted issuer, PKCE adapter, tenant denial, races and safe rollback',async()=>{
 let issuer,gateway,ready=false;
 await admin.query(readFileSync('db/migrations/0001_growth_starter.sql','utf8'));
 try{
  const version=Number((await admin.query('SHOW server_version_num')).rows[0].server_version_num);
  assert.ok(version>=170000&&version<180000);
  for(const table of ['workspaces','memberships','work_requests']){
   await admin.query('ALTER TABLE growth_starter.'+table+' ENABLE ROW LEVEL SECURITY');
   await admin.query('ALTER TABLE growth_starter.'+table+' FORCE ROW LEVEL SECURITY');
  }
  // Simulate Supabase's explicit default browser-role grants. M must revoke
  // these, not just the inherited PUBLIC function permissions.
  for(const role of ['anon','authenticated','service_role'])await admin.query(
   'DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname=\''+role+'\') THEN CREATE ROLE '+role+'; END IF; END $$');
  await admin.query('ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO authenticated,anon,service_role');
  await admin.query('ALTER DEFAULT PRIVILEGES GRANT SELECT ON TABLES TO authenticated,anon,service_role');
  await admin.query(readFileSync('db/drafts/phase315k_private_sessions_REVIEW_ONLY.sql','utf8'));ready=true;
  await admin.query(readFileSync('db/drafts/phase315m_private_issuer_REVIEW_ONLY.sql','utf8'));
  await admin.query('ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM authenticated,anon,service_role');
  await admin.query('ALTER DEFAULT PRIVILEGES REVOKE SELECT ON TABLES FROM authenticated,anon,service_role');
  issuer=await loginPool('gs315m_issuer');gateway=await loginPool('gs315k_gateway');
  await admin.query('INSERT INTO growth_starter.workspaces(id,owner_user_id) VALUES($1,$2),($3,$4)',[WA,A,WB,B]);
  await admin.query("INSERT INTO growth_starter.work_requests(id,workspace_id,title,kind) VALUES('m_a',$1,'Clinic A','Other'),('m_b',$2,'Clinic B','Other')",[WA,WB]);
  await admin.query("INSERT INTO growth_starter.memberships(workspace_id,user_id,owner_user_id,role,created_by) VALUES($1,$2,$3,'staff',$3)",[WA,C,A]);
  let identity=A,sid=randomUUID(),verifiedToken='',providerDown=false,providerActive=true;
  const captured=[];
  const provider=createSupabasePkceHttpAdapter({projectUrl:PROJECT+'/',callbackUrl:APP+'/auth/callback',
   publishableKey:'sb_publishable_'+'X'.repeat(32),fetchImpl:async(url,options)=>{
    if(providerDown)throw Error('synthetic outage');
    if(url.includes('/auth/v1/otp?')){
     const body=JSON.parse(options.body),redirect=new URL(new URL(url).searchParams.get('redirect_to'));
     assert.equal(body.create_user,false);assert.equal(body.code_challenge_method,'s256');
     assert.equal(redirect.origin,APP);assert.equal(redirect.pathname,'/auth/callback');
     captured.push({state:redirect.searchParams.get('state'),challenge:body.code_challenge});
     return {status:200,text:async()=>JSON.stringify({})};
    }
    if(url.endsWith('/token?grant_type=pkce')){
     const body=JSON.parse(options.body);assert.ok(body.code_verifier.length===43);
     assert.equal(body.auth_code,'synthetic_code_315m_abcdefghijklmnop');
     verifiedToken=jwt(identity,sid);
     return {status:200,text:async()=>JSON.stringify({access_token:verifiedToken,refresh_token:'never-browser',token_type:'bearer',expires_in:3600})};
    }
    if(url.endsWith('/auth/v1/user')){
     assert.equal(options.headers.authorization,'Bearer '+verifiedToken);
     return {status:200,text:async()=>JSON.stringify({id:identity,email:identity+'@invalid.example',email_confirmed_at:new Date().toISOString()})};
    }
    throw Error('Unexpected provider call');
   }});
  const config={issuerPool:issuer,gatewayPool:gateway,provider,projectUrl:PROJECT+'/',appOrigin:APP,
   csrfSigningKey:randomBytes(32),checkProviderSession:async({userId,sessionId})=>{
    if(providerDown)throw Error('outage');return {active:providerActive,userId,sessionId,expiresAt:Math.floor(Date.now()/1000)+3600};
   }};
  await assert.rejects(createPhase315mPrivateRuntime({...config,checkProviderSession:undefined}),/unavailable/);
  await assert.rejects(createPhase315mPrivateRuntime({...config,issuerPool:admin}),/unavailable/);
  const runtime=await createPhase315mPrivateRuntime(config);
  const sessions=[];
  for(const user of [A,B,C]){
   identity=user;sid=randomUUID();
   const f=await runtime.bridge.begin({email:user+'@invalid.example'}),state=captured.at(-1).state;
   await assert.rejects(runtime.bridge.completeAndIssue({state,browserBinding:randomBytes(32).toString('base64url'),authCode:'synthetic_code_315m_abcdefghijklmnop'}),/denied/);
   const issued=await runtime.bridge.completeAndIssue({state,browserBinding:f.browserBinding,authCode:'synthetic_code_315m_abcdefghijklmnop'});
   assert.ok(issued.token.startsWith('ce1.'));assert.equal(JSON.stringify(issued).includes(verifiedToken),false);
   sessions.push(issued.token);
   await assert.rejects(runtime.bridge.completeAndIssue({state,browserBinding:f.browserBinding,authCode:'synthetic_code_315m_abcdefghijklmnop'}),/denied/);
   await assert.rejects(runtime.bridge.begin({email:user+'@invalid.example'}),/unavailable/,'Database-backed email admission is bounded');
  }
  const [a,b,c]=sessions;
  const read=(token,workspaceId)=>runtime.authority.withAuthorizedRead({token,workspaceId},r=>r.listRequests());
  assert.deepEqual((await read(a,WA)).map(r=>r.id),['m_a']);
  assert.deepEqual((await read(b,WB)).map(r=>r.id),['m_b']);
  assert.deepEqual((await read(c,WA)).map(r=>r.id),['m_a']);
  await assert.rejects(read(a,WB),/denied/);await assert.rejects(read(b,WA),/denied/);
  await assert.rejects(read(a.slice(0,-2)+'ZZ',WA),/denied/);
  await assert.rejects(read(verifiedToken,WA),/denied/);
  for(const p of [issuer,gateway]){
   await assert.rejects(p.query('SELECT * FROM growth_starter_private.codeedge_sessions'),perm);
   await assert.rejects(p.query('SELECT * FROM growth_starter.work_requests'),perm);
   await assert.rejects(p.query('SET ROLE gs315m_issue_owner'),perm);
   await assert.rejects(p.query('UPDATE growth_starter_private.codeedge_sessions SET revoked_at=now()'),perm);
  }
  await assert.rejects(gateway.query('SELECT growth_starter_private.begin_login($1,$2,$3,$4,$5)',Array(5).fill('X'.repeat(43))),perm);
  await assert.rejects(issuer.query('SELECT growth_starter_private.read_requests($1,$2,20)',[a,WA]),perm);
  for(const role of ['anon','authenticated','service_role']){
   const denial=(await admin.query("SELECT has_schema_privilege($1,'growth_starter_private','USAGE') AS s,has_function_privilege($1,'growth_starter_private.session_context(text)','EXECUTE') AS f",[role])).rows[0];
   assert.deepEqual(denial,{s:false,f:false});
  }
  providerActive=false;await assert.rejects(read(a,WA),/denied/);providerActive=true;
  providerDown=true;await assert.rejects(read(a,WA),/unavailable/);providerDown=false;
  // Database trigger synchronizes even an existing writer that does not
  // explicitly acquire the application's advisory locks.
  let release,entered;const enteredPromise=new Promise(ok=>{entered=ok;});
  const pendingRead=runtime.authority.withAuthorizedRead({token:c,workspaceId:WA},async r=>{
   const result=await r.listRequests();entered();await new Promise(ok=>{release=ok;});return result;
  });
  await enteredPromise;let changed=false;
  const remove=admin.query("UPDATE growth_starter.memberships SET state='revoked',revoked_at=now() WHERE workspace_id=$1 AND user_id=$2",[WA,C]).then(()=>{changed=true;});
  await pause(125);assert.equal(changed,false);release();await pendingRead;await remove;
  await assert.rejects(read(c,WA),/denied/);
  const hold=await gateway.connect();
  await hold.query('BEGIN');await hold.query('SELECT * FROM growth_starter_private.read_requests($1,$2,20)',[a,WA]);
  let logoutFinished=false;
  const logout=runtime.authority.revoke({token:a}).then(r=>{logoutFinished=true;return r;});
  await pause(125);assert.equal(logoutFinished,false);await hold.query('COMMIT');hold.release();
  assert.deepEqual(await logout,{revoked:true});await assert.rejects(read(a,WA),/denied/);
  await admin.query('UPDATE growth_starter_private.codeedge_sessions SET expires_at=now()-interval \'1 second\' WHERE id=$1',[b.split('.')[1]]);
  await assert.rejects(read(b,WB),/denied/);
  await admin.query('UPDATE growth_starter_private.codeedge_sessions SET expires_at=now()+interval \'15 minutes\' WHERE id=$1',[b.split('.')[1]]);
  const workspaceReader=await gateway.connect();
  await workspaceReader.query('BEGIN');
  await workspaceReader.query('SELECT * FROM growth_starter_private.read_requests($1,$2,20)',[b,WB]);
  let suspensionFinished=false;
  const suspend=admin.query("UPDATE growth_starter.workspaces SET state='suspended' WHERE id=$1",[WB])
   .then(()=>{suspensionFinished=true;});
  await pause(125);assert.equal(suspensionFinished,false);
  await workspaceReader.query('COMMIT');workspaceReader.release();await suspend;
  await assert.rejects(read(b,WB),/denied/);
  // A consumed grant that already issued cannot mint another session.
  const f=(await admin.query('SELECT one_time_grant_id,email_sha256 FROM growth_starter_private.fresh_login_flows LIMIT 1')).rows[0];
  await assert.rejects(issuer.query('SELECT growth_starter_private.issue_session($1,$2,$3,$4,$5,$6,$7)',
   [f.one_time_grant_id,f.email_sha256,A,randomUUID(),randomUUID(),'0'.repeat(64),new Date(Date.now()+900000)]),e=>e.code==='28000');
  const h='1'.repeat(64),bindingHash='2'.repeat(64),verifier=randomBytes(32).toString('base64url'),grant=randomBytes(32).toString('base64url');
  await issuer.query('SELECT growth_starter_private.begin_login($1,$2,$3,$4,$5)',[h,bindingHash,verifier,grant,'3'.repeat(64)]);
  await issuer.query('SELECT * FROM growth_starter_private.consume_login($1,$2)',[h,bindingHash]);
  await assert.rejects(issuer.query('SELECT growth_starter_private.issue_session($1,$2,$3,$4,$5,$6,$7)',
   [grant,'3'.repeat(64),A,randomUUID(),a.split('.')[1],'4'.repeat(64),new Date(Date.now()+900000)]),e=>e.code==='23505');
  assert.equal((await admin.query('SELECT issued_at FROM growth_starter_private.fresh_login_flows WHERE one_time_grant_id=$1',[grant])).rows[0].issued_at,null,
   'Failed session INSERT must roll back grant consumption');
  // Explicit lockdown denies existing pooled connections too, without
  // deleting sessions or re-enabling any legacy access path.
  await admin.query(readFileSync('db/drafts/phase315m_lockdown_REVIEW_ONLY.sql','utf8'));
  await assert.rejects(read(b,WB),/unavailable|denied/);
  assert.equal((await admin.query("SELECT rolcanlogin FROM pg_roles WHERE rolname='gs315m_issuer'")).rows[0].rolcanlogin,false);
 }finally{
  await issuer?.end();await gateway?.end();
  if(ready){
   await admin.query('DROP TRIGGER IF EXISTS gs315m_workspace_writer ON growth_starter.workspaces');
   await admin.query('DROP TRIGGER IF EXISTS gs315m_membership_writer ON growth_starter.memberships');
   await admin.query('DROP SCHEMA growth_starter_private CASCADE');
  }
  await admin.query('DELETE FROM growth_starter.memberships WHERE workspace_id IN($1,$2)',[WA,WB]);
  await admin.query('DELETE FROM growth_starter.work_requests WHERE workspace_id IN($1,$2)',[WA,WB]);
  await admin.query('DELETE FROM growth_starter.workspaces WHERE id IN($1,$2)',[WA,WB]);
  for(const name of [...roles].reverse())if((await admin.query('SELECT FROM pg_roles WHERE rolname=$1',[name])).rowCount){
   await admin.query('DROP OWNED BY '+name+' CASCADE');await admin.query('DROP ROLE '+name);
  }
  await admin.query('ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM authenticated,anon,service_role');
  await admin.query('ALTER DEFAULT PRIVILEGES REVOKE SELECT ON TABLES FROM authenticated,anon,service_role');
  await admin.end();
 }
});
