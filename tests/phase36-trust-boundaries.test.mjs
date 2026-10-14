import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthenticatedReadGateway} from '../backend/authenticated-read-gateway.mjs';
import {checkAcceptedCatalog,syntheticAcceptedCatalogForTests} from '../backend/pg-rls-catalog.mjs';

const project='https://phase36-fictional.supabase.co',origin='https://fictional-client.invalid';
const now=1791570000;
const A='329d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const B='429d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const C='529d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const WA='ws_'+A,WB='ws_'+B;
const ids=[A,B,C];
const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
const sessions=new Map(ids.map((id,i)=>[id,(i+1)+'39d2e94-f1f0-4cd9-8bfa-0983be1434ab']));
function token(id,changes={}){
 return [enc({alg:'ES256',kid:'fixture-only'}),enc({
  iss:project+'/auth/v1',aud:'authenticated',role:'authenticated',sub:id,
  session_id:sessions.get(id),iat:now-60,exp:now+300,...changes
 }),Buffer.alloc(64,12).toString('base64url')].join('.');
}
function fixture(){
 const tokenIds=new Map(ids.map(id=>[token(id),id]));
 const memberships=new Map([[C,{workspaceId:WA,role:'client',state:'active'}]]);
 const suspended=new Set(),revoked=new Set(),requests=[],notes=[];
 let providerDown=false,sessionDown=false;
 const fetchImpl=async (url,opts)=>{
  const u=new URL(url),path=u.pathname;
  const id=tokenIds.get(opts.headers.authorization?.slice(7));
  requests.push(path);
  if(providerDown)throw Error('Synthetic provider unavailable');
  if(!id)return {status:401,json:async()=>({error:'invalid'})};
  if(path==='/auth/v1/user')return{status:200,json:async()=>({
    id,email:'user@fictional.invalid',email_confirmed_at:'2026-10-10T00:00:00Z'
  })};
  const owned=id===A?WA:id===B?WB:null;
  const member=memberships.get(id);
  const allowed=[owned,member?.state==='active'?member.workspaceId:null].filter(
    ws=>ws&&!suspended.has(ws));
  if(path==='/rest/v1/workspaces')return{status:200,json:async()=>
    allowed.map(ws=>({id:ws,owner_user_id:ws===WA?A:B,state:'active'}))};
  if(path==='/rest/v1/memberships')return{status:200,json:async()=>
    member?.state==='active'?[{workspace_id:member.workspaceId,
      user_id:id,role:member.role,state:'active'}]:[]};
  if(path==='/rest/v1/work_requests'){
   const ws=u.searchParams.get('workspace_id')?.slice(3);
   return{status:200,json:async()=>allowed.includes(ws)?[{
     id:'req_'+ws.slice(-12),workspace_id:ws,title:'Fictional enquiry',
     kind:'Local SEO',status:'Requested',version:0,updated_at:'2026-10-10T00:00:00Z'
   }]:[]};
  }
  throw Error('Unexpected synthetic request: '+path);
 };
 const checkAuthoritativeSession=async({userId,sessionId})=>{
  if(sessionDown)throw Error('Synthetic session authority unavailable');
  return {active:!revoked.has(userId)&&sessionId===sessions.get(userId),
    userId,sessionId};
 };
 const g=createAuthenticatedReadGateway({
  enableForSyntheticTesting:true,projectUrl:project,allowedOrigin:origin,
  publishableKey:'sb_publishable_phase36_fixture_only',
  fetchImpl,checkAuthoritativeSession,now:()=>now*1000
 });
 async function call(url,{id=A,overrideToken,method='GET'}={}){
  let status=0,body;
  const req={url,method,headers:{authorization:'Bearer '+(overrideToken??token(id))}};
  await g.handler(req,{writeHead(code){status=code},end(content){body=JSON.parse(content||'{}')}});
  return {status,body};
 }
 return {call,memberships,suspended,revoked,requests,notes,
   setProviderDown:x=>{providerDown=x},setSessionDown:x=>{sessionDown=x}};
}
test('Phase 3.6 fictional A/B/C: separate owners see only their own workspaces',async()=>{
 const f=fixture();
 for(const [id,yes,no] of [[A,WA,WB],[B,WB,WA],[C,WA,WB]]){
  const own=await f.call('/v1/workspaces',{id});
  assert.equal(own.status,200);assert.deepEqual(own.body.workspaces.map(x=>x.workspace_id),[yes]);
  const ownRequests=await f.call('/v1/requests?workspaceId='+yes,{id});
  assert.equal(ownRequests.status,200);
  assert.ok(ownRequests.body.items.every(x=>x.workspace_id===yes));
  assert.equal((await f.call('/v1/requests?workspaceId='+no,{id})).status,403);
 }
});
test('member C immediately loses both workspace and requests after server-side membership revocation',async()=>{
 const f=fixture();
 assert.equal((await f.call('/v1/requests?workspaceId='+WA,{id:C})).status,200);
 f.memberships.get(C).state='revoked';
 assert.deepEqual((await f.call('/v1/workspaces',{id:C})).body.workspaces,[]);
 assert.equal((await f.call('/v1/requests?workspaceId='+WA,{id:C})).status,403);
});
test('valid but revoked synthetic JWT and simulated provider outage fail closed before any data read',async()=>{
 const f=fixture();
 assert.equal((await f.call('/v1/workspaces')).status,200);
 const previous=f.requests.length;
 f.revoked.add(A);
 assert.equal((await f.call('/v1/workspaces')).status,401);
 assert.ok(f.requests.slice(previous).every(x=>x==='/auth/v1/user'));
 f.setSessionDown(true);
 assert.equal((await f.call('/v1/workspaces',{id:B})).status,401);
 f.setProviderDown(true);
 assert.equal((await f.call('/v1/workspaces',{id:B})).status,503);
 assert.ok(!f.requests.some(x=>x.includes('staging_list_')));
});
test('expired, wrong issuer/audience/role/session and fabricated actor claims are rejected',async()=>{
 const f=fixture();
 for(const bad of [
  {exp:now-1},{iss:'https://impostor.invalid/auth/v1'}, {aud:'service_role'},
  {role:'service_role'}, {session_id:null},{session_id:sessions.get(B)},
  {is_anonymous:true},{nbf:now+1000},{sub:B},{iat:now+3600}
 ]){
  assert.equal((await f.call('/v1/workspaces',{overrideToken:token(A,bad)})).status,401);
 }
 for(const raw of ['notajwt','x.y.z','',undefined]){
  const result=await f.call('/v1/workspaces',{overrideToken:raw??'none'});
  assert.equal(result.status,401);
 }
});
test('client-side owner/role escalation and cross-tenant request pollution fail closed',async()=>{
 const f=fixture();
 assert.equal((await f.call('/v1/requests?workspaceId='+WB+'&actorId='+B,{id:C})).status,400);
 assert.equal((await f.call('/v1/requests?workspaceId='+WB+'&role=owner',{id:C})).status,400);
 assert.equal((await f.call('/v1/requests?workspaceId='+WB,{id:C})).status,403);
 assert.equal((await f.call('/v1/workspaces',{id:C,overrideToken:token(C,{role:'owner'})})).status,401);
 assert.equal((await f.call('/v1/workspaces',{id:C,method:'POST'})).status,405);
});
test('catalog rejects policy or privileges widened, indirect role switch and old function grants',()=>{
 const base=syntheticAcceptedCatalogForTests();
 assert.equal(checkAcceptedCatalog(base),true);
 for(const mutate of [
  c=>c.policies[0].qual+=' OR true',
  c=>c.policies.push({...c.policies[0],name:'additional_unapproved'}),
  c=>c.privileges.find(x=>x.role==='authenticated'&&x.table==='workspaces').columns.push('private_data'),
  c=>c.role_paths.find(x=>x.role==='growth_starter_runtime'&&x.target==='growth_starter_reader').canSet=true,
  c=>c.legacy[2].roles.find(x=>x.role==='growth_starter_reader').execute=true
 ]){
  const c=structuredClone(base);mutate(c);
  assert.throws(()=>checkAcceptedCatalog(c),/authority unavailable/);
 }
});
