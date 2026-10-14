import test from 'node:test';
import assert from 'node:assert/strict';
import {assessCutoverSnapshot,PHASE315J} from '../backend/phase315j-cutover-readiness.mjs';
const baseline=()=>({
 rls_tables:7,policies:3,
 authenticated_schema_usage:true,authenticated_workspace_column:true,
 authenticated_membership_column:true,authenticated_request_column:true,
 runtime_can_set_old_reader:true,old_privileged_functions:3,
 authenticated_column_grant_rows:15,rls_predicates:[
  {table:'work_requests',name:'gs32_active_workspace_requests_read',
   qual:"exists(select 1 from growth_starter.workspaces w where w.id = work_requests.workspace_id)"}
 ],local_postgrest_schema_setting:null
});
test('staging real-shape catalog blocks unreviewed cutover',()=>{
 const v=assessCutoverSnapshot(baseline());
 assert.equal(v.classification,'blocked');
 assert.ok(v.blockers.includes('authenticated_request_column'));
 assert.ok(v.blockers.includes('runtime_can_set_old_reader'));
 assert.equal(v.canActivate,false);
 assert.equal(v.dashboardDataApiVerified,false);
});
test('even hypothetical remediated catalog never certifies hosted acceptance',()=>{
 const v=assessCutoverSnapshot({...baseline(),
  authenticated_schema_usage:false,authenticated_workspace_column:false,
  authenticated_membership_column:false,authenticated_request_column:false,
  runtime_can_set_old_reader:false,old_privileged_functions:0,
  authenticated_column_grant_rows:0
 });
 assert.equal(v.classification,'awaits_independent_hosted_evidence');
 assert.deepEqual(v.blockers,[]);
 assert.equal(v.canActivate,false);
 assert.equal(v.directRestDenied,false);
 assert.equal(v.rlsIsIndependentOfCodeedgeLogout,true);
 assert.equal(PHASE315J.mayCreateUsers,false);
});
test('reject malformed evidence and impossible grant counts',()=>{
 for(const item of [null,[],{}, {...baseline(),policies:-1},
  {...baseline(),authenticated_schema_usage:'false'},
  {...baseline(),rls_predicates:'passed'},
  {...baseline(),authenticated_column_grant_rows:NaN}]){
  assert.throws(()=>assessCutoverSnapshot(item),/Invalid catalog snapshot/);
 }
 const forged={...baseline(),canActivate:true,ownerApproved:true,
  signedUsersPassed:true,directRestDenied:true,providerValidated:true};
 assert.equal(assessCutoverSnapshot(forged).canActivate,false);
 assert.equal(assessCutoverSnapshot(forged).dashboardDataApiVerified,false);
});
