import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {demoGrowthReport} from '../backend/seo-fixtures.mjs';
import {buildPremiumContentStrategy} from '../backend/premium-content-intelligence.mjs';
import {prepareOfflinePilotReviewPack,restoreOfflinePilotCorrectionDrafts,PILOT_REVIEW_BOUNDARY} from '../backend/pilot-review-pack.mjs';
import {createDisabledWebsiteActionAdapter} from '../backend/website-proposals.mjs';
const seo=demoGrowthReport('clinic','2026-10-12T00:00:00.000Z');
const plan=buildPremiumContentStrategy({seoReport:seo});
const make=(report=seo,strategy=plan,correctionDrafts=[])=>prepareOfflinePilotReviewPack({seoReport:report,premiumPlan:strategy,correctionDrafts});
test('fictional clinic pilot handoff is actionable offline and never invents live metrics',()=>{
 const pack=make();
 assert.equal(pack.mode,'offline_review_only');
 assert.equal(pack.workspaceId,seo.workspaceId);
 assert.equal(pack.evidence.realGoogleMetricsVerified,false);
 assert.equal(pack.evidence.measuredTraffic,null);
 assert.ok(pack.seo.tasks.length>0);
 assert.ok(pack.websiteProposals.length>0);
 assert.ok(pack.aeoDrafts.length>0);
 assert.ok(pack.socialConcepts.length>0);
 assert.ok(pack.websiteProposals.every(p=>p.workspaceId===pack.workspaceId &&
   p.executable===false && p.review.approval===null));
 assert.equal(pack.review.clientApproved,false);
 assert.equal(pack.review.submissionStatus,'not_submitted');
 assert.deepEqual(Object.values(pack.externalActions),Array(6).fill(false));
 assert.equal(PILOT_REVIEW_BOUNDARY.liveIdentity,false);
});
test('foreign workspace and publication-capable evidence are rejected',()=>{
 const other=demoGrowthReport('plumbing');
 assert.throws(()=>make(other,plan),/Matching offline plans and workspace/);
 assert.throws(()=>make({...seo,publication:{...seo.publication,enabled:true}},plan),/publication gate/);
 assert.throws(()=>make(seo,{...plan,externalActions:{...plan.externalActions,approve:true}}),/Matching offline plans|Social or provider actions/);
 assert.throws(()=>make(seo,{...plan,social:{...plan.social,proposals:plan.social.proposals.map((p,i)=>
  i===0?{...p,publishEnabled:true}:p)}}),/publishing must remain disabled/);
});
test('fictional clinic and plumbing handoffs are deterministic and never write or publish',()=>{
 for(const kind of ['clinic','plumbing']){
  const json=execFileSync(process.execPath,['backend/pilot-review-demo.mjs',kind],{encoding:'utf8'});
  const pack=JSON.parse(json);
  assert.equal(pack.version,'codeedge.pilot-review-pack.v1');
  assert.match(pack.business.name,/fictional/i);
  assert.equal(pack.review.published,false);
  assert.equal(pack.externalActions.notify,false);
  assert.equal(pack.externalActions.providerOAuth,false);
  assert.ok(pack.websiteProposals.length>0);
 }
 const disabled=createDisabledWebsiteActionAdapter();
 assert.throws(()=>disabled.publish(),/disabled/);
 assert.throws(()=>disabled.approve(),/disabled/);
});

test('multiple page correction drafts survive one local export without approval or notification',()=>{
 const first=make().websiteProposals[0];
 const second=make().websiteProposals[1];
 assert.ok(second,'Fictional clinic must provide two proposals for review.');
 const corrections=[
  {workspaceId:seo.workspaceId,proposalId:first.id,note:'Confirm consultation opening hours.'},
  {workspaceId:seo.workspaceId,proposalId:second.id,note:'  Please verify   eligibility details.  '}
 ];
 const pack=make(seo,plan,corrections);
 assert.deepEqual(pack.correctionDrafts.map(d=>d.proposalId),[first.id,second.id]);
 assert.equal(pack.correctionDrafts[1].note,'Please verify eligibility details.');
 assert.ok(pack.correctionDrafts.every(d=>d.workspaceId===pack.workspaceId &&
   d.status==='local_only_not_submitted'));
 assert.equal(pack.review.clientApproved,false);
 assert.equal(pack.review.agencyAssigned,false);
 assert.deepEqual(Object.values(pack.externalActions),Array(6).fill(false));
 assert.equal(make().correctionDrafts.length,0);
});
test('local correction drafts reject cross-tenant, fake approvals, duplicates and unexpected pages',()=>{
 const id=make().websiteProposals[0].id;
 const good={workspaceId:seo.workspaceId,proposalId:id,note:'Please confirm this detail.'};
 const rejected=[
  [{...good,workspaceId:'ws_foreign'}],
  [{...good,proposalId:'WEB-999'}],
  [good,good],
  [{...good,approved:true}],
  [{...good,note:'abc'}],
  [{...good,note:'x'.repeat(601)}],
  [{...good,note:null}],
  'not-an-array'
 ];
 for(const input of rejected)
  assert.throws(()=>make(seo,plan,input),/correction draft|Correction note/);
});

test('Phase 3.14: review pack round-trips corrections for clinic and plumbing offline',()=>{
 for(const kind of ['clinic','plumbing']){
  const report=demoGrowthReport(kind,'2026-10-12T00:00:00.000Z');
  const strategy=buildPremiumContentStrategy({seoReport:report});
  const initial=prepareOfflinePilotReviewPack({seoReport:report,premiumPlan:strategy});
  const note={workspaceId:report.workspaceId,proposalId:initial.websiteProposals[0].id,note:'Please review local service information.'};
  const exportData=prepareOfflinePilotReviewPack({seoReport:report,premiumPlan:strategy,correctionDrafts:[note]});
  const restored=restoreOfflinePilotCorrectionDrafts({json:JSON.stringify(exportData),seoReport:report,premiumPlan:strategy});
  assert.deepEqual(restored,[note]);
  assert.equal(exportData.review.clientApproved,false);
  assert.equal(exportData.externalActions.publish,false);
 }
});
test('Phase 3.14: reject foreign, stale, forged or oversized review pack files',()=>{
 const valid=make(seo,plan,[{
  workspaceId:seo.workspaceId,proposalId:make().websiteProposals[0].id,
  note:'Verify this page before use.'
 }]);
 const restore=pack=>restoreOfflinePilotCorrectionDrafts({
  json:JSON.stringify(pack),seoReport:seo,premiumPlan:plan
 });
 const clone=()=>JSON.parse(JSON.stringify(valid));
 const invalid=[];
 let p=clone();p.workspaceId='ws_foreign';invalid.push(p);
 p=clone();p.business.website='https://other.example';invalid.push(p);
 p=clone();p.version='future-format';invalid.push(p);
 p=clone();p.mode='approved';invalid.push(p);
 p=clone();p.review.clientApproved=true;invalid.push(p);
 p=clone();p.review.verifiedActor='forged';invalid.push(p);
 p=clone();p.externalActions.publish=true;invalid.push(p);
 p=clone();p.websiteProposals[0].after.title='Changed by file';invalid.push(p);
 p=clone();p.websiteProposals.reverse();invalid.push(p);
 p=clone();p.correctionDrafts[0].status='approved';invalid.push(p);
 p=clone();p.correctionDrafts[0].recipient='external';invalid.push(p);
 p=clone();p.correctionDrafts[0].workspaceId='ws_foreign';invalid.push(p);
 p=clone();p.correctionDrafts.push({...p.correctionDrafts[0]});invalid.push(p);
 for(const item of invalid)assert.throws(()=>restore(item),/Review file|correction draft/);
 assert.throws(()=>restoreOfflinePilotCorrectionDrafts({json:'{broken',seoReport:seo,premiumPlan:plan}),/valid JSON/);
 assert.throws(()=>restoreOfflinePilotCorrectionDrafts({json:' '.repeat(262145),seoReport:seo,premiumPlan:plan}),/256 KB/);
 assert.throws(()=>restoreOfflinePilotCorrectionDrafts({json:'null',seoReport:seo,premiumPlan:plan}),/review pack/);
});
