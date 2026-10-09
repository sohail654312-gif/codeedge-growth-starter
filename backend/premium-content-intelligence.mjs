/**
 * Phase 2.9 — deterministic PREMIUM content-intelligence proposal engine.
 * Inputs ONLY: existing bounded Phase 2.6 offline SEO report and optional
 * Phase 2.7 unverified, manually imported GSC analysis. No fetch, LLM, storage,
 * Google connection, approval, crawl, publication or third-party action.
 */
const requireValid=(ok,message)=>{if(!ok)throw Error(message);};
const trim=s=>String(s??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim();
const includes=(text,needle)=>trim(text).toLocaleLowerCase('en').includes(trim(needle).toLocaleLowerCase('en'));
const slug=s=>trim(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,65);
const safeText=s=>trim(s).slice(0,180);
const OWNERSHIP=['fixture_only','unverified','verified'];
const SOURCE=Object.freeze({fixture:'operator_supplied_html_not_network_verified',hypothesis:'service_location_hypothesis',import:'user_supplied_search_console_export_not_google_verified'});
function evidenceForPage(page){
 return {source:SOURCE.fixture,reference:page?.url||null,observedAt:null,claim:'supplied_page_extract_only'};
}
function evidenceForKeyword(keyword){
 return {source:SOURCE.hypothesis,reference:keyword?.targetPage||null,observedAt:keyword?.provenance?.observedAt||null,claim:'not_verified_search_demand'};
}
function verifyInputs(report,analysis){
 requireValid(report?.version==='growth-starter.seo-report.v1' &&
  report.mode==='offline_supplied_html_only' &&
  report.publication?.enabled===false,'Offline SEO report required.');
 const business=report.business;
 requireValid(typeof report.workspaceId==='string'&&report.workspaceId===business?.workspaceId &&
  OWNERSHIP.includes(business.ownershipStatus),'Valid offline workspace business required.');
 requireValid(Array.isArray(report.keywords)&&report.keywords.length<=64 &&
  Array.isArray(report.siteAudit?.pages)&&report.siteAudit.pages.length<=8 &&
  Array.isArray(report.siteAudit?.findings),'Bounded Phase 2.6 research required.');
 requireValid(report.keywords.every(k=>k.provenance?.kind==='hypothesis' &&
  k.metrics?.searchVolume==null),'Keyword hypotheses must not claim verified demand.');
 if(analysis){
  requireValid(analysis.version==='growth-starter.search-analysis.v1' &&
   analysis.workspaceId===report.workspaceId &&
   analysis.source==='user_supplied_search_console_export_unverified' &&
   analysis.verification==='not_live_api_verified' &&
   analysis.externalActions?.enabled===false &&
   analysis.externalActions?.publishing===false &&
   analysis.externalActions?.persistentWrites===false,'Cross-workspace, untrusted or connected search evidence refused.');
  const host=new URL(business.website).hostname;
  requireValid(typeof analysis.property==='string' &&
   (analysis.property==='sc-domain:'+host || analysis.property==='https://'+host+'/' ||
    analysis.property==='https://'+host) &&
   Array.isArray(analysis.opportunities) && analysis.opportunities.length<=60,
   'Mismatched Search Console property or oversized observations.');
  requireValid(analysis.opportunities.every(o=>o.evidence?.property===analysis.property &&
   o.evidence?.source==='user_supplied_search_console_export_unverified'),
   'Search Console observations must retain unverified provenance.');
 }
 return business;
}
function choosePrimary(keys){
 return keys.find(k=>k.intent==='local')||keys.find(k=>k.intent==='commercial')||keys[0];
}
function labelPriority(page,report){
 const codes=report.siteAudit.findings.filter(f=>f.url===page?.url).map(f=>f.code);
 return codes.some(x=>['http_status','missing_title','noindex','broken_internal_link'].includes(x))?'high':
  codes.some(x=>['missing_description','thin_content','internal_links','h1_structure'].includes(x))?'medium':'normal';
}
function boundedTitle(service,area,business){
 const title=trim(service)+' in '+trim(area)+' | '+trim(business.name);
 return title.length<=65?title:title.slice(0,62).trimEnd()+'…';
}
function recommendedMeta(service,area){
 return safeText('Explore '+service+' information for '+area+'. Check service scope, coverage, availability and how to make an enquiry before choosing a provider.');
}
function serviceAngle(service){
 if(/boiler|heating|plumb|leak|pipe|drain/i.test(service))return {
  helpfulDetails:['Describe the types of work undertaken without promising emergency availability.','Explain what details customers should share before requesting a quote.','State licensing or qualifications only after the business confirms them.'],
  faq:'What information should I provide when asking about '+service+'?',
  shortAnswer:'Describe the problem, location and any relevant access details when making an enquiry. Ask the business to confirm its service scope, availability and next steps before assuming it can help.',
  socialIdea:'A short checklist of what to prepare before enquiring about '+service+'.'
 };
 if(/skin|clinic|laser|consult|treatment|hair|surgery|aesthetic/i.test(service))return {
  helpfulDetails:['Explain the booking and consultation process using practitioner-approved information.','Identify clinician details and qualifications only if documented and confirmed.','Avoid personal results, treatment promises and patient-specific advice.'],
  faq:'How can I prepare for a '+service+' enquiry?',
  shortAnswer:'Ask the clinic what information is needed before a consultation, how suitability is assessed by a qualified professional and how to book. Individual medical advice and outcomes cannot be assumed.',
  socialIdea:'An approved, non-clinical guide to arranging a consultation about '+service+'.'
 };
 return {
  helpfulDetails:['Explain the specific service scope with real examples only where authorised.','Describe how customers can ask for a quote or consultation.','Confirm coverage, pricing and credentials with the business owner.'],
  faq:'What should I check before arranging '+service+'?',
  shortAnswer:'Confirm the service scope, the area covered and how the business handles enquiries. Ask for availability, prices and relevant credentials directly rather than relying on assumptions.',
  socialIdea:'A customer checklist for evaluating '+service+' options.'
 };
}
function profileVisibility(business,page){
 const sample=[page?.title||'',...(page?.h1||[]),...(page?.h2||[]),page?.contentSample||''].join(' ');
 const hasName=includes(sample,business.name);
 const hasService=business.services.some(service=>includes(sample,service));
 const hasArea=business.serviceAreas.some(area=>includes(sample,area));
 const hasPhone=/(\+?\d[\d\s\-()]{7,}\d)/.test(sample);
 const hasContact=/contact|enquiry|enquire|book|appointment|get in touch/i.test(sample);
 return {hasName,hasService,hasArea,hasPhone,hasContact,sampleLength:sample.length};
}
export function buildPremiumContentStrategy({seoReport,searchAnalysis=null}){
 const business=verifyInputs(seoReport,searchAnalysis);
 const approvedPages=seoReport.siteAudit.pages;
 const groups=new Map();
 for(const k of seoReport.keywords){
  const key=k.cluster;
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(k);
 }
 const pageStrategies=[];
 for(const [cluster,keys] of [...groups.entries()].slice(0,18)){
  const primary=choosePrimary(keys);
  const target=approvedPages.find(p=>p.url===primary.targetPage)||null;
  const service=business.services.find(s=>cluster.startsWith(s+' — '))||business.services[0];
  const area=primary.geography;
  const matching=searchAnalysis?.opportunities.filter(o=>o.service===service &&
   includes(o.query,area) && o.evidence?.impressions>0).slice(0,5)||[];
  const angle=serviceAngle(service);
  const title=boundedTitle(service,area,business);
  const missing=seoReport.siteAudit.findings.filter(f=>f.url===target?.url).slice(0,8)
   .map(f=>({code:f.code,reason:f.finding,evidence:evidenceForPage(target)}));
  const proposedUrl=new URL('/services/'+slug(service)+'-'+slug(area),business.website).href;
  const internalTargets=approvedPages.filter(p=>p.url!==target?.url && p.status<400)
   .slice(0,4).map(p=>({url:p.url,rationale:'Review as a related internal link; relevance must be checked from supplied content.'}));
  pageStrategies.push({
   id:'CONTENT-'+(pageStrategies.length+1),topicCluster:cluster,service,location:area,
   primaryKeyword:primary.phrase,supportingKeywords:keys.filter(k=>k!==primary).slice(0,5).map(k=>k.phrase),
   targetPage:target?.url||proposedUrl,pageStatus:target?'existing_supplied_fixture':'proposed_not_live',
   priority:labelPriority(target,seoReport),objective:'Help relevant customers understand the service and make an informed enquiry; no ranking or conversion guarantee.',
   searchIntent:[...new Set(keys.map(k=>k.intent))],
   titleDraft:title,metaDescriptionDraft:recommendedMeta(service,area),
   headings:[service+' in '+area,'What this service includes','Where the service is available','Questions customers frequently ask','How to enquire'],
   contentSections:[
    {heading:'What this service includes',draft:'Provide a clear, owner-reviewed summary of '+service+' and the limits of the work available in '+area+'.',requiresConfirmation:['exact_service_scope']},
    {heading:'Local service information',draft:'Explain the parts of '+area+' covered, access arrangements and how enquiries are handled.',requiresConfirmation:['location_coverage','availability']},
    {heading:'What happens next',draft:angle.shortAnswer,requiresConfirmation:['booking_steps','staff_qualifications']}
   ],
   detailChecklist:angle.helpfulDetails,internalLinkSuggestions:internalTargets,technicalFindings:missing,
   sourceEvidence:{keyword:evidenceForKeyword(primary),page:target?evidenceForPage(target):null,
    searchObservations:matching.map(o=>({query:o.query,clicks:o.evidence.clicks,impressions:o.evidence.impressions,
     period:o.evidence.range,property:o.evidence.property,source:SOURCE.import}))},
   searchDemandStatus:matching.length?'observed_in_user_export_unverified':'hypothesis_not_measured',
   reviewStatus:'draft_requires_human_fact_check',publicationEnabled:false
  });
 }
 const geoPages=approvedPages.slice(0,8).map(page=>{
  const visibility=profileVisibility(business,page);
  const items=[
   ['business_identity',visibility.hasName,'Clearly present the business name in supplied page text.'],
   ['services',visibility.hasService,'Explain which specific services are offered with accurate detail.'],
   ['location',visibility.hasArea,'State actual service areas consistently and precisely.'],
   ['clear_headings',page.h1.length===1,'Use one descriptive H1 and topic-organised H2 headings.'],
   ['structured_business_data',page.schemaTypes.some(t=>/localbusiness|organization|medicalclinic/i.test(t)),'Review truthful organization/local-business schema and site-visible details.'],
   ['enquiry_path',visibility.hasContact,'Provide a clear, working contact or enquiry route.'],
   ['contact_details',visibility.hasPhone,'Review public contact details and ensure they match actual business information.'],
   ['first_hand_proof',false,'Add owner-approved case studies or service photos only with consent and evidence.'],
   ['credentials',false,'Show verifiable qualifications or professional credentials only after approval.'],
   ['source_references',false,'Reference trustworthy documents where substantive factual claims require support.']
  ];
  return {url:page.url,mode:'supplied_html_excerpt_not_live_scan',
   checks:items.map(([id,found,advice])=>({id,observation:found?'signal_observed_in_supplied_extract':'not_observed_or_not_verifiable_in_excerpt',
    recommendation:advice,provenance:evidenceForPage(page)})),
   observedSignals:items.filter(x=>x[1]).length,
   totalChecks:items.length,
   readinessScore:null,
   caveat:'Checklist coverage only; not an AI-search citation, ranking or visibility score.'};
 });
 const questions=[],seen=new Set();
 for(const item of pageStrategies.slice(0,10)){
  const matching=searchAnalysis?.opportunities.filter(o=>
   o.service===item.service && (/^(how|what|when|where|why|can|is|does|should)\b/i.test(o.query)||o.query.includes('?'))).slice(0,3)||[];
  const base=[...matching.map(o=>({question:o.query,source:SOURCE.import,detail:o.evidence})),
    {question:serviceAngle(item.service).faq,source:SOURCE.hypothesis,detail:item.sourceEvidence.keyword},
    {question:'Which areas are covered for '+item.service+'?',source:SOURCE.hypothesis,detail:item.sourceEvidence.keyword}];
  for(const v of base){
   const key=trim(v.question).toLowerCase();if(seen.has(key)||questions.length>=18)continue;seen.add(key);
   const type=serviceAngle(item.service);
   const answer=v.source===SOURCE.import?
    'Answer the observed search question directly using owner-approved service facts and relevant documentation. Confirm availability, price and practitioner credentials before making a claim.':
    key.startsWith('which areas')?
    'Confirm whether the business serves '+item.location+' and specify the exact locations and any restrictions before publishing.':
    type.shortAnswer;
   questions.push({id:'ANSWER-'+(questions.length+1),question:v.question,
    directAnswerDraft:answer,followUpTopics:[item.service+' scope','Confirmed local coverage','How to make an enquiry'],
    targetPage:item.targetPage,
    factualBasis:'declared_business_services_and_operator_supplied_fixture',
    factChecksRequired:['service_scope','coverage','operating_hours','pricing','qualifications'],
    evidence:{source:v.source,reference:v.detail,verifiedByExternalProvider:false},
    references:[],status:'draft_requires_owner_approval',
    schemaAdvice:'FAQPage only where eligible, genuinely visible and consistent with search-platform guidance',
    patientSpecificAdvice:false,guaranteedAIVisibility:false});
  }
 }
 const socialProposals=pageStrategies.slice(0,4).map((p,i)=>({
  id:'SOCIAL-'+(i+1),channelIdeas:['short_vertical_video','educational_carousel','local_business_post'],
  concept:serviceAngle(p.service).socialIdea,
  angle:'Helpful local education, not an unverified testimonial or result promise.',
  suggestedHook:'Before you enquire about '+p.service+' in '+p.location+', consider these questions.',
  callToAction:'Ask '+business.name+' to confirm their service details and enquiry options.',
  factsToVerify:['offered_service','exact_area','contact_route'],
  status:'draft_for_review',publishEnabled:false
 }));
 const recommendations=pageStrategies.slice(0,15).map((p,i)=>({
  id:'PLAN-'+(i+1),owner:'Codeedge editor and business owner',url:p.targetPage,priority:p.priority,
  action:p.pageStatus==='existing_supplied_fixture'?'Review and improve the supplied service page':'Propose a service page; confirm it does not duplicate an existing live page',
  why:'Align service/local intent, supporting questions and verified business details.',
  evidence:p.sourceEvidence,expectedOutcome:'Clearer service explanation and enquiry route; impact not measured.',
  status:'proposed_not_submitted',completionEvidence:null
 }));
 return Object.freeze({
  version:'growth-starter.premium-content-plan.v1',workspaceId:seoReport.workspaceId,
  business:{name:business.name,country:business.country,city:business.city,industry:business.industry,
   website:business.website,ownershipStatus:business.ownershipStatus},
  generatedFrom:{seoReportVersion:seoReport.version,searchEvidenceStatus:searchAnalysis?'user_supplied_gsc_not_live_verified':'not_connected',
   sourceMode:'offline_supplied_html_only'},
  seo:{pages:pageStrategies,cannibalisationWarnings:seoReport.cannibalisationWarnings,
   technicalPriorities:seoReport.siteAudit.findings.slice(0,12),keywordMetricsStatus:'Not available'},
  geo:{pages:geoPages,providerObservation:{status:'not_connected',citations:null,referrals:null,AIOverviews:null},
   providerContract:{version:'codeedge.geo-observation-read.v1',enabled:false,requires:['trusted_observable_source','explicit_website_scope','consent','dated_provenance']}},
  aeo:{answers:questions},sco:{reviewChecklist:['Intent match','Unique helpful page purpose','Verified local business details','Source-supported trust claims','Descriptive headings','Readable direct answers','Relevant internal links','Accessible contact action','Content freshness']},
  local:{profileClaimsVerified:false,googleBusinessProfile:'not_connected',
   priorities:['Confirm service areas and contact details','Review truthful relevant LocalBusiness structured data','Prepare owner-approved business description and FAQs','Seek genuine reviews without misleading incentives']},
  social:{proposals:socialProposals},tasks:recommendations,
  externalActions:{crawl:false,persist:false,edit:false,approve:false,publish:false},
  limitations:['Content and business facts require independent human verification.',
   'GEO checklist is NOT evidence of ChatGPT/Gemini/AI Overview citation or visibility.',
   'All search volume, difficulty, CPC, rankings, citations, backlinks and competitor traffic are Not available.',
   'Supplied HTML excerpts cannot prove absence of features elsewhere on the live site.',
   'No live Google, AI-search provider, social platform or publishing connection.']
 });
}
const csvCell=x=>{const v=trim(x??'Not available');return '"'+(/^[\s]*[=+\-@\t\r]/.test(v)?"'"+v:v).replace(/"/g,'""')+'"';};
export function exportPremiumStrategyCsv(result){
 requireValid(result?.version==='growth-starter.premium-content-plan.v1','Valid premium content plan required.');
 const keys=['service','location','primary_keyword','supporting_keywords','target_url','source_status','priority','draft_title','draft_meta','review_status'];
 const rows=result.seo.pages.map(p=>[p.service,p.location,p.primaryKeyword,p.supportingKeywords.join('; '),p.targetPage,p.searchDemandStatus,p.priority,p.titleDraft,p.metaDescriptionDraft,p.reviewStatus]);
 return [keys,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n');
}
export function requestPremiumPublication(){throw Error('Publishing disabled until independently verified tenant identity and human approval.');}
