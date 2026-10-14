import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assessIndependentTenantCatalog,TENANT_QA_EXPECTED_TABLES} from '../backend/independent-tenant-audit.mjs';

// Fictional metadata fixture modeled on the 2026-10-14 catalog-only inspection.
// NOT a live database probe from CI and never a signed-user test.
const baseline=()=>({
 tables:TENANT_QA_EXPECTED_TABLES.map(name=>({name,rls:true,forceRls:false})),
 policies:[
  {name:'gs32_membership_self_read',table:'memberships',cmd:'SELECT',
   roles:'{authenticated}',qual:"auth.uid() IS NOT NULL AND user_id = auth.uid()"},
  {name:'gs32_active_workspace_requests_read',table:'work_requests',cmd:'SELECT',
   roles:'{authenticated}',qual:"auth.uid() IS NOT NULL AND workspace_id IN (SELECT id FROM growth_starter.workspaces)"},
  {name:'gs32_active_workspace_read',table:'workspaces',cmd:'SELECT',
   roles:'{authenticated}',qual:"auth.uid() IS NOT NULL AND owner_user_id = auth.uid()"}
 ],
 legacyFunctions:['staging_list_requests','staging_list_workspaces','staging_session_active']
 .map(name=>({name,securityDefiner:true,owner:'postgres',readerExecute:true,
  authenticatedExecute:false,anonExecute:false})),
 authenticatedSchemaUsage:true,authenticatedColumnSelectCount:15,
 anonSchemaUsage:false,serviceRoleSchemaUsage:false,
 anonColumnSelectCount:0,serviceRoleColumnSelectCount:0,publicExecuteFunctionCount:0,
 runtimeCanSetLegacyReader:true,privateSchemaPresent:false,
 dashboardExposureVerified:false,signedHostedTenantTestsPassed:false
});
const problems=value=>assessIndependentTenantCatalog(value).findings;

test('metadata audit captures existing conditional access hazards without claiming leakage',()=>{
 const result=assessIndependentTenantCatalog(baseline());
 assert.equal(result.classification,'blocked_or_review_required');
 assert.equal(result.canDeploy,false);assert.equal(result.tenantIsolationCertified,false);
 assert.equal(result.tableCount,7);assert.equal(result.policyCount,3);
 assert.equal(result.authenticatedColumnSelectCount,15);
 assert.ok(result.findings.includes('authenticated_direct_column_read_grants'));
 assert.ok(result.findings.includes('runtime_can_assume_legacy_reader'));
 assert.ok(result.findings.includes('legacy_privileged_function_access:staging_list_requests'));
 assert.ok(result.findings.includes('dashboard_exposure_not_part_of_sql_proof'));
 assert.ok(result.findings.includes('no_live_signed_cross_tenant_acceptance'));
});

test('unexpected/missing table and weakened or expanded policy never look accepted',()=>{
 for(const change of [
  s=>{s.tables.pop();},
  s=>{s.tables.push({name:'shadow',rls:true,forceRls:true});},
  s=>{s.tables[0].rls=false;},
  s=>{s.policies.pop();},
  s=>{s.policies[0].cmd='ALL';},
  s=>{s.policies[0].roles='{public}';},
  s=>{s.policies[0].qual='true';}
 ]) {const s=baseline();change(s);assert.ok(problems(s).some(x=>
  x.startsWith('unexpected_or_missing')||x.startsWith('rls_disabled')||x.startsWith('policy_needs_independent_review')
  ),JSON.stringify(s));}
});

test('anonymous, service-role and PUBLIC function grant drift is flagged',()=>{
 for(const [key,value,code] of [
  ['anonSchemaUsage',true,'anonymous_role_has_growth_access'],
  ['anonColumnSelectCount',1,'anonymous_role_has_growth_access'],
  ['serviceRoleSchemaUsage',true,'service_role_has_growth_access'],
  ['serviceRoleColumnSelectCount',1,'service_role_has_growth_access'],
  ['publicExecuteFunctionCount',1,'public_function_execute_grants']
 ]){
  const s=baseline();s[key]=value;
  assert.ok(problems(s).includes(code),key);
 }
});

test('a newly callable privileged function or extra function is flagged',()=>{
 for(const change of [
  s=>{s.legacyFunctions[0].authenticatedExecute=true;},
  s=>{s.legacyFunctions[0].anonExecute=true;},
  s=>{s.legacyFunctions.push({name:'unexpected_helper',securityDefiner:true,owner:'postgres',readerExecute:true,authenticatedExecute:false,anonExecute:false});}
 ]){
  const s=baseline();change(s);
  const out=problems(s);
  assert.ok(out.some(x=>x.startsWith('browser_callable_function')||x==='unexpected_growth_function'));
 }
});

test('malformed, missing or forged audit evidence fails closed',()=>{
 for(const broken of [null,{},[],{...baseline(),tables:null},
  {...baseline(),authenticatedColumnSelectCount:-1},
  {...baseline(),authenticatedSchemaUsage:'false'},
  {...baseline(),anonColumnSelectCount:'0'},
  {...baseline(),publicExecuteFunctionCount:-1},
  {...baseline(),runtimeCanSetLegacyReader:null},
  {...baseline(),policies:[baseline().policies[0],baseline().policies[0]]}
 ])assert.throws(()=>assessIndependentTenantCatalog(broken),/Untrusted or incomplete/);
 const forged={...baseline(),ownerApproved:true,liveAccepted:true};
 const a=assessIndependentTenantCatalog(forged);
 assert.equal(a.canDeploy,false);assert.equal(a.tenantIsolationCertified,false);
});

test('even a hypothetically clean catalog never self-certifies release',()=>{
 const s=baseline();
 s.tables=s.tables.map(t=>({...t,forceRls:true}));
 s.legacyFunctions=[];s.authenticatedSchemaUsage=false;s.authenticatedColumnSelectCount=0;
 s.runtimeCanSetLegacyReader=false;s.privateSchemaPresent=true;
 s.anonSchemaUsage=false;s.serviceRoleSchemaUsage=false;
 s.anonColumnSelectCount=0;s.serviceRoleColumnSelectCount=0;s.publicExecuteFunctionCount=0;
 s.dashboardExposureVerified=true;s.signedHostedTenantTestsPassed=true;
 const a=assessIndependentTenantCatalog(s);
 assert.equal(a.classification,'catalog_review_only');
 assert.equal(a.canDeploy,false);assert.equal(a.tenantIsolationCertified,false);
});

test('staging audit SQL is strictly catalog-only, not a permission-changing migration',()=>{
 const sql=readFileSync('db/reviews/chatgpt_tenant_boundary_READ_ONLY.sql','utf8');
 assert.match(sql,/pg_policies/);assert.match(sql,/pg_class/);
 assert.match(sql,/information_schema\.column_privileges/);
 assert.match(sql,/pg_has_role/);
 assert.doesNotMatch(sql,/\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|GRANT|REVOKE|CREATE|TRUNCATE|SET\s+ROLE)\s+(?:TABLE|SCHEMA|ROLE|FUNCTION|ON|FROM|INTO|growth_starter)/i);
});
