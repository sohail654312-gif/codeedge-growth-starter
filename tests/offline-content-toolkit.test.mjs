import test from 'node:test';
import assert from 'node:assert/strict';
import {demoGrowthReport} from '../backend/seo-fixtures.mjs';
import {buildOfflineContentToolkit,validateStructuredData,serializeStructuredData,detectDuplicateContent} from '../backend/offline-content-toolkit.mjs';
const report=demoGrowthReport('clinic','2026-10-14T00:00:00Z');
test('deterministic offline schema/calendar retain supplied provenance and cannot approve or publish',()=>{
 const result=buildOfflineContentToolkit({seoReport:report});assert.deepEqual(result,buildOfflineContentToolkit({seoReport:report}));
 assert.equal(result.schemaDrafts.length,1);assert.equal(result.schemaDrafts[0]['@type'],'LocalBusiness');
 assert.equal(result.schemaDrafts[0].aggregateRating,undefined);assert.equal(result.schemaDrafts[0].medicalSpecialty,undefined);
 assert.ok(result.calendar.length>0&&result.calendar.every(x=>x.publishEnabled===false&&x.status==='proposed_requires_review'));
 assert.equal(result.calendar[0].date,'2026-10-14');assert.equal(result.externalActionsEnabled,false);assert.equal(result.approval,'not_approved');
 assert.throws(()=>buildOfflineContentToolkit({seoReport:report,startDate:'2026-02-30'}),/calendar/);
});
test('FAQ schema requires explicit supplied confirmations and exact workspace/site scope',()=>{
 const faq={workspaceId:report.workspaceId,url:report.business.website+'/',question:'How do I request information?',answer:'Use the contact details supplied on this page.',visibleConfirmed:true,accuracyConfirmed:true};
 const result=buildOfflineContentToolkit({seoReport:report,confirmedFaq:[faq]});assert.equal(result.schemaDrafts[1]['@type'],'FAQPage');
 for(const patch of [{workspaceId:'ws_foreign_123456'},{url:'https://foreign.invalid/'},{accuracyConfirmed:false},{visibleConfirmed:false}])
  assert.throws(()=>buildOfflineContentToolkit({seoReport:report,confirmedFaq:[{...faq,...patch}]}));
});
test('strict subset validation rejects invented fields and serialization prevents script injection',()=>{
 const schema=buildOfflineContentToolkit({seoReport:report}).schemaDrafts[0];
 assert.equal(validateStructuredData(schema,{website:report.business.website}).valid,true);
 for(const patch of [{aggregateRating:{ratingValue:5}},{'@context':'https://foreign.invalid'},{url:'https://foreign.invalid/'},{'@type':'MedicalBusiness'}])
  assert.equal(validateStructuredData({...schema,...patch},{website:report.business.website}).valid,false);
 const encoded=serializeStructuredData({...schema,name:'</script><script>alert(1)</script>'});assert.doesNotMatch(encoded,/<script|<\/script/);
 assert.equal(JSON.parse(encoded).name,'</script><script>alert(1)</script>');
});
test('duplicate analysis finds exact and similar extracts while preserving isolation and bounded memory',()=>{
 const phrase='This fictional business supplies local service information with clear booking steps and contact details for customers in the city';
 const page=(path,text)=>({workspaceId:report.workspaceId,url:report.business.website+path,text,source:'supplied_extract'});
 const input={workspaceId:report.workspaceId,website:report.business.website,pages:[page('/a',phrase),page('/b',phrase+'.'),page('/c','A brief unrelated snippet.')]};
 const result=detectDuplicateContent(input);assert.equal(result.pairs.length,1);assert.equal(result.pairs[0].similarity,1);assert.equal(result.liveCrawl,false);
 assert.throws(()=>detectDuplicateContent({...input,pages:[{...page('/a',phrase),workspaceId:'ws_foreign_123456'}]}),/Cross-workspace/);
 assert.throws(()=>detectDuplicateContent({...input,pages:[page('/a','x'.repeat(12001))]}),/too large/);
 assert.throws(()=>detectDuplicateContent({...input,pages:Array.from({length:31},(_,i)=>page('/'+i,phrase))}),/Bounded/);
 assert.equal(detectDuplicateContent({...input,pages:[page('/a',Array.from({length:1100},(_,i)=>'word'+i).join(' '))]}).truncatedPages.length,1);
});
