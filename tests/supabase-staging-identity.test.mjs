import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupabaseStagingIdentity} from '../backend/supabase-staging-identity.mjs';
const uid='329d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const sid='539d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const now=1_791_457_000;
const origin='https://synthetic-staging.supabase.co';
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
function bearer(change={},alg='ES256'){
 const h=b64({alg,kid:'asymmetric_test_key'}),p=b64({
  iss:origin+'/auth/v1',aud:'authenticated',role:'authenticated',sub:uid,
  session_id:sid,email:'person@synthetic.invalid',iat:now,exp:now+900,...change
 });
 // Synthetic signature: our mocked provider is authoritative for this test.
 return 'Bearer '+h+'.'+p+'.'+Buffer.alloc(64,12).toString('base64url');
}
function adapter({
 checkSession=async()=>true,
 fetchImpl=async()=>({status:200,json:async()=>({id:uid,email:'person@synthetic.invalid',
   email_confirmed_at:'2026-10-08T12:00:00Z',is_anonymous:false})}),url=origin
}={}){return createSupabaseStagingIdentity({projectUrl:url,
  publishableKey:'sb_publishable_only_synthetic_testing',
  checkSession,fetchImpl,now:()=>now*1000,maxLifetimeSeconds:1800});}
test('provider verified user AND current DB session required for authorization',async()=>{
 let seen=null;
 const a=adapter({checkSession:async actor=>{seen=actor;return true;}});
 const actor=await a.verifyAuthorization(bearer());
 assert.equal(actor.userId,uid);
 assert.equal(actor.sessionId,sid);
 assert.equal(seen.email,'person@synthetic.invalid');
});
test('forged workspace and role claims cannot change verified actor privileges',async()=>{
 const v=await adapter().verifyAuthorization(bearer({workspaceId:'ws_foreign',role:'authenticated',agencyRole:'owner'}));
 assert.deepEqual(Object.keys(v).sort(),['authProvider','email','emailVerified','issuer','sessionId','userId'].sort());
});
test('invalid issuer/audience/sub/session/expired/long token denied before provider HTTP',async()=>{
 let fetched=0;const a=adapter({fetchImpl:async()=>{fetched++;throw Error('must not fetch');}});
 for(const changes of [{iss:'https://bad.invalid/auth/v1'}, {aud:'other'},
   {sub:'forged'}, {session_id:'forged'}, {exp:now-10},
   {iat:now-3000,exp:now+100},{exp:now+5000}]){
  await assert.rejects(a.verifyAuthorization(bearer(changes)),e=>e.status===401);
 }
 assert.equal(fetched,0);
});
test('provider denies bad signatures; revoked and offline sessions denied',async()=>{
 await assert.rejects(adapter({fetchImpl:async()=>({status:401})})
   .verifyAuthorization(bearer()),e=>e.status===401);
 await assert.rejects(adapter({checkSession:async()=>false})
   .verifyAuthorization(bearer()),e=>e.status===401);
 await assert.rejects(adapter({checkSession:async()=>{throw Error('db offline');}})
   .verifyAuthorization(bearer()),e=>e.status===503);
 await assert.rejects(adapter({fetchImpl:async()=>{throw Error('network offline');}})
   .verifyAuthorization(bearer()),e=>e.status===503);
});
test('email mismatch/unconfirmed and legacy HS256 tokens denied',async()=>{
 await assert.rejects(adapter({fetchImpl:async()=>({status:200,json:async()=>({
  id:uid,email:'different@synthetic.invalid',email_confirmed_at:'2026-10-08T12:00:00Z'})})})
 .verifyAuthorization(bearer()),e=>e.status===403);
 await assert.rejects(adapter({fetchImpl:async()=>({status:200,json:async()=>({
  id:uid,email:'person@synthetic.invalid',email_confirmed_at:null})})})
 .verifyAuthorization(bearer()),e=>e.status===403);
 await assert.rejects(adapter().verifyAuthorization(bearer({},'HS256')),e=>e.status===503);
});
test('configuration must be trusted HTTPS Supabase URL with online revocation',()=>{
 assert.throws(()=>adapter({url:'http://synthetic-staging.supabase.co'}),e=>e.status===503);
 assert.throws(()=>createSupabaseStagingIdentity({projectUrl:origin,
  publishableKey:'sb_publishable_only_synthetic_testing'}),e=>e.status===503);
});
