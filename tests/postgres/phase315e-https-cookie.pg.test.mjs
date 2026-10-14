/**
 * Phase 3.15E: real synthetic HTTPS + disposable PG17 integration.
 * No real Supabase project, users, token, credential, or deployed listener.
 * Self-signed TLS key is created only in the runner's temporary directory.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import pg from 'pg';
import {createDisposableHttpsCookieGateway,createHostedHttpsCookieGateway}
 from '../../backend/phase315e-https-cookies.mjs';
import {createDisposableFreshLoginBridge}
 from '../../backend/phase315d-fresh-login.mjs';
import {createDisposableCodeedgeSessionProof}
 from '../../backend/codeedge-session-proof.mjs';
if(!process.env.TEST_DATABASE_URL)throw Error('Disposable PG17 only, never hosted Supabase.');
const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,max:4});
const A='a315e2e9-f1f0-4cd9-8bfa-0983be1434ab';
const B='b315e2e9-f1f0-4cd9-8bfa-0983be1434ab';
const WA='ws_'+A,WB='ws_'+B;
const PROVIDER='https://fixture-ref.supabase.co';
function jwt(user,sid){
 const time=Math.floor(Date.now()/1000);
 return Buffer.from(JSON.stringify({alg:'RS256',typ:'JWT'})).toString('base64url')+'.'+
  Buffer.from(JSON.stringify({iss:PROVIDER+'/auth/v1',aud:'authenticated',
   role:'authenticated',sub:user,session_id:sid,iat:time,exp:time+3600})).toString('base64url')+'.'+
  Buffer.from('fictional-signature').toString('base64url');
}
function cookiesFrom(reply,old=new Map()){
 const result=new Map(old);
 for(const item of reply.headers['set-cookie']||[]){
  const [pair,...attrs]=item.split(';'),index=pair.indexOf('=');
  const name=pair.slice(0,index),value=pair.slice(index+1);
  if(attrs.some(x=>x.trim().toLowerCase()==='max-age=0'))result.delete(name);
  else result.set(name,value);
 }
 return result;
}
const headerFor=jar=>Array.from(jar).map(([k,v])=>k+'='+v).join('; ');
function assertCookie(reply,name,options){
 const found=(reply.headers['set-cookie']||[]).find(x=>x.startsWith(name+'='));
 assert.ok(found,'Expected '+name+' cookie');
 for(const flag of options)assert.ok(found.includes(flag),name+' missing '+flag);
}
async function close(server){
 if(!server?.listening)return;
 await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
}
test('HTTPS cookie boundary: PKCE replay, host/CSRF/tenant denials, logout durability',async()=>{
 assert.throws(()=>createHostedHttpsCookieGateway(),/unavailable/);
 assert.throws(()=>createDisposableHttpsCookieGateway({}),/unavailable/);
 await pool.query(readFileSync('db/migrations/0001_growth_starter.sql','utf8'));
 await pool.query(readFileSync('tests/postgres/fixtures/phase315c-private-sessions.sql','utf8'));
 await pool.query(readFileSync('tests/postgres/fixtures/phase315d-fresh-login.sql','utf8'));
 const directory=mkdtempSync(join(tmpdir(),'growth-starter-315e-'));
 let tls,plain;
 try{
  execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes',
   '-keyout',join(directory,'key.pem'),'-out',join(directory,'cert.pem'),
   '-days','1','-subj','/CN=localhost'],{stdio:'ignore'});
  const key=readFileSync(join(directory,'key.pem'));
  const cert=readFileSync(join(directory,'cert.pem'));
  const codes=new Map(),accepted=new Map();
  const exchangeAuthCode=async({code,codeVerifier,redirectTo})=>{
   const item=codes.get(code);
   if(!item||item.redirectTo!==redirectTo||
      item.challenge!==createHash('sha256').update(codeVerifier).digest('base64url'))
    throw Error('Synthetic PKCE denied');
   codes.delete(code);
   return {accessToken:item.token};
  };
  const verifyUser=async({accessToken})=>{
   if(!accepted.has(accessToken))throw Error('Synthetic provider rejected token');
   return {id:accepted.get(accessToken),email_confirmed_at:new Date().toISOString(),
    is_anonymous:false};
  };
  let handler;
  tls=https.createServer({key,cert},(req,res)=>handler(req,res));
  await new Promise(resolve=>tls.listen(0,'127.0.0.1',resolve));
  const port=tls.address().port,origin='https://localhost:'+port;
  const bridge=createDisposableFreshLoginBridge({
   pool,projectUrl:PROVIDER,allowedOrigin:origin,
   exchangeAuthCode,verifyUser,fictionalTestOnly:true
  });
  const authority=createDisposableCodeedgeSessionProof({
   pool,verifyFreshLogin:bridge.consumeFreshProof,fictionalTestOnly:true
  });
  const csrfSigningKey=randomBytes(32);
  handler=createDisposableHttpsCookieGateway({
   bridge,authority,appOrigin:origin,csrfSigningKey,fictionalTestOnly:true
  }).handler;
  const request=(method,path,{jar=new Map(),headers={}}={})=>new Promise((resolve,reject)=>{
   const req=https.request({hostname:'127.0.0.1',port,method,path,
    rejectUnauthorized:false,headers:{
      host:'localhost:'+port,'sec-fetch-site':'same-origin',
      ...(jar.size?{cookie:headerFor(jar)}:{}),...headers
    }},res=>{
    const chunks=[];
    res.on('data',x=>chunks.push(x));
    res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,
     body:Buffer.concat(chunks).toString('utf8')}));
   });
   req.on('error',reject);req.end();
  });
  function makeCode(flow,user,sid){
   const code=randomBytes(32).toString('base64url');
   const token=jwt(user,sid);
   codes.set(code,{redirectTo:flow.redirectTo,
     challenge:flow.codeChallenge,token});
   accepted.set(token,user);
   return code;
  }
  await pool.query('INSERT INTO growth_starter.workspaces(id,owner_user_id) VALUES($1,$2),($3,$4)',[WA,A,WB,B]);
  await pool.query("INSERT INTO growth_starter.work_requests(workspace_id,id,title,kind) VALUES($1,'gs315e_a','A fictional request','Other'),($2,'gs315e_b','B fictional request','Local SEO')",[WA,WB]);
  const startA=await request('GET','/auth/start');
  assert.equal(startA.status,200);
  assertCookie(startA,'__Host-ce_flow',['Secure','HttpOnly','SameSite=Lax','Path=/']);
  const flowA=JSON.parse(startA.body),aStartJar=cookiesFrom(startA);
  const startB=await request('GET','/auth/start');
  const flowB=JSON.parse(startB.body),bStartJar=cookiesFrom(startB);
  const codeA=makeCode(flowA,A,'d315e2e9-f1f0-4cd9-8bfa-0983be1434ab');
  const codeB=makeCode(flowB,B,'e315e2e9-f1f0-4cd9-8bfa-0983be1434ab');
  const callbackA='/auth/callback?state='+flowA.state+'&code='+codeA;
  const callbackB='/auth/callback?state='+flowB.state+'&code='+codeB;
  const wrongOrigin=await request('GET',callbackA,{
   jar:aStartJar,headers:{origin:'https://attacker.example'}});
  assert.equal(wrongOrigin.status,403);
  const wrongBinding=await request('GET',callbackA,{jar:bStartJar});
  assert.equal(wrongBinding.status,303);
  assert.equal(wrongBinding.headers.location,'/login?auth=failed');
  const loggedA=await request('GET',callbackA,{jar:aStartJar});
  assert.equal(loggedA.status,303);
  assert.equal(loggedA.headers.location,'/dashboard');
  assert.equal(loggedA.headers['cache-control'],'private, no-store, max-age=0');
  assert.equal(loggedA.headers['referrer-policy'],'no-referrer');
  assertCookie(loggedA,'__Host-ce_session',['Secure','HttpOnly','SameSite=Lax','Path=/']);
  assertCookie(loggedA,'__Host-ce_csrf',['Secure','SameSite=Lax','Path=/']);
  const csrfLine=loggedA.headers['set-cookie'].find(x=>x.startsWith('__Host-ce_csrf='));
  assert.ok(!csrfLine.includes('HttpOnly'),'Readable CSRF cookie only');
  const jarA=cookiesFrom(loggedA,aStartJar);
  assert.ok(jarA.has('__Host-ce_session')&&jarA.has('__Host-ce_csrf'));
  assert.ok(!jarA.has('__Host-ce_flow'));
  const loggedB=await request('GET',callbackB,{jar:bStartJar});
  assert.equal(loggedB.status,303);
  const jarB=cookiesFrom(loggedB,bStartJar);
  const ownA=await request('GET','/v1/requests?workspaceId='+WA,{jar:jarA});
  assert.equal(ownA.status,200);
  assert.deepEqual(JSON.parse(ownA.body).items.map(x=>x.id),['gs315e_a']);
  const otherA=await request('GET','/v1/requests?workspaceId='+WB,{jar:jarA});
  assert.equal(otherA.status,403);
  const ownB=await request('GET','/v1/requests?workspaceId='+WB,{jar:jarB});
  assert.equal(ownB.status,200);
  assert.deepEqual(JSON.parse(ownB.body).items.map(x=>x.id),['gs315e_b']);
  assert.equal((await request('GET','/v1/requests?workspaceId='+WA)).status,401);
  assert.equal((await request('GET','/v1/requests?workspaceId='+WA,{
   jar:jarA,headers:{cookie:headerFor(jarA)+'; __Host-ce_session=forged'}})).status,400);
  assert.equal((await request('GET','/auth/start',{jar:jarA})).status,409);
  assert.equal((await request('GET',callbackA,{jar:aStartJar})).status,303);
  assert.equal((await request('POST','/auth/logout',{jar:jarA,
   headers:{'content-length':'0'}})).status,403);
  assert.equal((await request('POST','/auth/logout',{jar:jarA,
   headers:{origin:'https://attacker.example','x-csrf-token':jarA.get('__Host-ce_csrf'),
    'content-length':'0'}})).status,403);
  assert.equal((await request('POST','/auth/logout',{jar:jarA,
   headers:{origin, 'x-csrf-token':'wrong','content-length':'0'}})).status,403);
  const realLogout=await request('POST','/auth/logout',{jar:jarA,headers:{
   origin,'x-csrf-token':jarA.get('__Host-ce_csrf'),'content-length':'0'}});
  assert.equal(realLogout.status,204);
  assertCookie(realLogout,'__Host-ce_session',['Max-Age=0','HttpOnly']);
  assertCookie(realLogout,'__Host-ce_csrf',['Max-Age=0']);
  assert.equal((await request('GET','/v1/requests?workspaceId='+WA,{jar:jarA})).status,403);
  // A failed DB revoke cannot claim logout or clear a still-live credential.
  const failAuthority={...authority,revoke:async()=>{throw Error('Simulated outage');}};
  handler=createDisposableHttpsCookieGateway({
   bridge,authority:failAuthority,appOrigin:origin,
   csrfSigningKey,fictionalTestOnly:true
  }).handler;
  const failed=await request('POST','/auth/logout',{jar:jarB,headers:{
   origin,'x-csrf-token':jarB.get('__Host-ce_csrf'),'content-length':'0'}});
  assert.equal(failed.status,503);
  assert.equal(failed.headers['set-cookie'],undefined);
  handler=createDisposableHttpsCookieGateway({
   bridge,authority,appOrigin:origin,csrfSigningKey,fictionalTestOnly:true
  }).handler;
  assert.equal((await request('GET','/v1/requests?workspaceId='+WB,{jar:jarB})).status,200);
  assert.equal((await request('POST','/auth/logout',{jar:jarB,headers:{
   origin,'x-csrf-token':jarB.get('__Host-ce_csrf'),'content-length':'0'}})).status,204);
  // Fake TLS forwarding headers do not make an insecure socket trustworthy.
  plain=http.createServer((req,res)=>handler(req,res));
  await new Promise(resolve=>plain.listen(0,'127.0.0.1',resolve));
  const plainPort=plain.address().port;
  const nonTls=await new Promise((resolve,reject)=>{
   http.get({hostname:'127.0.0.1',port:plainPort,path:'/auth/start',
    headers:{host:'localhost:'+port,'x-forwarded-proto':'https'}},
    res=>{res.resume();res.on('end',()=>resolve(res.statusCode));}).on('error',reject);
  });
  assert.equal(nonTls,421);
 }finally{
  await close(plain);await close(tls);
  rmSync(directory,{recursive:true,force:true});
  await pool.query('DELETE FROM growth_starter.work_requests WHERE workspace_id=ANY($1)',[[WA,WB]]);
  await pool.query('DELETE FROM growth_starter.workspaces WHERE id=ANY($1)',[[WA,WB]]);
  await pool.query('DROP SCHEMA IF EXISTS growth_starter_private CASCADE');
  await pool.end();
 }
});
