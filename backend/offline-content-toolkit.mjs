import {buildPremiumContentStrategy} from './premium-content-intelligence.mjs';

const check=(ok,message)=>{if(!ok)throw Error(message);};
function text(value,max=200){check(typeof value==='string'&&value.trim().length>0&&value.length<=max&&!/[\u0000-\u001f\u007f]/u.test(value),'Bounded content text required.');return value.trim();}
function url(value,origin=null){
 const u=new URL(text(value,500));
 check(u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.search&&u.hostname.includes('.')&&
  !/^\d/.test(u.hostname)&&!u.hostname.includes(':')&&!/(^|\.)(localhost|local|internal|lan|home|onion)$/i.test(u.hostname)&&
  (!origin||u.origin===origin),'Same-site public-looking HTTPS evidence required.');return u;
}
function keys(obj,allowed){check(obj&&typeof obj==='object'&&!Array.isArray(obj)&&Object.keys(obj).every(x=>allowed.includes(x)),'Unsupported structured-data fields.');}
export function validateStructuredData(document,{website}={}){
 try{
  const base=url(website);check(JSON.stringify(document).length<=24000,'Structured data too large.');
  check(document?.['@context']==='https://schema.org','Schema.org context required.');
  const kind=document['@type'];
  if(kind==='LocalBusiness'){
   keys(document,['@context','@type','@id','name','url','address']);text(document.name,90);
   url(document.url,base.origin);check(document.url===base.href,'Business URL mismatch.');
   check(document['@id']===base.href+'#business','Business reference mismatch.');
   keys(document.address,['@type','addressLocality']);check(document.address['@type']==='PostalAddress','Postal address required.');text(document.address.addressLocality,90);
  }else if(kind==='FAQPage'){
   keys(document,['@context','@type','url','mainEntity']);url(document.url,base.origin);
   check(Array.isArray(document.mainEntity)&&document.mainEntity.length>=1&&document.mainEntity.length<=20,'Bounded FAQ entries required.');
   for(const q of document.mainEntity){keys(q,['@type','name','acceptedAnswer']);check(q['@type']==='Question','Question type required.');text(q.name,200);
    keys(q.acceptedAnswer,['@type','text']);check(q.acceptedAnswer['@type']==='Answer','Answer type required.');text(q.acceptedAnswer.text,1000);}
  }else throw Error('Only the supported LocalBusiness and FAQPage subset is validated.');
  return {valid:true,issues:[],scope:'offline_supported_subset_only'};
 }catch(e){return {valid:false,issues:[e instanceof Error?e.message:'Invalid structured data.'],scope:'offline_supported_subset_only'};}
}
export function serializeStructuredData(document){
 // Safe to put in a JSON-LD script element without closing it or injecting HTML.
 return JSON.stringify(document,null,2).replace(/[<>&\u2028\u2029]/g,x=>({'<':'\\u003c','>':'\\u003e','&':'\\u0026','\u2028':'\\u2028','\u2029':'\\u2029'}[x]));
}
function shingles(raw){
 const tokens=raw.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu)||[];
 const bounded=tokens.slice(0,1000),set=new Set();
 for(let i=0;i<bounded.length-2;i++)set.add(bounded.slice(i,i+3).join(' '));
 return {set,words:bounded.length,truncated:tokens.length>1000};
}
export function detectDuplicateContent({workspaceId,website,pages,threshold=0.8}={}){
 check(/^ws_[A-Za-z0-9_-]{8,128}$/.test(workspaceId||''),'Valid workspace required.');
 check(Array.isArray(pages)&&pages.length<=30&&Number.isFinite(threshold)&&threshold>=0.5&&threshold<=1,'Bounded duplicate analysis required.');
 const origin=url(website).origin,seen=new Set();
 const prepared=pages.map(p=>{
  check(p.workspaceId===workspaceId&&p.source==='supplied_extract','Cross-workspace or unsupported content evidence.');
  const pageUrl=url(p.url,origin).href;check(!seen.has(pageUrl),'Repeated page URL.');seen.add(pageUrl);
  check(typeof p.text==='string'&&p.text.length<=12000,'Page extract too large.');
  return {url:pageUrl,...shingles(p.text)};
 });
 const pairs=[];
 for(let i=0;i<prepared.length;i++)for(let j=i+1;j<prepared.length;j++){
  const a=prepared[i],b=prepared[j];if(a.words<12||b.words<12)continue;
  let overlap=0;const small=a.set.size<b.set.size?a.set:b.set,large=small===a.set?b.set:a.set;
  for(const word of small)if(large.has(word))overlap++;
  const union=a.set.size+b.set.size-overlap,similarity=union?overlap/union:0;
  if(similarity>=threshold)pairs.push({pages:[a.url,b.url],similarity:Number(similarity.toFixed(4)),source:'supplied_extract_only',review:'Check boilerplate and intent before consolidation.'});
 }
 return {workspaceId,pairs,comparedPages:prepared.length,truncatedPages:prepared.filter(x=>x.truncated).map(x=>x.url),
  method:'bounded_three_word_shingle_jaccard',liveCrawl:false};
}
export function buildOfflineContentToolkit({seoReport,searchAnalysis=null,startDate,confirmedFaq=[]}={}){
 const strategy=buildPremiumContentStrategy({seoReport,searchAnalysis});
 const {workspaceId,business}=seoReport,base=url(business.website);
 const date=startDate||seoReport.generatedAt.slice(0,10);
 check(/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date,'Valid UTC calendar start required.');
 check(Array.isArray(confirmedFaq)&&confirmedFaq.length<=20,'Bounded confirmed FAQ list required.');
 const local={'@context':'https://schema.org','@type':'LocalBusiness','@id':base.href+'#business',name:business.name,url:base.href,
  address:{'@type':'PostalAddress',addressLocality:business.city}};
 const schemaDrafts=[local],groups=new Map();
 for(const f of confirmedFaq){
  check(f.workspaceId===workspaceId&&f.visibleConfirmed===true&&f.accuracyConfirmed===true,'FAQ requires same-workspace supplied visibility and accuracy confirmations.');
  const page=url(f.url,base.origin).href;
  const entry={'@type':'Question',name:text(f.question,200),acceptedAnswer:{'@type':'Answer',text:text(f.answer,1000)}};
  if(!groups.has(page))groups.set(page,[]);groups.get(page).push(entry);
 }
 for(const [page,entries] of groups)schemaDrafts.push({'@context':'https://schema.org','@type':'FAQPage',url:page,mainEntity:entries});
 for(const draft of schemaDrafts)check(validateStructuredData(draft,{website:base.href}).valid,'Generated schema failed the supported subset validator.');
 const duplicates=detectDuplicateContent({workspaceId,website:base.href,pages:seoReport.siteAudit.pages.map(p=>({workspaceId,url:p.url,text:p.contentSample||'',source:'supplied_extract'}))});
 const priorities={high:0,medium:1,low:2};
 const topics=[...strategy.seo.pages].sort((a,b)=>(priorities[a.priority]??2)-(priorities[b.priority]??2)||a.id.localeCompare(b.id));
 const calendar=topics.slice(0,12).flatMap((topic,index)=>['Website draft','Social adaptation'].map((channel,offset)=>{
  const day=new Date(date+'T00:00:00.000Z');day.setUTCDate(day.getUTCDate()+index*3+offset);
  return {id:'calendar_'+index+'_'+offset,date:day.toISOString().slice(0,10),channel,title:topic.titleDraft,
   targetPage:topic.targetPage,priority:topic.priority,status:'proposed_requires_review',evidence:topic.searchDemandStatus,publishEnabled:false};
 }));
 const tasks=[...strategy.tasks.map(t=>({...t,evidence:'supplied_report_or_topic_hypothesis'})),
  ...duplicates.pairs.map((pair,i)=>({id:'duplicate_'+i,url:pair.pages[0],priority:'medium',action:'Review possible duplicate supplied content',
   why:pair.review,status:'proposed_not_submitted',evidence:'supplied_extract_similarity'}))]
  .sort((a,b)=>(priorities[a.priority]??2)-(priorities[b.priority]??2)||a.id.localeCompare(b.id));
 return {version:'growth-starter.offline-content-toolkit.v1',workspaceId,strategy,schemaDrafts,duplicates,calendar,tasks,
  schemaStatus:'draft_from_supplied_facts_requires_owner_review',approval:'not_approved',externalActionsEnabled:false,
  limitations:['Schema validation covers a strict supported subset, not rich-result eligibility.','Supplied facts and FAQ confirmations are not independently verified.',
   'Calendar dates are proposals, not provider schedules.','Similarity is calculated from bounded extracts; no live duplicate-content claim.']};
}
