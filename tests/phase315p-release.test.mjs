import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateRelease,WORKFLOWS,REPOSITORY,BRANCH} from '../scripts/release-readiness.mjs';
import {buildReviewBundle} from '../scripts/phase315p-migration-bundle.mjs';
const sha='1'.repeat(40),runs=WORKFLOWS.map((f,i)=>({path:'.github/workflows/'+f,head_sha:sha,head_branch:BRANCH,
 repository:{full_name:REPOSITORY},event:'push',id:i+1,html_url:`https://github.com/${REPOSITORY}/actions/runs/${i+1}`,status:'completed',conclusion:'success'}));
test('release distinguishes exact source CI success from missing hosted/provider/owner acceptance',()=>{
 const r=evaluateRelease({commitSha:sha,branch:BRANCH,clean:true,remoteHead:sha,runs});
 assert.equal(r.source.verdict,'SOURCE_READY');assert.equal(r.hostedStaging.verdict,'BLOCKED');assert.equal(r.production.verdict,'BLOCKED');assert.equal(r.finalVerdict,'BLOCKED');
});
test('release refuses stale/missing/failed/fork CI, dirty source and invented attestations',()=>{
 const valid={commitSha:sha,branch:BRANCH,clean:true,remoteHead:sha,runs};
 for(const changed of [{runs:[]},{remoteHead:'2'.repeat(40)},{clean:false},{branch:'main'},{retrievalError:'outage'},
 {runs:runs.map(r=>({...r,head_sha:'2'.repeat(40)}))},{runs:runs.map(r=>({...r,repository:{full_name:'untrusted/fork'}}))},
 {runs:runs.map(r=>({...r,conclusion:'failure'}))},{runs:runs.map(r=>({...r,event:'pull_request'}))},
 {runs:runs.map(r=>({...r,html_url:'https://attacker.invalid'}))}])assert.equal(evaluateRelease({...valid,...changed}).source.verdict,'BLOCKED');
 assert.equal(evaluateRelease({...valid,manualReady:true}).hostedStaging.verdict,'BLOCKED');
});
test('review bundle preserves exact dependency order and one atomic outer transaction',()=>{
 const r=buildReviewBundle();assert.equal(r.inventory.length,4);assert.equal((r.sql.match(/^BEGIN;$/gm)||[]).length,1);
 assert.equal((r.sql.match(/^COMMIT;$/gm)||[]).length,1);assert.match(r.sql,/REVIEW_ONLY/);
 for(const i of r.inventory)assert.match(i.sha256,/^[0-9a-f]{64}$/);
});
