import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {FICTIONAL_GSC} from '../backend/search-fixtures.mjs';
import {demoGrowthReport} from '../backend/seo-fixtures.mjs';
import {importSearchConsoleExport,analyzeImportedSearchEvidence,compareSearchEvidence,
  exportSearchAnalysisCsv,interpretSeoInstruction,SEARCH_PROVIDER_CONTRACTS} from '../backend/seo-search-data.mjs';
const fixture=FICTIONAL_GSC,profile=fixture.business;
const parse=(content=fixture.csv,manifest=fixture.manifest,format='csv')=>importSearchConsoleExport({content,manifest,format,business:profile});
test('native Search Console query CSV accepts unverified user export and computes correct weighted metrics',()=>{
 const e=parse(),s=analyzeImportedSearchEvidence(demoGrowthReport(),e);
 assert.equal(e.verification,'user_supplied_unverified');
 assert.equal(e.isComplete,false);
 assert.equal(s.summary.clicks,39);
 assert.equal(s.summary.impressions,1050);
 assert.ok(Math.abs(s.summary.ctr-39/1050)<1e-12);
 assert.ok(Math.abs(s.summary.averagePosition-(600*7+300*3+150*9)/1050)<1e-12);
 assert.equal(s.verification,'not_live_api_verified');
 assert.ok(s.opportunities.some(o=>o.kind==='high_impressions_low_ctr'&&o.query==='boiler repair manchester'));
 assert.ok(s.aeoProposals.length>0);
 assert.ok(s.keywords.every(k=>k.metrics.searchVolume===null&&k.metrics.cpc===null));
 assert.ok(s.proposedTasks.every(t=>t.status==='proposal_not_submitted'));
});
test('GSC query-only table never creates landing-page attribution',()=>{
 const result=analyzeImportedSearchEvidence(demoGrowthReport(),parse());
 assert.ok(result.opportunities.every(o=>o.page===null));
 assert.ok(result.limitations.some(x=>x.includes('double counting')));
});
test('recognised Pages export is scoped and does not fabricate query opportunities',()=>{
 const manifest={...fixture.manifest,dimensions:['page']};
 const csv='Top pages,Clicks,Impressions,CTR,Position\nhttps://atlas-plumbing.example/boiler-repair,4,100,4%,6';
 const imported=parse(csv,manifest);
 const result=analyzeImportedSearchEvidence(demoGrowthReport(),imported);
 assert.equal(result.summary.clicks,4);
 assert.equal(result.opportunities.length,0);
 assert.equal(imported.rows[0].page,'https://atlas-plumbing.example/boiler-repair');
});
test('property, workspace, dimensions, duplicate headers and rows fail closed',()=>{
 assert.throws(()=>parse(fixture.csv,{...fixture.manifest,workspaceId:'ws_foreign_client_123'}),/Cross-workspace/);
 assert.throws(()=>parse(fixture.csv,{...fixture.manifest,property:'sc-domain:foreign.example'}),/not associated/);
 assert.throws(()=>parse(fixture.csv,{...fixture.manifest,dimensions:['page']}),/dimensions/);
 assert.throws(()=>parse('Query,Clicks,Clicks,Impressions,Position\nx,1,1,2,3'),/Repeated CSV/);
 assert.throws(()=>parse('Query,Clicks,Impressions,CTR,Position\nx,1,2,50%,3\nx,1,2,50%,3'),/Duplicate/);
 const clinic=demoGrowthReport('clinic');
 assert.throws(()=>analyzeImportedSearchEvidence(clinic,parse()),/Cross-workspace/);
});
test('untrusted rows reject missing metrics, inconsistent CTR and unsafe URLs',()=>{
 for(const line of ['x,bad,20,0%,3','x,21,20,105%,3','x,5,20,1%,3','x,5,20,25%,NaN']){
  assert.throws(()=>parse('Query,Clicks,Impressions,CTR,Position\n'+line));
 }
 const pageManifest={...fixture.manifest,dimensions:['page']};
 assert.throws(()=>parse('Page,Clicks,Impressions,Position\nhttps://localhost/test,1,10,2',pageManifest));
 assert.throws(()=>parse('Page,Clicks,Impressions,Position\nhttps://evil.example/x,1,10,2',pageManifest));
 assert.throws(()=>parse('Query,Clicks,Impressions,Position\nx,1,10,2\n'+('a'.repeat(510)),fixture.manifest),/Oversized|column count/);
 assert.throws(()=>parse('Query,Clicks,Impressions,Position\n"x,1,10,2'),/Unterminated/);
 assert.throws(()=>parse('Query,Clicks,Impressions,Position\nx,1,10,2', {...fixture.manifest,startDate:'2026-02-30'}),/Invalid ISO/);
});
test('normalized JSON schema scopes and validates, no fake API verification',()=>{
 const manifest=fixture.manifest;
 const doc={version:'growth-starter.search-import.v1',manifest:{
  workspaceId:manifest.workspaceId,property:manifest.property,searchType:manifest.searchType,
  dimensions:manifest.dimensions,startDate:manifest.startDate,endDate:manifest.endDate
 },rows:[{query:'boiler repair manchester',clicks:4,impressions:200,ctr:0.02,position:8}]};
 const imported=parse(JSON.stringify(doc),manifest,'json');
 assert.equal(imported.rows[0].ctr,0.02);
 assert.throws(()=>parse(JSON.stringify({...doc,manifest:{...doc.manifest,property:'sc-domain:wrong.example'}}),manifest,'json'),/scope/);
 assert.throws(()=>parse(JSON.stringify({...doc,rows:[{...doc.rows[0],clicks:-1}]}),manifest,'json'),/Invalid clicks/);
});
test('comparison enforces property, type, dimensions, equal non-overlapping dates',()=>{
 const older=parse(fixture.earlierCsv,fixture.earlier);
 const later=parse();
 const cmp=compareSearchEvidence(older,later);
 assert.equal(cmp.before.clicks,35);
 assert.equal(cmp.after.clicks,39);
 assert.equal(cmp.change.clicks,4);
 assert.ok(cmp.warning.includes('not proof'));
 assert.throws(()=>compareSearchEvidence(later,older),/overlap or are reversed/);
 assert.throws(()=>compareSearchEvidence(older,parse(fixture.csv,{...fixture.manifest,startDate:'2026-09-03'})),/equal-length/);
 assert.throws(()=>compareSearchEvidence(older,parse('Page,Clicks,Impressions,Position\nhttps://atlas-plumbing.example/,1,10,3',{...fixture.manifest,dimensions:['page']})),/Incompatible/);
});
test('CSV injection is neutralized in exported client report',()=>{
 const mal='=HYPERLINK("https://evil.invalid","boiler repair")';
 const imp=parse('Query,Clicks,Impressions,CTR,Position\n"'+mal.replace(/"/g,'""')+'",1,10,10%,4');
 const analysis=analyzeImportedSearchEvidence(demoGrowthReport(),imp);
 const out=exportSearchAnalysisCsv(analysis);
 assert.match(out,/"'=HYPERLINK/);
 assert.ok(out.includes('user_supplied_search_console_export_unverified'));
 assert.throws(()=>exportSearchAnalysisCsv({}),/Valid analysis/);
});
test('malformed, partial or oversized data refuses import; no empty fake dashboard',()=>{
 assert.throws(()=>parse('Query,Clicks,Impressions,Position'),/Header and bounded/);
 assert.throws(()=>parse('Query,Clicks,Impressions\nx,1,2'),/Required GSC/);
 assert.throws(()=>parse('a'.repeat(512001)),/size/);
 assert.throws(()=>parse('Query,Clicks,Impressions,Position\nx,2,4,3',fixture.manifest,'xml'),/Only csv/);
});
test('AI command interpretation remains local, bounded, non-executable and tenant-scoped',()=>{
 const b=fixture.business;
 const parsed=interpretSeoInstruction({workspaceId:b.workspaceId,business:b,
  instruction:'Review Manchester boiler repair search performance and suggest keywords',
  service:'boiler repair',area:'Manchester',evidenceSources:['user_import_gsc','arbitrary_google_oauth']});
 assert.deepEqual(parsed.intent,['search_performance','keyword_research']);
 assert.deepEqual(parsed.requestedSources,['user_import_gsc']);
 assert.equal(parsed.externalActionsEnabled,false);
 assert.throws(()=>interpretSeoInstruction({workspaceId:'ws_forbidden_other123',business:b,
  instruction:'publish website changes',service:'boiler repair',area:'Manchester'}));
 assert.throws(()=>interpretSeoInstruction({workspaceId:b.workspaceId,business:b,
  instruction:'publish website changes',service:'boiler repair',area:'Manchester'}),/External website changes|Unsupported/);
});
test('provider contracts document OAuth but cannot call Google',()=>{
 assert.ok(SEARCH_PROVIDER_CONTRACTS.searchConsole.scope.endsWith('webmasters.readonly'));
 assert.ok(SEARCH_PROVIDER_CONTRACTS.ga4.scope.endsWith('analytics.readonly'));
 assert.equal(SEARCH_PROVIDER_CONTRACTS.businessProfile.status,'disabled_pending_oauth');
});
test('offline end-to-end fictional plumbing CSV import to client report and no network dependencies',()=>{
 const json=JSON.parse(execFileSync(process.execPath,['backend/search-demo.mjs','json'],{encoding:'utf8',timeout:5000}));
 assert.equal(json.summary.impressions,1050);
 assert.ok(json.opportunities.length>=2);
 assert.equal(json.externalActions.persistentWrites,false);
 const csv=execFileSync(process.execPath,['backend/search-demo.mjs','csv'],{encoding:'utf8',timeout:5000});
 assert.match(csv,/boiler repair manchester/);
 assert.match(csv,/user_supplied_search_console_export_unverified/);
});
