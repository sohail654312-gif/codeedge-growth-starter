/**
 * Phase 3.15J readiness is ALWAYS fail closed.
 * SQL catalog snapshots cannot approve privileged hosted changes.
 * Provider-issued users, dashboard exposure and migration approval are
 * independent observations; user-supplied flags cannot override this gate.
 */
export const PHASE315J=Object.freeze({
 project:'dbppeymhsemvghbvuvof',
 repository:'sohail654312-gif/codeedge-growth-starter',
 branch:'engineering/phase2-core-security',
 scope:'source_only_review',
 mayDeploy:false,mayAlterGrants:false,mayCreateUsers:false,mayMerge:false,
 needs:Object.freeze([
  'verified replacement gateway with original Supabase PKCE login',
  'independent security review of private function owners and RLS',
  'dashboard Data API exposed schemas plus REST and GraphQL negative probes',
  'signed fictional A/B/C login and revocation test in approved staging',
  'exact reviewed transaction, prechange ACL snapshots and tested secure rollback',
  'owner approval for enumerated hosted SQL, private role credentials and users',
  'independent Supabase administrator revocation contract decision'
 ])
});
const B=['authenticated_schema_usage','authenticated_workspace_column',
 'authenticated_membership_column','authenticated_request_column',
 'runtime_can_set_old_reader'];
const N=['rls_tables','policies','old_privileged_functions',
 'authenticated_column_grant_rows'];
export function assessCutoverSnapshot(row){
 if(!row||typeof row!=='object'||Array.isArray(row))throw Error('Invalid catalog snapshot');
 for(const key of B)if(typeof row[key]!=='boolean')throw Error('Invalid catalog snapshot');
 for(const key of N)if(!Number.isSafeInteger(row[key])||row[key]<0)
  throw Error('Invalid catalog snapshot');
 if(row.local_postgrest_schema_setting!==null&&
   (typeof row.local_postgrest_schema_setting!=='string'||
    row.local_postgrest_schema_setting.length>1024))
  throw Error('Invalid catalog snapshot');
 if(!Array.isArray(row.rls_predicates))throw Error('Invalid catalog snapshot');
 const blocked=[
  ...B.filter(k=>row[k]),
  ...(row.old_privileged_functions>0?['old_privileged_functions']:[]),
  ...(row.authenticated_column_grant_rows>0?['authenticated_column_grant_rows']:[]),
  ...(row.rls_tables!==7?['rls_table_count_drift']:[]),
  ...(row.policies!==3?['policy_count_drift']:[])
 ];
 return Object.freeze({
  classification:blocked.length?'blocked':'awaits_independent_hosted_evidence',
  blockers:Object.freeze(blocked),
  canActivate:false,canModifyHosted:false,
  dashboardDataApiVerified:false,
  directRestDenied:false,
  // The application requests policy is mediated by workspace RLS,
  // NOT proof that it checks Codeedge-managed session revocation.
  rlsIsIndependentOfCodeedgeLogout:true,
  requiredEvidence:PHASE315J.needs
 });
}
