import test from 'node:test';
import assert from 'node:assert/strict';
import {createRestrictedStagingPool} from '../backend/staging-restricted-runtime.mjs';

// Synthetic PostgreSQL catalog/connection fixtures; no hosted access or effects.
const WORKSPACES='SELECT workspace_id, role FROM growth_starter.staging_list_workspaces($1)';
const safe=()=>({
 database_login:'growth_starter_runtime',authenticated_login:'growth_starter_runtime',
 rolcanlogin:true,rolsuper:false,rolbypassrls:false,rolcreatedb:false,
 rolcreaterole:false,rolreplication:false,rolinherit:false,can_set_reader:true,
 can_create_db_objects:false,can_create_schema_objects:false,
 direct_table_access:false,reader_can_login:false,reader_super:false,
 reader_bypassrls:false,reader_create_role:false,reader_create_db:false,
 reader_inherit:false,reader_can_create:false,reader_direct_table_access:false,
 reader_extra_functions:false
});
function fixture({drift={},startupDrift={},runtimeRole='growth_starter_reader'}={}){
 const traces=[];let releases=0;
 const rawPool={connect:async()=>{
  const index=traces.length,calls=[];traces.push(calls);
  return {
   async query(sql,args){
    calls.push(sql);
    if(sql.includes('current_user AS database_login'))
     return {rows:[{...safe(),...(index===0?startupDrift:drift)}]};
    if(sql==='SELECT current_user AS role_name')
     return {rows:[{role_name:index===0?'growth_starter_reader':runtimeRole}]};
    if(sql===WORKSPACES){
     assert.deepEqual(args,['subject123456']);
     return {rows:[{workspace_id:'ws_fixture',role:'owner'}]};
    }
    return {rows:[]};
   },
   release(){releases++;}
  };
 }};
 return {rawPool,traces,get releases(){return releases;}};
}
test('staging reader rechecks each physical connection before a tenant read',async()=>{
 const f=fixture(),pool=await createRestrictedStagingPool({rawPool:f.rawPool});
 assert.deepEqual((await pool.query(WORKSPACES,['subject123456'])).rows,
  [{workspace_id:'ws_fixture',role:'owner'}]);
 assert.equal(f.traces.length,2);
 const calls=f.traces[1];
 const check=calls.findIndex(sql=>sql.includes('current_user AS database_login'));
 const role=calls.indexOf('SET LOCAL ROLE growth_starter_reader');
 const effective=calls.indexOf('SELECT current_user AS role_name');
 const tenant=calls.indexOf(WORKSPACES);
 assert.ok(check>calls.indexOf('BEGIN READ ONLY'));
 assert.ok(role>check && effective>role && tenant>effective);
 assert.ok(calls.includes('COMMIT'));
 assert.equal(f.releases,2);
});
test('staging reader denies pooled privilege and identity drift before tenant SQL',async()=>{
 const bad=[
  {database_login:'postgres'},{authenticated_login:'postgres'},
  {rolcanlogin:undefined},{rolsuper:true},{rolinherit:null},
  {rolbypassrls:'false'},{can_set_reader:null},
  {direct_table_access:true},{reader_extra_functions:undefined},
  {reader_direct_table_access:true},{reader_can_login:true},
  {can_create_db_objects:true},{reader_create_role:true}
 ];
 for(const drift of bad){
  const f=fixture({drift}),pool=await createRestrictedStagingPool({rawPool:f.rawPool});
  await assert.rejects(pool.query(WORKSPACES,['subject123456']),
   error=>error?.status===503,JSON.stringify(drift));
  const calls=f.traces[1];
  assert.ok(calls.some(sql=>sql.includes('current_user AS database_login')));
  assert.equal(calls.includes('SET LOCAL ROLE growth_starter_reader'),false);
  assert.equal(calls.includes(WORKSPACES),false);
  assert.ok(calls.includes('ROLLBACK'));
  assert.equal(f.releases,2);
 }
});
test('staging reader denies a failed role switch before tenant SQL',async()=>{
 const f=fixture({runtimeRole:'growth_starter_runtime'});
 const pool=await createRestrictedStagingPool({rawPool:f.rawPool});
 await assert.rejects(pool.query(WORKSPACES,['subject123456']),
  error=>error?.status===503);
 assert.ok(f.traces[1].includes('SET LOCAL ROLE growth_starter_reader'));
 assert.ok(f.traces[1].includes('SELECT current_user AS role_name'));
 assert.equal(f.traces[1].includes(WORKSPACES),false);
 assert.ok(f.traces[1].includes('ROLLBACK'));
 assert.equal(f.releases,2);
});
test('staging startup rejects unknown catalog facts',async()=>{
 const f=fixture({startupDrift:{reader_extra_functions:undefined}});
 await assert.rejects(createRestrictedStagingPool({rawPool:f.rawPool}),
  error=>error?.status===503);
 assert.equal(f.traces.length,1);
 assert.equal(f.traces[0].includes('SET LOCAL ROLE growth_starter_reader'),false);
 assert.equal(f.releases,1);
});
