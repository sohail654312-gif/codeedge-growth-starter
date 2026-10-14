import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createSupabasePkceHttpAdapter} from '../backend/phase315g-supabase-pkce-adapter.mjs';
import {createExactSessionAuthority} from '../backend/exact-session-authority.mjs';
const config={projectUrl:'https://fixture-proj.supabase.co/',callbackUrl:'https://fixture.invalid/auth/callback',publishableKey:'sb_publishable_'+'X'.repeat(32),timeoutMs:250};
const token='e30.e30.signature';
test('provider response body size and body-read timeout are bounded before JSON parsing',async()=>{
 const oversized=new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(32769));}}));
 await assert.rejects(createSupabasePkceHttpAdapter({...config,fetchImpl:async()=>oversized}).verifyUser({accessToken:token}),/unavailable/);
 await assert.rejects(createSupabasePkceHttpAdapter({...config,fetchImpl:async()=>({status:200,text:()=>new Promise(()=>{})})}).verifyUser({accessToken:token}),/unavailable/);
 await assert.rejects(createSupabasePkceHttpAdapter({...config,fetchImpl:()=>new Promise(()=>{})}).verifyUser({accessToken:token}),/unavailable/);
 await assert.rejects(createSupabasePkceHttpAdapter({...config,fetchImpl:async()=>({status:200,text:async()=>{throw Error('secret-token');}})}).verifyUser({accessToken:token}),e=>e.message==='Supabase Auth service unavailable.');
});
test('email initiation keeps eligible and denied-account responses indistinguishable',async()=>{
 const input={email:'fictional@invalid.example',codeChallenge:'X'.repeat(43),state:'Y'.repeat(43)};
 for(const status of [200,400,403,404,422]){
  const adapter=createSupabasePkceHttpAdapter({...config,fetchImpl:async()=>({status,text:async()=>'{}'})});
  assert.deepEqual(await adapter.sendLoginEmail(input),{requested:true});
 }
 await assert.rejects(createSupabasePkceHttpAdapter({...config,fetchImpl:async()=>({status:503,text:async()=>'{}'})}).sendLoginEmail(input),/unavailable/);
});
test('authority requires exact identity, explicit account/session policy and bounded lookup',async()=>{
 const userId=randomUUID(),sessionId=randomUUID(),row={userId,sessionId,exists:true,revoked:false,deleted:false,banned:false,policyValid:true,expiresAt:Math.floor(Date.now()/1000)+60};
 const check=async value=>createExactSessionAuthority({lookup:async()=>value}).checkProviderSession({userId,sessionId});
 assert.equal((await check(row)).active,true);
 assert.equal((await createExactSessionAuthority({lookup:async()=>row,now:()=>NaN}).checkProviderSession({userId,sessionId})).active,false);
 for(const patch of [{exists:false},{revoked:true},{deleted:true},{banned:true},{policyValid:false},{userId:randomUUID()},{sessionId:randomUUID()},{expiresAt:0},{expiresAt:undefined}])
  assert.equal((await check({...row,...patch})).active,false);
 let aborted=false;
 const authority=createExactSessionAuthority({timeoutMs:50,lookup:({signal})=>new Promise(()=>{signal.addEventListener('abort',()=>{aborted=true;});})});
 assert.equal((await authority.checkProviderSession({userId,sessionId})).active,false);assert.equal(aborted,true);
 const cancelled=new AbortController();cancelled.abort();assert.equal((await authority.checkProviderSession({userId,sessionId,signal:cancelled.signal})).active,false);
});
