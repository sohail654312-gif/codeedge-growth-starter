/**
 * Phase 3.15C: real PostgreSQL17 fallback proof using fictional accounts.
 * No actual Supabase credentials, login calls, provider revocation or hosting.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import pg from 'pg';
import {createDisposableCodeedgeSessionProof,createHostedCodeedgeSessionAuthority}
 from '../../backend/codeedge-session-proof.mjs';
if(!process.env.TEST_DATABASE_URL)throw Error('Disposable PostgreSQL required.');
const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,max:4});
const A='a315c2e9-f1f0-4cd9-8bfa-0983be1434ab';
const B='b315c2e9-f1f0-4cd9-8bfa-0983be1434ab';
const C='c315c2e9-f1f0-4cd9-8bfa-0983be1434ab';
const SA='d315c2e9-f1f0-4cd9-8bfa-0983be1434ab';
const SB='e315c2e9-f1f0-4cd9-8bfa-0983be1434ab';
const SC='f315c2e9-f1f0-4cd9-8bfa-0983be1434ab';
const WA='ws_'+A,WB='ws_'+B;
const grants=new Map();
function grant(userId,providerSessionId,id,evidence){
 grants.set(evidence,{freshAuthentication:true,userId,providerSessionId,
  oneTimeGrantId:id,authenticatedAt:Date.now()});
 return evidence;
}
const engine=createDisposableCodeedgeSessionProof({
 pool,fictionalTestOnly:true,verifyFreshLogin:async proof=>grants.get(proof)||null
});
const read=(token,workspaceId,fn=async r=>r.listRequests())=>
 engine.withAuthorizedRead({token,workspaceId},fn);
const DENIED=/Codeedge session denied/;
const OFFLINE=/session store unavailable/;
test('disposable PG17: sessions, cross-tenant, one-time login, revocation race',async()=>{
 assert.throws(()=>createHostedCodeedgeSessionAuthority(),/unavailable/);
 assert.throws(()=>createDisposableCodeedgeSessionProof({
   pool,verifyFreshLogin:async()=>({})}),/Disposable-only/);
 const version=Number((await pool.query('SHOW server_version_num')).rows[0].server_version_num);
 assert.ok(version>=170000&&version<180000);
 await pool.query(readFileSync('db/migrations/0001_growth_starter.sql','utf8'));
 await pool.query(readFileSync('tests/postgres/fixtures/phase315c-private-sessions.sql','utf8'));
 try{
  await pool.query('INSERT INTO growth_starter.workspaces(id,owner_user_id) VALUES($1,$2),($3,$4)',[WA,A,WB,B]);
  await pool.query("INSERT INTO growth_starter.work_requests(workspace_id,id,title,kind) VALUES($1,'gs315c_a','Fictional A','Other'),($2,'gs315c_b','Fictional B','Local SEO')",[WA,WB]);
  await pool.query("INSERT INTO growth_starter.memberships(workspace_id,user_id,owner_user_id,role,created_by) VALUES($1,$2,$3,'client',$3)",[WA,C,A]);
  const pa=grant(A,SA,'gs315c_grant_A_00000000000001','gs315c_evidence_A_000000000000000001');
  const pb=grant(B,SB,'gs315c_grant_B_00000000000002','gs315c_evidence_B_000000000000000002');
  const pc=grant(C,SC,'gs315c_grant_C_00000000000003','gs315c_evidence_C_000000000000000003');
  await assert.rejects(engine.issue({freshLoginProof:'unverified_bearer_from_browser'}),DENIED);
  const ta=(await engine.issue({freshLoginProof:pa})).token;
  const tb=(await engine.issue({freshLoginProof:pb})).token;
  const tc=(await engine.issue({freshLoginProof:pc})).token;
  await assert.rejects(engine.issue({freshLoginProof:pa}),OFFLINE);
  const values=(await pool.query('SELECT secret_sha256 FROM growth_starter_private.codeedge_sessions')).rows;
  assert.equal(values.length,3);
  assert.ok(values.every(v=>/^[0-9a-f]{64}$/.test(v.secret_sha256)));
  assert.ok(!JSON.stringify(values).includes(ta));
  assert.deepEqual((await read(ta,WA)).map(x=>x.id),['gs315c_a']);
  assert.deepEqual((await read(tb,WB)).map(x=>x.id),['gs315c_b']);
  assert.deepEqual((await read(tc,WA)).map(x=>x.id),['gs315c_a']);
  await assert.rejects(read(ta,WB),DENIED);
  await assert.rejects(read(tb,WA),DENIED);
  await assert.rejects(read(tc,WB),DENIED);
  await assert.rejects(read('ce1.'+ta.split('.')[1]+'.'+'z'.repeat(43),WA),DENIED);
  await assert.rejects(read('not-a-session',WA),DENIED);
  await assert.rejects(read(ta,WA,reader=>reader.listRequests(51)),DENIED);
  await pool.query("UPDATE growth_starter.memberships SET state='revoked',revoked_at=now() WHERE workspace_id=$1 AND user_id=$2",[WA,C]);
  await assert.rejects(read(tc,WA),DENIED);
  await pool.query("UPDATE growth_starter.memberships SET state='active',revoked_at=NULL WHERE workspace_id=$1 AND user_id=$2",[WA,C]);
  await pool.query("UPDATE growth_starter.workspaces SET state='suspended' WHERE id=$1",[WA]);
  await assert.rejects(read(ta,WA),DENIED);
  await pool.query("UPDATE growth_starter.workspaces SET state='active' WHERE id=$1",[WA]);
  // Hold protected SELECT lock; revoke must wait until read completes.
  let entered,release;
  const ready=new Promise(resolve=>{entered=resolve;});
  const hold=new Promise(resolve=>{release=resolve;});
  const inflight=read(ta,WA,async reader=>{entered();await hold;return reader.listRequests();});
  await ready;
  let completed=false;
  const pending=engine.revoke({token:ta}).then(r=>{completed=true;return r;});
  try{
   await new Promise(resolve=>setTimeout(resolve,120));
   assert.equal(completed,false);
  }finally{release();}
  assert.deepEqual((await inflight).map(x=>x.id),['gs315c_a']);
  assert.deepEqual(await pending,{revoked:true});
  await assert.rejects(read(ta,WA),DENIED);
  await assert.rejects(engine.issue({freshLoginProof:pa}),OFFLINE);
  await pool.query("UPDATE growth_starter_private.codeedge_sessions SET expires_at=clock_timestamp()-INTERVAL '1 minute' WHERE user_id=$1",[B]);
  await assert.rejects(read(tb,WB),DENIED);
  await assert.rejects(engine.issue({freshLoginProof:SB}),DENIED);
  await assert.rejects(engine.revoke({token:'ce1.'+tb.split('.')[1]+'.'+'A'.repeat(43)}),DENIED);
  assert.deepEqual(await engine.revoke({token:tb}),{revoked:true});
 }finally{
  await pool.query('DELETE FROM growth_starter.memberships WHERE workspace_id=$1',[WA]);
  await pool.query('DELETE FROM growth_starter.work_requests WHERE workspace_id=ANY($1)',[[WA,WB]]);
  await pool.query('DELETE FROM growth_starter.workspaces WHERE id=ANY($1)',[[WA,WB]]);
  await pool.query('DROP SCHEMA IF EXISTS growth_starter_private CASCADE');
  await pool.end();
 }
});
