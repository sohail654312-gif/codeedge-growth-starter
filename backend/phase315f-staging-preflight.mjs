/**
 * Phase 3.15F — diagnostic-only fictional-user staging preparation.
 *
 * This module never authorizes deployment or changes a project.
 * Snapshot fields come from a catalog-only SELECT, not login sessions.
 * Review evidence cannot be supplied by a caller to turn this into "ready".
 */
const BOOLS=Object.freeze([
 'anon_growth_schema_access','authenticated_growth_schema_access',
 'service_growth_schema_access','anon_can_select_work_requests',
 'auth_role_full_work_requests_select','auth_role_title_select',
 'checker_auth_schema_access','checker_can_login',
 'runtime_can_set_legacy_reader','production_private_session_schema_exists'
]);
const COUNTS=Object.freeze([
 'application_table_count','rls_enabled_table_count',
 'rls_policy_count','privileged_legacy_function_count'
]);
export const FICTIONAL_STAGING_PACKAGE=Object.freeze({
 version:'growth-starter.phase315f.staging-preparation.v1',
 projectRef:'dbppeymhsemvghbvuvof',
 branch:'engineering/phase2-core-security',
 stage:'read_only_preparation',
 allowedFictionalUsers:3,
 sourceOnly:true,canDeploy:false,canCreateUsers:false,canGrantRoles:false,
 canApplyMigrations:false,canAlterDataApi:false,canMerge:false,
 requiredExternalEvidence:Object.freeze([
  'independent_review_and_explicit_owner_approval_for_named_changes',
  'effective_dashboard_data_api_exposed_schemas_and_real_negative_probes',
  'server_side_pkce_sdk_supported_exchange_and_fresh_login_test',
  'private_db_principal_role_memberships_rls_privilege_and_locking_tests',
  'codeedge_logout_and_independent_supabase_revocation_contract',
  'rollback_snapshot_and_proven_fictional_account_restore',
  'real_fictional_multiuser_A_B_C_hosted_acceptance',
  'independent_security_signoff_and_cost_quota_check'
 ])
});
function invalid(){throw Error('Invalid read-only staging catalog snapshot.');}
export function assessFictionalStagingPreflight(snapshot){
 if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot))invalid();
 if(!/^17\./.test(snapshot.postgres_version)||snapshot.postgres_version.length>40)invalid();
 for(const k of BOOLS)if(typeof snapshot[k]!=='boolean')invalid();
 for(const k of COUNTS)
  if(!Number.isSafeInteger(snapshot[k])||snapshot[k]<0)invalid();
 if(snapshot.local_data_api_exposure_guc!==null&&
   (typeof snapshot.local_data_api_exposure_guc!=='string'||
    snapshot.local_data_api_exposure_guc.length>512))invalid();
 const checks=[
  ['base_seven_tables',snapshot.application_table_count===7],
  ['all_tables_rls_enabled',snapshot.rls_enabled_table_count===7],
  ['policy_count_needs_predicate_review',snapshot.rls_policy_count===3],
  ['anonymous_growth_schema_denied',!snapshot.anon_growth_schema_access],
  ['service_growth_schema_denied',!snapshot.service_growth_schema_access],
  ['anonymous_requests_denied',!snapshot.anon_can_select_work_requests],
  ['no_direct_authenticated_schema_access',!snapshot.authenticated_growth_schema_access],
  ['no_direct_authenticated_full_select',!snapshot.auth_role_full_work_requests_select],
  ['no_direct_authenticated_column_select',!snapshot.auth_role_title_select],
  ['no_legacy_role_switch',!snapshot.runtime_can_set_legacy_reader],
  ['no_legacy_privileged_functions',snapshot.privileged_legacy_function_count===0],
  ['private_sessions_not_deployed_yet',!snapshot.production_private_session_schema_exists]
 ].map(([name,passes])=>Object.freeze({name,passes}));
 const failed=checks.filter(c=>!c.passes).map(c=>c.name);
 return Object.freeze({
  version:FICTIONAL_STAGING_PACKAGE.version,
  classification:failed.length?'blocked':'requires_external_review_and_owner_approval',
  canDeploy:false,canModifySupabase:false,canCreateFictionalUsers:false,
  checks:Object.freeze(checks),
  failed:Object.freeze(failed),
  currentAuthSchemaChecker:Object.freeze({
   login:snapshot.checker_can_login,schemaAccess:snapshot.checker_auth_schema_access,
   // Fallback does not depend on enabling managed auth schema privileges.
   dependencyRequiredForFallback:false
  }),
  dataApi:Object.freeze({
   localGuc:snapshot.local_data_api_exposure_guc,
   dashboardExposureVerified:false,directRestNegativeTestPassed:false
  }),
  outstandingExternalEvidence:FICTIONAL_STAGING_PACKAGE.requiredExternalEvidence
 });
}
