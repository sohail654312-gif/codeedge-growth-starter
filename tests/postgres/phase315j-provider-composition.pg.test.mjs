/**
 * Phase 3.15J real disposable PostgreSQL17 wiring of the documented Supabase
 * PKCE HTTP request shape to Codeedge-owned session and membership checks.
 * Provider responses are synthetic; no Supabase traffic or real accounts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import pg from 'pg';
import {createHostedPhase315jGateway,createDisposablePhase315jProviderComposition}
 from '../../backend/phase315j-provider-composition.mjs';
if(!process.env.TEST_DATABASE_URL||
 /supabase\.co|supabase\.com/i.test(process.env.TEST_DATABASE_URL))
 throw Error('Disposable PostgreSQL only.');
const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,max:3});
const ORIGIN='https://fictional-proj.supabase.co';
const APP='https://clinic.example.invalid';
const KEY='sb_publishable_'+'X'.repeat(32);
const USER='a315d2e9-f1f0-4cd9-8bfa-0983be1434ab';
const SID='d315d2e9-f1f0-4cd9-8bfa-0983be1434ab';
const OTHER='b315d2e9-f1f0-4cd9-8bfa-0983be1434ab';
const W='ws_'+USER;
function jwt(){
 const iat=Math.floor(Date.now()/1000);
 const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
 return encode({alg:'RS256',typ:'JWT'})+'.'+encode({
  iss:ORIGIN+'/auth/v1',aud:'authenticated',role:'authenticated',
  sub:USER,session_id:SID,iat,exp:iat+3600,is_anonymous:false
 })+'.'+Buffer.from('fictional-signature').toString('base64url');
}
test('source-only PKCE adapter composition issues a revocable Codeedge session, without browser/provider token reuse',async()=>{
 assert.throws(()=>createHostedPhase315jGateway(),/unavailable/);
 assert.throws(()=>createDisposablePhase315jProviderComposition({}),/Disposable-only/);
 await pool.query(readFileSync('db/migrations/0001_growth_starter.sql','utf8'));
 await pool.query(readFileSync('tests/postgres/fixtures/phase315c-private-sessions.sql','utf8'));
 await pool.query(readFileSync('tests/postgres/fixtures/phase315d-fresh-login.sql','utf8'));
 let providerCalls=0,shouldMismatch=false;
 const original=jwt();
 const fetchImpl=async(url,options)=>{
  providerCalls++;
  if(url===ORIGIN+'/auth/v1/token?grant_type=pkce'){
   assert.equal(options.method,'POST');
   const posted=JSON.parse(options.body);
   assert.ok(posted.code_verifier.length>=43);
   assert.equal(posted.auth_code,'fictional_code_315j_abcdefghijklmnop');
   assert.equal(options.headers.apikey,KEY);
   return {status:200,text:async()=>JSON.stringify({
    access_token:original,refresh_token:'must-never-go-to-browser',
    token_type:'bearer',expires_in:3600
   })};
  }
  if(url===ORIGIN+'/auth/v1/user'){
   assert.equal(options.headers.authorization,'Bearer '+original);
   return {status:200,text:async()=>JSON.stringify({
    id:shouldMismatch?OTHER:USER,
    email:'fictional@invalid.example',
    email_confirmed_at:new Date().toISOString(),
    is_anonymous:false
   })};
  }
  throw Error('No other network calls permitted');
 };
 try{
  await pool.query('INSERT INTO growth_starter.workspaces(id,owner_user_id) VALUES($1,$2)',[W,USER]);
  await pool.query("INSERT INTO growth_starter.work_requests(workspace_id,id,title,kind) VALUES($1,'req_315j','Fictional','Other')",[W]);
  const wiring=createDisposablePhase315jProviderComposition({
   pool,projectUrl:ORIGIN+'/',appOrigin:APP,publishableKey:KEY,
   fetchImpl,csrfSigningKey:randomBytes(32),fictionalTestOnly:true
  });
  assert.equal(wiring.mayDeploy,false);
  const flow=await wiring.bridge.begin();
  const credential=await wiring.bridge.completeAndIssue({
   state:flow.state,browserBinding:flow.browserBinding,
   authCode:'fictional_code_315j_abcdefghijklmnop'
  },wiring.authority.issue);
  assert.ok(credential.token.startsWith('ce1.'));
  assert.notEqual(credential.token,original);
  assert.equal(providerCalls,2);
  assert.deepEqual((await wiring.authority.withAuthorizedRead(
   {token:credential.token,workspaceId:W},r=>r.listRequests()
  )).map(x=>x.id),['req_315j']);
  await wiring.authority.revoke({token:credential.token});
  await assert.rejects(wiring.authority.withAuthorizedRead(
   {token:credential.token,workspaceId:W},r=>r.listRequests()),/denied/);
  await assert.rejects(wiring.bridge.completeAndIssue({
   state:flow.state,browserBinding:flow.browserBinding,
   authCode:'fictional_code_315j_abcdefghijklmnop'
  },wiring.authority.issue),/denied/);
  // A separate browser flow with provider-subject mismatch fails closed.
  shouldMismatch=true;
  const forged=await wiring.bridge.begin();
  await assert.rejects(wiring.bridge.completeAndIssue({
   state:forged.state,browserBinding:forged.browserBinding,
   authCode:'fictional_code_315j_abcdefghijklmnop'
  },wiring.authority.issue),/denied/);
  assert.equal(providerCalls,4);
 }finally{
  await pool.query('DELETE FROM growth_starter.work_requests WHERE workspace_id=$1',[W]);
  await pool.query('DELETE FROM growth_starter.workspaces WHERE id=$1',[W]);
  await pool.query('DROP SCHEMA IF EXISTS growth_starter_private CASCADE');
  await pool.end();
 }
});
