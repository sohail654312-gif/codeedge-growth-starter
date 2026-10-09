import test from 'node:test';
import assert from 'node:assert/strict';
import {createTrustedSessionGate} from '../backend/trusted-session-gate.mjs';
import {createPostgrestReadBoundary} from '../backend/postgrest-read-boundary.mjs';
const uid='329d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const sid='539d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const now=1791570000;
const project='https://synthetic-staging.supabase.co';
const enc=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
function token(overrides={}){
 return [enc({alg:'RS256',typ:'JWT',kid:'synthetic'}),enc({
  iss:project+'/auth/v1',aud:'authenticated',role:'authenticated',sub:uid,
  session_id:sid,iat:now-60,exp:now+120,...overrides}),Buffer.alloc(256,7).toString('base64url')].join('.');
}
function gate(checkAuthoritativeSession=async({userId,sessionId})=>({active:true,userId,sessionId})){
 return createTrustedSessionGate({projectUrl:project,checkAuthoritativeSession,now:()=>now*1000});
}
test('verified-provider downstream session check enforces exact user/session and revocation',async()=>{
 assert.equal(await gate().verifyCurrentSession({userId:uid,token:token()}),true);
 assert.equal(await gate(async()=>({active:false,userId:uid,sessionId:sid})).verifyCurrentSession({userId:uid,token:token()}),false);
 assert.equal(await gate(async()=>({active:true,userId:uid,sessionId:'wrong'})).verifyCurrentSession({userId:uid,token:token()}),false);
 assert.equal(await gate(async()=>{throw Error('registry down');}).verifyCurrentSession({userId:uid,token:token()}),false);
 assert.equal(await gate(async()=>({active:true,userId:uid,sessionId:sid,expiresAt:now-1})).verifyCurrentSession({userId:uid,token:token()}),false);
});
test('unverified, expired, forged identity context and unauthorized roles rejected',async()=>{
 for(const change of [
  {sub:'429d2e94-f1f0-4cd9-8bfa-0983be1434ab'},{iss:'https://fake.supabase.co/auth/v1'},
  {aud:'service_role'},{role:'service_role'},{session_id:'wrong'},
  {exp:now-1},{iat:now+100},{iat:now-4000},{exp:now+4000},
  {is_anonymous:true},{nbf:now+1000}
 ])assert.equal(await gate().verifyCurrentSession({userId:uid,token:token(change)}),false);
 assert.equal(await gate().verifyCurrentSession({userId:uid,token:'not_a_token'}),false);
 assert.throws(()=>createTrustedSessionGate({projectUrl:project}),/required/);
});
test('PostgREST reader accepts only provider-verified user plus matching independent session record',async()=>{
 let calls=0;
 const registry=gate(async({userId,sessionId})=>{calls++;return{active:true,userId,sessionId};});
 const api=createPostgrestReadBoundary({projectUrl:project,
  publishableKey:'sb_publishable_synthetic_contract_only',
  verifyCurrentSession:registry.verifyCurrentSession,
  fetchImpl:async(url)=> {
   const p=new URL(url).pathname;
   if(p==='/auth/v1/user')return{status:200,json:async()=>({
    id:uid,email:'synthetic@example.invalid',email_confirmed_at:'2026-10-10T00:00:00Z'})};
   if(p==='/rest/v1/workspaces')return{status:200,json:async()=>[{id:'ws_'+uid,owner_user_id:uid,state:'active'}]};
   if(p==='/rest/v1/memberships')return{status:200,json:async()=>[]};
   throw Error('Unexpected endpoint');
  }});
 assert.equal((await api.listWorkspaces('Bearer '+token())).workspaces.length,1);
 assert.equal(calls,1);
 const forged=token({sub:'429d2e94-f1f0-4cd9-8bfa-0983be1434ab'});
 await assert.rejects(api.listWorkspaces('Bearer '+forged),e=>e.status===401);
 assert.equal(calls,1);
});
