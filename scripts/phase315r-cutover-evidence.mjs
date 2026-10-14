/**
 * Phase 3.15R: evidence-only catalog evaluator.
 * No network/database mutation; input is untrusted and never a deployment approval.
 */
import {readFileSync,statSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

function evaluateCutoverEvidence(snapshot) {
 const isObject=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 const safeCount=v=>Number.isSafeInteger(v)&&v>=0;
 const checks=[];
 const check=(id,level,passed,description,requiredAction)=>{
  checks.push({id,severity:level,status:passed===true?'PASS':'BLOCKED',description,
   requiredAction:passed===true?null:requiredAction});
 };
 const expected=isObject(snapshot)&&snapshot.schemaVersion===1&&
  snapshot.snapshotKind==='growth_starter_privilege_cutover_catalog'&&isObject(snapshot.roles);
 if(!expected){
  check('snapshot_integrity','HIGH',false,'Versioned read-only privilege snapshot is missing or malformed.',
   'Obtain the authorized read-only SQL snapshot from staging; do not fabricate or substitute another database.');
 } else {
  const r=snapshot.roles,proper=(name,login)=>{
   const role=r[name];return isObject(role)&&role.login===login&&role.super===false&&role.bypassRls===false;
  };
  const inert=name=>r[name]===undefined||proper(name,false);
  check('writer_identity','HIGH',proper('gs315p_writer',true),
   'Approved writer must be LOGIN, non-superuser and non-BYPASSRLS.',
   'Approve and provision the separately reviewed restricted writer only after cutover prerequisites.');
  check('writer_owner','HIGH',proper('gs315p_ops_owner',false),
   'Operational function owner must be NOLOGIN, non-superuser and non-BYPASSRLS.',
   'Apply reviewed private owner functions and verify its effective catalog permissions.');
  check('legacy_reader_inert','HIGH',inert('growth_starter_reader')&&inert('growth_starter_runtime'),
   'Historical reader/runtime accounts must be absent or NOLOGIN and non-bypass.',
   'Review old role edges and disable any legacy LOGIN/BYPASSRLS/superuser capability.');
  check('checker_inert','HIGH',proper('growth_starter_session_checker',false)&&snapshot.checkerCanUseAuth===false,
   'Unapproved historical checker must remain NOLOGIN without managed Auth schema USAGE.',
   'Do not activate managed Auth grants without provider support and independent approval.');
  for(const [id,field,description] of [
   ['legacy_definers','legacyDefiners','Legacy actor-argument SECURITY DEFINER functions must not remain.'],
   ['reader_exec','legacyReaderExecutables','Old reader EXECUTE privileges on legacy definers must be gone.'],
   ['browser_exec','legacyAuthenticatedExecutables','Authenticated browser EXECUTE privileges on old definers must be gone.'],
   ['public_exec','legacyPublicExecutables','PUBLIC EXECUTE privileges on old definers must be gone.'],
   ['browser_columns','authenticatedColumnSelects','Historical authenticated column SELECT grants must be gone.'],
   ['browser_tables','authenticatedTableReads','Authenticated direct table SELECT grants must be gone.'],
   ['anon_tables','anonTableReads','Anonymous direct table SELECT grants must be gone.'],
   ['writer_raw_read','writerCanReadRaw','The writer must not have direct table or column SELECT privileges.'],
   ['writer_raw_write','writerCanMutateRaw','The writer must not have direct table or column mutation privileges.'],
   ['private_forced_rls','privateNotForcedRls','Every private table must have FORCE ROW LEVEL SECURITY.']
  ])check(id,'HIGH',snapshot[field]===0,description,
   'Investigate the exact objects and privileges; change only in reviewed, separately approved staging cutover.');
  for(const [id,field,description] of [
   ['old_role_set','oldSetRole','Old runtime must not SET old reader role.'],
   ['authenticated_schema','authenticatedSchemaUsage','Authenticated role must not have Growth Starter schema USAGE.'],
   ['anon_schema','anonSchemaUsage','Anonymous role must not have Growth Starter schema USAGE.'],
   ['anon_private_schema','anonPrivateSchemaUsage','Anonymous role must not have private schema USAGE.'],
   ['authenticated_private_schema','authenticatedPrivateSchemaUsage','Authenticated browser must not have private schema USAGE.'],
   ['writer_auth_usage','writerCanUseAuth','Writer must not have managed Auth schema USAGE.'],
   ['writer_public_create','writerCanCreatePublic','Writer must not CREATE objects in public schema.'],
   ['writer_set_owner','writerCanSetOwner','Writer must not SET operational function owner role.']
  ])check(id,'HIGH',snapshot[field]===false,description,
   'Verify and correct only through an approved, least-privilege cutover and real-login preflight.');
  check('private_tables_exist','HIGH',safeCount(snapshot.privateTableCount)&&snapshot.privateTableCount>0,
   'Reviewed private tables must be installed before new private application activation.',
   'Keep traffic closed pending approved O→K→M→P migration bundle and postflight validation.');
  check('writer_private_usage','HIGH',snapshot.writerCanUsePrivateSchema===true,
   'Restricted writer must have only the approved private schema usage.',
   'Confirm expected fixed-purpose RPC EXECUTE and actual-login preflight; do not grant table access.');
 }
 const blocked=checks.filter(x=>x.status==='BLOCKED');
 const external=[
  'Supported exact original Supabase Auth session and current account/policy authority',
  'Provider answer to tickets SU-502526 / SU-503988 or an explicitly reviewed alternative contract',
  'Independent assessment of private function bodies, role privileges and tested backup restore',
  'Approved hosting, canonical HTTPS origin, secrets and actual restricted-login connection',
  'Dashboard exposed schemas and signed REST/GraphQL negative bypass tests',
  'Real authorized fictional PKCE identities, cross-tenant and logout/admin revocation tests',
  'Owner approval of exact staging change set and independent production release acceptance',
 ].map(description=>({description,status:'UNVERIFIED'}));
 return {schemaVersion:1,phase:'3.15R',reportKind:'unattested_privilege_catalog_only',
  catalog:{status:expected?(blocked.length?'BLOCKED':'MATCHES_EXPECTED_VALUES_UNATTESTED'):'BLOCKED',
   passedChecks:checks.length-blocked.length,blockedChecks:blocked.map(x=>x.id),checks},
  external:{status:'UNVERIFIED',gates:external},
  hostedStaging:'BLOCKED',production:'BLOCKED',finalVerdict:'BLOCKED',
  warning:'Input snapshot is operator-provided, not independently attested. Catalog values cannot prove Dashboard exposure, provider revocation, grant upgrade stability or live security.'};
}

export {evaluateCutoverEvidence};

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [input,output]=process.argv.slice(2);
 if(!input||!output){
  process.stderr.write('Usage: node scripts/phase315r-cutover-evidence.mjs <catalog.json> <new-report.json>\n');
  process.exitCode=2;
 } else {
  let snapshot;
  try{
   if(statSync(input).size>131072)throw Error('oversized');
   snapshot=JSON.parse(readFileSync(input,'utf8'));
  }catch{snapshot=null;}
  const report=evaluateCutoverEvidence(snapshot);
  writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
  process.stdout.write(JSON.stringify({catalog:report.catalog.status,passed:report.catalog.passedChecks,
   blocked:report.catalog.blockedChecks.length,hostedStaging:report.hostedStaging,production:report.production})+'\n');
  // A catalog never verifies a live provider or authorizes launch.
  process.exitCode=2;
 }
}
