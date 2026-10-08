import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import pg from 'pg';
const {Pool}=pg;
if(!process.env.TEST_DATABASE_URL) throw Error('Only disposable GitHub PostgreSQL is supported');
const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL,max:3});
before(async()=>{
  for(const name of ['0001_growth_starter.sql','0002_staging_readonly.sql',
      '0003_staging_default_deny_rls.sql','0004_prepare_runtime_role.sql']){
    await pool.query(readFileSync('db/migrations/'+name,'utf8'));
  }
});
after(async()=>{await pool.end();});
test('runtime role can SET reader, cannot inherit reader or log in',async()=>{
  const result=await pool.query(`SELECT rolcanlogin, rolinherit, rolbypassrls,
   rolsuper,rolcreaterole,rolcreatedb,rolreplication
   FROM pg_roles WHERE rolname='growth_starter_runtime'`);
  const r=result.rows[0];assert.ok(r);
  for(const value of Object.values(r))assert.equal(value,false);
  const grants=await pool.query(`SELECT
   pg_has_role('growth_starter_runtime','growth_starter_reader','SET') AS can_set,
   pg_has_role('growth_starter_runtime','growth_starter_reader','USAGE') AS can_inherit`);
  assert.equal(grants.rows[0].can_set,true);
  assert.equal(grants.rows[0].can_inherit,false);
  // The disposable CI database is owned by gs_test, not postgres.
  // Management-role membership is checked separately in the hosted project.
});
test('NOLOGIN preparation does not grant runtime any direct base-table privileges',async()=>{
  const r=await pool.query(`SELECT
   has_table_privilege('growth_starter_runtime','growth_starter.workspaces','SELECT') AS table_read,
   has_table_privilege('growth_starter_runtime','growth_starter.workspaces','INSERT') AS table_write,
   has_schema_privilege('growth_starter_runtime','growth_starter','USAGE') AS schema_use,
   has_function_privilege('growth_starter_runtime','growth_starter.staging_list_workspaces(text)','EXECUTE') AS direct_function`);
  assert.deepEqual(r.rows[0],{table_read:false,table_write:false,schema_use:false,direct_function:false});
});
test('RLS remains default-deny with no tenant policy or data',async()=>{
  const q=await pool.query(`SELECT count(*)::int AS count,
    count(*) FILTER (WHERE relrowsecurity)::int AS enabled
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='growth_starter' AND c.relkind='r'`);
  assert.deepEqual(q.rows[0],{count:7,enabled:7});
  assert.equal((await pool.query("SELECT count(*)::int AS c FROM pg_policies WHERE schemaname='growth_starter'")).rows[0].c,0);
});
