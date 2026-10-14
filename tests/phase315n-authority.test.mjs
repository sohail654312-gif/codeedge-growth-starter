import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {createPhase315mPrivateRuntime} from '../backend/phase315m-private-runtime.mjs';

// Phase 3.15N regression: these synthetic pools never open a network connection.
// They verify that an incorrect, expired, or unavailable EXACT Supabase session
// assertion cannot reach the private business-data function.
const APP='https://fictional.example.invalid';
const PROJECT='https://fictional-project.supabase.co/';
const OWNER=randomUUID(), SESSION=randomUUID(), WORKSPACE='ws_'+randomUUID();
const token=()=> 'ce1.'+randomUUID()+'.'+randomBytes(32).toString('base64url');

function restrictedPool(role){
 const calls=[];
 const functions=role==='gs315m_issuer'
   ? ['begin_login','consume_login','issue_session']
   : ['read_requests','revoke_session','session_context'];
 return {
  calls,
  async query(sql){
   if(!sql.includes('current_user AS actor'))throw Error('Unexpected preflight SQL');
   return {rows:[{actor:role,login:role,rolcanlogin:true,rolinherit:false,
    rolsuper:false,rolbypassrls:false,rolcreaterole:false,rolcreatedb:false,
    rolreplication:false,memberships:false,business_schema:false,db_create:false,
    public_functions:0,safe_owners:3,private_rls:2,accessible_tables:[],
    executable:functions}]};
  },
  async connect(){
   return {async query(sql){
    calls.push(sql);
    if(sql.includes('growth_starter_private.session_context'))
     return {rows:[{user_id:OWNER,provider_session_id:SESSION}],rowCount:1};
    if(sql.includes('growth_starter_private.read_requests'))
     return {rows:[{id:'fictional-owner-request'}],rowCount:1};
    return {rows:[],rowCount:0};
   },release(){}};
  }
 };
}

async function makeRuntime(checkProviderSession){
 const issuerPool=restrictedPool('gs315m_issuer');
 const gatewayPool=restrictedPool('gs315k_gateway');
 const provider={sendLoginEmail:async()=>{},exchangeAuthCode:async()=>{},
  verifyUser:async()=>{}};
 const runtime=await createPhase315mPrivateRuntime({issuerPool,gatewayPool,
  provider,projectUrl:PROJECT,appOrigin:APP,csrfSigningKey:randomBytes(32),
  checkProviderSession});
 return {runtime,gatewayPool};
}

test('private gateway fails closed before protected reads for invalid exact-session proof',async()=>{
 const seconds=Math.floor(Date.now()/1000);
 const deniedCases=[
  {name:'provider reports revoked',proof:{active:false,userId:OWNER,sessionId:SESSION}},
  {name:'provider returned another session',proof:{active:true,userId:OWNER,sessionId:randomUUID()}},
  {name:'provider returned another user',proof:{active:true,userId:randomUUID(),sessionId:SESSION}},
  {name:'provider session expired',proof:{active:true,userId:OWNER,sessionId:SESSION,expiresAt:seconds-1}},
  {name:'provider returned no assertion',proof:null},
  {name:'provider returned only a boolean',proof:true}
 ];
 for(const {name,proof} of deniedCases){
  const {runtime,gatewayPool}=await makeRuntime(async()=>proof);
  let callbacks=0;
  await assert.rejects(runtime.authority.withAuthorizedRead(
   {token:token(),workspaceId:WORKSPACE},async r=>{
    callbacks++;return r.listRequests();
   }),/Private session denied\./,name);
  assert.equal(callbacks,0,name+': application callback must not run');
  assert.equal(gatewayPool.calls.some(sql=>sql.includes('growth_starter_private.read_requests')),false,
   name+': no tenant data may be read');
 }
});

test('provider outage denies access; a verified exact user/session match permits only scoped read',async()=>{
 const {runtime,gatewayPool}=await makeRuntime(async()=>{throw Error('fictional provider unavailable');});
 await assert.rejects(runtime.authority.withAuthorizedRead(
  {token:token(),workspaceId:WORKSPACE},r=>r.listRequests()),/Private session dependency unavailable\./);
 assert.equal(gatewayPool.calls.some(sql=>sql.includes('growth_starter_private.read_requests')),false);
 const observations=[];
 const approved=await makeRuntime(async ({userId,sessionId,signal})=>{
  observations.push({userId,sessionId,signalProvided:signal instanceof AbortSignal});
  return {active:true,userId:OWNER,sessionId:SESSION,expiresAt:Math.floor(Date.now()/1000)+60};
 });
 const rows=await approved.runtime.authority.withAuthorizedRead(
  {token:token(),workspaceId:WORKSPACE},r=>r.listRequests());
 assert.deepEqual(rows,[{id:'fictional-owner-request'}]);
 assert.deepEqual(observations.map(o=>({userId:o.userId,sessionId:o.sessionId,signalProvided:o.signalProvided})),
  [{userId:OWNER,sessionId:SESSION,signalProvided:true}]);
 assert.equal(approved.gatewayPool.calls.filter(sql=>sql.includes('growth_starter_private.read_requests')).length,1);
});

test('hung session authority times out and aborts before any tenant read',async()=>{
 let observedAbort=false;
 const {runtime,gatewayPool}=await makeRuntime(({signal})=>new Promise(()=>{signal.addEventListener('abort',()=>{observedAbort=true;},{once:true});}));
 await assert.rejects(runtime.authority.withAuthorizedRead(
  {token:token(),workspaceId:WORKSPACE},r=>r.listRequests()),/Private session dependency unavailable\./);
 assert.equal(observedAbort,true);
 assert.equal(gatewayPool.calls.some(sql=>sql.includes('growth_starter_private.read_requests')),false);
});
