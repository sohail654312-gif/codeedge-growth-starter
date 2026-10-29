import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {randomBytes,randomUUID} from 'node:crypto';
import {createPrivateHttpsCookieHandler} from '../backend/phase315e-https-cookies.mjs';
import {validateFreshProviderIdentity} from '../backend/phase315d-fresh-login.mjs';
import {createSupabasePkceHttpAdapter} from '../backend/phase315g-supabase-pkce-adapter.mjs';
import {readPhase315mConfig,createPhase315mIngress} from '../staging/phase315m-config.mjs';
import {createPhase315mPrivateRuntime,PRIVATE_RUNTIME_PREFLIGHT} from '../backend/phase315m-private-runtime.mjs';
const APP='https://clinic.example.invalid',PROJECT='https://fictional-proj.supabase.co';
const opaque=()=>randomBytes(32).toString('base64url');
async function request(handler,path,{method='GET',headers={},body='',tls=true}={}){
 const req=Readable.from(body?[body]:[]);req.method=method;req.url=path;
 req.headers={host:'clinic.example.invalid',...headers};req.socket={encrypted:tls};
 const out={};const res={writeHead(status,h){out.status=status;out.headers=h;},end(raw){out.body=raw?JSON.parse(raw):null;}};
 await handler(req,res);return out;
}
test('private email login, callback and logout use existing HTTPS cookies and CSRF boundary',async()=>{
 const binding=opaque(),state=opaque(),token='ce1.'+randomUUID()+'.'+opaque();let loginCount=0,callbackCount=0;
 const bridge={begin:async({email})=>{assert.equal(email,'a@invalid.example');loginCount++;return {browserBinding:binding};},
  completeAndIssue:async()=>{callbackCount++;return {token,expiresAt:new Date(Date.now()+900000).toISOString()};}};
 const authority={revoke:async()=>({revoked:true}),withAuthorizedRead:async()=>[],issue:async()=>{}};
 const {handler}=createPrivateHttpsCookieHandler({bridge,authority,appOrigin:APP,csrfSigningKey:randomBytes(32),emailLogin:true});
 const start=await request(handler,'/auth/start');assert.equal(start.status,200);
 assert.ok(start.headers['set-cookie'][0].includes('Secure; SameSite=Lax; HttpOnly'));
 const nonceCookie=start.headers['set-cookie'][0].split(';')[0];
 const body=JSON.stringify({email:'a@invalid.example'});
 const post={method:'POST',headers:{cookie:nonceCookie,origin:APP,'content-type':'application/json',
 'content-length':String(Buffer.byteLength(body)),'x-csrf-token':start.body.csrfToken},body};
 assert.equal((await request(handler,'/auth/start',{...post,headers:{...post.headers,origin:'https://attacker.invalid'}})).status,403);
 assert.equal((await request(handler,'/auth/start',{...post,headers:{...post.headers,'x-csrf-token':'forged'}})).status,403);
 const sent=await request(handler,'/auth/start',post);assert.equal(sent.status,202);assert.equal(loginCount,1);
 assert.equal(JSON.stringify(sent.body).includes(binding),false);
 const callback=await request(handler,'/auth/callback?state='+state+'&code=synthetic_code_123456789',{
 headers:{cookie:sent.headers['set-cookie'][0].split(';')[0]}});
 assert.equal(callback.status,303);assert.equal(callbackCount,1);
 assert.equal(callback.headers.location,'/dashboard');
 const jar=callback.headers['set-cookie'].map(c=>c.split(';')[0]).join('; ');
 const csrf=callback.headers['set-cookie'].find(c=>c.startsWith('__Host-ce_csrf=')).split(';')[0].split('=')[1];
 const logout=await request(handler,'/auth/logout',{method:'POST',headers:{cookie:jar,origin:APP,'x-csrf-token':csrf}});
 assert.equal(logout.status,204);assert.ok(logout.headers['set-cookie'].every(c=>c.includes('Max-Age=0')));
 assert.equal((await request(handler,'/auth/start',{tls:false})).status,421);
 assert.equal((await request(handler,'/auth/start',{headers:{cookie:nonceCookie+'; '+nonceCookie}})).status,400);
 const oversized={...post,headers:{...post.headers,'content-length':'1025'}};
 assert.equal((await request(handler,'/auth/start',oversized)).status,400);
 assert.equal((await request(handler,'/auth/callback?state='+state+'&code=x&code=y',{headers:{cookie:nonceCookie}})).status,303);
 assert.equal(callbackCount,1);
});
test('provider initiation uses fresh email PKCE, never an existing bearer or automatic signup',async()=>{
 const calls=[];
 const provider=createSupabasePkceHttpAdapter({projectUrl:PROJECT+'/',callbackUrl:APP+'/auth/callback',
 publishableKey:'sb_publishable_'+'Z'.repeat(32),fetchImpl:async(url,opts)=>{calls.push({url,opts});return {status:200,text:async()=>'{}'};}});
 const state=opaque(),challenge=opaque();
 await provider.sendLoginEmail({email:'a@invalid.example',codeChallenge:challenge,state});
 const body=JSON.parse(calls[0].opts.body),url=new URL(calls[0].url);
 assert.deepEqual(body,{email:'a@invalid.example',create_user:false,code_challenge:challenge,code_challenge_method:'s256'});
 assert.equal(url.origin,PROJECT);assert.equal(new URL(url.searchParams.get('redirect_to')).searchParams.get('state'),state);
 await assert.rejects(provider.sendLoginEmail({email:'a@invalid.example',codeChallenge:challenge,state:'bad'}),/denied/);
 assert.equal(calls.length,1);
});
test('shared fresh identity validation denies stale, malformed and future-not-before JWT claims',()=>{
 const now=Date.now(),t=Math.floor(now/1000),id=randomUUID(),sid=randomUUID();
 const base={iss:PROJECT+'/auth/v1',aud:'authenticated',role:'authenticated',sub:id,session_id:sid,iat:t,exp:t+3600};
 const make=claims=>Buffer.from('{}').toString('base64url')+'.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.signature';
 const user={id,email:'a@invalid.example',email_confirmed_at:new Date(now).toISOString()};
 assert.equal(validateFreshProviderIdentity({accessToken:make(base),user,projectUrl:PROJECT,now}).userId,id);
 for(const changes of [{iat:t-121},{nbf:t+1},{exp:t},{exp:t-1},{sub:randomUUID()}])
  assert.throws(()=>validateFreshProviderIdentity({accessToken:make({...base,...changes}),user,projectUrl:PROJECT,now}),/denied/);
 assert.throws(()=>validateFreshProviderIdentity({accessToken:make(base),user:{...user,banned_until:'invalid'},projectUrl:PROJECT,now}),/denied/);
});
test('staging configuration cannot infer owner/reviewer approval or accept broad credentials',()=>{
 assert.throws(()=>readPhase315mConfig({},{}),/unavailable/);
 const env={GS315M_ACTIVATE:'dbppeymhsemvghbvuvof',GS315M_COMMIT_SHA:'a'.repeat(40),GS315M_APP_ORIGIN:APP,
 GS315M_ISSUER_DATABASE_URL:'postgres://gs315m_issuer:'+opaque()+'@db.dbppeymhsemvghbvuvof.supabase.co/postgres',
 GS315M_GATEWAY_DATABASE_URL:'postgres://gs315k_gateway:'+opaque()+'@db.dbppeymhsemvghbvuvof.supabase.co/postgres',
 GS315M_PUBLISHABLE_KEY:'sb_publishable_'+'X'.repeat(32),GS315M_DATABASE_CA_PEM:'-----BEGIN CERTIFICATE-----\nfictional\n-----END CERTIFICATE-----',
 GS315M_TLS_CERT_PATH:'fictional-cert.pem',GS315M_TLS_KEY_PATH:'fictional-key.pem',GS315M_CSRF_KEY_PATH:'fictional-csrf.key'};
 const evidence={projectRef:'dbppeymhsemvghbvuvof',commitSha:env.GS315M_COMMIT_SHA,appOrigin:APP,privateSchemaExcluded:true,
 directApiClosed:true,exactProviderRevocationAccepted:true,independentReviewer:'fictional-reviewer',ownerApprovalId:'fictional-offline-approval'};
 assert.equal(readPhase315mConfig(env,evidence).projectUrl,'https://dbppeymhsemvghbvuvof.supabase.co/');
 for(const change of [{exactProviderRevocationAccepted:false},{privateSchemaExcluded:false},{commitSha:'b'.repeat(40)}])
  assert.throws(()=>readPhase315mConfig(env,{...evidence,...change}),/unavailable/);
 assert.throws(()=>readPhase315mConfig({...env,GS315M_GATEWAY_DATABASE_URL:env.GS315M_GATEWAY_DATABASE_URL.replace('gs315k_gateway','postgres')},evidence),/unavailable/);
 const managedEnv={...env,GS315M_INGRESS_MODE:'managed_https',GS315M_TRUSTED_PROXY_ADDRESSES:'10.0.0.2',PORT:'8787'};
 assert.throws(()=>readPhase315mConfig(managedEnv,evidence),/unavailable/);
 const config=readPhase315mConfig(managedEnv,{...evidence,ingressMode:'managed_https',
  proxyReplacesForwardedHeaders:true,privateIngressOnly:true});
 assert.equal(config.bindHost,'0.0.0.0');assert.equal(config.port,8787);
 const secure=createPhase315mIngress(config);
 const proxyReq={socket:{remoteAddress:'::ffff:10.0.0.2'},headers:{'x-forwarded-proto':'https'}};
 assert.equal(secure(proxyReq),true);
 assert.equal(secure({...proxyReq,socket:{remoteAddress:'203.0.113.1'}}),false);
 assert.equal(secure({...proxyReq,headers:{'x-forwarded-proto':'http'}}),false);
 assert.equal(secure({...proxyReq,headers:{...proxyReq.headers,'x-forwarded-host':'attacker.invalid'}}),false);
});

test('private issuer and gateway preflights reject unknown or ill-typed privilege facts',async()=>{
 const rowFor=role=>({
  actor:role,login:role,rolcanlogin:true,rolinherit:false,rolsuper:false,
  rolbypassrls:false,rolcreaterole:false,rolcreatedb:false,rolreplication:false,
  memberships:false,business_schema:false,db_create:false,
  public_functions:0,safe_owners:3,private_rls:2,accessible_tables:[],
  executable:role==='gs315m_issuer'
   ?['begin_login','consume_login','issue_session']
   :['read_requests','revoke_session','session_context']
 });
 const issuer=rowFor('gs315m_issuer'),gateway=rowFor('gs315k_gateway');
 const pool=row=>({
  query:async()=>({rows:[row]}),
  connect:async()=>{throw Error('Unexpected database operation in source-only preflight test.');}
 });
 const start=(issuerPatch={},gatewayPatch={})=>createPhase315mPrivateRuntime({
  issuerPool:pool({...issuer,...issuerPatch}),
  gatewayPool:pool({...gateway,...gatewayPatch}),
  provider:{sendLoginEmail:async()=>{},exchangeAuthCode:async()=>{},verifyUser:async()=>{}},
  projectUrl:PROJECT+'/',appOrigin:APP+'/',csrfSigningKey:randomBytes(32),
  checkProviderSession:async()=>({active:false})
 });
 const accepted=await start();
 assert.equal(accepted.status,'restricted_source_runtime_hosted_acceptance_pending');
 assert.equal((await accepted.ready()).releaseReady,false);
 const forbidden=['rolinherit','rolsuper','rolbypassrls','rolcreaterole',
  'rolcreatedb','rolreplication','memberships','business_schema','db_create'];
 for(const key of forbidden){
  for(const value of [undefined,null,'false']){
   await assert.rejects(start({[key]:value}),/unavailable/,key+' issuer');
   await assert.rejects(start({}, {[key]:value}),/unavailable/,key+' gateway');
  }
 }
 for(const value of [undefined,null,'true',1]){
  await assert.rejects(start({rolcanlogin:value}),/unavailable/,'issuer LOGIN');
  await assert.rejects(start({}, {rolcanlogin:value}),/unavailable/,'gateway LOGIN');
 }
});

test('every acquired issuer/gateway pool connection is rechecked before private SQL effects',async()=>{
 const safe=role=>({
  actor:role,login:role,rolcanlogin:true,rolinherit:false,rolsuper:false,
  rolbypassrls:false,rolcreaterole:false,rolcreatedb:false,rolreplication:false,
  memberships:false,business_schema:false,db_create:false,
  public_functions:0,safe_owners:3,private_rls:2,accessible_tables:[],
  executable:role==='gs315m_issuer'
   ?['begin_login','consume_login','issue_session']
   :['read_requests','revoke_session','session_context']
 });
 const makePool=(role,drift={})=>{
  const calls=[];
  return {
   calls,
   // Startup/readiness can use a different physical connection from a transaction.
   query:async(sql)=>{
    assert.equal(sql,PRIVATE_RUNTIME_PREFLIGHT);
    return {rows:[safe(role)]};
   },
   connect:async()=>({
    query:async(sql)=>{
     calls.push(sql);
     if(sql===PRIVATE_RUNTIME_PREFLIGHT)return {rows:[{...safe(role),...drift}]};
     if(sql.startsWith('SELECT growth_starter_private.'))
      return {rows:[{revoked:true}],rowCount:1};
     return {rows:[]};
    },
    release(){}
   })
  };
 };
 const makeRuntime=async(issuerDrift={},gatewayDrift={})=>{
  const issuer=makePool('gs315m_issuer',issuerDrift);
  const gateway=makePool('gs315k_gateway',gatewayDrift);
  let emails=0;
  const runtime=await createPhase315mPrivateRuntime({
   issuerPool:issuer,gatewayPool:gateway,
   provider:{sendLoginEmail:async()=>{emails++;},
    exchangeAuthCode:async()=>{},verifyUser:async()=>{}},
   projectUrl:PROJECT+'/',appOrigin:APP+'/',csrfSigningKey:randomBytes(32),
   checkProviderSession:async()=>({active:false})
  });
  return {runtime,issuer,gateway,get emails(){return emails;}};
 };
 for(const drift of [
  {actor:'postgres',login:'postgres'},
  {rolsuper:true},{memberships:undefined},{db_create:'false'},
  {accessible_tables:['auth.sessions']},{executable:['issue_session']},
  {public_functions:null}
 ]){
  const issuer=await makeRuntime(drift);
  await assert.rejects(issuer.runtime.bridge.begin({email:'a@invalid.example'}),/unavailable/);
  assert.equal(issuer.emails,0,'no provider email after a rejected issuer connection');
  assert.equal(issuer.issuer.calls.filter(sql=>sql.startsWith('SELECT growth_starter_private.')).length,0,
   'no private issuer SQL after failed connection preflight');
  assert.ok(issuer.issuer.calls.includes(PRIVATE_RUNTIME_PREFLIGHT));
  const gateway=await makeRuntime({},drift);
  await assert.rejects(gateway.runtime.authority.revoke({
   token:'ce1.'+randomUUID()+'.'+opaque()
  }),/unavailable/);
  assert.equal(gateway.gateway.calls.filter(sql=>sql.startsWith('SELECT growth_starter_private.')).length,0,
   'no private gateway SQL after failed connection preflight');
  assert.ok(gateway.gateway.calls.includes(PRIVATE_RUNTIME_PREFLIGHT));
 }
 const ok=await makeRuntime();
 await ok.runtime.bridge.begin({email:'a@invalid.example'});
 assert.equal(ok.emails,1);
 assert.equal(ok.issuer.calls.filter(sql=>sql===PRIVATE_RUNTIME_PREFLIGHT).length,1);
 assert.equal((await ok.runtime.authority.revoke({
  token:'ce1.'+randomUUID()+'.'+opaque()
 })).revoked,true);
 assert.equal(ok.gateway.calls.filter(sql=>sql===PRIVATE_RUNTIME_PREFLIGHT).length,1);
});
