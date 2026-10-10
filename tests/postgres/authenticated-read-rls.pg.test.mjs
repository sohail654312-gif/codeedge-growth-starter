import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import pg from 'pg';
const {Pool}=pg;
if(!process.env.TEST_DATABASE_URL)throw Error('Disposable PostgreSQL required; NOT Supabase.');
const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL,max:2});
const a='329d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const b='429d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const staff='529d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const stranger='629d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const wa='ws_'+a,wb='ws_'+b;
async function role(c,roleName,subject,sql,args=[]) {
  await c.query('SAVEPOINT identity_probe');
  try {
    await c.query('SET LOCAL ROLE '+roleName);
    await c.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[subject||'']);
    return await c.query(sql,args);
  }finally{await c.query('ROLLBACK TO SAVEPOINT identity_probe');await c.query('RELEASE SAVEPOINT identity_probe');}
}
test('real disposable RLS denies cross-workspace reads, revoked members and mutations',async()=>{
 const c=await pool.connect();
 try {
  for(const file of ['0001_growth_starter.sql','0002_staging_readonly.sql','0003_staging_default_deny_rls.sql'])
   await c.query(readFileSync('db/migrations/'+file,'utf8'));
  await c.query('CREATE SCHEMA IF NOT EXISTS auth');
  await c.query(`DO $$BEGIN
    IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN;END IF;
    IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN;END IF;
  END$$`);
  // Disposable mock auth.uid reads a GUC ONLY to simulate an already
  // verified PostgREST identity. This is NOT a signature verifier and must
  // NEVER be installed or called from the app's direct PG connection.
  await c.query(`CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$`);
  await c.query('BEGIN');
  try {
   await c.query("INSERT INTO growth_starter.workspaces(id,owner_user_id) VALUES($1,$2),($3,$4)",[wa,a,wb,b]);
   await c.query("INSERT INTO growth_starter.memberships(workspace_id,user_id,owner_user_id,role,created_by) VALUES($1,$2,$3,'staff',$3)",[wa,staff,a]);
   await c.query("INSERT INTO growth_starter.work_requests(workspace_id,id,title,kind,status) VALUES($1,'rls_req_a','Alpha','Other','Requested'),($2,'rls_req_b','Beta','Other','Requested')",[wa,wb]);
   await c.query(readFileSync('db/drafts/0008_authenticated_read_rls_REVIEW_ONLY.sql','utf8'));
   const query="SELECT id FROM growth_starter.workspaces ORDER BY id";
   assert.deepEqual((await role(c,'authenticated',a,query)).rows.map(x=>x.id),[wa]);
   assert.deepEqual((await role(c,'authenticated',b,query)).rows.map(x=>x.id),[wb]);
   assert.deepEqual((await role(c,'authenticated',staff,query)).rows.map(x=>x.id),[wa]);
   assert.deepEqual((await role(c,'authenticated',stranger,query)).rows,[]);
   assert.deepEqual((await role(c,'authenticated','',query)).rows,[]);
   assert.deepEqual((await role(c,'authenticated',a,"SELECT id FROM growth_starter.work_requests ORDER BY id")).rows.map(x=>x.id),['rls_req_a']);
   assert.deepEqual((await role(c,'authenticated',staff,"SELECT id FROM growth_starter.work_requests ORDER BY id")).rows.map(x=>x.id),['rls_req_a']);
   assert.deepEqual((await role(c,'authenticated',b,"SELECT id FROM growth_starter.work_requests ORDER BY id")).rows.map(x=>x.id),['rls_req_b']);
   assert.deepEqual((await role(c,'authenticated',staff,"SELECT user_id,role FROM growth_starter.memberships")).rows.map(x=>x.user_id),[staff]);
   await assert.rejects(role(c,'anon',a,query),e=>e.code==='42501');
   await assert.rejects(role(c,'authenticated',staff,"UPDATE growth_starter.memberships SET role='agency_admin'"),e=>e.code==='42501');
   await assert.rejects(role(c,'authenticated',a,"UPDATE growth_starter.workspaces SET owner_user_id=$1",[staff]),e=>e.code==='42501');
   await assert.rejects(role(c,'authenticated',a,"SELECT secret_digest FROM growth_starter.invitations"),e=>e.code==='42501');
   await assert.rejects(role(c,'authenticated',staff,"SELECT actor_user_id FROM growth_starter.audit_events"),e=>e.code==='42501');
   await assert.rejects(role(c,'authenticated',staff,"SELECT owner_user_id FROM growth_starter.work_requests"),e=>e.code==='42703');
   // SQL filtering by foreign tenant does not bypass RLS.
   assert.deepEqual((await role(c,'authenticated',staff,'SELECT id FROM growth_starter.work_requests WHERE workspace_id=$1',[wb])).rows,[]);
   await c.query("UPDATE growth_starter.memberships SET state='revoked', revoked_at=now() WHERE workspace_id=$1 AND user_id=$2",[wa,staff]);
   assert.deepEqual((await role(c,'authenticated',staff,query)).rows,[]);
   assert.deepEqual((await role(c,'authenticated',staff,"SELECT id FROM growth_starter.work_requests")).rows,[]);
   await c.query("UPDATE growth_starter.workspaces SET state='suspended' WHERE id=$1",[wa]);
   assert.deepEqual((await role(c,'authenticated',a,query)).rows,[]);
   assert.deepEqual((await role(c,'authenticated',a,"SELECT id FROM growth_starter.work_requests")).rows,[]);
   // Runtime SQL principal receives NONE of the authenticated role's grants.
   await assert.rejects(role(c,'growth_starter_reader',a,query),e=>e.code==='42501');
  }finally{await c.query('ROLLBACK');}
 }finally{c.release();await pool.end();}
});
