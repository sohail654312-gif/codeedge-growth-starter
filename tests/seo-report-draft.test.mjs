import test from 'node:test';
import assert from 'node:assert/strict';
import {demoGrowthReport} from '../backend/seo-fixtures.mjs';
import {FICTIONAL_GSC} from '../backend/search-fixtures.mjs';
import {importSearchConsoleExport,analyzeImportedSearchEvidence} from '../backend/seo-search-data.mjs';
import {prepareSeoReportDraft,prepareSeoReportRevision,createDisabledSeoReportRepository,SEO_REPORT_STORAGE_GATE} from '../backend/seo-report-draft.mjs';
const seo=demoGrowthReport('plumbing','2026-10-08T00:00:00Z');
const businessRef='biz_synthetic_plumber_001',day='2026-10-10T00:00:00Z';
function make(report=seo,sourceEvidence='synthetic supplied HTML from fixture'){
 return prepareSeoReportDraft({workspaceId:report.workspaceId,businessRef,report,sourceEvidence,
   observedAt:'2026-09-01T00:00:00Z',clock:day});
}
test('offline SEO report fingerprint and review-only envelope preserve source uncertainty',()=>{
 const d=make();
 assert.equal(d.provenance,'offline_supplied_html_only');
 assert.equal(d.verifiedByGoogle,false);
 assert.equal(d.storageStatus,'not_persisted');
 assert.equal(d.reviewStatus,'draft_not_submitted');
 assert.match(d.sourceDigest,/^[0-9a-f]{64}$/);
 assert.equal(d.reportDigest,make().reportDigest);
 assert.notEqual(d.sourceDigest,make(seo,'different supplied fixture HTML').sourceDigest);
});
test('manually imported Search Console evidence never receives Google verified status',()=>{
 const evidence=importSearchConsoleExport({content:FICTIONAL_GSC.csv,format:'csv',
  manifest:FICTIONAL_GSC.manifest,business:FICTIONAL_GSC.business});
 const report=analyzeImportedSearchEvidence(seo,evidence);
 const draft=make(report,FICTIONAL_GSC.csv);
 assert.equal(draft.provenance,'user_supplied_search_console_export_unverified');
 assert.equal(draft.verifiedByGoogle,false);
 assert.throws(()=>make({...report,verification:'verified_google_api'},FICTIONAL_GSC.csv),/unverified/);
});
test('foreign workspace or contradictory nested business record are denied before any storage',()=>{
 assert.throws(()=>prepareSeoReportDraft({workspaceId:'ws_another_tenant_123',businessRef,
  report:seo,sourceEvidence:'html',observedAt:day,clock:day}),/Cross-workspace/);
 assert.throws(()=>make({...seo,business:{...seo.business,workspaceId:'ws_another_tenant_123'}}),/Cross-workspace/);
});
test('source bounds, date freshness and future timestamp are explicit',()=>{
 assert.throws(()=>make(seo,'a'.repeat(512001)),/Bounded/);
 assert.throws(()=>prepareSeoReportDraft({workspaceId:seo.workspaceId,businessRef,report:seo,
  sourceEvidence:'html',observedAt:'2026-12-31T00:00:00Z',clock:day}),/future/);
 const stale=prepareSeoReportDraft({workspaceId:seo.workspaceId,businessRef,report:seo,
  sourceEvidence:'old fixture',observedAt:'2025-01-01T00:00:00Z',clock:day});
 assert.equal(stale.staleEvidence,true);
});
test('append-only revisions enforce optimistic version and duplicate evidence detection',()=>{
 const first=prepareSeoReportRevision({history:[],draft:make(),expectedRevision:0});
 assert.equal(first.revision,1);
 assert.equal(first.previousReportDigest,null);
 assert.equal(first.approval,null);
 assert.throws(()=>prepareSeoReportRevision({history:[first],draft:make(),expectedRevision:1}),/Duplicate/);
 assert.throws(()=>prepareSeoReportRevision({history:[first],draft:make(seo,'different evidence'),expectedRevision:0}),/conflict/);
 const changedReport={...seo,instruction:'Different reviewed SEO draft instruction'};
 const second=prepareSeoReportRevision({history:[first],draft:make(changedReport,'different evidence'),expectedRevision:1});
 assert.equal(second.revision,2);
 assert.equal(second.previousReportDigest,first.reportDigest);
 assert.throws(()=>prepareSeoReportRevision({history:[first],draft:{...make(seo,'different evidence'),workspaceId:'ws_wrong_other_123'},expectedRevision:1}),/cross-workspace/);
});
test('source-only repository forbids reads, writes, approvals and publication',()=>{
 const repo=createDisabledSeoReportRepository();
 assert.equal(SEO_REPORT_STORAGE_GATE.acceptedHostedTwoUserEvidence,false);
 assert.equal(repo.capabilities.persistentWrites,false);
 for(const action of ['save','list','read','review','assign','publish'])
   assert.throws(()=>repo[action](),/disabled/);
});
