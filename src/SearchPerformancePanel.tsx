import {useState} from 'react';
import {Download, FileSearch, ShieldCheck, UploadCloud} from 'lucide-react';
import type {SeoBusiness,SeoReport} from '../backend/seo-growth.mjs';
import {runOfflineGrowthReport} from '../backend/seo-growth.mjs';
import {demoGrowthReport,FICTIONAL_SEO_FIXTURES} from '../backend/seo-fixtures.mjs';
import {FICTIONAL_GSC} from '../backend/search-fixtures.mjs';
import {importSearchConsoleExport,analyzeImportedSearchEvidence,exportSearchAnalysisCsv,
  interpretSeoInstruction,SEARCH_IMPORT_LIMITS} from '../backend/seo-search-data.mjs';
import type {SearchAnalysis,SearchManifest} from '../backend/seo-search-data.mjs';
import './seo-search-data.css';

type InputMode='fictional'|'manual';
type TableType='query'|'page';
const scopedWorkspace='ws_local_offline_import_user';
function download(name:string,value:string,type:string){
  const url=URL.createObjectURL(new Blob([value],{type}));
  try{const anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();}
  finally{window.setTimeout(()=>URL.revokeObjectURL(url),1000);}
}
export default function SearchPerformancePanel({seoReport,fictionalKind}:{
  seoReport:SeoReport|null;fictionalKind:'plumbing'|'clinic';
}){
 const [mode,setMode]=useState<InputMode>('fictional');
 const [name,setName]=useState('My authorised business');
 const [website,setWebsite]=useState('');
 const [service,setService]=useState('');
 const [city,setCity]=useState('');
 const [country,setCountry]=useState<'UK'|'Pakistan'>('UK');
 const [html,setHtml]=useState('');
 const [sourceAck,setSourceAck]=useState(false);
 const [property,setProperty]=useState('sc-domain:atlas-plumbing.example');
 const [table,setTable]=useState<TableType>('query');
 const [start,setStart]=useState('2026-09-01');
 const [end,setEnd]=useState('2026-09-30');
 const [fileText,setFileText]=useState('');
 const [format,setFormat]=useState<'csv'|'json'>('csv');
 const [fileLabel,setFileLabel]=useState('');
 const [result,setResult]=useState<SearchAnalysis|null>(null);
 const [beforeText,setBeforeText]=useState('');
 const [beforeFormat,setBeforeFormat]=useState<'csv'|'json'>('csv');
 const [beforeLabel,setBeforeLabel]=useState('');
 const [beforeStart,setBeforeStart]=useState('2026-08-02');
 const [beforeEnd,setBeforeEnd]=useState('2026-08-31');
 const [error,setError]=useState('');
 const selected=FICTIONAL_SEO_FIXTURES[fictionalKind];
 function changeMode(next:InputMode){
   setMode(next);setResult(null);setFileText('');setFileLabel('');setError('');
   setProperty(next==='fictional'?'sc-domain:'+new URL(selected.business.website).hostname:'');
    setBeforeText('');setBeforeLabel('');
 }
 function manualReport():SeoReport{
  if(!sourceAck)throw Error('Confirm website/HTML and export authorisation first.');
  if(!html.trim())throw Error('Paste authorised public HTML for your website. No website is fetched.');
  const u=new URL(website);
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.search||u.hash)throw Error('Enter the exact HTTPS business website origin.');
  const b:SeoBusiness={workspaceId:scopedWorkspace,name,industry:'Local service business',
   country,city,website:u.origin,ownershipStatus:'unverified',services:[service],serviceAreas:[city],
   audience:'Local customers',goals:['Understand local search performance'],languages:['English']};
  return runOfflineGrowthReport({workspaceId:scopedWorkspace,business:b,
    pages:[{workspaceId:scopedWorkspace,url:u.origin+'/',html,status:200}],
    instruction:'Review search performance and propose SEO improvements.',asOf:new Date().toISOString()});
 }
 function createAnalysis(content:string,kind:'csv'|'json',currentProperty=property,
  currentTable=table,currentStart=start,currentEnd=end,scopeMode=mode){
  const base=scopeMode==='manual'?manualReport():seoReport||demoGrowthReport(fictionalKind);
  if(scopeMode==='fictional'&&base.workspaceId!==selected.business.workspaceId){
   throw Error('Fictional research scope changed: generate a fresh SEO plan.');
  }
  const manifest:SearchManifest={workspaceId:base.workspaceId,property:currentProperty,
    searchType:'web',dimensions:[currentTable],startDate:currentStart,endDate:currentEnd};
  const parsed=importSearchConsoleExport({content,format:kind,manifest,business:base.business});
   const previous=beforeText?importSearchConsoleExport({content:beforeText,format:beforeFormat,
     manifest:{...manifest,startDate:beforeStart,endDate:beforeEnd},business:base.business}):null;
  interpretSeoInstruction({workspaceId:base.workspaceId,business:base.business,
    service:base.business.services[0],area:base.business.serviceAreas[0],
    instruction:'Review search performance, suggest keywords and answer questions.',
    evidenceSources:['offline_html','user_import_gsc']});
  return analyzeImportedSearchEvidence(base,parsed,{previous});
 }
 async function pickFile(file:File|undefined){
  setResult(null);setError('');setFileText('');setFileLabel('');
  if(!file)return;
  if(file.size>SEARCH_IMPORT_LIMITS.bytes){setError('The import exceeds the 512 KB local limit.');return;}
  const next=file.name.toLowerCase().endsWith('.csv')?'csv':file.name.toLowerCase().endsWith('.json')?'json':null;
  if(!next){setError('Use a supported CSV or normalized JSON export.');return;}
  try{const content=await file.text();setFileText(content);setFormat(next);setFileLabel(file.name);}
  catch{setError('Unable to read this file locally.');}
 }
 function sample(){
  setError('');setResult(null);
  try{
    if(mode!=='fictional'||fictionalKind!=='plumbing')throw Error('The supplied fictional Search Console sample belongs only to Atlas Plumbing.');
    const output=createAnalysis(FICTIONAL_GSC.csv,'csv',FICTIONAL_GSC.manifest.property,
      'query',FICTIONAL_GSC.manifest.startDate,FICTIONAL_GSC.manifest.endDate);
    setProperty(FICTIONAL_GSC.manifest.property);setStart(FICTIONAL_GSC.manifest.startDate);
    setEnd(FICTIONAL_GSC.manifest.endDate);setTable('query');
    setFileLabel('FICTIONAL EXAMPLE — not a real Google export');setFileText(FICTIONAL_GSC.csv);
    setFormat('csv');setResult(output);
  }catch(e){setError(e instanceof Error?e.message:'Example unavailable.');}
 }
 async function pickComparisonFile(file:File|undefined){
  setBeforeText('');setBeforeLabel('');setResult(null);setError('');
  if(!file)return;
  if(file.size>SEARCH_IMPORT_LIMITS.bytes){setError('Comparison exceeds 512 KB.');return;}
  const kind=file.name.toLowerCase().endsWith('.csv')?'csv':file.name.toLowerCase().endsWith('.json')?'json':null;
  if(!kind){setError('Comparison requires CSV or normalized JSON.');return;}
  try{setBeforeText(await file.text());setBeforeFormat(kind);setBeforeLabel(file.name);}catch{setError('Unable to read comparison file locally.');}
 }
 function analyze(){
  setError('');setResult(null);
  try{
    if(!fileText)throw Error('Choose a file or load the fictional example first.');
    setResult(createAnalysis(fileText,format));
  }catch(e){setError(e instanceof Error?e.message:'Unable to validate search export.');}
 }
 const rate=(value:number|null)=>value===null?'Not available':(value*100).toFixed(2)+'%';
 return <section className="gsc-panel" aria-label="Search Console offline import">
   <header className="gsc-heading"><div><small>SEARCH PERFORMANCE · EVIDENCE FIRST</small>
     <h3>See what people searched for.</h3>
     <p>Import one authorised Search Console report, inspect actual figures in that file and review suggested improvements. Nothing leaves your browser.</p></div>
     <ShieldCheck size={23}/></header>
   <p className="gsc-disclaimer">USER-SUPPLIED SEARCH CONSOLE EXPORT — NOT LIVE API VERIFIED. Imports may be incomplete and never prove search volume or ranking changes.</p>
   <div className="gsc-controls">
    <label>Analysis source<select value={mode} onChange={e=>changeMode(e.target.value as InputMode)}>
      <option value="fictional">Fictional training example</option><option value="manual">My authorised website and export (offline)</option>
    </select></label>
    {mode==='manual'&&<div className="gsc-manual">
      <label>Business name<input value={name} maxLength={120} onChange={e=>setName(e.target.value)}/></label>
      <label>Website HTTPS origin<input value={website} placeholder="https://my-business.example" maxLength={350} onChange={e=>setWebsite(e.target.value)}/></label>
      <label>Main service<input value={service} maxLength={90} onChange={e=>setService(e.target.value)}/></label>
      <label>Target city<input value={city} maxLength={90} onChange={e=>setCity(e.target.value)}/></label>
      <label>Country<select value={country} onChange={e=>setCountry(e.target.value as 'UK'|'Pakistan')}><option value="UK">United Kingdom</option><option value="Pakistan">Pakistan</option></select></label>
      <label className="gsc-span">Public HTML from your approved homepage (no crawling)
        <textarea rows={3} value={html} maxLength={120000} onChange={e=>setHtml(e.target.value)} placeholder="Paste authorised, non-sensitive HTML. HTTP 200 is a supplied offline assumption, not a measurement."/></label>
      <label className="gsc-authorise"><input type="checkbox" checked={sourceAck} onChange={e=>setSourceAck(e.target.checked)}/>
        I am authorised to use this website and Search Console export; no private or patient details are included.
      </label>
    </div>}
    <label>GSC property (explicit)<input value={property} maxLength={380}
      onChange={e=>{setProperty(e.target.value);setResult(null);}} placeholder="sc-domain:example.com or https://example.com/"/></label>
    <label>Table dimensions<select value={table} onChange={e=>{setTable(e.target.value as TableType);setResult(null);}}>
      <option value="query">Queries CSV</option><option value="page">Pages CSV</option>
    </select></label>
    <label>From<input type="date" value={start} onChange={e=>{setStart(e.target.value);setResult(null);}}/></label>
    <label>To<input type="date" value={end} onChange={e=>{setEnd(e.target.value);setResult(null);}}/></label>
    <label className="gsc-span">Choose CSV or normalized JSON export (max 512 KB)
      <input type="file" accept=".csv,.json,text/csv,application/json" onChange={e=>{void pickFile(e.target.files?.[0]);}}/>
      <small>{fileLabel||'No local export selected. Google Search Console may export multiple distinct CSV tabs; import one at a time.'}</small>
    </label>
    <details className="gsc-comparison gsc-span"><summary>Optional: compare with an earlier period</summary>
      <p>Use the same property's equivalent table for an equally long, non-overlapping period. Differences are observations, not evidence of causation.</p>
      <div className="gsc-comparison-grid">
        <label>Earlier from<input type="date" value={beforeStart} onChange={e=>{setBeforeStart(e.target.value);setResult(null);}}/></label>
        <label>Earlier to<input type="date" value={beforeEnd} onChange={e=>{setBeforeEnd(e.target.value);setResult(null);}}/></label>
      </div>
      <label>Earlier export CSV or JSON<input type="file" accept=".csv,.json,text/csv,application/json"
       onChange={e=>{void pickComparisonFile(e.target.files?.[0]);}}/>
       <small>{beforeLabel||'No earlier period selected.'}</small></label>
      {mode==='fictional'&&fictionalKind==='plumbing'&&<button type="button" onClick={()=>{
        setBeforeText(FICTIONAL_GSC.earlierCsv);setBeforeFormat('csv');
        setBeforeStart(FICTIONAL_GSC.earlier.startDate);setBeforeEnd(FICTIONAL_GSC.earlier.endDate);
        setBeforeLabel('FICTIONAL EARLIER EXAMPLE');setResult(null);}}>Load fictional earlier period</button>}
    </details>
   </div>
   <div className="gsc-buttons">
     {mode==='fictional'&&fictionalKind==='plumbing'&&<button type="button" onClick={sample}><FileSearch size={16}/> Try fictional Search Console report</button>}
     <button type="button" className="gsc-primary" onClick={analyze}><UploadCloud size={16}/> Analyse my selected export</button>
   </div>
   {error&&<p className="gsc-error" role="alert">{error}</p>}
   {!result?<div className="gsc-empty">No search data connected or imported. Metrics will appear only after a validated local import.</div>
   :<div className="gsc-results" aria-live="polite">
    <p><strong>Manual export — unverified</strong> · {result.period.start} to {result.period.end} · {result.property} · {result.dimensions.join(', ')} dimensional table</p>
    <div className="gsc-metrics">
      <div><strong>{result.summary.clicks.toLocaleString('en-GB')}</strong><span>Export-row clicks</span></div>
      <div><strong>{result.summary.impressions.toLocaleString('en-GB')}</strong><span>Export-row impressions</span></div>
      <div><strong>{rate(result.summary.ctr)}</strong><span>Weighted CTR</span></div>
      <div><strong>{result.summary.averagePosition===null?'Not available':result.summary.averagePosition.toFixed(2)}</strong><span>Impression-weighted position</span></div>
    </div>
    {result.comparison&&<article className="gsc-before-after"><h4>Comparable earlier period (user-supplied data)</h4>
      <p>Click change: {result.comparison.change.clicks>0?'+':''}{result.comparison.change.clicks} · Impression change: {result.comparison.change.impressions>0?'+':''}{result.comparison.change.impressions} · CTR change: {result.comparison.change.ctrPercentagePoints===null?'Not available':result.comparison.change.ctrPercentagePoints.toFixed(2)+' pp'}</p>
      <p>{result.comparison.warning}</p>
    </article>}
    <article><h4>Evidence-backed opportunities</h4>
      {result.opportunities.length===0?<p>No service-related search queries were found in this selected report. This is not proof of zero demand.</p>:
      result.opportunities.slice(0,8).map((item,i)=><div key={i} className="gsc-opportunity"><strong>{item.query}</strong>
        <span>{item.evidence.impressions.toLocaleString('en-GB')} impressions · {item.evidence.clicks} clicks · {rate(item.evidence.ctr)}</span>
        <p>{item.rationale}</p><small>Human review required · Imported export only</small></div>)}
    </article>
    <article><h4>Suggested next steps</h4>
      {result.proposedTasks.length?result.proposedTasks.slice(0,5).map(t=><p key={t.finding}>{t.recommendation}</p>)
        :<p>Review keyword coverage and your existing technical SEO report. No automatic website work has been submitted.</p>}
      <p className="gsc-muted">Technical audit findings: {result.existingSeoFindings.length} supplied-page observations · Provider verification: not connected</p>
    </article>
    <div className="gsc-buttons">
      <button type="button" onClick={()=>download('codeedge-search-analysis.json',JSON.stringify(result,null,2),'application/json')}><Download size={16}/> Download client report JSON</button>
      <button type="button" onClick={()=>download('codeedge-search-opportunities.csv',exportSearchAnalysisCsv(result),'text/csv;charset=utf-8')}><Download size={16}/> Download opportunities CSV</button>
      <button type="button" onClick={()=>window.print()}>Print report</button>
    </div>
    <div className="gsc-disclaimer">{result.limitations.join(' ')}</div>
   </div>}
 </section>;
}
