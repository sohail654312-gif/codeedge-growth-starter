import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {generateKeyPairSync,sign as rsaSign} from 'node:crypto';
import pg from 'pg';
const {Pool}=pg;
import {createPostgresStore} from '../../backend/postgres-store.mjs';
import {createTransactionalWorkspaceService,createTransactionalWorkflowService} from '../../backend/transactional.mjs';
import {createVerifiedIdentityAdapter} from '../../backend/verified-identity.mjs';
import {createMediaGate} from '../../backend/media-gate.mjs';
import {ownerWorkspaceId,DomainError} from '../../backend/core.mjs';

if(!process.env.TEST_DATABASE_URL)throw Error('Disposable TEST_DATABASE_URL required. Never run on a production URL.');
const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL, max:12,connectionTimeoutMillis:5000});
const ownerA={userId:'clinic_owner_A_111',email:'owner-a@synthetic.invalid',emailVerified:true};
const ownerB={userId:'clinic_owner_B_222',email:'owner-b@synthetic.invalid',emailVerified:true};
const client={userId:'clinic_client_333',email:'client@synthetic.invalid',emailVerified:true};
const fake={userId:'another_client_444',email:'other@synthetic.invalid',emailVerified:true};
const wsA=ownerWorkspaceId(ownerA.userId),wsB=ownerWorkspaceId(ownerB.userId);
const pepper='only-for-github-disposable-db-security-harness-0123456789';
let store,member,workflow,media;
before(async()=>{
  const ddl=readFileSync('db/migrations/0001_growth_starter.sql','utf8');
  await pool.query(ddl);
  await pool.query(`INSERT INTO growth_starter.workspaces(id,owner_user_id)
    VALUES ($1,$2),($3,$4)`,[wsA,ownerA.userId,wsB,ownerB.userId]);
  store=createPostgresStore({pool});
  member=createTransactionalWorkspaceService({store,pepper});
  workflow=createTransactionalWorkflowService({store});
  media=createMediaGate({store,authorizer:member});
});
after(async()=>{
  // This is an ephemeral, GitHub-hosted disposable service only.
  await pool.end();
});
test('PostgreSQL real unique constraints and database transaction contract',async()=>{
  assert.equal((await store.readWorkspace(wsA)).ownerUserId,ownerA.userId);
  await assert.rejects(pool.query(`INSERT INTO growth_starter.workspaces(id,owner_user_id)
    VALUES($1,$2)`,[wsA,ownerA.userId]),err=>err.code==='23505');
  await assert.rejects(pool.query(`INSERT INTO growth_starter.memberships
  (workspace_id,user_id,owner_user_id,role,created_by)
  VALUES($1,$2,$3,$4,$5)`,[wsA,ownerA.userId,ownerA.userId,'owner',ownerA.userId]));
});
test('two database workspaces have independently persisted request records',async()=>{
  await pool.query(`INSERT INTO growth_starter.work_requests(workspace_id,id,title,kind)
    VALUES ($1,'syntheticReqA','Clinic A sample','Local SEO'),($2,'syntheticReqB','Clinic B sample','Website update')`,[wsA,wsB]);
  const result=await pool.query(`SELECT workspace_id,id,title FROM growth_starter.work_requests
    WHERE workspace_id=$1 ORDER BY id`,[wsA]);
  assert.deepEqual(result.rows.map(r=>r.id),['syntheticReqA']);
});
test('verified email must match token and concurrent claim accepts exactly once on real PostgreSQL',async()=>{
  const invite=await member.issue({actor:ownerA,workspaceId:wsA,email:client.email,role:'client'});
  await assert.rejects(member.accept({actor:fake,token:invite.token}),err=>err.status===403);
  const settled=await Promise.allSettled([
    member.accept({actor:client,token:invite.token}),member.accept({actor:client,token:invite.token})
  ]);
  assert.equal(settled.filter(r=>r.status==='fulfilled').length,1,JSON.stringify(settled));
  assert.equal(settled.filter(r=>r.status==='rejected').length,1);
  assert.equal((await store.readMembership(wsA,client.userId)).role,'client');
  const inviteRow=await pool.query('SELECT state,accepted_by FROM growth_starter.invitations WHERE id=$1',[invite.token.split('.')[0]]);
  assert.equal(inviteRow.rows[0].state,'consumed');
  assert.equal(inviteRow.rows[0].accepted_by,client.userId);
  const audit=await pool.query(`SELECT action FROM growth_starter.audit_events WHERE workspace_id=$1 ORDER BY id`,[wsA]);
  assert.ok(audit.rows.some(x=>x.action==='invitation.accepted'));
  await assert.rejects(member.accept({actor:client,token:invite.token}),err=>err.status===403);
});
test('membership cannot self elevate, duplicates fail, and revoke denies access',async()=>{
  assert.equal((await member.authorize({userId:client.userId,workspaceId:wsA})).role,'client');
  await assert.rejects(member.issue({actor:client,workspaceId:wsA,email:fake.email,role:'agency_admin'}),err=>err.status===403);
  await assert.rejects(pool.query(`UPDATE growth_starter.memberships SET role='owner'
    WHERE workspace_id=$1 AND user_id=$2`,[wsA,client.userId]),err=>err.code==='23514');
  await assert.rejects(pool.query(`INSERT INTO growth_starter.memberships(workspace_id,user_id,owner_user_id,role,created_by)
    VALUES ($1,$2,$3,$4,$5)`,[wsA,client.userId,ownerA.userId,'client',ownerA.userId]),err=>err.code==='23505');
  await member.revoke({actor:ownerA,workspaceId:wsA,userId:client.userId});
  await assert.rejects(member.authorize({userId:client.userId,workspaceId:wsA}),err=>err.status===403);
  assert.equal((await store.readMembership(wsA,client.userId)).state,'revoked');
});
test('real serializable DB serializes conflicting versioned request approvals',async()=>{
  const initial={workspaceId:wsA,role:'owner'};
  const r=await Promise.allSettled([
    workflow.review({workspace:initial,actor:ownerA.userId,id:'syntheticReqA',requested:'In progress',expectedVersion:0}),
    workflow.review({workspace:initial,actor:ownerA.userId,id:'syntheticReqA',requested:'In progress',expectedVersion:0})
  ]);
  assert.equal(r.filter(x=>x.status==='fulfilled').length,1,JSON.stringify(r));
  assert.equal(r.filter(x=>x.status==='rejected').length,1);
  const updated=await workflow.review({workspace:initial,actor:ownerA.userId,id:'syntheticReqA',requested:'Awaiting approval',expectedVersion:1});
  assert.equal(updated.version,2);
  await assert.rejects(workflow.decision({workspace:{workspaceId:wsA,role:'staff'},actor:client.userId,
    id:'syntheticReqA',decision:'Approved',expectedVersion:2}),err=>err.status===403);
  const decision=await workflow.decision({workspace:{workspaceId:wsA,role:'client'},actor:client.userId,
    id:'syntheticReqA',decision:'Changes requested',expectedVersion:2});
  assert.equal(decision.version,3);
  await assert.rejects(workflow.decision({workspace:{workspaceId:wsA,role:'client'},actor:client.userId,
    id:'syntheticReqA',decision:'Approved',expectedVersion:2}),err=>err.status===409);
  const db=await pool.query(`SELECT status,version FROM growth_starter.work_requests WHERE workspace_id=$1 AND id='syntheticReqA'`,[wsA]);
  assert.deepEqual([db.rows[0].status,db.rows[0].version],['Changes requested',3]);
});
test('rejected changes roll back request and durable audit in a real SQL transaction',async()=>{
  const beforeAudit=Number((await pool.query(`SELECT count(*) AS n FROM growth_starter.audit_events WHERE action='request.review'`)).rows[0].n);
  await assert.rejects(workflow.review({workspace:{workspaceId:wsB,role:'owner'},actor:ownerB.userId,
    id:'syntheticReqB',requested:'Published',expectedVersion:0}),e=>e.status===409);
  const afterAudit=Number((await pool.query(`SELECT count(*) AS n FROM growth_starter.audit_events WHERE action='request.review'`)).rows[0].n);
  assert.equal(afterAudit,beforeAudit);
  assert.equal((await pool.query(`SELECT version FROM growth_starter.work_requests WHERE workspace_id=$1`,[wsB])).rows[0].version,0);
});
test('foreign and unapproved media fail in real DB; deletion has durable tombstone/outbox',async()=>{
  const storage='growth-starter/'+wsA+'/syntheticImage1.png';
  await pool.query(`INSERT INTO growth_starter.media
   (workspace_id,id,storage_key,filename,content_type,size_bytes,declared_rights,consent_state,scan_state)
   VALUES($1,'syntheticImage1',$2,'syntheticImage1.png','image/png',1000,true,'approved','clean'),
         ($1,'notapproved',$3,'unapproved.png','image/png',1000,true,'pending','clean')`,
    [wsA,storage,'growth-starter/'+wsA+'/notapproved.png']);
  await assert.rejects(media.lookup({actorUserId:ownerB.userId,workspaceId:wsA,id:'syntheticImage1'}),e=>e.status===403);
  await assert.rejects(media.lookup({actorUserId:ownerA.userId,workspaceId:wsA,id:'notapproved'}),e=>e.status===404);
  assert.equal((await media.lookup({actorUserId:ownerA.userId,workspaceId:wsA,id:'syntheticImage1'})).key,storage);
  const queued=await store.queueMediaDeletion({workspaceId:wsA,id:'syntheticImage1',actorUserId:ownerA.userId});
  assert.equal(queued.queued,true);
  assert.equal((await pool.query(`SELECT count(*)::int AS n FROM growth_starter.media_delete_outbox WHERE workspace_id=$1 AND media_id='syntheticImage1'`,[wsA])).rows[0].n,1);
  await assert.rejects(media.lookup({actorUserId:ownerA.userId,workspaceId:wsA,id:'syntheticImage1'}),e=>e.status===404);
  await assert.rejects(store.queueMediaDeletion({workspaceId:wsA,id:'syntheticImage1',actorUserId:ownerA.userId}),e=>e.status===409);
});
const ownerKey=generateKeyPairSync('rsa',{modulusLength:2048});
const verifier=createVerifiedIdentityAdapter({publicKeyPem:ownerKey.publicKey.export({type:'spki',format:'pem'}),issuer:'https://synthetic-qa.invalid',audience:'growth-starter-qa'});
function tokenFor(actor,opts={}) {
  const now=Math.floor(Date.now()/1000);
  const b64=obj=>Buffer.from(JSON.stringify(obj)).toString('base64url');
  const head=b64({alg:'RS256',typ:'JWT'});
  const claims=b64({iss:'https://synthetic-qa.invalid',aud:'growth-starter-qa',
    sub:actor.userId,email:actor.email,email_verified:true,iat:now,exp:now+300,...opts});
  const body=head+'.'+claims;
  return body+'.'+rsaSign('RSA-SHA256',Buffer.from(body),ownerKey.privateKey).toString('base64url');
}
test('two distinct cryptographically authenticated HTTP sessions isolate database workspaces',async()=>{
  const server=createServer(async(req,res)=>{
    const respond=(status,data)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));};
    try{
      const actor=verifier.verifyAuthorization(req.headers.authorization);
      const url=new URL(req.url,'http://localhost');
      if(url.pathname!=='/qa/requests')return respond(404,{error:'not found'});
      const workspaceId=url.searchParams.get('workspaceId');
      if(!workspaceId)return respond(400,{error:'workspace required'});
      if(workspaceId!==ownerWorkspaceId(actor.userId))await member.authorize({userId:actor.userId,workspaceId});
      const rows=await pool.query('SELECT id,workspace_id,title FROM growth_starter.work_requests WHERE workspace_id=$1',[workspaceId]);
      return respond(200,{records:rows.rows,subject:actor.userId});
    }catch(e){respond(e instanceof DomainError?e.status:500,{error:e.message});}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const origin='http://127.0.0.1:'+server.address().port;
    async function query(token,ws){
      const response=await fetch(origin+'/qa/requests?workspaceId='+encodeURIComponent(ws),{headers:token?{authorization:'Bearer '+token}:{}});
      return {status:response.status,body:await response.json()};
    }
    const sessionA=tokenFor(ownerA),sessionB=tokenFor(ownerB);
    const a=await query(sessionA,wsA),b=await query(sessionB,wsB),ab=await query(sessionA,wsB),ba=await query(sessionB,wsA);
    assert.deepEqual([a.status,b.status,ab.status,ba.status],[200,200,403,403]);
    assert.deepEqual(a.body.records.map(r=>r.id),['syntheticReqA']);
    assert.deepEqual(b.body.records.map(r=>r.id),['syntheticReqB']);
    const noAuth=await query('',wsA);
    assert.equal(noAuth.status,401);
    const forged=await query(tokenFor(ownerA,{sub:ownerB.userId,email_verified:false}),wsA);
    assert.equal(forged.status,403);
    const expired=await query(tokenFor(ownerA,{exp:Math.floor(Date.now()/1000)-10}),wsA);
    assert.equal(expired.status,401);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
