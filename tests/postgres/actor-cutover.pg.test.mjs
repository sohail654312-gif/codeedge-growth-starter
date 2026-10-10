import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import pg from 'pg';
const {Pool}=pg;
if(!process.env.TEST_DATABASE_URL)throw Error('Disposable PostgreSQL required; not Supabase.');
const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL,max:2});
test('proposed SQL cutover removes the actor-substitution reader capability, then rolls back',async()=>{
 const c=await pool.connect();
 try{
  for(const file of ['0001_growth_starter.sql','0002_staging_readonly.sql','0004_prepare_runtime_role.sql'])
   await c.query(readFileSync('db/migrations/'+file,'utf8'));
  const a='cutover_owner_test_001',b='cutover_owner_test_002',wa='ws_'+a,wb='ws_'+b;
  await c.query('BEGIN');
  try{
   await c.query('INSERT INTO growth_starter.workspaces(id,owner_user_id) VALUES($1,$2),($3,$4)',[wa,a,wb,b]);
   await c.query("INSERT INTO growth_starter.work_requests(workspace_id,id,title,kind,status) VALUES($1,'cutover_b_req','Synthetic','Other','Requested')",[wb]);
   await c.query('SET LOCAL ROLE growth_starter_reader');
   const before=await c.query('SELECT workspace_id FROM growth_starter.staging_list_workspaces($1)',[b]);
   assert.deepEqual(before.rows.map(r=>r.workspace_id),[wb],
    'Negative regression: original SQL function allows actor substitution');
   const exposed=await c.query('SELECT id FROM growth_starter.staging_list_requests($1,$2,$3)',[b,wb,20]);
   assert.deepEqual(exposed.rows.map(row=>row.id),['cutover_b_req'],
    'Negative regression: the legacy privileged request function accepts a substituted actor');
   await c.query('RESET ROLE');
   const verify=readFileSync('db/drafts/0009_cutover_assertions_REVIEW_ONLY.sql','utf8');
   await c.query('SAVEPOINT before_cutover');
   await assert.rejects(c.query(verify), e=>e.code==='P0001');
   await c.query('ROLLBACK TO SAVEPOINT before_cutover');
   await c.query('RELEASE SAVEPOINT before_cutover');
   await c.query(readFileSync('db/drafts/0007_disable_legacy_actor_definers_REVIEW_ONLY.sql','utf8'));
   await c.query(verify);
   await c.query('SET LOCAL ROLE growth_starter_reader');
   await c.query('SAVEPOINT denied_requests');
   await assert.rejects(c.query('SELECT id FROM growth_starter.staging_list_requests($1,$2,$3)',[b,wb,20]),
     e=>e.code==='42501');
   await c.query('ROLLBACK TO SAVEPOINT denied_requests');
   await c.query('RELEASE SAVEPOINT denied_requests');
   await c.query('SET LOCAL ROLE growth_starter_reader');
   await assert.rejects(c.query('SELECT workspace_id FROM growth_starter.staging_list_workspaces($1)',[b]),
     e=>e.code==='42501');
  }finally{await c.query('ROLLBACK');}
  const rights=await c.query("SELECT has_function_privilege('growth_starter_reader','growth_starter.staging_list_workspaces(text)','EXECUTE') AS can_execute");
  assert.equal(rights.rows[0].can_execute,true,'Cutover must be rolled back in disposable CI');
 }finally{c.release();await pool.end();}
});
