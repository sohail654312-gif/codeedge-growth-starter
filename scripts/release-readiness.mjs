import {execFileSync} from 'node:child_process';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {buildReviewBundle} from './phase315p-migration-bundle.mjs';
export const REPOSITORY='sohail654312-gif/codeedge-growth-starter';
export const BRANCH='engineering/phase2-core-security';
export const WORKFLOWS=['source-guards.yml','postgres-security.yml','seo-ui-check.yml','staging-supply-chain.yml'];
export function evaluateRelease({commitSha,branch,clean,remoteHead,runs=[],retrievalError=null}={}){
 const blockers=[];
 if(!/^[a-f0-9]{40}$/.test(commitSha||''))blockers.push('Invalid commit identity.');
 if(branch!==BRANCH)blockers.push('Unauthorized source branch.');
 if(clean!==true)blockers.push('Tracked source differs from evaluated commit.');
 if(remoteHead!==commitSha)blockers.push('Remote branch does not match evaluated commit.');
 if(retrievalError)blockers.push('Authenticated HTTPS CI evidence retrieval unavailable.');
 const verified=WORKFLOWS.map(file=>{
  const candidates=runs.filter(r=>r.path==='.github/workflows/'+file&&r.head_sha===commitSha&&r.head_branch===BRANCH&&
   r.repository?.full_name===REPOSITORY&&r.event==='push'&&Number.isSafeInteger(r.id)&&
   r.html_url===`https://github.com/${REPOSITORY}/actions/runs/${r.id}`);
  const r=candidates.sort((a,b)=>b.id-a.id)[0];
  if(!r||r.status!=='completed'||r.conclusion!=='success')blockers.push('Missing successful current-SHA workflow: '+file);
  return {workflow:file,status:r?.status||'missing',conclusion:r?.conclusion||null,url:r?.html_url||null,runId:r?.id||null};
 });
 const hostedBlockers=['Supported exact provider-session/account-policy authority is unverified.',
 'Authorized host and canonical HTTPS hostname are missing.',
 'Restricted credentials, reviewed migrations and legacy cutover have not been activated.',
 'Actual Data API exposure and signed REST/GraphQL bypass probes are unverified.',
 'Actual PKCE A/B/C login, revocation, media, failure and recovery acceptance are unverified.'];
 return {source:{verdict:blockers.length?'BLOCKED':'SOURCE_READY',blockers,workflows:verified},
 hostedStaging:{verdict:'BLOCKED',blockers:hostedBlockers},production:{verdict:'BLOCKED',blockers:[...hostedBlockers,
 'Independent reviewer approval, owner release approval and live operational acceptance are missing.']},finalVerdict:'BLOCKED'};
}
async function github(path){
 const res=await fetch('https://api.github.com/repos/'+REPOSITORY+path,{redirect:'error',headers:{accept:'application/vnd.github+json','user-agent':'growth-starter-release-verifier'},signal:AbortSignal.timeout(10000)});
 if(!res.ok)throw Error('GitHub evidence unavailable');return res.json();
}
export async function generateRelease(root=process.cwd()){
 const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
 const commitSha=git(['rev-parse','HEAD']),branch=git(['branch','--show-current']);
 // Generated artifacts are excluded from dirty calculation; code/docs changes
 // still block readiness. This avoids claiming an artifact describes itself.
 const tracked=execFileSync('git',['status','--porcelain','--untracked-files=all'],{cwd:root,encoding:'utf8'}).split(/\r?\n/).filter(Boolean).filter(line=>line.slice(3)!=='artifacts/release-readiness.json');
 let runs=[],remoteHead=null,retrievalError=null;
 try{
  const [checks,remote]=await Promise.all([github('/actions/runs?head_sha='+commitSha+'&per_page=100'),github('/branches/'+encodeURIComponent(BRANCH))]);
  runs=checks.workflow_runs;remoteHead=remote.commit.sha;
 }catch{retrievalError='GitHub HTTPS lookup failed.';}
 const gate=evaluateRelease({commitSha,branch,clean:tracked.length===0,remoteHead,runs,retrievalError});
 const bundle=buildReviewBundle(root),inventory=[];
 for(const dir of ['db/migrations','db/drafts'])for(const name of readdirSync(resolve(root,dir)).filter(n=>n.endsWith('.sql')).sort()){
  const path=dir+'/'+name;inventory.push({path,sha256:createHash('sha256').update(readFileSync(resolve(root,path),'utf8').replaceAll('\r\n','\n')).digest('hex'),reviewOnly:dir==='db/drafts',hashEncoding:'UTF-8 with LF newlines'});
 }
 return {schemaVersion:1,generatedAt:new Date().toISOString(),repository:REPOSITORY,branch,commitSha,
 evidenceSource:'Fetched directly from GitHub REST over HTTPS; no manual CI attestation accepted.',
 tests:{core:'source-guards.yml',disposablePostgres17:'postgres-security.yml',uiAndSeo:'seo-ui-check.yml',buildAndSupplyChain:'staging-supply-chain.yml'},
 database:{requiredMajor:17,hostedVersionLastReadOnly:'17.11',hostedMigrationHistory:bundle.manifest.hostedMigrationHistory,inventory,dependencyOrder:bundle.inventory},
 securityChecks:{exactSessionBoundary:'fail_closed_source_tested',hostedProviderVerified:false,writerCatalog:'effective_role/function/RLS_verifier_in_PG17',legacyBypass:'hosted_cutover_pending'},
 unsupportedAssumptions:['A signed JWT or getUser/getClaims alone proves immediate exact-session revocation.',
 'A Codeedge logout proves Supabase global/admin logout synchronization.','Disposable timings prove production latency.'],
 providerDependencies:['SU-502526','SU-503988','Written supported least-privilege exact-session and account-policy contract'],
 hostingDependencies:['Approved provider','Canonical HTTPS hostname','Trusted ingress','Secure credentials and authority module'],
 requiredApprovals:['Independent database/authentication review','Exact staging grant/migration/cutover approval','Controlled fictional hosted accounts','Deployment approval','Production release approval'],
 rollback:{strategy:'close_ingress_revoke_private_execute_retain_legacy_deny_all',disposableProofWorkflow:'postgres-security.yml',hostedVerified:false},...gate};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const output=resolve(process.argv[2]||'artifacts/release-readiness.json');
 const evidence=await generateRelease();mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(evidence,null,2)+'\n');
 process.stdout.write(JSON.stringify({source:evidence.source.verdict,hostedStaging:evidence.hostedStaging.verdict,production:evidence.production.verdict})+'\n');
 process.exitCode=evidence.finalVerdict==='BLOCKED'?2:0;
}
