import { useState } from 'react';
import { ArrowRight, CalendarCheck2, CheckCircle2, CircleAlert, ClipboardCheck, FileText, MessageSquareText, ShieldCheck } from 'lucide-react';

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
  const agency=role==='agency_admin'||role==='staff';
  async function sendCorrection(request:ProgressRequest) {
    if(message.trim().length<4 || message.trim().length>500)return;
    setPending(true);
    try {const saved=await onCorrection(request,message.trim());if(saved){setOpen(null);setMessage('');}}
    finally {setPending(false);}
  }
  return <section className='work-panel' aria-label={agency?'Codeedge agency work queue':'Your growth requests'}>
    <div className='work-top'>
      <div><div className='work-eyebrow'>{agency?'AGENCY WORK QUEUE':'YOUR WORK PROGRESS'}</div>
        <h2>{agency?'Client work, clearly organised':'Your requests, one step at a time'}</h2>
        <p>{agency?'Tasks are read-only until a transactional approval service has been verified.':'See what you have requested and ask Codeedge for changes.'}</p>
      </div>
      <button type='button' className='work-new' onClick={onNewRequest}>New request <ArrowRight size={15}/></button>
    </div>
    {requests.length===0?<div className='work-empty'><ClipboardCheck size={25}/><strong>Nothing in the queue yet</strong>
      <p>Start with one website, social or local SEO request.</p><button type='button' onClick={onNewRequest}>Create a request</button></div>
    : <div className='work-list'>{requests.map(request=><article className='work-item' key={request.id}>
        <div className='work-item-heading'><div className='work-item-symbol'><FileText size={18}/></div>
          <div className='work-item-name'><h3>{request.title}</h3><p>{request.kind} · {demo?'Illustrative example':request.createdAt?new Date(request.createdAt).toLocaleDateString('en-GB'):'Saved request'}</p></div>
          <span className='work-state'>{request.status}</span></div>
        <div className='work-timeline' aria-label={'Progress: '+request.status}>
          {steps.map((label,i)=><div key={label} className={'work-stage '+(i<=phase(request)?'reached':'')}>
            <span>{i<phase(request)?<CheckCircle2 size={15}/>:i+1}</span><small>{label}</small>
          </div>)}</div>
        {request.status==='Changes requested'&&<p className='work-revision'><MessageSquareText size={16}/> Changes have been requested. Codeedge can revise the proposal.</p>}
        {request.status==='Awaiting approval'&&<p className='work-revision'><CircleAlert size={16}/> Secure in-app approval is paused until transactional verification. You can request changes below.</p>}
        <div className='work-controls'>
          <button type='button' disabled={demo} onClick={()=>{setOpen(open===request.id?null:request.id);setMessage('');}}>
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
    <div className='work-info'><ShieldCheck size={16}/><span>Agency access and client approvals are disabled until authenticated staging and independent isolation tests pass. Never upload patient data.</span></div>
  </section>;
}
