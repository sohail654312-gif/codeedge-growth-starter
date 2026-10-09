import test from 'node:test';
import assert from 'node:assert/strict';
import {demoGrowthReport} from '../backend/seo-fixtures.mjs';
import {buildPremiumContentStrategy} from '../backend/premium-content-intelligence.mjs';
import {prepareWebsiteImprovementProposals,reviseWebsiteProposalOffline,createDisabledWebsiteActionAdapter,
 createOfflineContentGenerationPort,CONTENT_GENERATION_PROVIDER_CONTRACT} from '../backend/website-proposals.mjs';
const seo=demoGrowthReport('plumbing','2026-10-09T00:00:00Z');
const premium=buildPremiumContentStrategy({seoReport:seo});
const clinic=demoGrowthReport('clinic','2026-10-09T00:00:00Z');
test('before/after website proposals remain offline and link exact supplied page evidence',()=>{
 const plan=prepareWebsiteImprovementProposals({premiumPlan:premium,seoReport:seo});
 assert.ok(plan.proposals.length>0);
 const existing=plan.proposals.find(p=>p.type==='existing_page_content_proposal');
 assert.ok(existing && existing.before.source==='operator_supplied_html');
 assert.equal(existing.before.title,seo.siteAudit.pages.find(p=>p.url===existing.url).title);
 assert.ok(plan.proposals.some(p=>p.type==='new_page_proposal_only'&&p.before.title===null));
 assert.ok(plan.proposals.every(p=>p.review.approval===null&&p.executable===false));
 assert.equal(plan.externalActions.write,false);
});
test('cross-workspace and mismatching website plan evidence denied',()=>{
 assert.throws(()=>prepareWebsiteImprovementProposals({premiumPlan:premium,seoReport:clinic}),/Matching offline/);
 assert.throws(()=>prepareWebsiteImprovementProposals({premiumPlan:{...premium,business:{...premium.business,website:'https://wrong.example'}},seoReport:seo}),/scope mismatch/);
 assert.throws(()=>prepareWebsiteImprovementProposals({premiumPlan:{...premium,seo:{...premium.seo,pages:premium.seo.pages.map((p,i)=>i===0?{...p,targetPage:'https://evil.example/rewrite'}:p)}},seoReport:seo}),/escaped/);
});
test('optimistic proposed-only reviews cannot become approvals or cross-tenant edits',()=>{
 const plan=prepareWebsiteImprovementProposals({premiumPlan:premium,seoReport:seo});
 const original=plan.proposals[0];
 const modified=reviseWebsiteProposalOffline({proposal:original,workspaceId:seo.workspaceId,
  expectedRevision:0,after:{title:'Owner-reviewed title',description:'Factual local coverage information',heading:'Local boiler services'}});
 assert.equal(original.review.revision,0);
 assert.equal(modified.review.revision,1);
 assert.equal(modified.review.state,'proposal_not_submitted');
 assert.equal(modified.review.approval,null);
 assert.throws(()=>reviseWebsiteProposalOffline({proposal:modified,workspaceId:seo.workspaceId,
  expectedRevision:0,after:modified.after}),/conflict/);
 assert.throws(()=>reviseWebsiteProposalOffline({proposal:original,workspaceId:clinic.workspaceId,
  expectedRevision:0,after:modified.after}),/Foreign workspace/);
});
test('no network, publishing, agency assignment or approvals are possible',async()=>{
 const actions=createDisabledWebsiteActionAdapter();
 for(const action of ['submit','approve','assign','publish','crawl','deploy'])
  assert.throws(()=>actions[action](),/disabled/);
 const provider=createOfflineContentGenerationPort();
 assert.equal(provider.mode,'deterministic_offline');
 const p=await provider.propose({seoReport:seo,premiumPlan:premium});
 assert.equal(p.humanReviewRequired,true);
 assert.equal(p.proposals[0].review.approval,null);
 assert.throws(()=>provider.connect(),/disabled/);
 assert.throws(()=>provider.publish(),/disabled/);
 assert.ok(CONTENT_GENERATION_PROVIDER_CONTRACT.requiredClaims.includes('human_fact_review'));
});
test('unverified or unsafe actor control cannot mutate a proposal state',()=>{
 const plan=prepareWebsiteImprovementProposals({premiumPlan:premium,seoReport:seo});
 assert.throws(()=>reviseWebsiteProposalOffline({proposal:{...plan.proposals[0],review:{...plan.proposals[0].review,state:'approved'}},
  workspaceId:seo.workspaceId,expectedRevision:0,after:plan.proposals[0].after}),/Foreign workspace or active/);
});
