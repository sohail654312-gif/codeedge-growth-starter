/** Independent read-only Growth Starter tenant-boundary evidence evaluator.
 * No PostgreSQL connection, secrets, auth, network or write capabilities.
 * This flags catalog hazards; it NEVER authorizes a hosted release.
 */
export const TENANT_QA_EXPECTED_TABLES=Object.freeze([
 'audit_events','invitations','media','media_delete_outbox',
 'memberships','work_requests','workspaces'
]);
const POLICY_NAMES=Object.freeze([
 'gs32_membership_self_read',
 'gs32_active_workspace_requests_read',
 'gs32_active_workspace_read'
]);
const LEGACY_NAMES=Object.freeze([
 'staging_list_requests','staging_list_workspaces','staging_session_active'
]);
const invalid=()=>{throw Error('Untrusted or incomplete tenant catalog evidence.');};
const validObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function allDistinct(items,label) {
 if(items.some(x=>typeof x!=='string'||!x))invalid();
 if(new Set(items).size!==items.length)invalid();
 return items;
}
function sortedSame(actual,expected){
 return actual.length===expected.length &&
 [...actual].sort().every((s,i)=>s===[...expected].sort()[i]);
}
export function assessIndependentTenantCatalog(snapshot){
 if(!validObject(snapshot)||
  !Array.isArray(snapshot.tables)||!Array.isArray(snapshot.policies)||
  !Array.isArray(snapshot.legacyFunctions)||
  typeof snapshot.authenticatedSchemaUsage!=='boolean'||
  !Number.isSafeInteger(snapshot.authenticatedColumnSelectCount)||
  snapshot.authenticatedColumnSelectCount<0||
  typeof snapshot.runtimeCanSetLegacyReader!=='boolean'||
  typeof snapshot.privateSchemaPresent!=='boolean'||
  typeof snapshot.dashboardExposureVerified!=='boolean'||
  typeof snapshot.signedHostedTenantTestsPassed!=='boolean')invalid();

 const problems=[];
 const tableNames=allDistinct(snapshot.tables.map(t=>t?.name),'table');
 if(!sortedSame(tableNames,TENANT_QA_EXPECTED_TABLES))problems.push('unexpected_or_missing_table');
 for(const t of snapshot.tables){
  if(typeof t.rls!=='boolean'||typeof t.forceRls!=='boolean')invalid();
  if(!t.rls)problems.push('rls_disabled:'+t.name);
  // A postgres-owned SECURITY DEFINER can bypass non-FORCE RLS.
  if(!t.forceRls)problems.push('owner_bypass_requires_review:'+t.name);
 }
 const policyNames=allDistinct(snapshot.policies.map(p=>p?.name),'policy');
 if(!sortedSame(policyNames,POLICY_NAMES))problems.push('unexpected_or_missing_policy');
 for(const p of snapshot.policies){
  if(typeof p.table!=='string'||typeof p.cmd!=='string'||typeof p.roles!=='string'||
     typeof p.qual!=='string')invalid();
  if(!TENANT_QA_EXPECTED_TABLES.includes(p.table)||p.cmd!=='SELECT'||
     p.roles!=='{authenticated}'||!p.qual.includes('auth.uid()'))
   problems.push('policy_needs_independent_review:'+p.name);
 }
 const functionNames=allDistinct(snapshot.legacyFunctions.map(f=>f?.name),'function');
 if(functionNames.some(name=>!LEGACY_NAMES.includes(name)))
  problems.push('unexpected_growth_function');
 for(const f of snapshot.legacyFunctions){
  if(typeof f.securityDefiner!=='boolean'||typeof f.owner!=='string'||
   typeof f.readerExecute!=='boolean'||typeof f.authenticatedExecute!=='boolean'||
   typeof f.anonExecute!=='boolean')invalid();
  if(f.securityDefiner&&f.readerExecute)
   problems.push('legacy_privileged_function_access:'+f.name);
  if(f.anonExecute||f.authenticatedExecute)
   problems.push('browser_callable_function:'+f.name);
 }
 if(snapshot.authenticatedSchemaUsage&&snapshot.authenticatedColumnSelectCount>0)
  problems.push('authenticated_direct_column_read_grants');
 if(snapshot.runtimeCanSetLegacyReader)problems.push('runtime_can_assume_legacy_reader');
 if(!snapshot.privateSchemaPresent)problems.push('private_session_schema_not_installed');
 if(!snapshot.dashboardExposureVerified)problems.push('dashboard_exposure_not_part_of_sql_proof');
 if(!snapshot.signedHostedTenantTestsPassed)problems.push('no_live_signed_cross_tenant_acceptance');
 return Object.freeze({
  classification:problems.length?'blocked_or_review_required':'catalog_review_only',
  findings:Object.freeze([...new Set(problems)]),
  tableCount:snapshot.tables.length,
  policyCount:snapshot.policies.length,
  legacyFunctionCount:snapshot.legacyFunctions.length,
  authenticatedColumnSelectCount:snapshot.authenticatedColumnSelectCount,
  canDeploy:false,canAlterHostedPermissions:false,tenantIsolationCertified:false,
  note:'Catalog metadata and synthetic tests never certify real hosted tenant isolation or grant release permission.'
 });
}
