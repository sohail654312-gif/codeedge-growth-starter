import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupabasePkceHttpAdapter}
 from '../backend/phase315g-supabase-pkce-adapter.mjs';

const url='https://fictional-proj.supabase.co/';
const callback='https://clinic.example.invalid/auth/callback';
const key='sb_publishable_'+ 'Z'.repeat(32);
const code='synthetic-code-12345678901234567890';
const verifier='X'.repeat(43);
const jwt=['eyJhbGciOiJSUzI1NiJ9','eyJzdWIiOiJ0ZXN0In0','fictionalsignature'].join('.');
const user={id:'a315d2e9-f1f0-4cd9-8bfa-0983be1434ab',
 email:'fictional@invalid.example',email_confirmed_at:'2026-10-01T00:00:00Z',
 is_anonymous:false};
const goodToken={status:200,text:async()=>JSON.stringify({
 access_token:jwt,refresh_token:'never-return-this-secret',
 token_type:'bearer',expires_in:3600,provider_token:'not-for-browser'
})};
const goodUser={status:200,text:async()=>JSON.stringify(user)};
const mock=async(target,init)=>{
 if(target.endsWith('/auth/v1/token?grant_type=pkce'))return goodToken;
 if(target.endsWith('/auth/v1/user'))return goodUser;
 throw Error('Unexpected endpoint');
};
const make=(fetchImpl=mock)=>createSupabasePkceHttpAdapter({
 projectUrl:url,callbackUrl:callback,publishableKey:key,fetchImpl
});
test('real documented PKCE endpoint and original bearer user verification are separated',async()=>{
 const calls=[],a=make(async(u,options)=>{calls.push({url:u,options});return mock(u,options);});
 const exchanged=await a.exchangeAuthCode({code,codeVerifier:verifier,redirectTo:callback});
 assert.deepEqual(Object.keys(exchanged),['accessToken']);
 assert.equal(exchanged.accessToken,jwt);
 assert.equal(JSON.stringify(exchanged).includes('never-return-this-secret'),false);
 const verified=await a.verifyUser({accessToken:exchanged.accessToken});
 assert.equal(verified.id,user.id);
 assert.equal(verified.email_confirmed_at,user.email_confirmed_at);
 assert.equal(calls.length,2);
 assert.equal(calls[0].url,'https://fictional-proj.supabase.co/auth/v1/token?grant_type=pkce');
 assert.deepEqual(JSON.parse(calls[0].options.body),{
  auth_code:code,code_verifier:verifier
 });
 assert.equal(calls[0].options.headers.apikey,key);
 assert.equal(calls[0].options.headers.authorization,undefined);
 assert.equal(calls[1].url,'https://fictional-proj.supabase.co/auth/v1/user');
 assert.equal(calls[1].options.headers.authorization,'Bearer '+jwt);
 for(const item of calls){
  assert.equal(item.options.redirect,'error');
  assert.equal(item.options.cache,'no-store');
  assert.equal(item.options.credentials,'omit');
 }
});
test('reject malicious origins, redirect substitution and private keys',async()=>{
 for(const bad of [
  {projectUrl:'http://fictional-proj.supabase.co/'},
  {projectUrl:'https://fictional-proj.supabase.co.attacker.tld/'},
  {projectUrl:'https://fictional-proj.supabase.co/a'},
  {callbackUrl:'http://clinic.example.invalid/auth/callback'},
  {callbackUrl:'https://clinic.example.invalid/auth/callback?next=https://x'},
  {publishableKey:'sk_private_not_permitted'},
  {publishableKey:'eyJ'+ 'A'.repeat(52)},
  {publishableKey:'sb_secret_'+ 'Z'.repeat(30)},
  {fetchImpl:null}
 ])assert.throws(()=>createSupabasePkceHttpAdapter({
  projectUrl:url,callbackUrl:callback,publishableKey:key,fetchImpl:mock,...bad
 }),/required|denied/);
 const a=make();
 for(const input of [
  {code:jwt,codeVerifier:verifier,redirectTo:callback},
  {code,codeVerifier:verifier,redirectTo:'https://attacker.tld/auth/callback'},
  {code,codeVerifier:'short',redirectTo:callback},
  {code,codeVerifier:verifier,redirectTo:undefined}
 ])await assert.rejects(a.exchangeAuthCode(input),/denied/);
 await assert.rejects(a.verifyUser({accessToken:code}),/denied/);
});
test('fail closed on HTTP failure, malicious redirect, oversized or forged response',async()=>{
 for(const resp of [
  {status:401,text:async()=>JSON.stringify({})},
  {status:500,text:async()=>JSON.stringify({})},
  {status:302,text:async()=>''},
  {status:200,text:async()=>'not-json'},
  {status:200,text:async()=>JSON.stringify({access_token:jwt,token_type:'bearer',expires_in:7200})},
  {status:200,text:async()=>JSON.stringify({access_token:jwt,token_type:'Bearer',expires_in:3600})},
  {status:200,text:async()=>JSON.stringify({access_token:jwt,token_type:'bearer',expires_in:3600})+'.'.repeat(40000)}
 ]){
  const a=make(async()=>resp);
  await assert.rejects(a.exchangeAuthCode({code,codeVerifier:verifier,redirectTo:callback}),
   /denied|unavailable/);
 }
 await assert.rejects(make(async()=>{throw Error('Connection failed')})
  .verifyUser({accessToken:jwt}),/unavailable/);
 await assert.rejects(make(async()=>({
  status:200,text:async()=>JSON.stringify({id:'wrong',email:user.email})
 })).verifyUser({accessToken:jwt}),/denied/);
});
test('provider subject is not taken from untrusted caller identity',async()=>{
 const calls=[];
 const a=make(async(u,options)=>{calls.push(u);return mock(u,options);});
 const actual=await a.verifyUser({accessToken:jwt,userId:'forged',owner:'forged'});
 assert.equal(actual.id,user.id);
 assert.equal(Object.hasOwn(actual,'owner'),false);
 assert.equal(calls.length,1);
});
