import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthenticatedReadGateway} from '../backend/authenticated-read-gateway.mjs';

const project='https://synthetic-tenant.supabase.co';
const origin='https://client.synthetic.invalid';
const now=1791570000;
const A='329d2e94-f1f0-4cd9-8bfa-0983be1434ab', B='429d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const STAFF='529d2e94-f1f0-4cd9-8bfa-0983be1434ab',CLIENT='629d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const wa='ws_'+A,wb='ws_'+B;
const users=[A,B,STAFF,CLIENT];
const enc=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const session=Object.fromEntries(users.map((u,i)=>[u,`${i+1}39d2e94-f1f0-4cd9-8bfa-0983be1434ab`]));
function token(user,overrides={}){
 const claims={iss:project+'/auth/v1',aud:'authenticated',role:'authenticated',sub:user,
   session_id:session[user],iat:now-60,exp:now+300,...overrides};
 return [enc({alg:'ES256',kid:'synthetic'}),enc(claims),Buffer.alloc(64,4).toString('base64url')].join('.');
}
function fixture(){
 const accepted=new Map(users.map(u=>[token(u),u]));
 const records=new Map([[wa,{owner:A,state:'active'}],[wb,{owner:B,state:'active'}]]);
 const membership=new Map([[STAFF,{workspace:wa,role:'staff',state:'active'}],
   [CLIENT,{workspace:wb,role:'client',state:'active'}]]);
 const deniedSessions=new Set(),calls=[];
 let providerDown=false;
 const fetchImpl=async(url,opts)=>{
  const u=new URL(url),auth=opts.headers.authorization,subject=accepted.get(auth?.slice(7));
  calls.push({url,method:opts.method,auth,query:u.searchParams});
  if(providerDown)throw Error('Synthetic provider unavailable');
  if(!subject)return {status:401,json:async()=>({error:'Invalid token'})};
  if(u.pathname==='/auth/v1/user')return {status:200,json:async()=>({
    id:subject,email:'synthetic@example.invalid',email_confirmed_at:'2026-10-10T00:00:00Z'
  })};
  const allowed=new Set([...records].filter(([id,r])=>r.state==='active' &&
    (r.owner===subject || membership.get(subject)?.workspace===id &&
     membership.get(subject)?.state==='active')).map(([id])=>id));
  if(u.pathname==='/rest/v1/workspaces')return{status:200,json:async()=>[...allowed].map(id=>({
    id,owner_user_id:records.get(id).owner,state:'active'
  }))};
  if(u.pathname==='/rest/v1/memberships')return{status:200,json:async()=>membership.get(subject)?.state==='active'?
    [{user_id:subject,workspace_id:membership.get(subject).workspace,role:membership.get(subject).role,state:'active'}]:[]};
  if(u.pathname==='/rest/v1/work_requests'){
   const id=u.searchParams.get('workspace_id')?.slice(3);
   return{status:200,json:async()=>allowed.has(id)?[{
    id:'req_'+id.slice(-5),workspace_id:id,title:'Synthetic request',kind:'Other',
    status:'Requested',version:0,updated_at:'2026-10-10T00:00:00Z'
   }]:[]};
  }
  throw Error('Unexpected API route');
 };
 const cb=async({userId,sessionId})=>({userId,sessionId,active:!deniedSessions.has(userId)});
 const gateway=createAuthenticatedReadGateway({projectUrl:project,allowedOrigin:origin,
  publishableKey:'sb_publishable_fixture_gateway_only',checkAuthoritativeSession:cb,
  fetchImpl,now:()=>now*1000,enableForSyntheticTesting:true});
 return{gateway,accepted,records,membership,deniedSessions,calls,setDown:v=>providerDown=v};
}
async function serve(gateway,fn){
 const s=gateway.createServer();await new Promise(resolve=>s.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+s.address().port;
 try{return await fn(async(path,{method='GET',token,headers={}}={})=>{
  const res=await fetch(base+path,{method,headers:{...(token?{authorization:'Bearer '+token}:{}),...headers}});
  let body={};if(res.status!==204)body=await res.json();
  return{status:res.status,body,headers:res.headers};
 });}finally{await new Promise(resolve=>s.close(resolve));}
}
test('gateway is disabled by default and fails when trusted dependencies missing',()=>{
 assert.throws(()=>createAuthenticatedReadGateway(),/not approved/);
 assert.throws(()=>createAuthenticatedReadGateway({projectUrl:project,allowedOrigin:origin,
  publishableKey:'sb_publishable_fixture_gateway_only',enableForSyntheticTesting:true}),/required/);
 assert.throws(()=>createAuthenticatedReadGateway({projectUrl:project,allowedOrigin:'http://unsafe.invalid',
  publishableKey:'sb_publishable_fixture_gateway_only',checkAuthoritativeSession:async()=>true,
  enableForSyntheticTesting:true}),/not approved/);
});
test('synthetic 4-person HTTP end-to-end: owners, staff, client, both cross-tenant denials',async()=>{
 const f=fixture();
 await serve(f.gateway,async request=>{
  for(const [user,own,other] of [[A,wa,wb],[B,wb,wa],[STAFF,wa,wb],[CLIENT,wb,wa]]){
   const ws=await request('/v1/workspaces',{token:token(user)});
   assert.equal(ws.status,200);assert.deepEqual(ws.body.workspaces.map(x=>x.workspace_id),[own]);
   const yes=await request('/v1/requests?workspaceId='+own+'&limit=2&page=0',{token:token(user)});
   assert.equal(yes.status,200);assert.equal(yes.body.items.length,1);assert.equal(yes.body.page,0);
   const no=await request('/v1/requests?workspaceId='+other,{token:token(user)});
   assert.equal(no.status,403);
  }
  assert.equal((await request('/v1/workspaces')).status,401);
  assert.equal((await request('/v1/workspaces',{token:'malformed'})).status,401);
  assert.equal((await request('/v1/workspaces',{token:token(A,{exp:now-10})})).status,401);
  assert.equal((await request('/v1/workspaces',{token:token(A,{role:'service_role'})})).status,401);
  assert.equal((await request('/v1/workspaces',{token:token(A,{sub:B})})).status,401);
  assert.equal((await request('/v1/requests?workspaceId='+wa+'&actorId='+B,{token:token(A)})).status,400);
  assert.equal((await request('/v1/requests?workspaceId='+wa+'&page=20',{token:token(A)})).status,400);
  assert.equal((await request('/v1/requests?workspaceId='+wa+'&limit=51',{token:token(A)})).status,400);
  assert.equal((await request('/v1/requests?workspaceId='+wa,{token:token(A),method:'POST'})).status,405);
  assert.equal((await request('/v1/requests?workspaceId='+wa,{token:token(A),
    headers:{origin:'https://attacker.invalid'}})).status,403);
  const preflight=await request('/v1/workspaces',{method:'OPTIONS',
    headers:{origin,'access-control-request-method':'GET','access-control-request-headers':'Authorization'}});
  assert.equal(preflight.status,204);
  const noPreflight=await request('/v1/workspaces',{method:'OPTIONS',
    headers:{origin,'access-control-request-method':'POST','access-control-request-headers':'Authorization'}});
  assert.equal(noPreflight.status,403);
 });
 assert.ok(f.calls.every(c=>c.method==='GET'));
 assert.ok(f.calls.every(c=>!c.url.includes('staging_list_') && !c.url.includes('actorId')));
});
test('revocation, suspended workspaces and trusted provider outage deny without legacy fallback',async()=>{
 const f=fixture();
 await serve(f.gateway,async request=>{
  f.membership.get(STAFF).state='revoked';
  assert.deepEqual((await request('/v1/workspaces',{token:token(STAFF)})).body.workspaces,[]);
  assert.equal((await request('/v1/requests?workspaceId='+wa,{token:token(STAFF)})).status,403);
  f.records.get(wb).state='suspended';
  assert.equal((await request('/v1/requests?workspaceId='+wb,{token:token(B)})).status,403);
  f.deniedSessions.add(A);
  assert.equal((await request('/v1/workspaces',{token:token(A)})).status,401);
  f.setDown(true);
  const v=await request('/v1/workspaces',{token:token(B)});
  assert.equal(v.status,503);
  assert.equal(v.body.error,'Read boundary unavailable.');
 });
 assert.ok(f.calls.every(c=>!c.url.includes('staging_list_')));
});
