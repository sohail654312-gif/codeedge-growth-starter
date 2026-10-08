import test from 'node:test';
import assert from 'node:assert/strict';
import {runOfflineGrowthReport,exportKeywordCsv,requestNetworkCrawl,INTEGRATION_CONTRACT} from '../backend/seo-growth.mjs';
import {FICTIONAL_SEO_FIXTURES,demoGrowthReport} from '../backend/seo-fixtures.mjs';
test('fictional UK plumbing vertical slice: keyword clusters, audits, AEO and actionable tasks',()=>{
 const r=demoGrowthReport();
 assert.equal(r.mode,'offline_supplied_html_only');
 assert.ok(r.keywords.some(x=>x.intent==='local'&&x.geography==='Manchester'));
 assert.ok(r.keywords.some(x=>x.intent==='informational'));
 assert.ok(r.keywords.some(x=>x.mapping==='existing_fixture_page'));
 assert.ok(r.siteAudit.findings.some(x=>x.code==='missing_description'));
 assert.ok(r.siteAudit.findings.some(x=>x.code==='broken_internal_link'));
 assert.ok(r.siteAudit.findings.some(x=>x.code==='image_alt'));
 assert.ok(r.siteAudit.findings.some(x=>x.code==='noindex'));
 assert.ok(r.aeo.length>0 && r.aeo.every(x=>x.status==='draft_requires_fact_check'));
 assert.ok(r.tasks.every(x=>x.status==='proposed_not_submitted'&&!x.completionEvidence));
 assert.equal(r.publication.enabled,false);
 assert.ok(r.siteAudit.pages.every(x=>x.source==='supplied_html_fixture'));
});
test('Pakistan clinic fixture is fictional, avoids asserting clinical results, and includes local terms',()=>{
 const r=demoGrowthReport('clinic');
 assert.equal(r.business.country,'Pakistan');
 assert.ok(r.keywords.some(x=>x.geography==='Peshawar'));
 assert.ok(r.aeo.every(x=>x.assumptions.some(a=>a.includes('unverified'))));
 assert.ok(r.siteAudit.findings.some(x=>x.code==='duplicate_title'));
});
test('no fabricated Google metrics; clean CSV export carries Not available and neutralizes formulas',()=>{
 const r=demoGrowthReport();
 for(const k of r.keywords)assert.deepEqual([k.metrics.searchVolume,k.metrics.keywordDifficulty,k.metrics.cpc,k.metrics.ranking],[null,null,null,null]);
 assert.ok(r.analytics.providers.every(x=>x.status==='not_connected' && x.metrics.impressions===null));
 const csv=exportKeywordCsv(r);
 assert.match(csv,/Not available/);
 assert.ok(csv.split('\r\n').length===r.keywords.length+1);
 assert.throws(()=>exportKeywordCsv({}),/Valid report/);
});
test('offline run enforces explicit scope on profile and every HTML fixture',()=>{
 const f=FICTIONAL_SEO_FIXTURES.plumbing;
 const base={business:f.business,pages:f.pages,workspaceId:f.business.workspaceId,instruction:'Improve SEO'};
 assert.throws(()=>runOfflineGrowthReport({...base,workspaceId:'ws_another_client_123'}),/Cross-workspace/);
 assert.throws(()=>runOfflineGrowthReport({...base,pages:[{...f.pages[0],workspaceId:'ws_another_client_123'}]}),/Cross-workspace/);
 assert.throws(()=>runOfflineGrowthReport({...base,pages:Array(9).fill(f.pages[0])}),/Bounded/);
 assert.throws(()=>runOfflineGrowthReport({...base,pages:[{...f.pages[0],html:'x'.repeat(120001)}]}),/too large/);
});
test('unsafe network URLs and live crawl attempts are rejected',()=>{
 const f=FICTIONAL_SEO_FIXTURES.plumbing,base={business:f.business,pages:f.pages,workspaceId:f.business.workspaceId,instruction:'SEO'};
 for(const url of ['http://127.0.0.1','https://127.0.0.1','https://localhost','https://10.0.0.9','https://metadata.internal','https://[::1]']){
   assert.throws(()=>runOfflineGrowthReport({...base,business:{...f.business,website:url}}));
 }
 assert.throws(()=>runOfflineGrowthReport({...base,pages:[{...f.pages[0],url:'https://foreign.example/'}]}),/same/);
 assert.throws(()=>requestNetworkCrawl({url:'https://atlas-plumbing.example'}),/disabled/);
});
test('duplicate inputs rejected and live publication/integration remain strictly disabled',()=>{
 const f=FICTIONAL_SEO_FIXTURES.plumbing,base={business:f.business,pages:f.pages,workspaceId:f.business.workspaceId,instruction:'SEO'};
 assert.throws(()=>runOfflineGrowthReport({...base,business:{...f.business,services:['boiler repair','Boiler Repair']}}),/unique/);
 assert.throws(()=>runOfflineGrowthReport({...base,pages:[f.pages[0],f.pages[0]]}),/Duplicate page/);
 assert.equal(INTEGRATION_CONTRACT.enabled,false);
 assert.equal(INTEGRATION_CONTRACT.direction,'Growth Starter to Business OS read only');
});
