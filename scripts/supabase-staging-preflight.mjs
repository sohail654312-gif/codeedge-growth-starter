/**
 * Phase 3.15Q: offline, fail-closed evaluation of a read-only PostgreSQL
 * catalog snapshot. This is NOT authentication of the snapshot or approval to
 * activate hosted resources. No network, SQL execution, or secret access.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export const STAGING_BASELINE = Object.freeze([
 '20261008141834','20261008141846','20261008143234',
 '20261008145300','20261008145917','20261010063818','20261010063911',
]);
const EXPECTED_ROLES = Object.freeze(['gs315m_issuer','gs315k_gateway','gs315p_writer']);
const EXTERNAL_GATES = Object.freeze([
 ['provider_exact_session','Written supported exact original Supabase session/account/policy authority and real revocation behavior'],
 ['host_and_ingress','Approved host, canonical HTTPS origin, trusted ingress and secret injection'],
 ['dashboard_api_exposure','Actual Dashboard Data API/GraphQL exposed schemas independently inspected'],
 ['signed_rest_graphql','Signed REST/GraphQL negative bypass probes, including after logout'],
 ['real_auth_acceptance','Real controlled PKCE users, tenant isolation and provider logout/admin/policy acceptance'],
 ['backup_and_cutover','Approved bundle hashes, isolated backup restoration and legacy replacement cutover'],
 ['independent_approval','Independent reviewer and owner deployment/release approvals'],
]);

const isObject=x=>x!==null && typeof x==='object' && !Array.isArray(x);
const isNonnegInt=x=>Number.isSafeInteger(x)&&x>=0;
const sameMigrations=x=>Array.isArray(x)&&x.length===STAGING_BASELINE.length&&
 x.every((v,i)=>typeof v==='string'&&v===STAGING_BASELINE[i]);

export function evaluateStagingPreflight(snapshot) {
 const checks=[];
 const check=(id,ok,summary,nextAction)=>checks.push({id,status:ok===true?'PASS':'BLOCKED',summary,nextAction:ok===true?null:nextAction});
 const valid=isObject(snapshot)&&snapshot.schemaVersion===1&&
  snapshot.snapshotKind==='growth_starter_staging_catalog';
 if(!valid){
  check('valid_snapshot',false,'Missing or invalid versioned catalog snapshot.',
   'Run the reviewed read-only catalog SQL against the authorized staging project; inspect its origin.');
 } else {
  check('postgres17',snapshot.databaseMajor===17,'PostgreSQL major version must be 17.',
   'Reconcile PostgreSQL version before any reviewed staging migration.');
  check('migration_baseline',sameMigrations(snapshot.migrationVersions),
   'Exactly seven known hosted migration IDs are required for this baseline.',
   'Investigate migration drift; do not rewrite hosted migration history.');
  check('private_schema',snapshot.privateSchemaExists===true,
   'The reviewed growth_starter_private schema must exist.',
   'Obtain independent review and explicit owner approval before applying the private bundle.');
  for(const role of EXPECTED_ROLES){
   const evidence=isObject(snapshot.roles)?snapshot.roles[role]:null;
   check('role_'+role,isObject(evidence)&&evidence.exists===true&&evidence.canLogin===true,
    'Restricted hosted runtime login '+role+' must be installed and approved.',
    'Do not enable this login or issue credentials without separately approved vault and privilege preflight.');
  }
  const checker=isObject(snapshot.roles)?snapshot.roles.growth_starter_session_checker:null;
  check('checker_stays_disabled',isObject(checker)&&checker.exists===true&&checker.canLogin===false,
   'The unapproved historical session-checker login must remain disabled.',
   'Stop and review unexpected checker LOGIN access; do not infer provider authorization.');
  check('managed_auth_not_granted',snapshot.checkerAuthSchemaUsage===false,
   'No unapproved managed auth schema USAGE for the historical checker.',
   'Stop and verify any managed Auth grant against written provider guidance.');
  check('legacy_definers_retired',snapshot.legacyDefinerCount===0,
   'Old actor-argument SECURITY DEFINER functions must be retired.',
   'Reconcile dependent callers and perform the separately approved legacy cutover.');
  check('legacy_reader_exec_retired',snapshot.legacyReaderCallableCount===0,
   'The old reader must not be able to execute actor-argument definers.',
   'Revoke exact legacy EXECUTE after replacement and independently test denial.');
  check('legacy_set_role_retired',snapshot.runtimeCanSetOldReader===false,
   'The old runtime must not be able to SET the old reader role.',
   'Remove the old role edge only during the reviewed cutover.');
  check('browser_column_grants_retired',snapshot.authenticatedColumnGrants===0,
   'Historical authenticated column-grant rows must be absent.',
   'Review exact historical column grants and revoke only in an approved cutover.');
  check('browser_schema_usage_retired',snapshot.authenticatedSchemaUsage===false,
   'The browser authenticated role should lack Growth Starter private-schema access.',
   'Verify actual exposed schemas and revoke only in an approved cutover.');
  check('growth_rls',snapshot.growthTables===7&&snapshot.growthTablesWithoutRls===0,
   'All seven existing Growth Starter tables must retain RLS.',
   'Investigate missing tables or disabled RLS; never add public allow policies to silence INFO notices.');
  check('private_rls',isNonnegInt(snapshot.privateTables)&&snapshot.privateTables>0&&
    snapshot.privateTablesWithoutRls===0,
   'The new private tables must exist and have RLS enabled.',
   'Review the private schema, forced-RLS policies and exact runtime identities.');
 }
 const externalChecks=EXTERNAL_GATES.map(([id,summary])=>({id,status:'UNVERIFIED',summary}));
 const blockers=checks.filter(x=>x.status==='BLOCKED').map(x=>x.id);
 return {
  schemaVersion:1,tool:'growth_starter_staging_read_only_preflight',
  evidenceLimit:'Untrusted operator-supplied catalog JSON; cannot attest project identity, actual API exposure, provider behavior or approval.',
  catalog:{verdict:blockers.length?'BLOCKED':'CATALOG_CONSISTENT_UNATTESTED',checks,blockedChecks:blockers},
  external:{verdict:'UNVERIFIED',checks:externalChecks},
  hostedStaging:{verdict:'BLOCKED',reason:'Missing provider, Dashboard, real-user, security-cutover and independent approval evidence.'},
  production:{verdict:'BLOCKED',reason:'Hosted acceptance and owner production release approval are not established.'},
  finalVerdict:'BLOCKED',
 };
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [inputPath,outputPath]=process.argv.slice(2);
 if(!inputPath||!outputPath){
  process.stderr.write('Usage: node scripts/supabase-staging-preflight.mjs <read-only-snapshot.json> <report.json>\n');
  process.exitCode=2;
 }else{
  let snapshot=null;
  try{
   const fs=await import('node:fs');
   if(fs.statSync(inputPath).size>131072)throw new Error('oversize');
   snapshot=JSON.parse(readFileSync(inputPath,'utf8'));
  }catch{
   // Fail closed; do not disclose the input, contents, or exception.
  }
  const report=evaluateStagingPreflight(snapshot);
  writeFileSync(outputPath,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
  process.stdout.write(JSON.stringify({catalog:report.catalog.verdict,hostedStaging:report.hostedStaging.verdict,production:report.production.verdict,blockedChecks:report.catalog.blockedChecks.length})+'\n');
  process.exitCode=2;
 }
}
