/**
 * Phase 2.7: offline, untrusted, user-supplied Search Console evidence.
 * No OAuth, fetch, storage, task submission or website effects.
 * Supports ONE dimensional GSC CSV table per import (query/page/date/country/device)
 * or normalized JSON rows with explicitly declared dimensions.
 */
const check=(ok,message)=>{if(!ok)throw Error(message);};
const clean=x=>String(x??'').normalize('NFKC').replace(/\s+/g,' ').trim();
const WS=/^ws_[A-Za-z0-9_-]{8,128}$/;
export const SEARCH_IMPORT_LIMITS=Object.freeze({bytes:512000,rows:1500,field:500,days:366});
const isoDate=s=>{
 check(typeof s==='string'&&/^\d{4}-\d\d-\d\d$/.test(s)&&
   !Number.isNaN(Date.parse(s+'T00:00:00Z'))&&
   new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s,'Invalid ISO calendar date.');
 return s;
};
const dayNum=d=>Date.parse(isoDate(d)+'T00:00:00Z')/86400000;
function hostOf(value,{allowQuery=false}={}){
 const url=new URL(value);
 check(url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&(allowQuery||!url.search)&&!url.hash&&
    url.hostname.includes('.')&&!url.hostname.startsWith('.')&&!/^\d/.test(url.hostname),'Unsafe property or page URL.');
 return url;
}
function propertyScope(property,website){
 check(typeof property==='string'&&property.length<400,'Search Console property required.');
 const site=hostOf(website);
 if(property.startsWith('sc-domain:')){
  const h=property.slice(10);
  check(/^[a-z0-9.-]+$/i.test(h)&&h.includes('.')&&
   (site.hostname===h||site.hostname.endsWith('.'+h)),'Property is not associated with this business website.');
  return {property,matchPage:u=>u.hostname===h||u.hostname.endsWith('.'+h)};
 }
 const prefix=hostOf(property);
 check(prefix.origin===site.origin&&site.pathname.startsWith(prefix.pathname),
   'Property is not associated with this business website.');
 return {property,matchPage:u=>u.origin===prefix.origin&&u.pathname.startsWith(prefix.pathname)};
}
export function validateSearchManifest(manifest,business){
 check(manifest&&typeof manifest==='object'&&business,'Explicit import manifest required.');
 check(WS.test(manifest.workspaceId)&&manifest.workspaceId===business.workspaceId,'Cross-workspace import denied.');
 const scope=propertyScope(manifest.property,business.website);
 check(manifest.searchType==='web','Only Web search exports are supported.');
 const dims=manifest.dimensions;
 check(Array.isArray(dims)&&dims.length>=1&&dims.length<=3&&
  dims.every(d=>['query','page','date','country','device'].includes(d))&&
  new Set(dims).size===dims.length,'Unsupported or duplicate report dimensions.');
 check(dims.includes('query')||dims.includes('page')||dims.length===1,'A query, page, or single-dimension table is required.');
 const startDate=isoDate(manifest.startDate),endDate=isoDate(manifest.endDate);
 const days=dayNum(endDate)-dayNum(startDate)+1;
 check(days>=1&&days<=SEARCH_IMPORT_LIMITS.days,'Invalid or overlong reporting period.');
 return Object.freeze({workspaceId:manifest.workspaceId,property:scope.property,
  searchType:'web',dimensions:[...dims],startDate,endDate,
  observedAt:typeof manifest.observedAt==='string'&&Number.isFinite(Date.parse(manifest.observedAt))
    ?new Date(manifest.observedAt).toISOString():null,
  source:'user_supplied_search_console_export_unverified',verifiedByGoogleApi:false,scope});
}
function csvGrid(source){
 check(typeof source==='string'&&new TextEncoder().encode(source).byteLength<=SEARCH_IMPORT_LIMITS.bytes,
  'Import exceeds size limit.');
 check(!source.startsWith('\uFFFD')&&!source.includes('\0')&&!source.includes('\uFFFD'),'Unsupported or invalid encoding.');
 const body=source.replace(/^\uFEFF/,'');
 const rows=[];let row=[],cell='',quoted=false,closed=false;
 for(let i=0;i<body.length;i++){
  const c=body[i];
  if(quoted){
   if(c==='"'&&body[i+1]==='"'){cell+='"';i++;}
   else if(c==='"') {quoted=false;closed=true;}
   else cell+=c;
  }else if(c==='"'&&!cell&&!closed)quoted=true;
  else if(c===','||c==='\r'||c==='\n'){
   row.push(cell);cell='';closed=false;
   if(c!==','){
    if(c==='\r'&&body[i+1]==='\n')i++;
    if(row.some(x=>x.trim()))rows.push(row);
    check(rows.length<=SEARCH_IMPORT_LIMITS.rows+1,'Too many export rows.');
    row=[];
   }
  }else {check(!closed&&c!=='"','Malformed CSV quoting.');cell+=c;}
  check(cell.length<=SEARCH_IMPORT_LIMITS.field,'Oversized import cell.');
 }
 check(!quoted,'Unterminated quoted CSV cell.');
 row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
 check(rows.length>=2&&rows.length<=SEARCH_IMPORT_LIMITS.rows+1,'Header and bounded data rows required.');
 const cols=rows[0].map(v=>clean(v).toLowerCase().replace(/[\s_-]+/g,' '));
 const alias={'top queries':'query','queries':'query','top pages':'page','pages':'page','top countries':'country',
  'countries':'country','devices':'device','dates':'date','clicks':'clicks','impressions':'impressions',
  'ctr':'ctr','position':'position','average position':'position','average ctr':'ctr'};
 const head=cols.map(v=>alias[v]||v);
 check(new Set(head).size===head.length,'Repeated CSV columns.');
 check(head.includes('clicks')&&head.includes('impressions')&&head.includes('position'),'Required GSC metrics are missing.');
 return {head,rows:rows.slice(1).map((r,i)=>{check(r.length===head.length,'CSV column count mismatch at row '+(i+2));return Object.fromEntries(head.map((key,j)=>[key,r[j]]));})};
}
function whole(value,label){const s=String(value??'').trim();check(/^\d+$/.test(s),'Invalid '+label);const n=Number(s);check(Number.isSafeInteger(n)&&n<=1e10,'Out-of-range '+label);return n;}
function number(value,label){const s=String(value??'').trim().replace(/,/g,'');check(/^\d+(?:\.\d+)?$/.test(s),'Invalid '+label);const n=Number(s);check(Number.isFinite(n)&&n>=0&&n<=1e7,'Out-of-range '+label);return n;}
function normalizeRow(raw,manifest,i){
 const values={};
 for(const dim of manifest.dimensions){
  let value=raw[dim];
  check(typeof value==='string'&&clean(value).length>0&&clean(value).length<=350,'Missing or oversized '+dim+' at row '+(i+1));
  value=clean(value);
  if(dim==='page'){
   let url;try{url=hostOf(value,{allowQuery:true});}catch{throw Error('Unsafe page URL at row '+(i+1));}
   check(manifest.scope.matchPage(url),'Page outside approved property.');
   value=url.href;
  }
  if(dim==='date')check(isoDate(value)>=manifest.startDate&&value<=manifest.endDate,'Date outside declared period.');
  if(dim==='device')check(['mobile','desktop','tablet'].includes(value.toLowerCase()),'Invalid device dimension.');
  if(dim==='country')check(/^[a-z]{3}$/i.test(value),'Country must be ISO-3166 alpha-3 as exported by GSC.');
  if(dim==='query')check(!/[\u0000-\u001F]/.test(value)&&value.length<=200,'Unsafe query value.');
  values[dim]=value;
 }
 const clicks=whole(raw.clicks,'clicks'),impressions=whole(raw.impressions,'impressions');
 check(clicks<=impressions || impressions===0&&clicks===0,'Clicks exceed impressions.');
 const position=number(raw.position,'average position');
 check((impressions===0&&position===0)||(impressions>0&&position>=1),'Position inconsistent with impression count.');
 if(raw.ctr!==undefined&&String(raw.ctr).trim()!==''){
  const pct=String(raw.ctr).trim().endsWith('%');
  const declared=number(pct?String(raw.ctr).trim().slice(0,-1):raw.ctr,'CTR');
  const rate=pct?declared/100:declared;
  check(rate<=1,'CTR exceeds 100%.');
  const computed=impressions?clicks/impressions:0;
  check(Math.abs(rate-computed)<=0.005,'CTR inconsistent with clicks and impressions.');
 }
 return Object.freeze({...values,clicks,impressions,position,ctr:impressions?clicks/impressions:null});
}
export function importSearchConsoleExport({content,format,manifest,business}){
 const metadata=validateSearchManifest(manifest,business);
 check(typeof content==='string'&&new TextEncoder().encode(content).byteLength<=SEARCH_IMPORT_LIMITS.bytes,'Invalid import size.');
 let input;
 if(format==='csv'){
  const parsed=csvGrid(content);
  check(metadata.dimensions.every(k=>parsed.head.includes(k)),'Export dimensions do not match manifest.');
  check(parsed.head.every(k=>[...metadata.dimensions,'clicks','impressions','ctr','position'].includes(k)),
    'CSV includes unaccounted dimensions; import separately.');
  input=parsed.rows;
 }else if(format==='json'){
  let doc;try{doc=JSON.parse(content);}catch{throw Error('Malformed JSON export.');}
  check(doc&&doc.version==='growth-starter.search-import.v1'&&Array.isArray(doc.rows),
   'Unsupported normalized JSON export.');
  check(JSON.stringify(doc.manifest||null)===JSON.stringify({
   workspaceId:manifest.workspaceId,property:manifest.property,searchType:manifest.searchType,
   dimensions:manifest.dimensions,startDate:manifest.startDate,endDate:manifest.endDate}),
   'JSON export scope differs from authorized manifest.');
  input=doc.rows;
 }else throw Error('Only csv or normalized JSON import is accepted.');
 check(input.length>0&&input.length<=SEARCH_IMPORT_LIMITS.rows,'Empty or oversized Search Console export.');
 const seen=new Set(),rows=input.map((row,i)=>{
  check(row&&typeof row==='object'&&!Array.isArray(row),'Malformed import row.');
  const normalized=normalizeRow(row,metadata,i);
  const identity=JSON.stringify(metadata.dimensions.map(d=>normalized[d].toLowerCase()));
  check(!seen.has(identity),'Duplicate Search Console dimensional row.');
  seen.add(identity);return normalized;
 });
 return Object.freeze({version:'growth-starter.search-evidence.v1',workspaceId:metadata.workspaceId,
  property:metadata.property,searchType:metadata.searchType,dimensions:metadata.dimensions,
  startDate:metadata.startDate,endDate:metadata.endDate,observedAt:metadata.observedAt,
  verification:'user_supplied_unverified',isComplete:false,
  warning:'GSC exports may omit anonymized queries or truncate rows; these totals are exported-row totals, not necessarily property totals.',
  rows});
}
function summarize(rows){
 const clicks=rows.reduce((n,r)=>n+r.clicks,0);
 const impressions=rows.reduce((n,r)=>n+r.impressions,0);
 return Object.freeze({clicks,impressions,ctr:impressions?clicks/impressions:null,
  averagePosition:impressions?rows.reduce((n,r)=>n+r.position*r.impressions,0)/impressions:null,rows:rows.length});
}
export function compareSearchEvidence(earlier,later){
 for(const r of [earlier,later])check(r?.version==='growth-starter.search-evidence.v1','Valid search evidence required.');
 check(earlier.workspaceId===later.workspaceId&&earlier.property===later.property&&
  earlier.searchType===later.searchType&&JSON.stringify(earlier.dimensions)===JSON.stringify(later.dimensions),
  'Incompatible properties or dimensions.');
 check(earlier.endDate<later.startDate,'Comparison periods overlap or are reversed.');
 const ea=dayNum(earlier.endDate)-dayNum(earlier.startDate),la=dayNum(later.endDate)-dayNum(later.startDate);
 check(ea===la,'Date-range comparison needs equal-length periods.');
 const before=summarize(earlier.rows),after=summarize(later.rows);
 return {status:'comparable_imported_rows_only',before,after,
  change:{clicks:after.clicks-before.clicks,impressions:after.impressions-before.impressions,
   ctrPercentagePoints:before.ctr===null||after.ctr===null?null:(after.ctr-before.ctr)*100,
   averagePosition:before.averagePosition===null||after.averagePosition===null?null:after.averagePosition-before.averagePosition},
  warning:'Observed differences are not proof that Codeedge work caused these changes; import coverage may differ.'};
}
const phraseHit=(query,service)=>service.toLowerCase().split(' ').some(token=>token.length>=4&&query.toLowerCase().includes(token));
export function analyzeImportedSearchEvidence(report,evidence,{previous=null}={}){
 check(report?.version==='growth-starter.seo-report.v1'&&evidence?.version==='growth-starter.search-evidence.v1',
  'Validated SEO report and imported evidence required.');
 check(report.workspaceId===evidence.workspaceId,'Cross-workspace search analysis denied.');
 check(propertyScope(evidence.property,report.business.website),'Property mismatch.');
 const summary=summarize(evidence.rows),dims=evidence.dimensions;
 const opportunities=[];
 const queryRows=dims.includes('query')?evidence.rows:[];
 const pageRows=dims.includes('page')?evidence.rows:[];
 for(const r of queryRows){
  const matched=report.business.services.find(s=>phraseHit(r.query,s));
  if(!matched)continue;
  const lowCtr=r.impressions>=50&&r.ctr!==null&&r.ctr<0.04;
  opportunities.push({kind:lowCtr?'high_impressions_low_ctr':'relevant_measured_query',query:r.query,
    page:r.page||null,service:matched,
    evidence:{source:'user_supplied_search_console_export_unverified',property:evidence.property,
      range:[evidence.startDate,evidence.endDate],impressions:r.impressions,clicks:r.clicks,ctr:r.ctr,averagePosition:r.position},
    rationale:lowCtr?'Relevant query with at least 50 recorded impressions and under 4% export-row CTR. Review the page title and relevance.':'Relevant query observed in imported rows; review page coverage.',
    status:'proposal_requires_human_review',confidence:'bounded_import_observation_not_live_verified'});
 }
 const keywords=report.keywords.map(k=>{
  const matches=queryRows.filter(r=>r.query.toLowerCase()===k.phrase.toLowerCase());
  return {...k,searchEvidence:matches.length?{status:'observed_in_user_export_unverified',
    ...summarize(matches),property:evidence.property,range:[evidence.startDate,evidence.endDate]}:
    {status:'not_observed_in_supplied_rows_not_proof_of_zero_demand'},
    metrics:{...k.metrics,searchVolume:null,keywordDifficulty:null,cpc:null,ranking:null}};
 });
 const relatedAeo=opportunities.filter(o=>o.query.includes('?')||/^(how|what|when|where|why|can|does|is)\b/i.test(o.query))
  .slice(0,8).map((o,i)=>({id:'GSC-AEO-'+(i+1),question:o.query,
   answerDraft:'Review the business page and draft a factual answer; verify the service, availability, qualifications and pricing with the business owner.',
   evidence:o.evidence,status:'draft_requires_fact_check',assumptions:['Business details and professional claims unverified.'],
   suggestedSchema:'FAQPage only for genuinely visible appropriate question-and-answer content'}));
 const comparable=previous?compareSearchEvidence(previous,evidence):null;
 return Object.freeze({version:'growth-starter.search-analysis.v1',workspaceId:report.workspaceId,
  source:'user_supplied_search_console_export_unverified',property:evidence.property,
  dimensions:dims,period:{start:evidence.startDate,end:evidence.endDate},summary,
  opportunities:opportunities.slice(0,60),keywords,aeoProposals:relatedAeo,
  comparison:comparable,existingSeoFindings:report.siteAudit.findings,
  proposedTasks:opportunities.filter(o=>o.kind==='high_impressions_low_ctr').slice(0,12).map((o,i)=>({
   id:'SEARCH-'+(i+1),finding:o.rationale,url:o.page,sourceEvidence:o.evidence,
   recommendation:'Human review of the landing page relevance, title, description and supporting FAQ before any edits.',
   priority:'medium',status:'proposal_not_submitted',owner:'Codeedge review',
   completionEvidence:null})),
  verification:'not_live_api_verified',
  limitations:[evidence.warning,'No GSC OAuth connection or provider authenticity check.',
    'Query/page exports cannot be summed together without double counting; this report covers one selected dimensional view.',
    'Impressions are not keyword search-volume estimates; no conversions or ranking uplift are established.'],
  externalActions:{enabled:false,publishing:false,persistentWrites:false}});
}
const csvCell=value=>{const raw=String(value??'Not available');const safe=/^[\s]*[=+\-@\t\r]/.test(raw)?"'"+raw:raw;return '"'+safe.replace(/"/g,'""')+'"';};
export function exportSearchAnalysisCsv(result){
 check(result?.version==='growth-starter.search-analysis.v1','Valid analysis report required.');
 const keys=['query','service','page','impressions','clicks','ctr','position','source','status'];
 const rows=result.opportunities.map(o=>[o.query,o.service,o.page,o.evidence.impressions,
   o.evidence.clicks,o.evidence.ctr===null?'Not available':o.evidence.ctr,
   o.evidence.averagePosition,o.evidence.source,o.status]);
 return [keys,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n');
}
export const SEARCH_PROVIDER_CONTRACTS=Object.freeze({
 searchConsole:{status:'disabled_pending_oauth',scope:'https://www.googleapis.com/auth/webmasters.readonly',
  sites:'GET https://www.googleapis.com/webmasters/v3/sites',
  analytics:'POST https://www.googleapis.com/webmasters/v3/sites/{siteUrl}/searchAnalytics/query',
  rowLimitMax:25000,notes:'Bounded page and date requests; API may return only top rows; require authorized property verification.'},
 ga4:{status:'disabled_pending_oauth',scope:'https://www.googleapis.com/auth/analytics.readonly',
  report:'POST https://analyticsdata.googleapis.com/v1beta/properties/{propertyId}:runReport',
  notes:'Only consented GA4 property and explicitly configured events; never substitute for GSC clicks.'},
 businessProfile:{status:'disabled_pending_oauth',scope:'https://www.googleapis.com/auth/business.manage',
  performance:'GET https://businessprofileperformance.googleapis.com/v1/locations/{locationId}:fetchMultiDailyMetricsTimeSeries',
  searchKeywords:'GET https://businessprofileperformance.googleapis.com/v1/locations/{locationId}/searchkeywords/impressions/monthly',
  notes:'Requires eligible approved GBP access; monthly keyword counts may be thresholded.'}
});
export function interpretSeoInstruction({instruction,business,service,area,workspaceId,evidenceSources=[]}){
 check(WS.test(workspaceId)&&business?.workspaceId===workspaceId,'Unauthorized workspace instruction.');
 check(typeof instruction==='string'&&instruction.trim().length>=8&&instruction.length<=300,'Bounded instruction required.');
 check(business.services.includes(service)&&business.serviceAreas.includes(area),'Choose an approved service and location.');
 const lower=instruction.toLowerCase();
 check(!/\b(publish|deploy|post|send|delete|edit|rewrite|update|change|launch|run ads)\b/i.test(lower),
   'External website changes and publication are not executable in offline analysis.');
 const intents=[
  /performance|click|impression|search console|traffic/.test(lower)?'search_performance':null,
  /keyword|query|search term/.test(lower)?'keyword_research':null,
  /faq|answer|aeo|question/.test(lower)?'aeo_content':null,
  /audit|technical|website|seo|optimis|improv/.test(lower)?'technical_seo':null
 ].filter(Boolean);
 check(intents.length>0,'Unsupported instruction; choose SEO, keywords, AEO or search performance.');
 return Object.freeze({version:'growth-starter.ai-seo-command.v1',workspaceId,
  intent:intents,service,area,requestedSources:evidenceSources.filter(s=>['offline_html','user_import_gsc'].includes(s)),
  requiresPermissions:['verified_workspace','website_evidence_authorization'],
  reviewStatus:'draft_not_executable',externalActionsEnabled:false,
  limitations:['Structured deterministic interpreter, not an LLM','No network crawl, OAuth, writes or publishing']});
}
