import {useMemo,useState} from 'react';
import {BookOpen,Download,FileText,ShieldCheck} from 'lucide-react';
import type {SeoReport} from '../backend/seo-growth.mjs';
import type {SearchAnalysis} from '../backend/seo-search-data.mjs';
import {buildPremiumContentStrategy,exportPremiumStrategyCsv} from '../backend/premium-content-intelligence.mjs';
import './premium-content.css';
type Tab='seo'|'geo'|'aeo'|'sco'|'social';
function saveOffline(name:string,value:string,mime:string){
 const url=URL.createObjectURL(new Blob([value],{type:mime}));
 try{const link=document.createElement('a');link.href=url;link.download=name;link.click();}
 finally{window.setTimeout(()=>URL.revokeObjectURL(url),1000);}
}
export default function PremiumContentPanel({seoReport,searchAnalysis=null}:{
 seoReport:SeoReport|null;searchAnalysis?:SearchAnalysis|null;
}){
 const [tab,setTab]=useState<Tab>('seo');
 const [expanded,setExpanded]=useState(0);
 const state=useMemo(()=>{
  if(!seoReport)return {plan:null,error:''};
  try{return {plan:buildPremiumContentStrategy({seoReport,searchAnalysis}),error:''};}
  catch(e){return {plan:null,error:e instanceof Error?e.message:'Content plan unavailable.'};}
 },[seoReport,searchAnalysis]);
 const plan=state.plan;
 const menu:Array<{id:Tab;label:string}>=[
  {id:'seo',label:'SEO strategy'},{id:'geo',label:'GEO readiness'},
  {id:'aeo',label:'Answers & FAQ'},{id:'sco',label:'SCO & local'},
  {id:'social',label:'Social content'}
 ];
 return <section className="pci" aria-label="Premium SEO GEO AEO and content intelligence">
  <header className="pci-top">
   <div><small>CODEEDGE · PREMIUM CONTENT INTELLIGENCE</small>
    <h3>One research brief. A complete content plan.</h3>
    <p>Professional strategy proposals derived from supplied evidence. Every service claim, contact detail and qualification still needs human review.</p></div>
   <BookOpen size={23}/>
  </header>
  <p className="pci-trust"><ShieldCheck size={15}/> OFFLINE CONTENT PROPOSALS · No Google or AI-search citations verified · No publishing or client-storage access</p>
  {!seoReport?<p className="pci-empty">Generate an offline SEO plan above to review tailored content recommendations.</p>:state.error?
    <p className="pci-error" role="alert">{state.error}</p>:plan&&<>
   <div className="pci-summary"><div><strong>{plan.seo.pages.length}</strong><small>Topic clusters</small></div>
    <div><strong>{plan.geo.pages.length}</strong><small>Page excerpts evaluated</small></div>
    <div><strong>{plan.aeo.answers.length}</strong><small>Questions to review</small></div>
    <div><strong>Not available</strong><small>Verified AI citations</small></div></div>
   <div className="pci-source">
    <span>{plan.business.name} · {plan.business.city}</span>
    <span>{plan.generatedFrom.searchEvidenceStatus==='not_connected'?'Keyword hypotheses only':'Imported GSC observations — not live API verified'}</span>
   </div>
   <div className="pci-nav" role="group" aria-label="Content strategy sections">
    {menu.map(item=><button key={item.id} type="button" aria-pressed={tab===item.id}
     onClick={()=>setTab(item.id)}>{item.label}</button>)}
   </div>
   {tab==='seo'&&<article className="pci-section">
    <h4>Service pages and search-intent strategy</h4>
    <p>Titles and sections are drafts. Primary keywords are relevance hypotheses, not measured search volume.</p>
    <label className="pci-picker">Select a service/location topic
     <select value={Math.min(expanded,plan.seo.pages.length-1)} onChange={e=>setExpanded(Number(e.target.value))}>
      {plan.seo.pages.map((p,i)=><option value={i} key={p.id}>{p.service} · {p.location}</option>)}
     </select></label>
    {plan.seo.pages.length>0&&(()=>{
     const p=plan.seo.pages[Math.min(expanded,plan.seo.pages.length-1)];
     return <div className="pci-brief">
      <small>{p.pageStatus==='existing_supplied_fixture'?'Existing supplied page':'Proposed page — not live'} · {p.priority} priority</small>
      <h5>{p.titleDraft}</h5>
      <p>{p.metaDescriptionDraft}</p>
      <dl><dt>Primary topic</dt><dd>{p.primaryKeyword}</dd>
       <dt>Supporting searches</dt><dd>{p.supportingKeywords.join(' · ')||'Not available'}</dd>
       <dt>Page target</dt><dd className="pci-break">{p.targetPage}</dd>
       <dt>Evidence</dt><dd>{p.searchDemandStatus==='observed_in_user_export_unverified'?'Observed in a manually supplied, unverified Search Console export':'Generated from service/location context only'}</dd></dl>
      <strong>Suggested headings</strong>
      <ul>{p.headings.map((h,i)=><li key={i}>{h}</li>)}</ul>
      <strong>Suggested content sections</strong>
      {p.contentSections.map((s,i)=><div className="pci-draft" key={i}><strong>{s.heading}</strong><p>{s.draft}</p><small>Verify: {s.requiresConfirmation.join(', ')}</small></div>)}
      <strong>Evidence-led next steps</strong>
      <ul>{p.detailChecklist.map((x,i)=><li key={i}>{x}</li>)}</ul>
      {p.sourceEvidence.searchObservations.length>0&&
        <p className="pci-signal">User-import observations: {p.sourceEvidence.searchObservations.map(x=>x.query+' ('+x.impressions+' exported-row impressions)').join('; ')}. No demand estimate.</p>}
     </div>;
    })()}
    {plan.seo.cannibalisationWarnings.length>0&&<p>Possible keyword overlap requires manual page review; no automatic consolidation.</p>}
   </article>}
   {tab==='geo'&&<article className="pci-section">
    <h4>GEO content-readiness audit</h4>
    <p>These are checks of supplied page extracts, not AI answer-engine ranking or citation scores. A missing signal does not prove it is absent from the live site.</p>
    {plan.geo.pages.slice(0,4).map((page,i)=><details key={page.url} open={i===0}>
     <summary className="pci-break">{page.url} · {page.observedSignals}/{page.totalChecks} signals observed in excerpt</summary>
     {page.checks.map(c=><div className="pci-check" key={c.id}>
      <strong>{c.id.replace(/_/g,' ')}</strong><span>{c.observation==='signal_observed_in_supplied_extract'?'Observed in supplied text':'Not observed or not verifiable'}</span>
      <p>{c.recommendation}</p></div>)}
    </details>)}
    <p className="pci-signal">AI referrals, AI search citations and AI Overview placements: <strong>Not available.</strong></p>
   </article>}
   {tab==='aeo'&&<article className="pci-section">
    <h4>Answer-first FAQ drafts</h4>
    <p>Questions derived from business topics or user-supplied search exports are not necessarily actual customer FAQs.</p>
    {plan.aeo.answers.slice(0,12).map(a=><div className="pci-draft" key={a.id}>
     <strong>{a.question}</strong><p>{a.directAnswerDraft}</p>
     <small>Source: {a.evidence.source.replace(/_/g,' ')} · Human fact check required: {a.factChecksRequired.join(', ')}</small>
    </div>)}
    <p className="pci-signal">Schema.org FAQPage eligibility requires genuine visible Q&A and platform-specific rules; no rich-result guarantee.</p>
   </article>}
   {tab==='sco'&&<article className="pci-section">
    <h4>Search content and local visibility checklist</h4>
    <ul>{plan.sco.reviewChecklist.map(x=><li key={x}>{x}</li>)}</ul>
    <h4>Local SEO and Google Business Profile</h4>
    <ul>{plan.local.priorities.map(x=><li key={x}>{x}</li>)}</ul>
    <p>Google Business Profile: <strong>Not connected</strong>. No location performance or review counts have been verified.</p>
    <h4>Codeedge tasks for human review</h4>
    {plan.tasks.slice(0,8).map(t=><p className="pci-task" key={t.id}><strong>{t.priority}:</strong> {t.action} · {t.url}</p>)}
   </article>}
   {tab==='social'&&<article className="pci-section">
    <h4>Social content intelligence</h4>
    <p>Platform adaptation ideas only. No posting, scheduling, automated research or real-world trending claims.</p>
    {plan.social.proposals.map(s=><div className="pci-draft" key={s.id}>
     <strong>{s.suggestedHook}</strong><p>{s.concept}</p>
     <small>Format ideas: {s.channelIdeas.join(', ')} · {s.status.replace(/_/g,' ')}</small></div>)}
   </article>}
   <div className="pci-actions">
    <button type="button" onClick={()=>saveOffline('codeedge-premium-content-plan.json',JSON.stringify(plan,null,2),'application/json')}><Download size={15}/> Full JSON plan</button>
    <button type="button" onClick={()=>saveOffline('codeedge-premium-seo-pages.csv',exportPremiumStrategyCsv(plan),'text/csv;charset=utf-8')}><FileText size={15}/> Service page CSV</button>
    <button type="button" disabled title="Live workspace approval and secure persistence have not passed security acceptance">Request implementation — blocked</button>
   </div>
   <p className="pci-limit">{plan.limitations.join(' ')}</p>
  </>}
 </section>;
}
