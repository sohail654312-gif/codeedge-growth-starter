import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {createPrivateWorkspaceOperations,WRITER_PREFLIGHT,OPERATION_SIGNATURES} from '../backend/phase315p-private-operations.mjs';

// Synthetic catalog fixtures exercise the source gate, not hosted PostgreSQL.
const now=Date.parse('2026-10-29T00:00:00Z');
const token='ce1.'+randomUUID()+'.'+randomBytes(32).toString('base64url');
const userId=randomUUID(),sessionId=randomUUID();
const safe=()=>({
 actor:'gs315p_writer',login:'gs315p_writer',rolcanlogin:true,
 rolinherit:false,rolsuper:false,rolbypassrls:false,rolcreaterole:false,
 rolcreatedb:false,rolreplication:false,memberships:false,
 business_schema:false,auth_schema:false,schema_create:false,db_create:false,
 writable_schemas:0,tables:[],functions:[...OPERATION_SIGNATURES],
 public_functions:0,unsafe_operations:0,safe_owner:1,rls:9,
 other_definers:0,owner_extra_tables:0,owner_destructive:0,
 owner_create:false,browser_private:0
});
function fixture(drift={}){
 const calls=[];let checks=0,releases=0;
 const pool={
  query:async sql=>{
   assert.equal(sql,WRITER_PREFLIGHT);
   return {rows:[safe()]}; // Startup uses another pool connection.
  },
  connect:async()=>({
   query:async sql=>{
    calls.push(sql);
    if(sql===WRITER_PREFLIGHT)return {rows:[{...safe(),...drift}]};
    if(sql.startsWith('SELECT * FROM growth_starter_private.session_context('))
     return {rows:[{user_id:userId,provider_session_id:sessionId,expires_at:new Date(now+900000)}]};
    if(sql.startsWith('SELECT growth_starter_private.ops_workspaces('))
     return {rows:[{result:{workspaces:[]}}]};
    return {rows:[]};
   },
   release(){releases++;}
  })
 };
 const start=()=>createPrivateWorkspaceOperations({
  pool,cursorKey:'fictional-test-only-cursor-key-000000000000000',
  now:()=>now,
  checkProviderSession:async({userId:u,sessionId:s})=>{
   checks++;return {active:true,userId:u,sessionId:s,expiresAt:Math.floor(now/1000)+600};
  }
 });
 return {start,calls,get checks(){return checks;},get releases(){return releases;}};
}
test('workspace writer checks acquired connection before private session and operation SQL',async()=>{
 const f=fixture(),ops=await f.start();
 const result=await ops.run({token,action:'workspaces'});
 assert.deepEqual(result,{workspaces:[],sessionExpiresAt:new Date(now+900000).toISOString()});
 const preflight=f.calls.indexOf(WRITER_PREFLIGHT);
 const session=f.calls.findIndex(s=>s.startsWith('SELECT * FROM growth_starter_private.session_context('));
 const operation=f.calls.findIndex(s=>s.startsWith('SELECT growth_starter_private.ops_workspaces('));
 assert.ok(preflight>=0 && session>preflight && operation>session);
 assert.equal(f.calls.filter(s=>s==='COMMIT').length,1);
 assert.equal(f.checks,1);assert.equal(f.releases,1);
});
test('writer denies pooled identity, privilege and catalog drift before private SQL or provider calls',async()=>{
 const unsafe=[
  {actor:'postgres'},{login:'postgres'},{rolcanlogin:undefined},
  {rolsuper:true},{rolinherit:null},{rolbypassrls:'false'},
  {memberships:true},{auth_schema:true},{schema_create:true},
  {functions:[...OPERATION_SIGNATURES,'unexpected(text)']},
  {functions:undefined},{tables:['auth.sessions']},{rls:8},
  {safe_owner:0},{unsafe_operations:1},{owner_create:true},
  {browser_private:1},{writable_schemas:1}
 ];
 for(const drift of unsafe){
  const f=fixture(drift),ops=await f.start();
  await assert.rejects(ops.run({token,action:'workspaces'}),e=>e?.status===503);
  assert.ok(f.calls.includes(WRITER_PREFLIGHT),JSON.stringify(drift));
  assert.ok(f.calls.includes('ROLLBACK'),JSON.stringify(drift));
  assert.equal(f.calls.some(s=>s.includes('growth_starter_private.session_context(')),false);
  assert.equal(f.calls.some(s=>s.includes('growth_starter_private.ops_')),false);
  assert.equal(f.calls.includes('COMMIT'),false);
  assert.equal(f.checks,0);assert.equal(f.releases,1);
 }
});
