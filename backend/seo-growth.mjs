/**
 * Phase 2.6 provider-neutral OFFLINE SEO/AEO research core.
 * No fetch, DNS, filesystem, privileged store, database mutation or LLM API.
 * Inputs are caller-provided HTML evidence, never live crawl results.
 */
export const SEO_LIMITS=Object.freeze({pages:8,htmlBytes:120000,services:6,areas:4,keywords:64,links:70});
const assert=(ok,message)=>{if(!ok)throw Error(message);};
const tidy=x=>String(x??'').replace(/\s+/g,' ').trim();
function field(x,label,max=120){
 assert(typeof x==='string' && tidy(x).length>0 && tidy(x).length<=max,label+' must be nonempty bounded text.');
 return tidy(x);
}
function strings(input,label,maxCount,maxLength=90){
 assert(Array.isArray(input) && input.length>0 && input.length<=maxCount,label+' needs bounded items.');
 const result=input.map(x=>field(x,label,maxLength));
 assert(new Set(result.map(x=>x.toLowerCase())).size===result.length,label+' must be unique.');
 return result;
}
const safeWorkspace=s=>typeof s==='string' && /^ws_[A-Za-z0-9_-]{8,128}$/.test(s);
function httpsUrl(value){
 const s=field(value,'Website',500);let u;
 try{u=new URL(s);}catch{throw Error('Valid HTTPS website required.');}
 assert(u.protocol==='https:' && !u.username && !u.password && !u.hash && !u.search &&
   u.port==='' && u.hostname.includes('.') && !u.hostname.endsWith('.') &&
   !/^\d+(?:\.\d+){1,3}$/.test(u.hostname) &&
   !u.hostname.includes(':') && // no IPv6 or literal IP endpoints
   !/(^|\.)(localhost|local|internal|lan|home|onion)$/i.test(u.hostname) &&
   !/^\d/.test(u.hostname) && !/%/.test(s) && !/\\/.test(s),
   'Only public-looking HTTPS hostnames are accepted for offline evidence.');
 return u;
}
function pageUrl(value,origin){
 const u=httpsUrl(value);
 assert(u.origin===origin,'Pages must share the declared website origin.');
 assert(u.pathname.length<=200 && !u.pathname.includes('//'),'Unsafe page path.');
 return u;
}
const tagText=html=>tidy(html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi,' ')
  .replace(/<[^>]*>/g,' ')
  .replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' '));
function attr(tag,name){
 const regex=new RegExp('(?:^|\\s)'+name+'\\s*=\\s*(?:"([^"]*)"|\\x27([^\\x27]*)\\x27|([^\\s>]+))','i');
 const match=tag.match(regex);
 return match?(match[1]??match[2]??match[3]??'').trim():null;
}
function selectedMeta(html,key,value){
 for(const tag of html.match(/<meta\b[^>]*>/gi)||[])if((attr(tag,key)||'').toLowerCase()===value)return attr(tag,'content')||'';
 return '';
}
function selectedLink(html,rel){
 for(const tag of html.match(/<link\b[^>]*>/gi)||[])if((attr(tag,'rel')||'').toLowerCase().split(/\s+/).includes(rel))return attr(tag,'href')||'';
 return '';
}
function headings(html,tag){
 return [...html.matchAll(new RegExp('<'+tag+'\\b[^>]*>([\\s\\S]*?)<\\/'+tag+'\\s*>','gi'))]
   .slice(0,24).map(m=>tagText(m[1]).slice(0,180));
}
function pageEvidence(page,base){
 const u=pageUrl(page.url,base);
 assert(typeof page.html==='string' && page.html.length<=SEO_LIMITS.htmlBytes,'HTML fixture too large.');
 assert(Number.isInteger(page.status) && page.status>=100 && page.status<=599,'HTTP status fixture required.');
 const html=page.html;
 const title=tagText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1]||'').slice(0,180);
 const description=selectedMeta(html,'name','description').slice(0,320);
 const robots=selectedMeta(html,'name','robots').toLowerCase();
 const canonicalRaw=selectedLink(html,'canonical');
 let canonical=null,canonicalConcern=false;
 if(canonicalRaw){try{canonical=new URL(canonicalRaw,u.href).href;canonicalConcern=new URL(canonical).origin!==base;}catch{canonicalConcern=true;}}
 const links=[];
 for(const match of html.matchAll(/<a\b[^>]*>/gi)){
  if(links.length>=SEO_LIMITS.links)break;
  const href=attr(match[0],'href');if(!href || /^mailto:|^tel:|^javascript:/i.test(href))continue;
  try{const dest=new URL(href,u.href);if(dest.origin===base && dest.protocol==='https:')links.push(dest.pathname);}catch{}
 }
 const images=[...(html.match(/<img\b[^>]*>/gi)||[])].slice(0,90);
 const structured=[];
 for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)){
  if((attr(match[1],'type')||'').toLowerCase()!=='application/ld+json')continue;
  if(match[2].length>12000){structured.push('Unparseable JSON-LD');continue;}
  try{
   const data=JSON.parse(match[2]);
   const values=Array.isArray(data)?data:[data];
   for(const item of values.slice(0,12)){
    const type=item?.['@type'];if(typeof type==='string')structured.push(type);
    else if(Array.isArray(type))structured.push(...type.filter(x=>typeof x==='string').slice(0,8));
   }
  }catch{structured.push('Unparseable JSON-LD');}
 }
 const body=tagText(html);
 return Object.freeze({
  url:u.href,path:u.pathname,status:page.status,title,description,h1:headings(html,'h1'),
  h2:headings(html,'h2'),viewport:Boolean(selectedMeta(html,'name','viewport')),
  robots,canonical,canonicalConcern,links:[...new Set(links)],
  images:images.length,missingAlt:images.filter(x=>!tidy(attr(x,'alt'))).length,
  schemaTypes:[...new Set(structured)],words:body?body.split(' ').length:0,
  contentSample:body.slice(0,900),source:'supplied_html_fixture',
  responseStatusProvenance:'supplied_by_operator_not_network_verified'
 });
}
const slug=s=>tidy(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70)||'service';
const task=(id,code,page,detail,change,priority)=>({id,code,url:page.url,
 finding:detail,recommendation:change,priority,objective:'Improve page clarity and search discoverability; no ranking guarantee.',
 owner:'Codeedge review',status:'proposed_not_submitted',completionEvidence:null,
 provenance:{source:page.source,reference:page.url,kind:'supplied_fixture'},reviewHistory:[]});
function analyzePages(pages){
 const tasks=[], add=(p,code,finding,change,priority='medium')=>tasks.push(task('SEO-'+(tasks.length+1),code,p,finding,change,priority));
 for(const p of pages){
  if(p.status>=400)add(p,'http_status','Fixture response status '+p.status,'Investigate the failed page response.','high');
  if(!p.title)add(p,'missing_title','No HTML title found','Write a unique descriptive page title.','high');
  if(!p.description)add(p,'missing_description','No meta description found','Draft a concise accurate meta description.');
  if(p.h1.length!==1)add(p,'h1_structure',p.h1.length+' H1 headings found','Use one clear page topic heading.');
  if(!p.viewport)add(p,'mobile_viewport','No mobile viewport meta tag','Add a responsive viewport declaration.');
  if(!p.canonical)add(p,'canonical_missing','Canonical link not supplied','Review and set the canonical URL.');
  if(p.canonicalConcern)add(p,'canonical_external','Canonical points off the approved origin or is invalid','Confirm canonical ownership before changing.');
  if(p.missingAlt)add(p,'image_alt',p.missingAlt+' images have blank/missing alt text','Review images and add purposeful alt text; decorative images may use empty alt.');
  if(p.robots.includes('noindex'))add(p,'noindex','Page requests noindex','Confirm whether this page is intentionally excluded from search.','high');
  if(p.words<90)add(p,'thin_content','Only '+p.words+' extracted words in supplied HTML','Consider useful service details, FAQs and next steps.');
  if(!p.schemaTypes.length)add(p,'structured_data','No parsable JSON-LD structured data','Review accurate LocalBusiness/Service schema where applicable.');
  if(!p.links.length)add(p,'internal_links','No internal links observed','Add relevant links to nearby service and contact pages.');
 }
 for(const key of ['title','description']){
  const seen=new Map();
  for(const p of pages){
   const v=p[key]?.toLowerCase();if(!v)continue;
   if(seen.has(v))add(p,'duplicate_'+key,'Duplicate '+key+' also found on '+seen.get(v),
      'Give each page a distinct purpose and metadata.');
   else seen.set(v,p.url);
  }
 }
 const map=new Map(pages.map(x=>[x.path,x]));
 for(const p of pages)for(const target of p.links){
  const linked=map.get(target);
  if(linked && linked.status>=400)add(p,'broken_internal_link','Fixture link points to '+target+' (HTTP '+linked.status+')',
   'Fix or replace this internal link.','high');
 }
 return tasks.slice(0,80);
}
function offlineSiteDirectives(robotsTxt,sitemapXml,origin){
 assert(typeof robotsTxt==='string' && robotsTxt.length<=20000,'robots.txt fixture must be bounded.');
 assert(typeof sitemapXml==='string' && sitemapXml.length<=60000,'Sitemap XML fixture must be bounded.');
 const references=[];
 for(const line of robotsTxt.split(/\r?\n/)){
  const match=line.replace(/#.*/, '').trim().match(/^Sitemap\s*:\s*(\S+)/i);
  if(match && references.length<20){
    try{const u=new URL(match[1]);references.push({url:u.href,inScope:u.protocol==='https:'&&u.origin===origin});}
    catch{references.push({url:'invalid_reference',inScope:false});}
  }
 }
 const sitemapPaths=[];
 for(const match of sitemapXml.matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc\s*>/gi)){
  if(sitemapPaths.length>=40)break;
  try{const u=new URL(match[1].trim());if(u.origin===origin&&u.protocol==='https:')sitemapPaths.push(u.pathname);}
  catch{/* Invalid supplied sitemap links are not treated as valid crawl evidence. */}
 }
 return {
  status:robotsTxt||sitemapXml?'operator_supplied_offline_text':'not_supplied',
  robotsTxtPresent:Boolean(robotsTxt),sitemapXmlPresent:Boolean(sitemapXml),
  sitemapReferences:references,sitemapPaths:[...new Set(sitemapPaths)],
  allPagesBlockedByRobots:/^User-agent:\s*\*\s*\n\s*Disallow:\s*\/\s*(?:\n|$)/im.test(robotsTxt),
  evidence:'Provided text only: no robots/sitemap HTTP fetch or robots compliance claim.'
 };
}
const keywordMetrics=()=>({searchVolume:null,keywordDifficulty:null,cpc:null,ranking:null,traffic:null,
 metricsStatus:'not_connected'});
function planKeywords(business,pages,date){
 const records=[],dedup=new Set();
 function add(phrase,service,area,intent){
  const key=phrase.toLowerCase();if(dedup.has(key)||records.length>=SEO_LIMITS.keywords)return;
  dedup.add(key);
  const match=pages.find(p=>p.path.toLowerCase().includes(slug(service)));
  const proposed='/services/'+slug(service)+'-'+slug(area);
  records.push({
   phrase,geography:area,intent,cluster:service+' — '+area,
   targetPage:match?.url||new URL(proposed,business.website).href,
   mapping:match?'existing_fixture_page':'proposed_page_only',
   confidence:'low',uncertainty:'Candidate generated from declared services and locations; demand not measured.',
   provenance:{source:'service_location_combinations',kind:'hypothesis',observedAt:date},
   freshness:'Generated '+date+'; not evidence of search demand',
   rationale:'Relevant to the declared service and target geography.',
   suggestedTitle:service+' in '+area+' | '+business.name,
   suggestedHeading:service+' in '+area,
   internalLinkTarget:match?.url||new URL('/services',business.website).href,
   status:'suggested_for_human_review',reviewHistory:[],metrics:keywordMetrics()
  });
 }
 for(const service of business.services)for(const area of business.serviceAreas){
  add(service+' '+area,service,area,'local');
  add(service+' services in '+area,service,area,'commercial');
  add('how to choose '+service+' in '+area,service,area,'informational');
  add(service+' enquiry '+area,service,area,'conversion');
 }
 return records;
}
function aeoSuggestions(business,pages){
 return business.services.slice(0,4).map((service,i)=>({
  id:'AEO-'+(i+1),question:'What should customers know before choosing '+service+' in '+business.serviceAreas[0]+'?',
  answerDraft:'Explain the scope of '+service+', the area covered, how to contact the business, and any availability or qualifications only after checking those facts with the owner.',
  status:'draft_requires_fact_check',verifiedBusinessFacts:[],
  assumptions:['Service scope, availability, professional credentials, and pricing are unverified.'],
  suggestedSchema:'FAQPage — only if genuine, publicly visible FAQs meet current search-engine policies',
  targetPage:pages.find(p=>p.path.includes(slug(service)))?.url||null,
  evidence:'Client-supplied service and area only; not a verified customer search question.'
 }));
}
function validateBusiness(b){
 assert(b&&typeof b==='object','Business profile required.');
 assert(safeWorkspace(b.workspaceId),'Workspace ID is invalid.');
 const website=httpsUrl(b.website);
 assert(['fixture_only','verified','unverified'].includes(b.ownershipStatus),'Website ownership status required.');
 assert(['UK','Pakistan'].includes(b.country),'Country must be UK or Pakistan for current pilot fixtures.');
 return Object.freeze({
  workspaceId:b.workspaceId,name:field(b.name,'Business name'),industry:field(b.industry,'Industry'),
  country:b.country,city:field(b.city,'City'),website:website.origin,
  ownershipStatus:b.ownershipStatus,services:strings(b.services,'Services',SEO_LIMITS.services),
  serviceAreas:strings(b.serviceAreas,'Areas',SEO_LIMITS.areas),
  audience:field(b.audience,'Audience'),goals:strings(b.goals,'Goals',4,150),
  languages:strings(b.languages,'Languages',3,35)
 });
}
export function runOfflineGrowthReport({business:input,pages:fixtures,workspaceId,instruction,robotsTxt='',sitemapXml='',asOf='2026-10-08T00:00:00.000Z'}){
 assert(safeWorkspace(workspaceId),'Authorized workspace scope required.');
 const business=validateBusiness(input);
 assert(workspaceId===business.workspaceId,'Cross-workspace research denied.');
 const command=field(instruction,'Growth instruction',300);
 assert(Array.isArray(fixtures)&&fixtures.length>0&&fixtures.length<=SEO_LIMITS.pages,'Bounded HTML fixtures required.');
 assert(typeof asOf==='string'&&!Number.isNaN(Date.parse(asOf)),'Valid evidence timestamp required.');
 const pages=fixtures.map(p=>{
  assert(p?.workspaceId===workspaceId,'Cross-workspace page denied.');
  return pageEvidence(p,business.website);
 });
 assert(new Set(pages.map(p=>p.url)).size===pages.length,'Duplicate page fixture.');
 const directives=offlineSiteDirectives(robotsTxt,sitemapXml,business.website);
 const tasks=analyzePages(pages);
 if(directives.allPagesBlockedByRobots)tasks.push(task('SEO-ROBOTS','robots_disallow_all',pages[0],
   'Supplied robots.txt fixture disallows every path for wildcard crawlers',
   'Verify actual robots policy and intended indexing before adjusting it.','high'));
 const keywords=planKeywords(business,pages,asOf);
 const aeo=aeoSuggestions(business,pages);
 const localTask=keywords.filter(k=>k.mapping==='proposed_page_only').slice(0,4).map((k,i)=>({
  id:'KW-'+(i+1),code:'keyword_page_gap',url:k.targetPage,
  finding:'No supplied service page matches '+k.cluster,
  recommendation:'Review a distinct service page proposal with accurate local details and internal links.',
  priority:'medium',objective:'Cover service intent without promising visibility or results.',
  owner:'Codeedge review',status:'proposed_not_submitted',completionEvidence:null,
  provenance:k.provenance,reviewHistory:[]
 }));
 return Object.freeze({
  version:'growth-starter.seo-report.v1',workspaceId,business,instruction:command,
  generatedAt:asOf,mode:'offline_supplied_html_only',
  siteAudit:{pages,findings:tasks,directives},keywords,aeo,
  tasks:[...tasks,...localTask],cannibalisationWarnings:keywords
   .filter(k=>k.mapping==='existing_fixture_page')
   .reduce((acc,k)=>{const similar=keywords.filter(other=>other!==k&&other.targetPage===k.targetPage&&other.cluster!==k.cluster);if(similar.length&&!acc.includes(k.targetPage))acc.push(k.targetPage);return acc;},[]),
  analytics:{
   providers:['search_console','ga4','business_profile','web_performance','research_provider'].map(provider=>({
    provider,status:'not_connected',period:null,provenance:null,
    metrics:{impressions:null,clicks:null,ctr:null,averagePosition:null,
      organicLandingTraffic:null,conversions:null,localVisibility:null}
   }))
  },
  publication:{enabled:false,requiresHumanApproval:true},
  warnings:['All site data and HTTP statuses are operator-supplied fixtures, not live crawls.',
   'Keyword candidates are hypotheses, not verified search demand.',
   'No Google Search Console, Analytics, ranking, CPC or web performance data is connected.',
   'No changes were saved, requested, approved or published.']
 });
}
export function exportKeywordCsv(report){
 assert(report?.version==='growth-starter.seo-report.v1','Valid report required.');
 const header=['keyword','area','intent','cluster','target_page','mapping','confidence','source','search_volume','difficulty','cpc','rank','status'];
 const csv=cell=>{const text=String(cell??'Not available');const safe=/^[=+\-@\t\r]/.test(text)?"'"+text:text;return '"'+safe.replace(/"/g,'""')+'"';};
 const rows=report.keywords.map(k=>[k.phrase,k.geography,k.intent,k.cluster,k.targetPage,k.mapping,k.confidence,k.provenance.source,
   k.metrics.searchVolume,k.metrics.keywordDifficulty,k.metrics.cpc,k.metrics.ranking,k.status]);
 return [header,...rows].map(x=>x.map(csv).join(',')).join('\r\n');
}
/** Deliberate deny-all: network collection requires separate SSRF-safe reviewed adapter + approval. */
export function requestNetworkCrawl(){throw Error('Network crawling disabled. Supply explicitly authorized offline HTML fixtures.');}
export const INTEGRATION_CONTRACT=Object.freeze({
 version:'codeedge.marketing-read.v1',direction:'Growth Starter to Business OS read only',
 required:['businessIdentityMapping','workspaceAuthorization','consent','versionedProvenance'],
 growthStarterOwns:['goals','keywordPlans','auditReports','contentProposals','marketingTasks'],
 businessOSOwns:['crmLeads','conversations','receptionist','appointments','finance'],
 enabled:false
});
