import { ArrowRight, ClipboardCheck, ExternalLink, FileText, Globe2, ShieldCheck, Users, Camera } from 'lucide-react';
type RequestItem={id:string;title:string;kind:string;notes:string;status:string;createdAt:string};
type MediaItem={id:string;filename:string;mime:string;url:string;createdAt:string};
const Status=({name}:{name:string})=><span className='service-chip'>{name}</span>;
export function WebsitePage({business,website,requests,demo,onWebsiteEdit,onRequest}:{
  business:string;website:string;requests:RequestItem[];demo:boolean;
  onWebsiteEdit:()=>void;onRequest:()=>void;
}) {
  const safe=website.startsWith('https://')?website:null;
  const relevant=requests.filter(r=>r.kind==='Website update');
  return <section className='service-page'>
    <div className='service-heading'><span>YOUR DIGITAL FRONT DOOR</span><h1>Your website, clearly managed.</h1><p>See your current website link and ask Codeedge for changes in one place.</p></div>
    <div className='service-grid'>
      <article className='service-main-card'>
        <div className='service-title'><span className='service-icon'><Globe2 size={22}/></span>
          <div><strong>{business}</strong><p>{safe?'Website linked':'No public website link supplied yet'}</p></div><Status name={demo?'Example concept':safe?'Linked':'Not linked'}/></div>
        <div className='service-preview'><strong>One clear presence.<br/>More ways to enquire.</strong><span>Codeedge web & growth support</span></div>
        <div className='service-actions'>{safe?<a href={safe} target='_blank' rel='noopener noreferrer'>View website <ExternalLink size={15}/></a>:null}
        <button type='button' onClick={onWebsiteEdit}>Update website details <ArrowRight size={15}/></button></div>
      </article>
      <article className='service-main-card'><div className='service-title'><span className='service-icon'><ClipboardCheck size={21}/></span><div><strong>Website improvements</strong><p>Simple requests you can follow</p></div></div>
        <div className='service-tasks'>{relevant.length?relevant.map(r=><div className='service-task' key={r.id}>
          <span><FileText size={16}/>{r.title}</span><Status name={r.status}/></div>):<p>No website changes requested yet.</p>}</div>
        <button className='service-primary' type='button' onClick={onRequest}>Request a website change <ArrowRight size={15}/></button>
      </article>
    </div>
    <div className='service-honesty'><ShieldCheck size={16}/> Website uptime, conversion rate and search rankings are not connected to this preview.</div>
  </section>;
}
export function AgencyDesk({role,requests,assets}:{
  role:string;requests:RequestItem[];assets:MediaItem[]
}) {
  const authorised=role==='agency_admin'||role==='staff';
  if(!authorised)return <section className='service-page'><ShieldCheck size={25}/><h2>Agency access not authorised</h2><p>Only server-verified agency roles may open this area.</p></section>;
  return <section className='service-page'>
    <div className='service-heading'><span>CODEEDGE TEAM AREA</span><h1>Client work, one clear queue.</h1><p>Read-only operations view until a trusted membership and approval backend is connected.</p></div>
    <div className='agency-grid'>
      <div className='service-main-card'><div className='service-title'><span className='service-icon'><Users size={20}/></span><div><strong>Authorised client workspace</strong><p>Only the workspace selected through your verified server membership</p></div></div><p>Cross-client selection and invitations are disabled pending identity and database acceptance.</p>
      <button className='service-disabled' disabled type='button'>Invite a client — security gate pending</button></div>
      <div className='service-main-card'><div className='service-title'><span className='service-icon'><FileText size={20}/></span><div><strong>Request review queue</strong><p>{requests.length} recorded requests</p></div></div>
        <div className='service-tasks'>{requests.slice(0,12).map(r=><div key={r.id} className='service-task'><span><FileText size={15}/>{r.title}</span><Status name={r.status}/></div>)}</div>
        <button className='service-disabled' disabled type='button'>Assign and submit approval — security gate pending</button></div>
      <div className='service-main-card'><div className='service-title'><span className='service-icon'><Camera size={20}/></span><div><strong>Media review</strong><p>{assets.length} uploaded files in authorised workspace</p></div></div>
        <p>Uploads are private and unapproved media is not downloadable. Media review and deletion need durable lifecycle controls.</p>
        <button className='service-disabled' disabled type='button'>Approve media — security gate pending</button></div>
    </div>
    <div className='service-honesty'><ShieldCheck size={16}/> Nothing can be published, assigned to another tenant, or approved from this restricted preview.</div>
  </section>;
}
