import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateRelease,WORKFLOWS,REPOSITORY,BRANCH,CANDIDATE_BRANCH} from '../scripts/release-readiness.mjs';
const sha='a'.repeat(40);
const workflows=(branch=CANDIDATE_BRANCH)=>WORKFLOWS.map((file,i)=>({
 path:'.github/workflows/'+file,head_sha:sha,head_branch:branch,
 repository:{full_name:REPOSITORY},event:'push',id:i+100,
 html_url:'https://github.com/'+REPOSITORY+'/actions/runs/'+(i+100),
 status:'completed',conclusion:'success'
}));
const candidate=(changes={})=>evaluateRelease({
 commitSha:sha,branch:CANDIDATE_BRANCH,clean:true,remoteHead:sha,runs:workflows(),...changes
});
test('candidate requires all four successful workflows at the same candidate commit',()=>{
 const result=candidate();
 assert.equal(result.source.verdict,'SOURCE_READY');
 assert.equal(result.hostedStaging.verdict,'BLOCKED');
 assert.equal(result.production.verdict,'BLOCKED');
 assert.equal(result.finalVerdict,'BLOCKED');
 for(const file of WORKFLOWS){
  assert.equal(candidate({runs:workflows().filter(r=>r.path!=='.github/workflows/'+file)}).source.verdict,'BLOCKED');
 }
});
test('older engineering branch checks cannot certify the candidate, even at the same SHA',()=>{
 assert.equal(candidate({runs:workflows(BRANCH)}).source.verdict,'BLOCKED');
 assert.equal(candidate({runs:workflows().map(r=>({...r,head_sha:'b'.repeat(40)}))}).source.verdict,'BLOCKED');
 assert.equal(candidate({runs:workflows().map(r=>({...r,event:'pull_request'}))}).source.verdict,'BLOCKED');
 assert.equal(candidate({branch:'release/unreviewed-candidate'}).source.verdict,'BLOCKED');
});
test('a newer pending or failed rerun supersedes an older successful run',()=>{
 const older=workflows(),failed={...older[0],id:500,html_url:'https://github.com/'+REPOSITORY+'/actions/runs/500',conclusion:'failure'};
 assert.equal(candidate({runs:[...older,failed]}).source.verdict,'BLOCKED');
 const pending={...failed,status:'in_progress',conclusion:null};
 assert.equal(candidate({runs:[...older,pending]}).source.verdict,'BLOCKED');
});
test('moved remote head, dirty source, forged URLs and fork evidence fail closed',()=>{
 for(const changed of [
  {remoteHead:'c'.repeat(40)},{clean:false},{retrievalError:'API unavailable'},
  {runs:workflows().map(r=>({...r,repository:{full_name:'other/fork'}}))},
  {runs:workflows().map(r=>({...r,html_url:'https://example.invalid/fake'}))}
 ])assert.equal(candidate(changed).source.verdict,'BLOCKED');
});
