import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createBridgeBackedSessionAuthority} from '../backend/phase315t-bridge-authority.mjs';

const userId=randomUUID(),sessionId=randomUUID(),now=()=>Date.parse('2026-10-30T05:00:00Z');
const seconds=Math.floor(now()/1000);
const row={pair_exists:true,banned:false,deleted:false,session_not_after:null};
const policy={userId,sessionId,policyValid:true,expiresAt:seconds+120};
const factory=(readExactPair=async()=>row,verifyOriginalSessionPolicy=async()=>policy,options={})=>
 createBridgeBackedSessionAuthority({readExactPair,verifyOriginalSessionPolicy,now,...options});
const check=authority=>authority.checkProviderSession({userId,sessionId});
test('source authority refuses absent real bridge or policy implementation',()=>{
 assert.throws(()=>createBridgeBackedSessionAuthority({readExactPair:async()=>row}),/required/);
 assert.throws(()=>createBridgeBackedSessionAuthority({verifyOriginalSessionPolicy:async()=>policy}),/required/);
 assert.deepEqual(factory().capabilities,{exactPair:true,policyVerifierRequired:true,liveProviderAccepted:false,hostedVerified:false});
});
test('combines verified exact pair with independently supplied finite policy expiry',async()=>{
 const r=await check(factory());
 assert.deepEqual(r,{active:true,userId,sessionId,expiresAt:seconds+120});
 const earlier=new Date((seconds+30)*1000);
 assert.equal((await check(factory(async()=>({...row,session_not_after:earlier})))).expiresAt,seconds+30);
});
test('bridge does not infer account health or active original session from partial facts',async()=>{
 for(const bad of [null,{}, {...row,pair_exists:false},{...row,banned:true},
  {...row,deleted:true},{...row,banned:null},{...row,deleted:undefined},
  {...row,session_not_after:'not-a-date'},
  {...row,session_not_after:new Date((seconds-1)*1000)}]){
  assert.equal((await check(factory(async()=>bad))).active,false);
 }
});
test('policy is mandatory, exact, current and independently checked after the bridge',async()=>{
 for(const bad of [null,{}, {...policy,policyValid:false},{...policy,policyValid:undefined},
  {...policy,userId:randomUUID()},{...policy,sessionId:randomUUID()},
  {...policy,expiresAt:seconds},{...policy,expiresAt:undefined}]){
  assert.equal((await check(factory(async()=>row,async()=>bad))).active,false);
 }
 assert.equal((await check(factory(async()=>row,async()=>{throw Error('provider outage')}))).active,false);
});
test('does not consult policy for missing, banned, deleted or expired sessions',async()=>{
 let calls=0;
 const a=factory(async()=>({...row,pair_exists:false}),async()=>{calls++;return policy;});
 assert.equal((await check(a)).active,false);assert.equal(calls,0);
});
test('timeout and in-flight caller cancellation deny late provider results',async()=>{
 const late=factory(async()=>new Promise(()=>{}),async()=>policy,{timeoutMs:50});
 assert.equal((await check(late)).active,false);
 let resolvePolicy,start;
 const started=new Promise(r=>{start=r;});
 const active=factory(async()=>row,async()=>{start();return new Promise(r=>{resolvePolicy=r;});});
 const controller=new AbortController();
 const decision=active.checkProviderSession({userId,sessionId,signal:controller.signal});
 await started;controller.abort();resolvePolicy(policy);
 assert.equal((await decision).active,false);
});
