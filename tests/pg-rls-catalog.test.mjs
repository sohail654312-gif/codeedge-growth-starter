import test from 'node:test';
import assert from 'node:assert/strict';
import {CATALOG_SQL,checkAcceptedCatalog,syntheticAcceptedCatalogForTests} from '../backend/pg-rls-catalog.mjs';
const copy=()=>syntheticAcceptedCatalogForTests();
const reject=x=>assert.throws(()=>checkAcceptedCatalog(x),/Trusted staging session authority unavailable/);
test('positive golden read-only catalog accepts exact reviewed policy and role fingerprint',()=>{
 assert.equal(checkAcceptedCatalog(copy()),true);
 assert.ok(CATALOG_SQL.includes('pg_policies')&&CATALOG_SQL.includes('pg_has_role'));
 assert.ok(CATALOG_SQL.includes('aclexplode')&&CATALOG_SQL.includes('has_column_privilege'));
});
test('deny missing, renamed, altered and foreign-workspace permissive RLS policies',()=>{
 for(const alter of [
  c=>c.policies.pop(),
  c=>c.policies[0].name='gs32_renamed',
  c=>c.policies[0].qual+=' OR true',
  c=>c.policies[0].roles=['public'],
  c=>c.policies[0].cmd='ALL',
  c=>c.policies[0].permissive='RESTRICTIVE',
  c=>c.policies[1].check='true',
  c=>c.policies.push({...c.policies[0],name:'extra_permissive',qual:'true'})
 ]){const c=copy();alter(c);reject(c);}
});
test('deny disabled or missing RLS and unknown table',()=>{
 for(const alter of [
  c=>c.tables.pop(),
  c=>c.tables[0].rls=false,
  c=>c.tables.push({name:'shadow_table',rls:true})
 ]){const c=copy();alter(c);reject(c);}
});
test('deny broad, extra or unexpected schema/column grants',()=>{
 for(const alter of [
  c=>c.privileges[0].columns=['id'],
  c=>c.privileges.find(x=>x.role==='authenticated'&&x.table==='workspaces').columns.push('internal_note'),
  c=>c.privileges.find(x=>x.role==='authenticated'&&x.table==='workspaces').selectTable=true,
  c=>c.privileges.find(x=>x.role==='authenticated'&&x.table==='workspaces').update=true,
  c=>c.privileges.find(x=>x.role==='anon'&&x.table==='workspaces').insert=true,
  c=>c.anonSchema=true,
  c=>c.serviceSchema=true,
  c=>c.authSchema=false
 ]){const c=copy();alter(c);reject(c);}
});
test('deny all three legacy function rights, PUBLIC execute, extra principals or missing catalog records',()=>{
 for(const alter of [
  c=>c.legacy[0].roles.find(x=>x.role==='growth_starter_reader').execute=true,
  c=>c.legacy[1].roles.find(x=>x.role==='growth_starter_runtime').execute=true,
  c=>c.legacy[2].roles.find(x=>x.role==='growth_starter_reader').execute=true,
  c=>c.legacy[2].publicExecute=true,
  c=>c.legacy[0].roles.pop(),
  c=>c.legacy.pop(),
  c=>c.legacy[0].roles.find(x=>x.role==='authenticated').execute=true
 ]){const c=copy();alter(c);reject(c);}
});
test('deny effective SET ROLE capability including NOINHERIT and missing role graph',()=>{
 for(const alter of [
  c=>c.role_paths.find(x=>x.role==='growth_starter_runtime'&&x.target==='growth_starter_reader').canSet=true,
  c=>c.role_paths.find(x=>x.role==='growth_starter_session_checker'&&x.target==='postgres').canSet=true,
  c=>c.role_paths.pop()
 ]){const c=copy();alter(c);reject(c);}
});
test('deny absent, partially returned or malformed policy catalog',()=>{
 for(const v of [null,{},[],{policies:null}, {...copy(),policies:'not an array'}])reject(v);
});
