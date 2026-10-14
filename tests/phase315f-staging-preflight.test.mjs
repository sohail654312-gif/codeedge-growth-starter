import test from 'node:test';
import assert from 'node:assert/strict';
import {assessFictionalStagingPreflight,FICTIONAL_STAGING_PACKAGE}
 from '../backend/phase315f-staging-preflight.mjs';
const observed=()=>({
 postgres_version:'17.11',application_table_count:7,rls_enabled_table_count:7,
 rls_policy_count:3,anon_growth_schema_access:false,
 authenticated_growth_schema_access:true,service_growth_schema_access:false,
 anon_can_select_work_requests:false,auth_role_full_work_requests_select:false,
 auth_role_title_select:true,checker_auth_schema_access:false,
 checker_can_login:false,runtime_can_set_legacy_reader:true,
 privileged_legacy_function_count:3,
 production_private_session_schema_exists:false,local_data_api_exposure_guc:null
});
test('actual staging catalog blocks direct-authenticated and legacy bypass access',()=>{
 const r=assessFictionalStagingPreflight(observed());
 assert.equal(r.classification,'blocked');
 assert.deepEqual(r.failed,[
  'no_direct_authenticated_schema_access',
  'no_direct_authenticated_column_select','no_legacy_role_switch',
  'no_legacy_privileged_functions'
 ]);
 assert.equal(r.dataApi.dashboardExposureVerified,false);
 assert.equal(r.canDeploy,false);
});
test('even idealized database cannot self-approve users, migrations or hosting',()=>{
 const r=assessFictionalStagingPreflight({...observed(),
  authenticated_growth_schema_access:false,auth_role_title_select:false,
  runtime_can_set_legacy_reader:false,privileged_legacy_function_count:0});
 assert.equal(r.classification,'requires_external_review_and_owner_approval');
 assert.deepEqual(r.failed,[]);
 assert.equal(r.canDeploy,false);
 assert.equal(r.canCreateFictionalUsers,false);
 assert.equal(r.canModifySupabase,false);
 assert.equal(r.outstandingExternalEvidence.length,8);
});
test('reject missing, forged, malformed and policy-drift observations',()=>{
 for(const v of [null,undefined,[],{},{
  ...observed(),auth_role_title_select:'false'
 },{...observed(),privileged_legacy_function_count:-1},
 {...observed(),rls_enabled_table_count:6},
 {...observed(),rls_policy_count:4},
 {...observed(),local_data_api_exposure_guc:[]}]){
  if(v?.rls_enabled_table_count===6||v?.rls_policy_count===4){
   assert.equal(assessFictionalStagingPreflight(v).classification,'blocked');
  }else assert.throws(()=>assessFictionalStagingPreflight(v),/Invalid/);
 }
 const forged={...observed(),ownerApproved:true,securityApproved:true,canDeploy:true,
  providerApproved:true,dataApiDisabled:true};
 assert.equal(assessFictionalStagingPreflight(forged).canDeploy,false);
 assert.equal(FICTIONAL_STAGING_PACKAGE.canGrantRoles,false);
 assert.equal(FICTIONAL_STAGING_PACKAGE.canMerge,false);
});
test('source-only staging package has exact account boundary',()=>{
 assert.equal(FICTIONAL_STAGING_PACKAGE.allowedFictionalUsers,3);
 assert.equal(FICTIONAL_STAGING_PACKAGE.projectRef,'dbppeymhsemvghbvuvof');
 assert.equal(FICTIONAL_STAGING_PACKAGE.sourceOnly,true);
 assert.equal(FICTIONAL_STAGING_PACKAGE.canCreateUsers,false);
});
