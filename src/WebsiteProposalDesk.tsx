import {useMemo,useState} from 'react';
import {Download,FilePenLine,ShieldCheck} from 'lucide-react';
import type {SeoReport} from '../backend/seo-growth.mjs';
import type {PremiumPlan} from '../backend/premium-content-intelligence.mjs';
import {prepareWebsiteImprovementProposals} from '../backend/website-proposals.mjs';
import './website-proposals.css';
function offlineDownload(name:string,data:string){
 const href=URL.createObjectURL(new Blob([data],{type:'application/json'}));
 try{const a=document.createElement('a');a.href=href;a.download=name;a.click();}
 finally{window.setTimeout(()=>URL.revokeObjectURL(href),1000);}
}
export default function WebsiteProposalDesk({seoReport,premiumPlan}:{
 seoReport:SeoReport;premiumPlan:PremiumPlan
}){
 const [index,setIndex]=useState(0),[correction,setCorrection]=useState('');
 const result=useMemo(()=>{
  try{return {data:prepareWebsiteImprovementProposals({seoReport,premiumPlan}),error:''};}
  catch(e){return {data:null,error:e instanceof Error?e.message:'Proposal not available.'};}
 },[seoReport,premiumPlan]);
 const pack=result.data,p=pack?.proposals[Math.min(index,(pack?.proposals.length||1)-1)];
 return <div className="wpd" aria-label="Review website improvement proposals">
  <div className="wpd-header"><FilePenLine size={20}/><div><h4>Proposed website improvements</h4>
    <p>Before/after drafts based only on supplied HTML and business context. Changes require independent Codeedge and client review.</p></div></div>
  {result.error?<p role="alert">{result.error}</p>:!pack||!p?<p>No page proposal available.</p>:<>
   <label className="wpd-picker">Choose a proposed page
     <select value={index} onChange={e=>{setIndex(Number(e.target.value));setCorrection('');}}>
      {pack.proposals.map((x,i)=><option value={i} key={x.id}>{x.type==='existing_page_content_proposal'?'Supplied page':'New draft page'} · {x.url}</option>)}
     </select></label>
   <p className="wpd-source"><ShieldCheck size={14}/> {p.before.source==='operator_supplied_html'?'Existing page = operator-supplied extract, not a live crawl':'New page proposal, no verified live URL'}</p>
   <div className="wpd-diff">
     <section><small>BEFORE · SUPPLIED EVIDENCE</small><dl>
       <dt>Title</dt><dd>{p.before.title||'Not available'}</dd>
       <dt>Description</dt><dd>{p.before.description||'Not available'}</dd>
       <dt>Heading</dt><dd>{p.before.heading||'Not available'}</dd>
      </dl></section>
     <section><small>AFTER · DRAFT ONLY</small><dl>
       <dt>Title</dt><dd>{p.after.title}</dd>
       <dt>Description</dt><dd>{p.after.description}</dd>
       <dt>Heading</dt><dd>{p.after.heading}</dd>
      </dl></section>
   </div>
   <div className="wpd-section"><strong>Proposed content structure</strong>
    {p.after.sections.map((s,i)=><p key={i}><strong>{s.heading}</strong> — {s.draft} <em>Facts to confirm: {s.verify.join(', ')}</em></p>)}
   </div>
   <label className="wpd-note">Client feedback or correction request — local draft, not submitted
    <textarea rows={3} maxLength={600} value={correction} onChange={e=>setCorrection(e.target.value)}
     placeholder="For example: this service is only available within Manchester city limits."/></label>
   <div className="wpd-actions">
    <button type="button" onClick={()=>offlineDownload('codeedge-content-correction-draft.json',JSON.stringify({
      status:'local_correction_draft_not_submitted',workspaceId:pack.workspaceId,
      proposal:p,correctionRequested:correction.trim().slice(0,600),
      acknowledged:false,authorisedActor:null
    },null,2))}><Download size={14}/> Download local review draft</button>
    <button type="button" disabled title="Hosted identity and transaction gate not accepted">Send to Codeedge — disabled</button>
   </div>
   <p className="wpd-warning">No agency notification, content modification, hosting deployment, approval or report persistence has occurred.</p>
  </>}
 </div>;
}
