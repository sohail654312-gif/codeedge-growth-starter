import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { generateKeyPairSync, sign } from 'node:crypto';
import pg from 'pg';
import { createStagingIdentityVerifier } from '../../backend/staging-identity.mjs';
import { createStagingGateway } from '../../backend/staging-gateway.mjs';

const {Pool}=pg;
if(!process.env.TEST_DATABASE_URL)throw Error('Disposable PostgreSQL TEST_DATABASE_URL required');
const root=new Pool({connectionString:process.env.TEST_DATABASE_URL,max:5});
const actors=[
  {userId:'staging_owner_A123',email:'a@synthetic.invalid'},
  {userId:'staging_owner_B456',email:'b@synthetic.invalid'},
  {userId:'staging_client_C789',email:'c@synthetic.invalid'},
];
const ws=actors.map(a=>'ws_'+a.userId);
const key=generateKeyPairSync('rsa',{modulusLength:2048});
const current=Math.floor(Date.now()/1000);
let server,origin,revoked;
const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
function token(actor,change={}) {
  const h=encode({alg:'RS256',typ:'JWT',kid:'stage_key_1'});
  const p=encode({iss:'https://idp.synthetic.invalid',aud:'stage-only',
    sub:actor.userId,email:actor.email,email_verified:true,sid:'stage_session_123',
    jti:'stage_token_123',iat:current,exp:current+300,...change});
  return h+'.'+p+'.'+sign('RSA-SHA256',Buffer.from(h+'.'+p),key.privateKey).toString('base64url');
}
async function req(actor,path,{method='GET',originHeader,tokenOverride}={}) {
  const result=await fetch(origin+path,{method,headers:{
    ...(tokenOverride!==undefined?{authorization:'Bearer '+tokenOverride}:actor?{authorization:'Bearer '+token(actor)}:{}),
    ...(originHeader?{origin:originHeader}:{})
  }});
  return {status:result.status,body:await result.json()};
}
before(async()=>{
  await root.query(readFileSync('db/migrations/0001_growth_starter.sql','utf8'));
  await root.query(readFileSync('db/migrations/0002_staging_readonly.sql','utf8'));
  await root.query('INSERT INTO growth_starter.workspaces(id,owner_user_id) VALUES($1,$2),($3,$4)',[ws[0],actors[0].userId,ws[1],actors[1].userId]);
  await root.query("INSERT INTO growth_starter.work_requests(workspace_id,id,title,kind) VALUES($1,'stageRequestA','A website','Website update'),($2,'stageRequestB','B SEO','Local SEO')",[ws[0],ws[1]]);
  revoked=new Set();
  const identityVerifier=createStagingIdentityVerifier({
    issuer:'https://idp.synthetic.invalid',audience:'stage-only',
    keys:[{kid:'stage_key_1',publicKeyPem:key.publicKey.export({type:'spki',format:'pem'})}],
    clock:()=>current*1000,
    checkSession:async actor=>!revoked.has(actor.userId),
  });
  // Role is set LOCAL in each transaction, simulating the dedicated restricted
  // non-owner login role without a secret or permanent LOGIN in the test DB.
  const restrictedPool={
    async query(sql,args=[]) {
      const conn=await root.connect();
      try {
        await conn.query('BEGIN');
        await conn.query('SET LOCAL ROLE growth_starter_reader');
        const answer=await conn.query(sql,args);
        await conn.query('COMMIT');
        return answer;
      }catch(err) {
        await conn.query('ROLLBACK');
        throw err;
      }finally{conn.release();}
    }
  };
  const gateway=createStagingGateway({pool:restrictedPool,identityVerifier,allowedOrigin:'https://stage.example.invalid'});
  server=createServer(gateway.handler);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  origin='http://127.0.0.1:'+server.address().port;
});
after(async()=>{
  if(server) await new Promise(resolve=>server.close(resolve));
  await root.end();
});
test('real restricted database role has no arbitrary table reads or writes',async()=>{
  const c=await root.connect();
  try {
    await c.query('BEGIN');
    await c.query('SET LOCAL ROLE growth_starter_reader');
    await assert.rejects(c.query('SELECT * FROM growth_starter.work_requests'),e=>e.code==='42501');
    await c.query('ROLLBACK');await c.query('BEGIN');
    await c.query('SET LOCAL ROLE growth_starter_reader');
    await assert.rejects(c.query('INSERT INTO growth_starter.workspaces (id,owner_user_id) VALUES ($1,$2)', ['ws_forged_owner','fakeowner']),e=>e.code==='42501');
    await c.query('ROLLBACK');await c.query('BEGIN');
    await c.query('SET LOCAL ROLE growth_starter_reader');
    const allowed=await c.query('SELECT * FROM growth_starter.staging_list_workspaces($1)',[actors[0].userId]);
    assert.deepEqual(allowed.rows.map(x=>x.workspace_id),[ws[0]]);
    await c.query('ROLLBACK');
  }finally{c.release();}
});
test('real PostgreSQL and signed HTTP gateway allow only own workspace',async()=>{
  const a=await req(actors[0],'/v1/requests?workspaceId='+ws[0]);
  const b=await req(actors[1],'/v1/requests?workspaceId='+ws[1]);
  const ab=await req(actors[0],'/v1/requests?workspaceId='+ws[1]);
  const ba=await req(actors[1],'/v1/requests?workspaceId='+ws[0]);
  assert.deepEqual([a.status,b.status,ab.status,ba.status],[200,200,403,403]);
  assert.deepEqual(a.body.items.map(x=>x.id),['stageRequestA']);
  assert.deepEqual(b.body.items.map(x=>x.id),['stageRequestB']);
});
test('real membership grants limited read access and immediately respects revocation',async()=>{
  const query=await req(actors[2],'/v1/requests?workspaceId='+ws[0]);
  assert.equal(query.status,403);
  await root.query("INSERT INTO growth_starter.memberships(workspace_id,user_id,owner_user_id,role,created_by) VALUES($1,$2,$3,'client',$4)",[ws[0],actors[2].userId,actors[0].userId,actors[0].userId]);
  assert.equal((await req(actors[2],'/v1/requests?workspaceId='+ws[0])).status,200);
  await root.query("UPDATE growth_starter.memberships SET state='revoked' WHERE workspace_id=$1 AND user_id=$2",[ws[0],actors[2].userId]);
  assert.equal((await req(actors[2],'/v1/requests?workspaceId='+ws[0])).status,403);
});
test('expired/revoked/forged JWT and unauthorized HTTP method fail',async()=>{
  assert.equal((await req(null,'/v1/workspaces')).status,401);
  assert.equal((await req(actors[0],'/v1/workspaces',{tokenOverride:token(actors[0],{exp:current-1})})).status,401);
  assert.equal((await req(actors[0],'/v1/workspaces',{tokenOverride:token(actors[0],{email_verified:false})})).status,403);
  assert.equal((await req(actors[0],'/v1/requests?workspaceId='+ws[1],{tokenOverride:token(actors[0],{role:'owner',workspaceId:ws[1]})})).status,403);
  revoked.add(actors[0].userId);
  assert.equal((await req(actors[0],'/v1/workspaces')).status,401);
  revoked.delete(actors[0].userId);
  assert.equal((await req(actors[0],'/v1/workspaces',{method:'POST'})).status,405);
  assert.equal((await req(actors[0],'/v1/workspaces',{originHeader:'https://evil.invalid'})).status,403);
  assert.equal((await req(actors[0],'/v1/requests?workspaceId='+ws[0]+'&limit=999')).status,400);
});
