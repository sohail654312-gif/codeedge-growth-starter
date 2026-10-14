/**
 * Phase 3.15B — diagnostic, read-only Supabase staging readiness report.
 * This is intentionally NOT an activation gate or approval token. Even when
 * every database check passes, provider, direct API and signed-session
 * evidence MUST be independently verified before hosted activation.
 */
const FLAGS=Object.freeze([
 'checker_login','checker_auth_schema','checker_full_sessions_select',
 'checker_full_users_select','checker_can_set_reader','runtime_can_set_reader'
]);
const COUNTS=Object.freeze([
 'checker_required_auth_columns','privileged_legacy_paths',
 'policy_count','rls_table_count'
]);
function rowInvalid(message='Untrusted or incomplete security snapshot.'){
 throw Error(message);
}
export const PHASE315B_BOUNDARY=Object.freeze({
 version:'codeedge.phase315b.readiness.v1',
 mode:'read_only_security_diagnostic',
 canActivate:false,mayApplyGrants:false,mayDeploy:false,
 mayApproveHosted:false,mayAcceptExternalClaims:false
});
export function assessHostedAuthReadiness(snapshot){
 if(!snapshot || typeof snapshot!=='object'||Array.isArray(snapshot))rowInvalid();
 for(const key of FLAGS)if(typeof snapshot[key]!=='boolean')rowInvalid();
 for(const key of COUNTS){
  if(!Number.isSafeInteger(snapshot[key]) || snapshot[key]<0)rowInvalid();
 }
 if(snapshot.pgrst_exposed_schemas_guc!==null &&
    (typeof snapshot.pgrst_exposed_schemas_guc!=='string' ||
      snapshot.pgrst_exposed_schemas_guc.length>1024))rowInvalid();
 // No acceptance flags supplied by a caller can make this tool authorize a
 // hosted migration, even after its synthetic test fixture is all-green.
 const checks=[
  ['checker_has_login',snapshot.checker_login,
   'Dedicated checker LOGIN remains disabled. Never enable without approval and a private credential delivery plan.'],
  ['checker_has_auth_schema_usage',snapshot.checker_auth_schema,
   'Managed Auth schema access is missing or must be independently confirmed as supported.'],
  ['exact_six_auth_columns',snapshot.checker_required_auth_columns===6,
   'Expected six narrow Auth column SELECT grants; never grant full-table access.'],
  ['no_auth_sessions_table_select',!snapshot.checker_full_sessions_select,
   'Checker has forbidden whole-table SELECT on auth.sessions.'],
  ['no_auth_users_table_select',!snapshot.checker_full_users_select,
   'Checker has forbidden whole-table SELECT on auth.users.'],
  ['no_checker_legacy_role_switch',!snapshot.checker_can_set_reader,
   'Session checker must not SET ROLE into the legacy reader.'],
  ['no_runtime_legacy_role_switch',!snapshot.runtime_can_set_reader,
   'Old runtime can still SET ROLE growth_starter_reader.'],
  ['no_legacy_privileged_functions',snapshot.privileged_legacy_paths===0,
   'Old reader still has privileged SECURITY DEFINER executable paths.'],
  ['seven_rls_tables',snapshot.rls_table_count===7,
   'Unexpected number of tenant RLS tables.'],
  ['three_reviewed_policies',snapshot.policy_count===3,
   'RLS policy count drift; exact policy predicates also require independent inspection.']
 ].map(([id,passes,reason])=>Object.freeze({
   id,verdict:passes?'pass':'block',...(passes?{}:{reason})
 }));
 const blockers=checks.filter(c=>c.verdict==='block').map(c=>c.id);
 const externalEvidence=Object.freeze([
  'written_managed_auth_role_compatibility_or_supported_alternative',
  'effective_data_api_exposed_schemas_and_direct_rest_denial',
  'provider_issued_original_jwt_current_and_revoked_sessions',
  'independent_database_tenant_and_role_boundary_verification',
  'separate_owner_permission_and_independent_security_signoff'
 ]);
 const exposure=snapshot.pgrst_exposed_schemas_guc;
 return Object.freeze({
  version:PHASE315B_BOUNDARY.version,
  classification:blockers.length?'blocked':'awaiting_independent_hosted_evidence',
  mayActivate:false,
  checks:Object.freeze(checks),
  blockers:Object.freeze(blockers),
  dataApi:Object.freeze({
   observedDatabaseGuc:exposure,
   verifiedFromDashboard:false,
   interpretation:'Database-local GUC does not establish effective hosted Data API exposure.'
  }),
  outstandingExternalEvidence:externalEvidence,
  fallback:'If managed Auth access is unsupported, design a private Codeedge session authority with explicitly narrower provider-logout guarantees.'
 });
}
