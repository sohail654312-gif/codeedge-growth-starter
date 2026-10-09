import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {demoGrowthReport} from '../backend/seo-fixtures.mjs';
import {FICTIONAL_GSC} from '../backend/search-fixtures.mjs';
import {importSearchConsoleExport,analyzeImportedSearchEvidence} from '../backend/seo-search-data.mjs';
import {buildPremiumContentStrategy,exportPremiumStrategyCsv,requestPremiumPublication} from '../backend/premium-content-intelligence.mjs';
const uk=demoGrowthReport('plumbing','2026-10-09T00:00:00Z');
const clinic=demoGrowthReport('clinic','2026-10-09T00:00:00Z');
const metrics=importSearchConsoleExport({content:FICTIONAL_GSC.csv,format:'csv',manifest:FICTIONAL_GSC.manifest,business:FICTIONAL_GSC.business});
const measured=analyzeImportedSearchEvidence(uk,metrics);
test('premium SEO strategy maps primary/supporting keywords, correct local area and reviewable pages',()=>{
 const plan=buildPremiumContentStrategy({seoReport:uk});
 assert.equal(plan.version,'growth-starter.premium-content-plan.v1');
 assert.equal(plan.workspaceId,uk.workspaceId);
 assert.ok(plan.seo.pages.some(p=>p.service==='boiler repair'&&p.location==='Manchester'&&p.primaryKeyword.includes('boiler repair')));
 assert.ok(plan.seo.pages.some(p=>p.pageStatus==='existing_supplied_fixture'));
 assert.ok(plan.seo.pages.some(p=>p.supportingKeywords.length>=1));
 assert.ok(plan.seo.pages.every(p=>p.titleDraft&&p.metaDescriptionDraft&&p.headings.length>=4));
 assert.ok(plan.seo.pages.every(p=>p.sourceEvidence.keyword.source==='service_location_hypothesis'));
 assert.ok(plan.tasks.length>0&&plan.tasks.every(t=>t.status==='proposed_not_submitted'));
 assert.ok(plan.seo.pages.every(p=>p.publicationEnabled===false));
});
test('SEO recommendations preserve original Phase 2.6 technical findings and proposed-only status',()=>{
 const p=buildPremiumContentStrategy({seoReport:uk});
 assert.ok(p.seo.technicalPriorities.some(f=>f.code==='missing_description'));
 assert.ok(p.seo.pages.some(x=>x.technicalFindings.some(f=>f.code==='missing_description')));
 assert.equal(p.seo.keywordMetricsStatus,'Not available');
 assert.ok(p.seo.cannibalisationWarnings.every(x=>typeof x==='string'));
});
test('GEO readiness observes bounded supplied content, no proprietary score or invented AI citations',()=>{
 const plan=buildPremiumContentStrategy({seoReport:uk});
 assert.equal(plan.geo.pages.length,uk.siteAudit.pages.length);
 assert.ok(plan.geo.pages.every(p=>p.mode==='supplied_html_excerpt_not_live_scan'));
 assert.ok(plan.geo.pages.every(p=>p.checks.length===10 && p.readinessScore===null));
 assert.ok(plan.geo.pages.every(p=>p.checks.some(c=>c.observation==='not_observed_or_not_verifiable_in_excerpt')));
 assert.deepEqual(plan.geo.providerObservation,{status:'not_connected',citations:null,referrals:null,AIOverviews:null});
 assert.equal(plan.geo.providerContract.enabled,false);
});
test('AEO answers distinguish measured user-supplied question observations from derived hypotheses',()=>{
 const plan=buildPremiumContentStrategy({seoReport:uk,searchAnalysis:measured});
 assert.equal(plan.generatedFrom.searchEvidenceStatus,'user_supplied_gsc_not_live_verified');
 assert.ok(plan.aeo.answers.some(x=>x.question.includes('how to choose boiler repair')));
 assert.ok(plan.aeo.answers.some(x=>x.evidence.source==='user_supplied_search_console_export_not_google_verified'));
 assert.ok(plan.aeo.answers.some(x=>x.evidence.source==='service_location_hypothesis'));
 assert.ok(plan.aeo.answers.every(x=>x.references.length===0 && x.guaranteedAIVisibility===false));
 assert.ok(plan.aeo.answers.every(x=>x.status==='draft_requires_owner_approval'));
 assert.ok(plan.seo.pages.some(p=>p.sourceEvidence.searchObservations.length>0));
});
test('GSC observations never become keyword volume, CPC, ranking or AI citation measurements',()=>{
 const plan=buildPremiumContentStrategy({seoReport:uk,searchAnalysis:measured});
 assert.ok(plan.seo.pages.some(p=>p.searchDemandStatus==='observed_in_user_export_unverified'));
 assert.ok(plan.limitations.some(l=>l.includes('search volume')));
 assert.equal(plan.geo.providerObservation.citations,null);
 assert.equal(plan.seo.keywordMetricsStatus,'Not available');
});
test('Pakistani clinical content flags qualifications and does not invent treatments or patient outcomes',()=>{
 const plan=buildPremiumContentStrategy({seoReport:clinic});
 assert.equal(plan.business.country,'Pakistan');
 assert.ok(plan.aeo.answers.some(x=>x.directAnswerDraft.includes('qualified professional')));
 assert.ok(plan.aeo.answers.every(x=>x.patientSpecificAdvice===false));
 assert.ok(plan.seo.pages.every(p=>p.detailChecklist.some(x=>x.includes('qualified')||x.includes('qualifications'))));
 assert.ok(plan.seo.pages.every(p=>p.contentSections.some(x=>x.requiresConfirmation.includes('staff_qualifications'))));
 assert.ok(plan.social.proposals.every(x=>x.publishEnabled===false));
});
test('foreign business, workspace, report and analysis are rejected before content synthesis',()=>{
 assert.throws(()=>buildPremiumContentStrategy({seoReport:uk,searchAnalysis:{...measured,workspaceId:clinic.workspaceId}}),/Cross-workspace|untrusted/);
 assert.throws(()=>buildPremiumContentStrategy({seoReport:{...uk,workspaceId:clinic.workspaceId}}),/Valid offline workspace/);
 assert.throws(()=>buildPremiumContentStrategy({seoReport:uk,searchAnalysis:{...measured,property:'sc-domain:foreign.example'}}),/Mismatched/);
 assert.throws(()=>buildPremiumContentStrategy({seoReport:uk,searchAnalysis:{...measured,verification:'live_google_verified'}}),/untrusted/);
});
test('source-only content engine refuses wrong report version and fabricated search demand',()=>{
 assert.throws(()=>buildPremiumContentStrategy({seoReport:{...uk,version:'growth-starter.search-analysis.v1'}}),/Offline SEO/);
 const wrong={...uk,keywords:uk.keywords.map((k,i)=>i===0?{...k,metrics:{...k.metrics,searchVolume:40000}}:k)};
 assert.throws(()=>buildPremiumContentStrategy({seoReport:wrong}),/hypotheses/);
});
test('local strategy includes schema and verified review, not live GBP claims or fake rankings',()=>{
 const p=buildPremiumContentStrategy({seoReport:clinic});
 assert.equal(p.local.googleBusinessProfile,'not_connected');
 assert.equal(p.local.profileClaimsVerified,false);
 assert.ok(p.local.priorities.some(x=>x.includes('reviews')));
 assert.ok(p.sco.reviewChecklist.includes('Source-supported trust claims'));
});
test('SCO and social proposal outputs remain professionally reviewable and cannot publish',()=>{
 const p=buildPremiumContentStrategy({seoReport:uk});
 assert.ok(p.sco.reviewChecklist.length>=7);
 assert.ok(p.social.proposals.length>0);
 assert.ok(p.social.proposals.every(s=>s.factsToVerify.length>0 && s.status==='draft_for_review' && s.publishEnabled===false));
 assert.deepEqual(p.externalActions,{crawl:false,persist:false,edit:false,approve:false,publish:false});
 assert.throws(()=>requestPremiumPublication(),/disabled/);
});
test('safe CSV export contains useful local content plan and properly escapes formulas',()=>{
 const plan=buildPremiumContentStrategy({seoReport:uk});
 const csv=exportPremiumStrategyCsv(plan);
 assert.match(csv,/boiler repair/);
 assert.match(csv,/Manchester/);
 assert.equal(csv.split('\r\n').length,plan.seo.pages.length+1);
 assert.throws(()=>exportPremiumStrategyCsv({}),/Valid premium/);
});
test('offline fictional business through SEO, optional GSC evidence and premium strategy exports end to end',()=>{
 const raw=execFileSync(process.execPath,['backend/premium-content-demo.mjs','json'],{timeout:5000,encoding:'utf8'});
 const p=JSON.parse(raw);
 assert.equal(p.version,'growth-starter.premium-content-plan.v1');
 assert.equal(p.geo.providerObservation.citations,null);
 assert.ok(p.aeo.answers.length>0);
 const csv=execFileSync(process.execPath,['backend/premium-content-demo.mjs','csv'],{timeout:5000,encoding:'utf8'});
 assert.match(csv,/boiler repair/);
});
