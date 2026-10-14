import { useMemo, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, CircleAlert, ClipboardCheck, FileText, MessageSquareText, ShieldCheck } from 'lucide-react';

export type ProgressRequest = {
  id:string;title:string;kind:string;notes:string;status:string;createdAt:string;
};
type Props={
  requests:ProgressRequest[];
  demo:boolean;
  role?:string;
  onNewRequest:()=>void;
  onCorrection:(request:ProgressRequest,note:string)=>Promise<boolean>;
};
const steps=['Requested','In progress','Awaiting approval','Approved','Completed'];
function phase(request:ProgressRequest) {
  if(request.status==='Changes requested')return 1;
  return Math.max(0,steps.indexOf(request.status));
}
export default function WorkProgress({requests,demo,role,onNewRequest,onCorrection}:Props) {
  const [open,setOpen]=useState<string|null>(null);
  const [message,setMessage]=useState('');
  const [pending,setPending]=useState(false);
  const [error,setError]=useState('');
  const [filter,setFilter]=useState('All');
  const [search,setSearch]=useState('');
  const [sort,setSort]=useState('newest');
  const [page,setPage]=useState(0);
  const sending=useRef(false);
  const agency=role==='agency_admin'||role==='staff';
  const canCorrect=!demo&&(role==='owner'||role==='client');
  const filtered=useMemo(()=>requests.filter(r=>(filter==='All'||r.status===filter)&&
    (r.title+' '+r.kind).toLowerCase().includes(search.trim().toLowerCase())).slice().sort((a,b)=>sort==='title'?
      a.title.localeCompare(b.title):((Date.parse(b.createdAt)||0)-(Date.parse(a.createdAt)||0))||a.id.localeCompare(b.id)),[requests,filter,search,sort]);
  const pages=Math.max(1,Math.ceil(filtered.length/8)),currentPage=Math.min(page,pages-1);
  const visible=filtered.slice(currentPage*8,currentPage*8+8);
  async function sendCorrection(request:ProgressRequest) {
    if(!canCorrect||sending.current||message.trim().length<4 || message.trim().length>500)return;
    sending.current=true;setPending(true);setError('');
    try {const saved=await onCorrection(request,message.trim());if(saved){setOpen(null);setMessage('');}else setError('The change request could not be saved. Please try again.');}
    catch{setError('The change request could not be saved. Please try again.');}
    finally {sending.current=false;setPending(false);}
  }
  return <section className='work-panel' aria-label={agency?'Codeedge agency work queue':'Your growth requests'}>
    <div className='work-top'>
      <div><div className='work-eyebrow'>{agency?'AGENCY WORK QUEUE':'YOUR WORK PROGRESS'}</div>
        <h2>{agency?'Client work, clearly organised':'Your requests, one step at a time'}</h2>
        <p>{agency?'Tasks are read-only until a transactional approval service has been verified.':'See what you have requested and ask Codeedge for changes.'}</p>
      </div>
      <button type='button' className='work-new' onClick={onNewRequest}>New request <ArrowRight size={15}/></button>
    </div>
    {requests.length>0&&<div className='work-filters'>
      <label>Search loaded requests<input type='search' value={search} maxLength={100} onChange={e=>{setSearch(e.target.value);setPage(0);}}/></label>
      <label>Status<select aria-label='Status' value={filter} onChange={e=>{setFilter(e.target.value);setPage(0);}}><option>All</option>{[...steps,'Changes requested'].map(status=><option key={status}>{status}</option>)}</select></label>
      <label>Sort<select aria-label='Sort' value={sort} onChange={e=>{setSort(e.target.value);setPage(0);}}><option value='newest'>Newest first</option><option value='title'>Title</option></select></label>
    </div>}
    {error&&<p className='work-error' role='alert'>{error}</p>}
    {requests.length===0?<div className='work-empty'><ClipboardCheck size={25}/><strong>Nothing in the queue yet</strong>
      <p>Start with one website, social or local SEO request.</p><button type='button' onClick={onNewRequest}>Create a request</button></div>
    : <div className='work-list' aria-busy={pending}>{visible.map(request=><article className='work-item' key={request.id}>
        <div className='work-item-heading'><div className='work-item-symbol'><FileText size={18}/></div>
          <div className='work-item-name'><h3>{request.title}</h3><p>{request.kind} · {demo?'Illustrative example':Number.isFinite(Date.parse(request.createdAt))?new Date(request.createdAt).toLocaleDateString('en-GB'):'Saved request'}</p></div>
          <span className='work-state'>{request.status}</span></div>
        <div className='work-timeline' aria-label={'Progress: '+request.status}>
          {steps.map((label,i)=><div key={label} className={'work-stage '+(i<=phase(request)?'reached':'')}>
            <span>{i<phase(request)?<CheckCircle2 size={15}/>:i+1}</span><small>{label}</small>
          </div>)}</div>
        {request.status==='Changes requested'&&<p className='work-revision'><MessageSquareText size={16}/> Changes have been requested. Codeedge can revise the proposal.</p>}
        {request.status==='Awaiting approval'&&<p className='work-revision'><CircleAlert size={16}/> Secure in-app approval is paused until transactional verification. You can request changes below.</p>}
        <div className='work-controls'>
          <button type='button' disabled={!canCorrect||pending} aria-expanded={open===request.id} onClick={()=>{setOpen(open===request.id?null:request.id);setMessage('');setError('');}}>
            <MessageSquareText size={15}/> Request a correction
          </button>
          {request.status==='Awaiting approval'&&<button type='button' disabled title='Approval requires independently verified atomic persistence'><ShieldCheck size={15}/> Approval pending security gate</button>}
        </div>
        {open===request.id&&!demo&&<div className='work-correction'>
          <label htmlFor={'correction-'+request.id}>What should Codeedge change?</label>
          <textarea id={'correction-'+request.id} value={message} maxLength={500} rows={3}
            onChange={e=>setMessage(e.target.value)} placeholder='Explain the changes you would like...' />
          <div className='work-correction-actions'>
            <button type='button' disabled={pending} onClick={()=>setOpen(null)}>Cancel</button>
            <button type='button' disabled={pending||message.trim().length<4} onClick={()=>void sendCorrection(request)}>Send change request <ArrowRight size={14}/></button>
          </div><small>This creates a separate tracked request; it does not approve or change the original proposal.</small>
        </div>}
      </article>)}</div>}
    {requests.length>0&&<nav className='work-pagination' aria-label='Loaded request pages'>
      <button type='button' disabled={currentPage===0||pending} onClick={()=>setPage(currentPage-1)}>Previous</button>
      <span aria-live='polite'>{filtered.length} matches in {requests.length} loaded requests · Page {currentPage+1} of {pages}</span>
      <button type='button' disabled={currentPage>=pages-1||pending} onClick={()=>setPage(currentPage+1)}>Next</button>
    </nav>}
    <div className='work-info'><ShieldCheck size={16}/><span>Agency access and client approvals are disabled until authenticated staging and independent isolation tests pass. Never upload patient data.</span></div>
  </section>;
}
