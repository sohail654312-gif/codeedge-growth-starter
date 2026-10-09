import {useState} from 'react';
import {ArrowRight, Download, FileSearch, ShieldCheck, Sparkles} from 'lucide-react';
import {FICTIONAL_SEO_FIXTURES} from '../backend/seo-fixtures.mjs';
import {runOfflineGrowthReport,exportKeywordCsv} from '../backend/seo-growth.mjs';
import type {SeoReport} from '../backend/seo-growth.mjs';
import './seo-growth.css';
import SearchPerformancePanel from './SearchPerformancePanel';
import PremiumContentPanel from './PremiumContentPanel';
import type {SearchAnalysis} from '../backend/seo-search-data.mjs';

type DemoChoice='plumbing'|'clinic';
function saveLocally(fileName:string,data:string,type:string){
  const blob=new Blob([data],{type});
  const url=URL.createObjectURL(blob);
  try{
    const anchor=document.createElement('a');
    anchor.href=url;anchor.download=fileName;anchor.click();
  }finally{window.setTimeout(()=>URL.revokeObjectURL(url),1000);}
}
export default function SeoGrowthManager({demo}:{demo:boolean}){
  const [choice,setChoice]=useState<DemoChoice>('plumbing');
  const [service,setService]=useState(FICTIONAL_SEO_FIXTURES.plumbing.business.services[0]);
  const [area,setArea]=useState(FICTIONAL_SEO_FIXTURES.plumbing.business.serviceAreas[0]);
  const [instruction,setInstruction]=useState('Improve my website SEO, research keywords and show me what needs changing.');
  const [providedHtml,setProvidedHtml]=useState('');
  const [acknowledge,setAcknowledge]=useState(false);
  const [report,setReport]=useState<SeoReport|null>(null);
  const [premiumSource,setPremiumSource]=useState<{seo:SeoReport;analysis:SearchAnalysis}|null>(null);
  const [error,setError]=useState('');
  const selected=FICTIONAL_SEO_FIXTURES[choice];
  function switchDemo(value:DemoChoice){
    const next=FICTIONAL_SEO_FIXTURES[value];
    setChoice(value);setService(next.business.services[0]);setArea(next.business.serviceAreas[0]);
    setProvidedHtml('');setAcknowledge(false);setReport(null);setPremiumSource(null);setError('');
  }
  function generate(){
    setReport(null);setPremiumSource(null);setError('');
    try{
      if(providedHtml && !acknowledge)throw Error('Confirm you are authorised to use the supplied HTML.');
      const business={...selected.business,services:[service],serviceAreas:[area]};
      const pages=selected.pages.map((page,i)=>i===0 && providedHtml
        ? {...page,html:providedHtml}:page);
      const output=runOfflineGrowthReport({
        workspaceId:business.workspaceId,business,pages,
        instruction:instruction.trim(),asOf:new Date().toISOString()
      });
      setReport(output);
    }catch(caught){setError(caught instanceof Error?caught.message:'Offline analysis unavailable.');}
  }
  return <section className="sgm" aria-label="SEO Growth Manager offline research">
    <div className="sgm-banner">
      <span className="sgm-symbol"><Sparkles size={22}/></span>
      <div><small>AI SEO & AEO GROWTH MANAGER</small>
        <h2>From a simple instruction to a clear SEO plan.</h2>
        <p>Try the working offline research engine with invented business pages. It generates keyword hypotheses, page audit findings, reviewed answer ideas and tasks — not fictional search statistics.</p>
      </div>
    </div>
    <div className="sgm-trust"><ShieldCheck size={17}/>
      <span>Offline research only · No web crawling, Google data connection, saving, agency assignment or publishing</span>
    </div>
    {!demo&&<p className="sgm-private"><ShieldCheck size={15}/>
      Your authenticated workspace is not connected to the SEO engine yet. These examples stay fictional and local to this browser session; your live business data is never accessed.</p>}
    <div className="sgm-form">
      <div className="sgm-section-label"><span>1</span><strong>Select an example business and goal</strong></div>
      <div className="sgm-input-grid">
        <label>Fictional business
          <select value={choice} onChange={e=>switchDemo(e.target.value as DemoChoice)}>
            <option value="plumbing">Atlas Plumbing · Manchester (fictional)</option>
            <option value="clinic">Northstar Skin Clinic · Peshawar (fictional)</option>
          </select>
        </label>
        <label>Target service
          <select value={service} onChange={e=>{setService(e.target.value);setReport(null);}}>
            {selected.business.services.map(x=><option key={x}>{x}</option>)}
          </select>
        </label>
        <label>Target location
          <select value={area} onChange={e=>{setArea(e.target.value);setReport(null);}}>
            {selected.business.serviceAreas.map(x=><option key={x}>{x}</option>)}
          </select>
        </label>
      </div>
      <div className="sgm-section-label"><span>2</span><strong>Tell Codeedge what you want to improve</strong></div>
      <label className="sgm-full">Your instruction
        <textarea value={instruction} onChange={e=>{setInstruction(e.target.value);setReport(null);}}
          maxLength={300} rows={2} aria-describedby="sgm-command-help"/>
      </label>
      <p id="sgm-command-help" className="sgm-hint">The instruction is recorded as the brief. Targeting comes from the selected service and area; no chatbot or external AI API is being called.</p>
      <details className="sgm-optional"><summary>Optional: audit your own authorised HTML sample (offline)</summary>
        <p>Paste only public, nonsensitive page HTML you own or are authorised to inspect. It replaces the fictional homepage fixture for this temporary offline analysis. No network requests are made.</p>
        <label>Page HTML (maximum 120,000 characters)
          <textarea value={providedHtml} maxLength={120000} rows={4}
            onChange={e=>{setProvidedHtml(e.target.value);setReport(null);}} placeholder="<!doctype html>..."/>
        </label>
        {providedHtml&&<label className="sgm-check"><input type="checkbox" checked={acknowledge}
          onChange={e=>setAcknowledge(e.target.checked)}/>
          I am authorised to analyse this page content, and it contains no confidential or patient information.
        </label>}
      </details>
      {error&&<p role="alert" className="sgm-error">{error}</p>}
      <button type="button" className="sgm-run" onClick={generate}>
        <FileSearch size={17}/> Generate offline SEO plan <ArrowRight size={17}/>
      </button>
    </div>
    {!report?<div className="sgm-empty"><FileSearch size={24}/>
      <strong>Your research report will appear here.</strong>
      <p>Run the offline example to review keyword targeting, real fixture-based HTML findings and proposed next steps.</p>
    </div>:<div className="sgm-results" aria-live="polite">
      <div className="sgm-result-header">
        <div><small>OFFLINE REPORT · SOURCE: SUPPLIED HTML FIXTURES</small>
          <h3>{report.business.name}</h3>
          <p>{service} · {area} · Generated {new Date(report.generatedAt).toLocaleDateString('en-GB')}</p>
        </div>
        <div className="sgm-export">
          <button type="button" onClick={()=>saveLocally('growth-starter-seo-keywords.csv',exportKeywordCsv(report),'text/csv;charset=utf-8')}>
            <Download size={14}/> Keyword CSV</button>
          <button type="button" onClick={()=>saveLocally('growth-starter-seo-report.json',JSON.stringify(report,null,2),'application/json')}>
            <Download size={14}/> Full report</button>
        </div>
      </div>
      <div className="sgm-kpis">
        <div><strong>{report.keywords.length}</strong><span>Keyword hypotheses</span></div>
        <div><strong>{report.siteAudit.pages.length}</strong><span>HTML fixtures reviewed</span></div>
        <div><strong>{report.tasks.length}</strong><span>Reviewable tasks</span></div>
        <div><strong>Not connected</strong><span>Real Google metrics</span></div>
      </div>
      <div className="sgm-columns">
        <article className="sgm-result-card"><h4>Keyword plan</h4>
          <p>Topic, search intent and target page are proposed — not based on measured demand.</p>
          <div className="sgm-table-wrap"><table><thead><tr><th>Candidate keyword</th><th>Intent</th><th>Page plan</th></tr></thead>
            <tbody>{report.keywords.slice(0,12).map(k=><tr key={k.phrase}><td>{k.phrase}<small>{k.confidence} confidence · Volume: Not available</small></td>
              <td>{k.intent}</td><td>{k.mapping==='existing_fixture_page'?'Existing fixture':'Proposed page'}</td></tr>)}</tbody></table></div>
          {report.keywords.length>12&&<small>Showing 12 of {report.keywords.length}; export CSV for the full plan.</small>}
        </article>
        <article className="sgm-result-card"><h4>Technical SEO audit</h4>
          <p>Observations from operator-supplied HTML and HTTP-status fixtures, never live site measurements.</p>
          {report.siteAudit.findings.slice(0,8).map(task=><div className="sgm-finding" key={task.id}>
            <span className={'sgm-priority '+(task.priority==='high'?'sgm-high':'')}>{task.priority}</span>
            <div><strong>{task.finding}</strong><small>{task.url}</small></div>
          </div>)}
          {report.siteAudit.findings.length>8&&<small>Additional findings included in the full report.</small>}
        </article>
      </div>
      <div className="sgm-columns">
        <article className="sgm-result-card"><h4>Answer engine optimisation (AEO)</h4>
          {report.aeo.map(x=><div className="sgm-answer" key={x.id}><strong>{x.question}</strong>
            <p>{x.answerDraft}</p><small>Needs human fact-check · No AI visibility guarantee</small></div>)}
        </article>
        <article className="sgm-result-card"><h4>Proposed Codeedge work</h4>
          {report.tasks.slice(0,7).map(t=><div className="sgm-task" key={t.id}>
            <strong>{t.recommendation}</strong>
            <small>{t.priority} priority · {t.status.replace(/_/g,' ')} · {t.url}</small>
          </div>)}
          {report.tasks.length>7&&<small>See the full report for {report.tasks.length} reviewable tasks.</small>}
          <button type="button" disabled title="Agency task creation requires verified hosted identity and transactional authorisation">
            Request Codeedge implementation — awaiting security approval
          </button>
        </article>
      </div>
      {report.cannibalisationWarnings.length>0&&<p className="sgm-private">
        Potential topic overlap: {report.cannibalisationWarnings.length} proposed target pages serve multiple clusters. Review before publishing.</p>}
      <div className="sgm-trust"><ShieldCheck size={17}/><span>
        All keyword demand, CPC, rankings, AI citations and traffic metrics: <strong>Not available.</strong> Nothing was saved or published. Live analytics require separately approved provider OAuth and verified tenant isolation.
      </span></div>
    </div>}
    <SearchPerformancePanel key={choice} seoReport={report} fictionalKind={choice}
      onAnalysis={(seo,analysis)=>setPremiumSource({seo,analysis})} onReset={()=>setPremiumSource(null)}/>
    <PremiumContentPanel seoReport={premiumSource?.seo||report} searchAnalysis={premiumSource?.analysis||null}/>
  </section>;
}
