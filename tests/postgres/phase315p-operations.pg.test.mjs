import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {Readable} from 'node:stream';
import pg from 'pg';
import {createPrivateWorkspaceOperations,WRITER_PREFLIGHT,verifyWriterCatalog} from '../../backend/phase315p-private-operations.mjs';
import {buildReviewBundle} from '../../scripts/phase315p-migration-bundle.mjs';
import {createPhase315mPrivateRuntime} from '../../backend/phase315m-private-runtime.mjs';
const url=new URL(process.env.TEST_DATABASE_URL||'http://missing.invalid');
if(!['postgres:','postgresql:'].includes(url.protocol)||!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.pathname!=='/gs_test')
 throw Error('Local disposable gs_test PostgreSQL 17 required.');
const db='gs_p_'+randomUUID().replaceAll('-',''),isolated=new URL(url);isolated.pathname='/'+db;
const admin=new pg.Pool({connectionString:url.href,max:2}),setup=new pg.Pool({connectionString:isolated.href,max:4});
const roles=['gs315k_gateway','gs315k_read_owner','gs315k_revoke_owner','gs315m_issuer','gs315m_issue_owner','gs315p_writer','gs315p_ops_owner'];
const [A,B,C,D]=Array.from({length:4},()=>randomUUID()),WA='ws_'+A,WB='ws_'+B;
const key=()=>randomBytes(20).toString('base64url');
let pool,ops,created=false,providerFacts,authorityCalls=0;
const sessions=new Map();
const denied=e=>e?.status===403;
const call=(user,action,input={},query={},workspaceId=WA)=>ops.run({token:sessions.get(user),workspaceId,action,input,query});
before(async()=>{
 await admin.query('CREATE DATABASE '+db);created=true;
 const v=Number((await setup.query('SHOW server_version_num')).rows[0].server_version_num);assert.ok(v>=170000&&v<180000);
 for(const role of ['anon','authenticated','service_role'])await setup.query('DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname=\''+role+'\') THEN CREATE ROLE '+role+'; END IF; END $$');
 await setup.query(readFileSync('db/migrations/0001_growth_starter.sql','utf8'));
 const baselineClient=await setup.connect();
 try{
  await baselineClient.query('ALTER TABLE growth_starter.workspaces ADD COLUMN unexpected text');
  await assert.rejects(baselineClient.query(buildReviewBundle().sql),/baseline catalog drift/);
  await baselineClient.query('ROLLBACK');
  await baselineClient.query('ALTER TABLE growth_starter.workspaces DROP COLUMN unexpected');
  await baselineClient.query(buildReviewBundle().sql);
 }finally{baselineClient.release();}
 const password=randomBytes(32).toString('base64url');await setup.query("ALTER ROLE gs315p_writer LOGIN PASSWORD '"+password+"'");
 const login=new URL(isolated);login.username='gs315p_writer';login.password=password;
 pool=new pg.Pool({connectionString:login.href,max:6,connectionTimeoutMillis:2000,query_timeout:6500});
 providerFacts=({userId,sessionId})=>({active:true,userId,sessionId,expiresAt:Math.floor(Date.now()/1000)+3600});
 ops=await createPrivateWorkspaceOperations({pool,checkProviderSession:async args=>{authorityCalls++;return providerFacts(args);},cursorKey:'fictional-only-p-cursor-key-1234567890123456789'});
 for(const u of [A,B,C,D]){
  const id=randomUUID(),secret=key().padEnd(43,'a').slice(0,43),hash=createHash('sha256').update('codeedge-growth-starter:session:v1\0'+id+'\0'+secret).digest('hex');
  sessions.set(u,'ce1.'+id+'.'+secret);
  await setup.query('INSERT INTO growth_starter_private.codeedge_sessions(id,secret_sha256,user_id,provider_session_id,one_time_grant_id,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval \'15 minutes\')',[id,hash,u,randomUUID(),key()]);
 }
 await call(A,'onboard');await call(B,'onboard');
 for(const [u,role] of [[C,'staff'],[D,'client']])await setup.query('INSERT INTO growth_starter.memberships(workspace_id,user_id,owner_user_id,role,created_by) VALUES($1,$2,$3,$4,$3)',[WA,u,A,role]);
});
after(async()=>{
 await pool?.end();await setup.end();if(created)await admin.query('DROP DATABASE '+db+' WITH (FORCE)');
 for(const r of [...roles].reverse())if((await admin.query('SELECT FROM pg_roles WHERE rolname=$1',[r])).rowCount)await admin.query('DROP ROLE '+r);
 await admin.end();
});
test('P writer exact effective catalog, browser denies and missing/drifted privileges',async()=>{
 const catalog=(await pool.query(WRITER_PREFLIGHT)).rows[0];verifyWriterCatalog(catalog);
 for(const sql of ['SELECT * FROM growth_starter.work_requests','SELECT * FROM growth_starter_private.codeedge_sessions',
 'SET ROLE gs315p_ops_owner','SET ROLE gs315m_issue_owner','SELECT growth_starter_private.op_actor(NULL,NULL,NULL)',
 'SELECT growth_starter_private.issue_session(NULL,NULL,NULL,NULL,NULL,NULL,NULL)'])await assert.rejects(pool.query(sql),e=>e.code==='42501');
 for(const r of ['anon','authenticated','service_role']){
  const row=(await setup.query("SELECT has_schema_privilege($1,'growth_starter_private','USAGE') AS s,has_function_privilege($1,'growth_starter_private.ops_authorize(text,text)','EXECUTE') AS f",[r])).rows[0];assert.deepEqual(row,{s:false,f:false});
 }
 await setup.query('GRANT SELECT(title) ON growth_starter.work_requests TO gs315p_writer');
 await assert.rejects(createPrivateWorkspaceOperations({pool,checkProviderSession:providerFacts,cursorKey:'x'.repeat(40)}),/catalog denied/);
 await setup.query('REVOKE SELECT(title) ON growth_starter.work_requests FROM gs315p_writer');
 await setup.query('REVOKE EXECUTE ON FUNCTION growth_starter_private.ops_profile_read(text,text) FROM gs315p_writer');
 await assert.rejects(call(A,'profile'),e=>e.status===503);
 await setup.query('GRANT EXECUTE ON FUNCTION growth_starter_private.ops_profile_read(text,text) TO gs315p_writer');
 await setup.query('GRANT SELECT ON growth_starter.invitations TO gs315p_ops_owner');
 assert.throws(()=>verifyWriterCatalog((catalog.owner_extra_tables=1,catalog)),/catalog denied/);
 await assert.rejects(createPrivateWorkspaceOperations({pool,checkProviderSession:providerFacts,cursorKey:'x'.repeat(40)}),/catalog denied/);
 await setup.query('REVOKE SELECT ON growth_starter.invitations FROM gs315p_ops_owner');
 await setup.query('GRANT CREATE ON SCHEMA public TO gs315p_writer');
 await assert.rejects(createPrivateWorkspaceOperations({pool,checkProviderSession:providerFacts,cursorKey:'x'.repeat(40)}),/catalog denied/);
 await setup.query('REVOKE CREATE ON SCHEMA public FROM gs315p_writer');
 // Standard PUBLIC Auth helpers need no managed ACL change: without Auth
 // USAGE they are unreachable, not usable writer RPCs.
 await setup.query("CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT NULL::uuid'");
 await createPrivateWorkspaceOperations({pool,checkProviderSession:providerFacts,cursorKey:'x'.repeat(40)});
 await assert.rejects(pool.query('SELECT auth.uid()'),e=>e.code==='42501');
 await setup.query('GRANT USAGE ON SCHEMA auth TO gs315p_writer');
 await assert.rejects(createPrivateWorkspaceOperations({pool,checkProviderSession:providerFacts,cursorKey:'x'.repeat(40)}),/catalog denied/);
 await setup.query('REVOKE USAGE ON SCHEMA auth FROM gs315p_writer');await setup.query('DROP SCHEMA auth CASCADE');
});
test('P real session-derived A/B/C authorization, owner onboarding, profile and forged claims',async()=>{
 assert.equal((await call(A,'authorize')).role,'owner');assert.equal((await call(C,'authorize')).role,'staff');
 assert.deepEqual((await call(A,'workspaces')).workspaces.map(w=>w.workspaceId),[WA]);
 assert.deepEqual((await call(C,'workspaces')).workspaces.map(w=>w.workspaceId),[WA]);
 await assert.rejects(call(A,'authorize',{}, {},WB),denied);await assert.rejects(call(B,'authorize'),denied);
 await assert.rejects(call(C,'revokeMember',{idempotencyKey:key(),userId:D,actor:A,role:'owner'}),denied);
 const fields={name:'Fictional Clinic A',industry:'Clinic',city:'Karachi',website:'https://fiction.invalid/',goal:'Review a draft'};
 const input={fields,version:0,idempotencyKey:key()};assert.equal((await call(A,'saveProfile',input)).version,1);
 assert.deepEqual(await call(A,'saveProfile',input),await call(A,'profile'));
 await assert.rejects(call(A,'saveProfile',{...input,fields:{...fields,name:'Changed'}}),e=>e.status===409);
 await assert.rejects(call(B,'saveProfile',{...input,idempotencyKey:key()}),denied);
 await setup.query("UPDATE growth_starter.workspaces SET state='suspended' WHERE id=$1",[WB]);
 await assert.rejects(call(B,'onboard'),denied);await assert.rejects(call(B,'authorize',{}, {},WB),denied);
 await setup.query("UPDATE growth_starter.workspaces SET state='active' WHERE id=$1",[WB]);
});
let request;
test('P concurrent idempotent request creation, full versioned review/assignment/correction/approval',async()=>{
 const rollbackKey=key();
 await setup.query('REVOKE INSERT ON growth_starter.audit_events FROM gs315p_ops_owner');
 await assert.rejects(call(A,'createRequest',{idempotencyKey:rollbackKey,fields:{title:'Must roll back',kind:'Other'}}),e=>e.status===503);
 assert.equal((await setup.query('SELECT count(*)::int AS n FROM growth_starter.work_requests WHERE title=\'Must roll back\'')).rows[0].n,0);
 assert.equal((await setup.query('SELECT count(*)::int AS n FROM growth_starter.operation_receipts WHERE idempotency_key=$1',[rollbackKey])).rows[0].n,0);
 await setup.query('GRANT INSERT ON growth_starter.audit_events TO gs315p_ops_owner');
 const input={idempotencyKey:key(),fields:{title:'Fictional website draft',kind:'Website update',notes:'No external publication'}};
 const both=await Promise.all([call(A,'createRequest',input),call(A,'createRequest',input)]);assert.equal(both[0].id,both[1].id);request=both[0];
 assert.equal((await setup.query('SELECT count(*)::int AS n FROM growth_starter.operation_receipts WHERE idempotency_key=$1',[input.idempotencyKey])).rows[0].n,1);
 await assert.rejects(call(A,'assign',{id:request.id,idempotencyKey:key(),assignedTo:B,version:0}),denied);
 request=await call(A,'assign',{id:request.id,idempotencyKey:key(),assignedTo:C,version:0});assert.equal(request.assignedTo,C);
 const change=(u,action,status,note='')=>call(u,action,{id:request.id,idempotencyKey:key(),status,version:request.version,note});
 request=await change(C,'review','In progress');request=await change(C,'review','Awaiting approval');
 await assert.rejects(change(C,'decision','Approved'),denied);
 request=await change(D,'correction','Changes requested','Please revise the fictional headline.');
 assert.equal((await call(D,'detail',{id:request.id})).notesHistory.length,1);
 request=await change(C,'review','In progress');request=await change(C,'review','Awaiting approval');
 request=await change(D,'decision','Approved');request=await change(C,'review','Completed');
 await assert.rejects(change(C,'review','In progress'),e=>e.status===409);
 await assert.rejects(call(B,'detail',{id:request.id}),denied);await assert.rejects(call(C,'history'),denied);
 assert.ok((await call(A,'history')).items.length>0);
});
test('P cursor binding, tampering, microsecond pagination, bounded pages and malicious values',async()=>{
 for(let i=0;i<3;i++)await call(A,'createRequest',{idempotencyKey:key(),fields:{title:'Fictional '+i,kind:'Other'}});
 const first=await call(A,'list',{}, {limit:1});assert.ok(first.nextCursor);
 const second=await call(A,'list',{}, {limit:1,cursor:first.nextCursor});assert.notEqual(first.items[0].id,second.items[0].id);
 for(const q of [{limit:51},{cursor:first.nextCursor+'x'},{cursor:first.nextCursor,status:'Requested'}])await assert.rejects(call(A,'list',{},q),e=>e.status===400);
 await assert.rejects(call(C,'list',{}, {cursor:first.nextCursor}),e=>e.status===400);
 await assert.rejects(pool.query('SELECT growth_starter_private.ops_requests_page($1,$2,NULL,NULL,NULL,\'infinity\',\'x\',20)',[sessions.get(A),WA]),e=>e.code==='22023');
 await assert.rejects(call(A,'createRequest',{idempotencyKey:key(),fields:{title:'bad\u0001',kind:'Other'}}),e=>e.status===400);
 await assert.rejects(call(A,'assign',{id:request.id,idempotencyKey:key(),assignedTo:C,dueDate:'2026-02-30',version:request.version}),e=>e.status===400);
});
test('P exact provider pair, malformed/expired/outage/timeout authority fails before business operation',async()=>{
 const original=providerFacts;
 for(const mutate of [r=>({...r,active:false}),r=>({...r,userId:B}),r=>({...r,sessionId:randomUUID()}),r=>({...r,expiresAt:0}),r=>({...r,expiresAt:undefined}),()=>null]){
  providerFacts=args=>mutate(original(args));await assert.rejects(call(A,'profile'),denied);
 }
 providerFacts=()=>{throw Error('private upstream details');};await assert.rejects(call(A,'profile'),e=>e.status===503&&!e.message.includes('upstream'));
 providerFacts=()=>new Promise(()=>{});await assert.rejects(call(A,'profile'),e=>e.status===503);
 providerFacts=original;
});
test('P authorized media checks, denial and atomic deletion outbox plus sandbox-only authorization',async()=>{
 const storage='growth-starter/'+WA+'/fictional.png';
 await setup.query("INSERT INTO growth_starter.media(workspace_id,id,storage_key,filename,content_type,size_bytes,declared_rights,consent_state,scan_state) VALUES($1,'fictional_media',$2,'fictional.png','image/png',128,true,'approved','clean')",[WA,storage]);
 assert.equal((await call(A,'mediaRead',{id:'fictional_media'})).storage_key,storage);
 await assert.rejects(call(B,'mediaRead',{id:'fictional_media'}),denied);
 await assert.rejects(call(C,'mediaDelete',{id:'fictional_media',idempotencyKey:key()}),denied);
 const input={id:'fictional_media',idempotencyKey:key()};assert.deepEqual(await call(A,'mediaDelete',input),await call(A,'mediaDelete',input));
 await assert.rejects(call(A,'mediaRead',{id:'fictional_media'}),denied);
 assert.equal((await setup.query('SELECT count(*)::int AS n FROM growth_starter.media_delete_outbox')).rows[0].n,1);
 assert.equal((await call(A,'automationAuthorize')).mode,'sandbox_only');await assert.rejects(call(C,'automationAuthorize'),denied);
});
test('P integrated PKCE callback cookies -> restricted operation -> real Codeedge logout denies replay',async()=>{
 const pools=[];
 try{
  for(const role of ['gs315m_issuer','gs315k_gateway']){
   const password=randomBytes(32).toString('base64url');await setup.query('ALTER ROLE '+role+" LOGIN PASSWORD '"+password+"'");
   const login=new URL(isolated);login.username=role;login.password=password;pools.push(new pg.Pool({connectionString:login.href,max:2}));
  }
  let state;const origin='https://fictional.example.invalid',project='https://fictional-proj.supabase.co',sid=randomUUID();
  const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url'),t=Math.floor(Date.now()/1000),
   jwt=encode({alg:'RS256'})+'.'+encode({iss:project+'/auth/v1',aud:'authenticated',role:'authenticated',sub:A,session_id:sid,iat:t,exp:t+3600})+'.'+encode('synthetic');
  const runtime=await createPhase315mPrivateRuntime({issuerPool:pools[0],gatewayPool:pools[1],operations:ops,
   projectUrl:project+'/',appOrigin:origin,csrfSigningKey:randomBytes(32),checkProviderSession:providerFacts,
   provider:{sendLoginEmail:async args=>{state=args.state;},exchangeAuthCode:async()=>({accessToken:jwt}),
    verifyUser:async()=>({id:A,email:'fictional-a@invalid.example',email_confirmed_at:new Date().toISOString()})}});
  async function send(path,{method='GET',body=null,jar='',csrf}={}){
   const raw=body===null?'':JSON.stringify(body),req=Readable.from(raw?[Buffer.from(raw)]:[]);req.method=method;req.url=path;req.socket={encrypted:true};
   req.headers={host:new URL(origin).host,cookie:jar,origin,...(method==='POST'?{'content-type':'application/json','content-length':String(Buffer.byteLength(raw)),'x-csrf-token':csrf}: {})};
   const out={};await runtime.handler(req,{writeHead(status,headers){out.status=status;out.headers=headers;},end(raw){out.body=raw?JSON.parse(raw):null;}});return out;
  }
  const start=await send('/auth/start');assert.equal(start.status,200);
  const initiated=await send('/auth/start',{method:'POST',body:{email:'fictional-a@invalid.example'},jar:start.headers['set-cookie'][0].split(';')[0],csrf:start.body.csrfToken});assert.equal(initiated.status,202);
  const binding=initiated.headers['set-cookie'][0].split(';')[0],path='/auth/callback?state='+state+'&code=synthetic_pkce_code_abcdefghijklmnop';
  const callback=await send(path,{jar:binding});assert.equal(callback.status,303);assert.equal(callback.headers.location,'/dashboard');
  const cookies=callback.headers['set-cookie'].map(c=>c.split(';')[0]).join('; '),csrf=callback.headers['set-cookie'].find(c=>c.startsWith('__Host-ce_csrf=')).split(';')[0].split('=')[1];
  const input={idempotencyKey:key(),fields:{title:'Real restricted SQL via cookie route',kind:'Other'},actor:B,role:'owner'};
  const created=await send('/v1/operations/requests?workspaceId='+WA,{method:'POST',body:input,jar:cookies,csrf});assert.equal(created.status,200);
  assert.equal((await setup.query('SELECT created_by FROM growth_starter.work_requests WHERE id=$1',[created.body.id])).rows[0].created_by,A);
  assert.equal((await send(path,{jar:binding})).headers.location,'/login?auth=failed');
  assert.equal((await send('/v1/operations/requests?workspaceId='+WB,{jar:cookies})).status,403);
  assert.equal((await send('/auth/logout',{method:'POST',jar:cookies,csrf})).status,204);
  assert.equal((await send('/v1/operations/requests?workspaceId='+WA,{jar:cookies})).status,403);
 }finally{for(const p of pools)await p.end();for(const r of ['gs315m_issuer','gs315k_gateway'])await setup.query('ALTER ROLE '+r+' NOLOGIN');}
});
test('P transaction ordering: in-flight member operation completes before revocation; subsequent replay denies',async()=>{
 const hold=await pool.connect();await hold.query('BEGIN');
 await hold.query('SELECT growth_starter_private.ops_authorize($1,$2)',[sessions.get(C),WA]);
 let revoked=false;const pending=call(A,'revokeMember',{userId:C,idempotencyKey:key()}).then(r=>{revoked=true;return r;});
 await new Promise(ok=>setTimeout(ok,125));assert.equal(revoked,false);
 await hold.query('COMMIT');hold.release();await pending;
 await assert.rejects(call(C,'list'),denied);
 // Committed Codeedge revocation and expiry apply even while provider is active.
 await setup.query('UPDATE growth_starter_private.codeedge_sessions SET expires_at=now()-interval \'1 second\' WHERE id=$1',[sessions.get(B).split('.')[1]]);
 await assert.rejects(call(B,'authorize',{}, {},WB),denied);
 await setup.query('UPDATE growth_starter_private.codeedge_sessions SET revoked_at=now() WHERE id=$1',[sessions.get(D).split('.')[1]]);
 await assert.rejects(call(D,'list'),denied);
});
test('P reproducible restricted-workflow timing and deny-all recovery for existing pooled connections',async()=>{
 const samples=[];for(let i=0;i<10;i++){const start=performance.now();await call(A,'list');samples.push(performance.now()-start);}
 mkdirSync('work',{recursive:true});writeFileSync('work/phase315p-pg-evidence.json',JSON.stringify({databaseVersion:(await setup.query('SELECT version()')).rows[0].version,
 fixture:'fictional A/B/C/D, generated isolated database',method:'10 complete restricted list transactions, local loopback, synthetic provider authority',samplesMs:samples,authorityCalls,
 hostedProviderVerified:false,writerCatalog:(await pool.query(WRITER_PREFLIGHT)).rows[0]},null,2));
 await setup.query('REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA growth_starter_private FROM gs315p_writer');
 await assert.rejects(call(A,'list'),e=>e.status===503);
});
