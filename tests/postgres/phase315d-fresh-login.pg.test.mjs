import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import pg from 'pg';
import {createDisposableCodeedgeSessionProof}
 from '../../backend/codeedge-session-proof.mjs';
import {createDisposableFreshLoginBridge,createHostedFreshLoginBridge}
 from '../../backend/phase315d-fresh-login.mjs';
if(!process.env.TEST_DATABASE_URL)throw Error('Disposable PostgreSQL only.');
const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,max:4});
const A='a315d2e9-f1f0-4cd9-8bfa-0983be1434ab';
const B='b315d2e9-f1f0-4cd9-8bfa-0983be1434ab';
const WA='ws_'+A,WB='ws_'+B,ORIGIN='https://fixture-ref.supabase.co';
const codes=new Map();
const jwt=(user,sid,iat=Math.floor(Date.now()/1000))=>{
 const header=Buffer.from(JSON.stringify({alg:'RS256',typ:'JWT'})).toString('base64url');
 const body=Buffer.from(JSON.stringify({iss:ORIGIN+'/auth/v1',aud:'authenticated',
  role:'authenticated',sub:user,session_id:sid,iat,exp:iat+3600})).toString('base64url');
 return header+'.'+body+'.'+Buffer.from('fictional-signature').toString('base64url');
};
const exchangeAuthCode=async({code,codeVerifier,redirectTo})=>{
 const r=codes.get(code);
 if(!r||r.redirectTo!==redirectTo)throw Error('Invalid exchange');
 const challenge=createHash('sha256').update(codeVerifier).digest('base64url');
 if(challenge!==r.challenge)throw Error('PKCE denied');
 codes.delete(code);return {accessToken:r.jwt};
};
const verifyUser=async({accessToken})=>{
 // MOCK ONLY. A real provider must verify the signature on the ORIGINAL
 // exchanged access token over HTTPS. Never promote this test mock to hosted.
 if(!accepted.has(accessToken))throw Error('Provider rejected bearer');
 return {id:accepted.get(accessToken),email:'fictional@invalid.example',email_confirmed_at:new Date().toISOString(),
  is_anonymous:false};
};
const accepted=new Map();
const codeFor=(flow,user,sid,stale=false)=>{
 const code=randomBytes(32).toString('base64url'),token=jwt(user,sid,
  Math.floor(Date.now()/1000)-(stale?600:0));
 codes.set(code,{challenge:flow.codeChallenge,redirectTo:flow.redirectTo,jwt:token});
 accepted.set(token,user);return code;
};
test('phase315D: disposable PKCE callback, replay/CSRF, workspace and Codeedge logout',async()=>{
 assert.throws(()=>createHostedFreshLoginBridge(),/unavailable/);
 assert.throws(()=>createDisposableFreshLoginBridge({pool}),/Disposable-only/);
 await pool.query(readFileSync('db/migrations/0001_growth_starter.sql','utf8'));
 await pool.query(readFileSync('tests/postgres/fixtures/phase315c-private-sessions.sql','utf8'));
 await pool.query(readFileSync('tests/postgres/fixtures/phase315d-fresh-login.sql','utf8'));
 const bridge=createDisposableFreshLoginBridge({pool,projectUrl:ORIGIN,
  allowedOrigin:'https://codeedge.example.invalid',exchangeAuthCode,verifyUser,
  fictionalTestOnly:true});
 const auth=createDisposableCodeedgeSessionProof({pool,verifyFreshLogin:bridge.consumeFreshProof,
  fictionalTestOnly:true});
 try{
  await pool.query('INSERT INTO growth_starter.workspaces(id,owner_user_id) VALUES($1,$2),($3,$4)',[WA,A,WB,B]);
  await pool.query("INSERT INTO growth_starter.work_requests(workspace_id,id,title,kind) VALUES($1,'gs315d_a','A fictional','Other'),($2,'gs315d_b','B fictional','Local SEO')",[WA,WB]);
  const a=await bridge.begin(),b=await bridge.begin();
  assert.equal(a.codeChallengeMethod,'S256');
  assert.notEqual(a.state,a.browserBinding);
  assert.notEqual(a.state,b.state);
  const codeA=codeFor(a,A,'d315d2e9-f1f0-4cd9-8bfa-0983be1434ab');
  const codeB=codeFor(b,B,'e315d2e9-f1f0-4cd9-8bfa-0983be1434ab');
  await assert.rejects(bridge.completeAndIssue({state:a.state,browserBinding:b.browserBinding,
   authCode:codeA},auth.issue),/denied/);
  await assert.rejects(bridge.completeAndIssue({state:'broken',browserBinding:a.browserBinding,
   authCode:codeA},auth.issue),/denied/);
  const sessionA=await bridge.completeAndIssue({state:a.state,browserBinding:a.browserBinding,
   authCode:codeA},auth.issue);
  const sessionB=await bridge.completeAndIssue({state:b.state,browserBinding:b.browserBinding,
   authCode:codeB},auth.issue);
  assert.ok(sessionA.token.startsWith('ce1.'));
  assert.ok(!JSON.stringify(sessionA).includes(codeA));
  const ownA=await auth.withAuthorizedRead({token:sessionA.token,workspaceId:WA},
   reader=>reader.listRequests());
  assert.deepEqual(ownA.map(x=>x.id),['gs315d_a']);
  await assert.rejects(auth.withAuthorizedRead({token:sessionA.token,workspaceId:WB},
   reader=>reader.listRequests()),/denied/);
  const ownB=await auth.withAuthorizedRead({token:sessionB.token,workspaceId:WB},
   reader=>reader.listRequests());
  assert.deepEqual(ownB.map(x=>x.id),['gs315d_b']);
  await assert.rejects(bridge.completeAndIssue({state:a.state,browserBinding:a.browserBinding,
   authCode:codeA},auth.issue),/denied/);
  assert.deepEqual(await auth.revoke({token:sessionA.token}),{revoked:true});
  await assert.rejects(auth.withAuthorizedRead({token:sessionA.token,workspaceId:WA},
   reader=>reader.listRequests()),/denied/);
  // Even a still-valid *old* provider JWT cannot be accepted as a fresh code.
  const staleBearer=accepted.keys().next().value;
  await assert.rejects(bridge.completeAndIssue({state:a.state,browserBinding:a.browserBinding,
   authCode:staleBearer},auth.issue),/denied/);
  const c=await bridge.begin(),badCode=codeFor(c,A,'f315d2e9-f1f0-4cd9-8bfa-0983be1434ab',true);
  await assert.rejects(bridge.completeAndIssue({state:c.state,browserBinding:c.browserBinding,
   authCode:badCode},auth.issue),/denied/);
  await assert.rejects(bridge.completeAndIssue({state:c.state,browserBinding:c.browserBinding,
   authCode:badCode},auth.issue),/denied/);
  // One-time state is stored hashed, not browser-binding secret.
  const saved=(await pool.query('SELECT state_hash,binding_hash,consumed_at FROM growth_starter_private.fresh_login_flows')).rows;
  assert.ok(saved.every(x=>/^[0-9a-f]{64}$/.test(x.state_hash) &&
   /^[0-9a-f]{64}$/.test(x.binding_hash)));
  assert.ok(saved.every(x=>x.consumed_at!==null));
 }finally{
  await pool.query('DELETE FROM growth_starter.work_requests WHERE workspace_id=ANY($1)',[[WA,WB]]);
  await pool.query('DELETE FROM growth_starter.workspaces WHERE id=ANY($1)',[[WA,WB]]);
  await pool.query('DROP SCHEMA IF EXISTS growth_starter_private CASCADE');
  await pool.end();
 }
});
