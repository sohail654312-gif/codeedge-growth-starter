// Disposable loopback fixture only. No real email, Supabase calls or hosted DDL.
// Exercises the production build, HTTP adapter, cookie handler and restricted SQL.
import {createServer} from 'node:https';
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import pg from '../../node_modules/pg/lib/index.js';
import {buildReviewBundle} from '../../scripts/phase315p-migration-bundle.mjs';
import {createPrivateWorkspaceOperations} from '../../backend/phase315p-private-operations.mjs';
import {createPhase315mPrivateRuntime} from '../../backend/phase315m-private-runtime.mjs';
import {createSupabasePkceHttpAdapter} from '../../backend/phase315g-supabase-pkce-adapter.mjs';
import {loadPrivateUi,servePrivateUi} from '../../staging/private-ui-assets.mjs';
const root=resolve('../..'),url=new URL(process.env.TEST_DATABASE_URL||'http://missing.invalid');
if(process.env.GS_FICTIONAL_BROWSER_TEST!=='1'||!['postgres:','postgresql:'].includes(url.protocol)||
 !['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.pathname!=='/gs_test')throw Error('Explicit fictional loopback gs_test database required.');
const origin='https://localhost:4178',project='https://fictional-browser.supabase.co',roles=['gs315k_gateway','gs315k_read_owner','gs315k_revoke_owner','gs315m_issuer','gs315m_issue_owner','gs315p_writer','gs315p_ops_owner'];
const db='gs_browser_'+randomUUID().replaceAll('-',''),isolated=new URL(url);isolated.pathname='/'+db;
const admin=new pg.Pool({connectionString:url.href}),setup=new pg.Pool({connectionString:isolated.href}),pools=[];
let server,created=false,closing=false,mode='active';
async function cleanup(closeServer=true){if(closing)return;closing=true;if(closeServer)await new Promise(done=>server?server.close(done):done());for(const p of pools)await p.end();await setup.end();if(created){await admin.query('DROP DATABASE '+db+' WITH (FORCE)');for(const r of [...roles].reverse())if((await admin.query('SELECT FROM pg_roles WHERE rolname=$1',[r])).rowCount)await admin.query('DROP ROLE '+r);}await admin.end();}
process.on('SIGTERM',()=>void cleanup().then(()=>process.exit(0)));process.on('SIGINT',()=>void cleanup().then(()=>process.exit(0)));
try{
 if(Number((await admin.query('SHOW server_version_num')).rows[0].server_version_num)<170000||Number((await admin.query('SHOW server_version_num')).rows[0].server_version_num)>=180000)throw Error('PostgreSQL 17 required.');
 if((await admin.query('SELECT FROM pg_roles WHERE rolname=ANY($1)',[roles])).rowCount)throw Error('Conflicting runtime roles: use a fresh isolated cluster or finish prior tests.');
 await admin.query('CREATE DATABASE '+db);created=true;
 for(const role of ['anon','authenticated','service_role'])await setup.query("DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='"+role+"') THEN CREATE ROLE "+role+"; END IF; END $$");
 await setup.query(readFileSync(resolve(root,'db/migrations/0001_growth_starter.sql'),'utf8'));
 await setup.query(buildReviewBundle(root).sql);
 for(const role of ['gs315m_issuer','gs315k_gateway','gs315p_writer']){const password=randomBytes(32).toString('base64url');await setup.query('ALTER ROLE '+role+" LOGIN PASSWORD '"+password+"'");const login=new URL(isolated);login.username=role;login.password=password;pools.push(new pg.Pool({connectionString:login.href,max:4,connectionTimeoutMillis:2000,query_timeout:6500}));}
 const users=new Map(),flows=new Map(),codes=new Map(),tokens=new Map(),scenarios=new Map();
 function user(email){if(!/^fictional_[a-z0-9_]+@invalid\.example$/.test(email))throw Error('Only fictional users allowed.');if(!users.has(email))users.set(email,randomUUID());return users.get(email);}
 const jwt=(id,sid)=>{const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url'),t=Math.floor(Date.now()/1000);return enc({alg:'RS256'})+'.'+enc({iss:project+'/auth/v1',aud:'authenticated',role:'authenticated',sub:id,session_id:sid,iat:t,exp:t+3600})+'.'+enc('fictional-signature');};
 const provider=createSupabasePkceHttpAdapter({projectUrl:project+'/',callbackUrl:origin+'/auth/callback',publishableKey:'sb_publishable_'+'fictional'.repeat(5),fetchImpl:async(path,options)=>{
  if(mode==='outage')throw Error('Synthetic provider outage');
  const respond=value=>({status:200,text:async()=>JSON.stringify(value)});
  if(path.includes('/otp?')){const input=JSON.parse(options.body),callback=new URL(new URL(path).searchParams.get('redirect_to'));if(input.create_user!==false||input.code_challenge_method!=='s256')throw Error('Unsafe login contract');const code=randomBytes(32).toString('base64url');const flow={email:input.email,userId:user(input.email),sessionId:randomUUID(),state:callback.searchParams.get('state'),challenge:input.code_challenge,code};flows.set(input.email,flow);codes.set(code,flow);return respond({});}
  if(path.endsWith('/token?grant_type=pkce')){const input=JSON.parse(options.body),flow=codes.get(input.auth_code);codes.delete(input.auth_code);if(!flow||createHash('sha256').update(input.code_verifier).digest('base64url')!==flow.challenge)throw Error('PKCE mismatch');const access=jwt(flow.userId,flow.sessionId);tokens.set(access,flow);return respond({access_token:access,token_type:'bearer',expires_in:3600});}
  if(path.endsWith('/auth/v1/user')){const flow=tokens.get(options.headers.authorization.slice(7));if(!flow)throw Error('Token mismatch');return respond({id:flow.userId,email:flow.email,email_confirmed_at:new Date().toISOString()});}throw Error('Unexpected external request');
 }});
 const authority=async({userId,sessionId})=>{if(mode==='outage')throw Error('Synthetic provider outage');return {active:mode!=='revoked',userId,sessionId:mode==='mismatch'?randomUUID():sessionId,expiresAt:Math.floor(Date.now()/1000)+3600};};
 const operations=await createPrivateWorkspaceOperations({pool:pools[2],checkProviderSession:authority,cursorKey:randomBytes(32).toString('base64url')});
 const runtime=await createPhase315mPrivateRuntime({issuerPool:pools[0],gatewayPool:pools[1],operations,provider,checkProviderSession:authority,projectUrl:project+'/',appOrigin:origin,csrfSigningKey:randomBytes(32)});
 const certDir=resolve(root,'work/browser-tls');mkdirSync(certDir,{recursive:true});
 execFileSync(process.env.GS_TEST_OPENSSL||'openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost','-keyout',resolve(certDir,'key.pem'),'-out',resolve(certDir,'cert.pem')],{stdio:'ignore'});
 const files=loadPrivateUi(resolve(root,'dist/private'));
 server=createServer({key:readFileSync(resolve(certDir,'key.pem')),cert:readFileSync(resolve(certDir,'cert.pem'))},async(req,res)=>{
  try{
   if(req.headers.host!==new URL(origin).host||!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)){res.writeHead(421);return res.end();}
   const u=new URL(req.url,origin);
   const json=value=>{res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value));};
   if(u.pathname==='/__fixture/ready')return json({fictionalTestOnly:true,providerLive:false,databaseVersion:17});
   if(u.pathname==='/__fixture/stop'&&req.method==='POST'&&req.headers.origin===origin){await cleanup(false);json({stopping:true,fixtureRemoved:true});setImmediate(()=>server.close(()=>process.exit(0)));return;}
   if(u.pathname==='/__fixture/link'){const flow=flows.get(u.searchParams.get('email'));if(!flow)throw Error('No fictional email requested');return json({url:origin+'/auth/callback?state='+flow.state+'&code='+flow.code});}
   if(u.pathname==='/__fixture/scenario'){
    const tag=u.searchParams.get('name');if(!/^[a-z0-9_]{1,60}$/.test(tag||''))throw Error('Invalid fictional scenario');
    if(!scenarios.has(tag)){const emails=Object.fromEntries(['owner','agency','staff','client','other'].map(r=>[r,'fictional_'+tag+'_'+r+'@invalid.example'])),ids=Object.fromEntries(Object.entries(emails).map(([r,e])=>[r,user(e)])),ws='ws_'+ids.owner,otherWs='ws_'+ids.other;
     await setup.query('INSERT INTO growth_starter.workspaces(id,owner_user_id) VALUES($1,$2),($3,$4)',[ws,ids.owner,otherWs,ids.other]);
     if(tag.endsWith('_journey'))await setup.query("INSERT INTO growth_starter.memberships(workspace_id,user_id,owner_user_id,role,created_by) VALUES($1,$2,$3,'client',$3)",[otherWs,ids.owner,ids.other]);
     for(const [r,role] of [['agency','agency_admin'],['staff','staff'],['client','client']])await setup.query('INSERT INTO growth_starter.memberships(workspace_id,user_id,owner_user_id,role,created_by) VALUES($1,$2,$3,$4,$3)',[ws,ids[r],ids.owner,role]);
     await setup.query("INSERT INTO growth_starter.media(workspace_id,id,storage_key,filename,content_type,size_bytes,declared_rights,consent_state,scan_state) VALUES($1,'fictional_media','growth-starter/'||$1||'/fictional.png','fictional.png','image/png',128,true,'approved','clean')",[ws]);
     scenarios.set(tag,{emails,ids,ws,otherWs});}
    return json(scenarios.get(tag));
   }
   if(u.pathname==='/__fixture/control'&&req.method==='POST'&&req.headers.origin===origin){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>1024)throw Error();}const input=JSON.parse(raw);if(input.mode){if(!['active','outage','revoked','mismatch'].includes(input.mode))throw Error();mode=input.mode;}if(input.expireEmail)await setup.query("UPDATE growth_starter_private.codeedge_sessions SET expires_at=clock_timestamp()-interval '1 second' WHERE user_id=$1",[user(input.expireEmail)]);return json({fictionalTestOnly:true});}
   if(servePrivateUi(req,res,{files,appOrigin:origin,secureIngress:r=>r.socket.encrypted===true}))return;
   await runtime.handler(req,res);
  }catch{if(!res.headersSent)res.writeHead(503,{'content-type':'application/json'});res.end(JSON.stringify({error:'Fictional fixture unavailable.'}));}
 });
 server.requestTimeout=10000;server.headersTimeout=10000;server.timeout=12000;
 await new Promise(done=>server.listen(4178,'127.0.0.1',done));process.stdout.write('Fictional loopback HTTPS browser fixture ready. No live provider evidence.\n');
}catch(e){await cleanup();throw e;}
