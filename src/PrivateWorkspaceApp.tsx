import {useEffect,useRef,useState} from 'react';
import {type PrivateClient,type PrivateRequest,type PrivateProfile} from './private-workspace-client.mjs';
import SeoGrowthManager from './SeoGrowthManager';
import './private-workspace.css';
const empty:PrivateProfile={name:'',industry:'',city:'',website:'',goal:''};
const next:Record<string,string>={'Requested':'In progress','Changes requested':'In progress','In progress':'Awaiting approval','Approved':'Completed'};
export function PrivateWorkspaceApp({client}:{client:PrivateClient}){
 const [ws,setWs]=useState(()=>new URLSearchParams(location.search).get('workspaceId')||'');
 const [workspaceInput,setWorkspaceInput]=useState(ws);
 const [workspaces,setWorkspaces]=useState<Array<{workspaceId:string;role:string;name:string}>>([]);
 const [role,setRole]=useState(''),[email,setEmail]=useState(''),[signedIn,setSignedIn]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [tab,setTab]=useState('Work'),[profile,setProfile]=useState(empty),[profileVersion,setProfileVersion]=useState(0);
 const [requests,setRequests]=useState<PrivateRequest[]>([]),[selected,setSelected]=useState<PrivateRequest|null>(null);
 const [filter,setFilter]=useState(''),[search,setSearch]=useState(''),[cursor,setCursor]=useState<string|null>(null);
 const [cursors,setCursors]=useState<string[]>([]),[title,setTitle]=useState(''),[kind,setKind]=useState('Website update'),[notes,setNotes]=useState('');
 const [correction,setCorrection]=useState(''),[assignee,setAssignee]=useState(''),[due,setDue]=useState('');
 const [history,setHistory]=useState<Array<{id:string;action:string;target:string}>>([]);
 const pending=useRef(false),generation=useRef(0),keys=useRef(new Map<string,string>());
 const agency=['owner','agency_admin','staff'].includes(role),decider=['owner','client'].includes(role),assigner=['owner','agency_admin'].includes(role);
 async function load(workspace:string,position='',status=filter){
  const gen=++generation.current;setLoading(true);setError('');setSelected(null);
  try{
   const authorization=await client.authorize(workspace);
   const [page,saved]=await Promise.all([client.list(workspace,{limit:'20',cursor:position,status}),client.profile(workspace)]);
   if(gen!==generation.current)return;
   setWs(workspace);setWorkspaceInput(workspace);setRole(authorization.role);setRequests(page.items);setCursor(page.nextCursor);
   setProfile(saved.fields||empty);setProfileVersion(saved.version);setSignedIn(true);
  }catch(e){if(gen===generation.current){setRequests([]);setRole('');setProfile(empty);setError(e instanceof Error?e.message:'Unable to load workspace.');}}
  finally{if(gen===generation.current)setLoading(false);}
 }
 useEffect(()=>{let active=true;
  async function start(){try{let available=await client.workspaces();
   if(!available.workspaces.length){await client.onboard();available=await client.workspaces();}
   if(active){setWorkspaces(available.workspaces);await load(ws||available.workspaces[0].workspaceId);}}
   catch(e){if(active){setLoading(false);setError(e instanceof Error?e.message:'Sign in to continue.');}}}
  void start();return()=>{active=false;generation.current++;};
 // Initial client is a stable injected dependency; workspace changes reload explicitly.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[client]);
 async function perform(action:string,payload:unknown,fn:(key:string)=>Promise<unknown>){
  if(pending.current)return;pending.current=true;setBusy(true);setError('');setNotice('');
  const binding=JSON.stringify({ws,action,payload});let key=keys.current.get(binding);
  if(!key){key=crypto.randomUUID().replaceAll('-','');keys.current.set(binding,key);}
  try{await fn(key);keys.current.delete(binding);setNotice('Changes saved.');await load(ws,cursors.at(-1)||'');}
  catch(e){setError(e instanceof Error?e.message:'Unable to save. Retry the same action.');}
  finally{pending.current=false;setBusy(false);}
 }
 async function signIn(){if(pending.current)return;pending.current=true;setBusy(true);setError('');
  try{await client.login(email);setNotice('If eligible, check your email to continue.');}
  catch(e){setError(e instanceof Error?e.message:'Login unavailable.');}finally{pending.current=false;setBusy(false);}}
 async function logout(){setBusy(true);setError('');try{await client.logout();generation.current++;setSignedIn(false);setRole('');setRequests([]);setSelected(null);setHistory([]);setProfile(empty);keys.current.clear();setNotice('Signed out.');}
  catch(e){setError(e instanceof Error?e.message:'Retry sign out.');}finally{setBusy(false);}}
 async function detail(r:PrivateRequest){setBusy(true);setError('');try{setSelected(await client.detail(ws,r.id));setAssignee(r.assignedTo||'');setDue(r.dueDate||'');setCorrection('');}
  catch(e){setError(e instanceof Error?e.message:'Unable to load details.');}finally{setBusy(false);}}
 const visible=requests.filter(r=>(r.title+' '+r.kind).toLowerCase().includes(search.toLowerCase()));
 return <div className="private-app"><header><a href="/dashboard" className="private-brand">Codeedge<span>Growth workspace</span></a>
  {signedIn&&<div><span className="private-role">{role.replace('_',' ')}</span><button disabled={busy} onClick={()=>void logout()}>Sign out</button></div>}</header>
  <main>{error&&<p className="private-error" role="alert">{error}</p>}{notice&&<p className="private-notice" role="status">{notice}</p>}
   {loading&&!signedIn?<p role="status">Checking your workspace…</p>:!signedIn?<section className="private-login"><h1>Your work, in one place.</h1>
    <p>Sign in to review requests, save your business profile and track changes with Codeedge.</p>
    <form onSubmit={e=>{e.preventDefault();void signIn();}}><label>Email address<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label>
     <button className="private-primary" disabled={busy||!email}>{busy?'Sending…':'Send sign-in link'}</button></form></section>:
   <><div className="private-heading"><div><h1>{profile.name||'Your growth workspace'}</h1><p>Review work before it moves forward.</p></div>
    <form className="private-workspace" onSubmit={e=>{e.preventDefault();setCursors([]);void load(workspaceInput);}}><label>Workspace<select value={workspaceInput} onChange={e=>setWorkspaceInput(e.target.value)}>{workspaces.map(w=><option key={w.workspaceId} value={w.workspaceId}>{w.name}</option>)}</select></label><button disabled={busy||loading}>Open workspace</button></form></div>
    <nav aria-label="Workspace sections">{['Work','Business profile','Activity','Growth tools'].filter(t=>t!=='Activity'||assigner).map(t=><button key={t} aria-current={tab===t?'page':undefined} onClick={()=>{
     setTab(t);if(t==='Activity'){setBusy(true);client.history(ws).then(v=>setHistory(v.items)).catch(e=>setError(e.message)).finally(()=>setBusy(false));}
    }}>{t}</button>)}</nav>
    <div aria-busy={busy||loading}>
    {tab==='Work'&&<><section className="private-compose"><h2>Create a work request</h2><form onSubmit={e=>{e.preventDefault();const fields={title,kind,notes};void perform('create',fields,key=>client.createRequest(ws,fields,key));}}>
     <label>Title<input required maxLength={100} value={title} onChange={e=>setTitle(e.target.value)}/></label>
     <label>Type<select value={kind} onChange={e=>setKind(e.target.value)}>{['Website update','Social content','Local SEO','Other'].map(v=><option key={v}>{v}</option>)}</select></label>
     <label>Brief<textarea maxLength={600} rows={2} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
     <button className="private-primary" disabled={busy||loading||!title.trim()}>Create request</button></form></section>
     <section className="private-queue"><div className="private-queue-heading"><h2>Work requests</h2><button disabled={busy||loading} onClick={()=>void load(ws,cursors.at(-1)||'')}>Refresh</button></div>
      <div className="private-filters"><label>Search loaded requests<input type="search" value={search} maxLength={100} onChange={e=>setSearch(e.target.value)}/></label>
       <label>Status<select value={filter} onChange={e=>{setFilter(e.target.value);setCursors([]);void load(ws,'',e.target.value);}}><option value="">All statuses</option>{['Requested','In progress','Awaiting approval','Approved','Changes requested','Completed'].map(s=><option key={s}>{s}</option>)}</select></label></div>
      {!loading&&!visible.length&&<p>No matching requests. Create a request or change your filters.</p>}
      <ul className="private-requests">{visible.map(r=><li key={r.id}><div><span className="private-kind">{r.kind}</span><h3>{r.title}</h3><p>{r.status} · Version {r.version}</p></div><button disabled={busy||loading} onClick={()=>void detail(r)}>Review details</button></li>)}</ul>
      <div className="private-pages"><button disabled={busy||loading||!cursors.length} onClick={()=>{const prev=cursors.slice(0,-1);setCursors(prev);void load(ws,prev.at(-1)||'');}}>Previous page</button>
       <span>{requests.length} loaded requests</span><button disabled={busy||loading||!cursor} onClick={()=>{if(cursor){setCursors([...cursors,cursor]);void load(ws,cursor);}}}>Next page</button></div>
     </section>
     {selected&&<section className="private-detail" aria-label="Request details"><button className="private-close" onClick={()=>setSelected(null)}>Close details</button><h2>{selected.title}</h2><p>{selected.notes||'No brief supplied.'}</p>
      <p>{selected.status} · Version {selected.version}</p>
      {agency&&next[selected.status]&&<button className="private-primary" disabled={busy} onClick={()=>void perform('review',{id:selected.id,status:next[selected.status],version:selected.version},key=>client.review(ws,selected.id,next[selected.status],selected.version,key))}>Move to {next[selected.status].toLowerCase()}</button>}
      {assigner&&selected.status!=='Completed'&&<form onSubmit={e=>{e.preventDefault();void perform('assign',{id:selected.id,assignee,due,version:selected.version},key=>client.assign(ws,selected.id,assignee||null,due||null,selected.version,key));}}>
       <label>Assign to member ID<input value={assignee} onChange={e=>setAssignee(e.target.value)} maxLength={128}/></label><label>Due date<input type="date" value={due} onChange={e=>setDue(e.target.value)}/></label><button disabled={busy}>Save assignment</button></form>}
      {decider&&selected.status==='Awaiting approval'&&<div className="private-decision"><button className="private-primary" disabled={busy} onClick={()=>void perform('approve',{id:selected.id,version:selected.version},key=>client.decision(ws,selected.id,'Approved','',selected.version,key))}>Approve this version</button>
       <form onSubmit={e=>{e.preventDefault();void perform('correction',{id:selected.id,note:correction,version:selected.version},key=>client.correction(ws,selected.id,correction,selected.version,key));}}>
        <label>Changes needed<textarea required maxLength={600} value={correction} onChange={e=>setCorrection(e.target.value)}/></label><button disabled={busy||!correction.trim()}>Request changes</button></form></div>}
      <h3>Correction history</h3>{selected.notesHistory?.length?<ul>{selected.notesHistory.map(n=><li key={n.id}>{n.note}</li>)}</ul>:<p>No correction notes yet.</p>}
     </section>}
    </>}
    {tab==='Business profile'&&<section className="private-profile"><h2>Business profile</h2><form onSubmit={e=>{e.preventDefault();void perform('profile',{profile,profileVersion},key=>client.saveProfile(ws,profile,profileVersion,key));}}>
     {([['name','Business name',90],['industry','Industry',60],['city','City',90],['website','Website',250],['goal','Growth goal',240]] as const).map(([field,label,max])=><label key={field}>{label}<input required={['name','industry','city'].includes(field)} type={field==='website'?'url':'text'} maxLength={max} value={profile[field]} onChange={e=>setProfile({...profile,[field]:e.target.value})}/></label>)}
     <button className="private-primary" disabled={busy||loading}>Save business profile</button></form></section>}
    {tab==='Activity'&&<section><h2>Recent workspace activity</h2><p>Showing the latest authorized events.</p><ul className="private-activity">{history.map(h=><li key={h.id}><strong>{h.action.replaceAll('.',' ')}</strong><span>{h.target}</span></li>)}</ul></section>}
    {tab==='Growth tools'&&<><p className="private-notice">Offline planning tools use clearly labelled fictional examples or extracts you supply. Google and publishing connections remain disabled.</p><SeoGrowthManager demo={false}/></>}
    </div><footer>Content approvals track the reviewed version. External publishing and payments remain disabled.</footer>
   </>}
  </main></div>;
}
