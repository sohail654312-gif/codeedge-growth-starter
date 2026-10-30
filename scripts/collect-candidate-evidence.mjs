import {mkdirSync,writeFileSync,appendFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {generateRelease,evaluateRelease,REPOSITORY,CANDIDATE_BRANCH} from './release-readiness.mjs';

// GitHub-hosted evidence only. No credentials, database connections or deployment.
const commitSha=process.env.GITHUB_SHA,branch=process.env.GITHUB_REF_NAME;
if(process.env.GITHUB_ACTIONS!=='true'||process.env.GITHUB_REPOSITORY!==REPOSITORY||
 branch!==CANDIDATE_BRANCH||!/^[a-f0-9]{40}$/.test(commitSha||'')||
 !process.env.GITHUB_TOKEN||!process.env.RUNNER_TEMP)
 throw Error('Candidate evidence requires its exact GitHub Actions context.');
const output=resolve(process.env.RUNNER_TEMP,'growth-starter-candidate-evidence.json');
const deadline=Date.now()+15*60*1000;
let retrievalErrors=0,waitError=null;
while(Date.now()<deadline){
 try{
  const response=await fetch('https://api.github.com/repos/'+REPOSITORY+'/actions/runs?head_sha='+commitSha+'&per_page=100',{
   redirect:'error',signal:AbortSignal.timeout(10000),
   headers:{accept:'application/vnd.github+json',authorization:'Bearer '+process.env.GITHUB_TOKEN,
    'user-agent':'growth-starter-candidate-evidence'}});
  if(!response.ok)throw Error('GitHub workflow evidence unavailable.');
  const payload=await response.json();
  if(!Array.isArray(payload.workflow_runs))throw Error('Invalid workflow evidence.');
  retrievalErrors=0;
  const current=evaluateRelease({commitSha,branch,clean:true,remoteHead:commitSha,runs:payload.workflow_runs});
  if(current.source.workflows.every(w=>w.status==='completed'))break;
 }catch{
  if(++retrievalErrors>=3){waitError='Repeated GitHub evidence retrieval failure.';break;}
 }
 await new Promise(r=>setTimeout(r,15000));
}
if(Date.now()>=deadline)waitError='Timed out waiting for complete candidate checks.';
const report=await generateRelease();
report.collection={execution:'GitHub-hosted runner',workflowRunId:process.env.GITHUB_RUN_ID,
 workflowUrl:'https://github.com/'+REPOSITORY+'/actions/runs/'+process.env.GITHUB_RUN_ID,
 waitError,testsRerunOnLocalComputer:false};
if(waitError){
 report.source.verdict='BLOCKED';
 report.source.blockers.push(waitError);
}
mkdirSync(dirname(output),{recursive:true});
writeFileSync(output,JSON.stringify(report,null,2)+'\n');
const summary=[
 '## Growth Starter candidate evidence',
 '',
 'Commit: `'+report.commitSha+'`',
 '',
 '| Gate | Verdict |','| --- | --- |',
 '| Source candidate | '+report.source.verdict+' |',
 '| Hosted staging | '+report.hostedStaging.verdict+' |',
 '| Production | '+report.production.verdict+' |',
 '',
 ...report.source.workflows.map(w=>'- ['+w.workflow+']('+w.url+'): '+w.status+' / '+w.conclusion),
 '',
 ...report.source.blockers.map(b=>'- Source blocker: '+b),
 '',
 'Database metadata in this report is a historical baseline, not a current hosted probe.',
 'No deployment, hosted migration, provider account or production change was performed.',
 ''
].join('\n');
if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);
console.log(JSON.stringify({commitSha:report.commitSha,source:report.source.verdict,
 hostedStaging:report.hostedStaging.verdict,production:report.production.verdict}));
process.exitCode=report.source.verdict==='SOURCE_READY'?0:1;
