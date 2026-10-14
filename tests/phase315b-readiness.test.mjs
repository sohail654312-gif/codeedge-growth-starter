import test from 'node:test';
import assert from 'node:assert/strict';
import {assessHostedAuthReadiness,PHASE315B_BOUNDARY} from '../backend/phase315b-readiness.mjs';

const observed=()=>({
 checker_login:false,checker_auth_schema:false,checker_required_auth_columns:6,
 checker_full_sessions_select:false,checker_full_users_select:false,
 checker_can_set_reader:false,runtime_can_set_reader:true,
 privileged_legacy_paths:3,policy_count:3,rls_table_count:7,
 pgrst_exposed_schemas_guc:null
});

test('read-only actual-shape snapshot reports blockers, never authorizes activation',()=>{
 const verdict=assessHostedAuthReadiness(observed());
 assert.equal(verdict.classification,'blocked');
 assert.equal(verdict.mayActivate,false);
 assert.deepEqual([...verdict.blockers],[
  'checker_has_login','checker_has_auth_schema_usage',
  'no_runtime_legacy_role_switch','no_legacy_privileged_functions'
 ]);
 assert.equal(verdict.dataApi.verifiedFromDashboard,false);
 assert.equal(PHASE315B_BOUNDARY.mayApplyGrants,false);
});
test('hypothetically clean database snapshot still requires external provider/hosted evidence',()=>{
 const clean={...observed(),checker_login:true,checker_auth_schema:true,
  runtime_can_set_reader:false,privileged_legacy_paths:0,
  pgrst_exposed_schemas_guc:'public'};
 const verdict=assessHostedAuthReadiness(clean);
 assert.equal(verdict.classification,'awaiting_independent_hosted_evidence');
 assert.deepEqual(verdict.blockers,[]);
 assert.equal(verdict.mayActivate,false);
 assert.equal(verdict.outstandingExternalEvidence.length,5);
 assert.equal(verdict.dataApi.verifiedFromDashboard,false);
});
test('deny broad Auth SELECT, role escalation, missing grants and policy drift',()=>{
 const changes=[
  {checker_full_sessions_select:true},{checker_full_users_select:true},
  {checker_can_set_reader:true},{checker_required_auth_columns:5},
  {policy_count:4},{rls_table_count:6},{privileged_legacy_paths:1}
 ];
 for(const change of changes){
  const result=assessHostedAuthReadiness({...observed(),...change});
  assert.equal(result.classification,'blocked');
  assert.equal(result.mayActivate,false);
 }
});
test('reject unknown/null/malformed catalog rows instead of calling them ready',()=>{
 const invalid=[null,[],undefined,
  {...observed(),checker_login:'true'},
  {...observed(),checker_required_auth_columns:-1},
  {...observed(),policy_count:NaN},
  {...observed(),pgrst_exposed_schemas_guc:{}},
  {...observed(),pgrst_exposed_schemas_guc:'x'.repeat(1025)}];
 for(const value of invalid)assert.throws(()=>assessHostedAuthReadiness(value),/snapshot/);
});
test('forged caller approval cannot activate the phase',()=>{
 const forged={...observed(),checker_login:true,checker_auth_schema:true,
  runtime_can_set_reader:false,privileged_legacy_paths:0,
  providerApproved:true,ownerApproved:true,liveHostedPassed:true,mayActivate:true,
  pgrst_exposed_schemas_guc:'no issue'};
 const result=assessHostedAuthReadiness(forged);
 assert.equal(result.mayActivate,false);
 assert.equal(result.classification,'awaiting_independent_hosted_evidence');
 assert.ok(!('providerApproved' in result));
});
