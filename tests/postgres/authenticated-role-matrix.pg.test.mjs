import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import pg from 'pg';
if(!process.env.TEST_DATABASE_URL)throw Error('Disposable PostgreSQL ONLY.');
const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,max:2});
const owner='a39d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const foreignOwner='b39d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const agency='c39d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const staff='d39d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const client='e39d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const ws='ws_'+owner,other='ws_'+foreignOwner;
async function as(c,role,user,query,args=[]){
 await c.query('SAVEPOINT actor_scope');
 try{
  await c.query('SET LOCAL ROLE '+role);
  await c.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[user]);
  return await c.query(query,args);
 }finally{await c.query('ROLLBACK TO SAVEPOINT actor_scope');await c.query('RELEASE SAVEPOINT actor_scope');}
}
test('real PostgreSQL policy differentiates active owner/agency/staff/client membership and denies escalation',async()=>{
 const c=await pool.connect();
 try{
  for(const file of ['0001_growth_starter.sql','0002_staging_readonly.sql','0003_staging_default_deny_rls.sql'])
   await c.query(readFileSync('db/migrations/'+file,'utf8'));
  await c.query('CREATE SCHEMA IF NOT EXISTS auth');
  await c.query(`DO $$BEGIN
   IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN;END IF;
   IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN;END IF;
  END$$`);
  await c.query(`CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
   AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$`);
  await c.query('BEGIN');
  try{
   await c.query('INSERT INTO growth_starter.workspaces(id,owner_user_id) VALUES($1,$2),($3,$4)',[ws,owner,other,foreignOwner]);
   for(const [uid,role] of [[agency,'agency_admin'],[staff,'staff'],[client,'client']]){
    await c.query('INSERT INTO growth_starter.memberships(workspace_id,user_id,owner_user_id,role,created_by) VALUES($1,$2,$3,$4,$3)',[ws,uid,owner,role]);
   }
   await c.query("INSERT INTO growth_starter.work_requests(workspace_id,id,title,kind) VALUES($1,'matrix_a','Alpha','Other'),($2,'matrix_b','Beta','Other')",[ws,other]);
   await c.query(readFileSync('db/drafts/0008_authenticated_read_rls_REVIEW_ONLY.sql','utf8'));
   for(const [uid,expectedRole] of [[owner,'owner'],[agency,'agency_admin'],[staff,'staff'],[client,'client']]){
    const own=await as(c,'authenticated',uid,'SELECT id FROM growth_starter.workspaces ORDER BY id');
    assert.deepEqual(own.rows.map(x=>x.id),[ws]);
    const requests=await as(c,'authenticated',uid,'SELECT id FROM growth_starter.work_requests ORDER BY id');
    assert.deepEqual(requests.rows.map(x=>x.id),['matrix_a']);
    const membership=await as(c,'authenticated',uid,
      'SELECT role FROM growth_starter.memberships ORDER BY role');
    assert.deepEqual(membership.rows.map(x=>x.role),uid===owner?[]:[expectedRole]);
    await assert.rejects(as(c,'authenticated',uid,
      'UPDATE growth_starter.memberships SET role=$1 WHERE user_id=$2',['agency_admin',client]),e=>e.code==='42501');
    await assert.rejects(as(c,'authenticated',uid,
      "INSERT INTO growth_starter.work_requests(workspace_id,id,title,kind) VALUES($1,'hack','Hack','Other')",[ws]),e=>e.code==='42501');
   }
   assert.deepEqual((await as(c,'authenticated',foreignOwner,'SELECT id FROM growth_starter.work_requests')).rows.map(x=>x.id),['matrix_b']);
   await c.query("UPDATE growth_starter.memberships SET state='revoked' WHERE user_id=$1",[client]);
   assert.deepEqual((await as(c,'authenticated',client,'SELECT id FROM growth_starter.workspaces')).rows,[]);
   assert.deepEqual((await as(c,'authenticated',client,'SELECT id FROM growth_starter.work_requests')).rows,[]);
   await c.query("UPDATE growth_starter.workspaces SET state='suspended' WHERE id=$1",[ws]);
   assert.deepEqual((await as(c,'authenticated',agency,'SELECT id FROM growth_starter.workspaces')).rows,[]);
   assert.deepEqual((await as(c,'authenticated',staff,'SELECT id FROM growth_starter.work_requests')).rows,[]);
   // GUC-based auth.uid() here is a CI SIMULATOR, NOT cryptographic JWT validation.
   await assert.rejects(as(c,'growth_starter_reader',foreignOwner,'SELECT id FROM growth_starter.workspaces'),e=>e.code==='42501');
  }finally{await c.query('ROLLBACK');}
 }finally{c.release();await pool.end();}
});
