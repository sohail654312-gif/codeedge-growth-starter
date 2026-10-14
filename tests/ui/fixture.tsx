import React from 'react';
import {createRoot} from 'react-dom/client';
import WorkProgress from '../../src/WorkProgress';
import BeforeWorkProgress from '../../work/WorkProgress.before';
import PremiumContentPanel from '../../src/PremiumContentPanel';
import {demoGrowthReport} from '../../backend/seo-fixtures.mjs';
import '../../src/work-progress.css';
import './qa.css';
import {PrivateWorkspaceApp} from '../../src/PrivateWorkspaceApp';
import type {PrivateClient} from '../../src/private-workspace-client.mjs';
const requests=Array.from({length:1000},(_,i)=>({id:'fiction_'+i,title:'Fictional task '+String(i).padStart(4,'0'),kind:i%2?'Local SEO':'Website update',
 notes:'Synthetic UI fixture',status:i%2?'Requested':'Awaiting approval',createdAt:new Date(Date.UTC(2026,9,14,0,0,i)).toISOString()}));
const role=new URLSearchParams(location.search).get('role')||'owner';
const Queue=new URLSearchParams(location.search).get('baseline')==='1'?BeforeWorkProgress:WorkProgress;
const privateClient={
 workspaces:async()=>({workspaces:[{workspaceId:'ws_fictional_owner_A',role,name:'Fictional Clinic A'}]}),
 onboard:async()=>({workspaceId:'ws_fictional_owner_A'}),authorize:async()=>({workspaceId:'ws_fictional_owner_A',role}),
 list:async()=>({items:[{id:'fictional_request',workspaceId:'ws_fictional_owner_A',title:'Fictional clinic website draft',kind:'Website update',notes:'Synthetic browser fixture',status:'Awaiting approval',version:3,updatedAt:Date.now(),assignedTo:null,dueDate:null}],nextCursor:null}),
 profile:async()=>({fields:{name:'Fictional Clinic A',industry:'Clinic',city:'Karachi',website:'https://fiction.invalid/',goal:'Review drafts'},version:1}),
 detail:async()=>({...((await privateClient.list()).items[0]),notesHistory:[]}),
 decision:async()=>{throw Error('This item changed. Refresh before saving.');},correction:async()=>{},
 saveProfile:async()=>{},createRequest:async()=>{},assign:async()=>{},review:async()=>{},logout:async()=>{},
 history:async()=>({items:[{id:'1',action:'request.created',target:'fictional_request'}],nextCursor:null}),
 login:async()=>{},revokeMember:async()=>{},deleteMedia:async()=>{}
} as unknown as PrivateClient;
createRoot(document.getElementById('root')!).render(new URLSearchParams(location.search).get('private')==='1'?
 <PrivateWorkspaceApp client={privateClient}/>:<React.StrictMode><main><h1>Isolated Growth Starter QA</h1>
 <p>Fictional local fixtures. No server, provider connection or deployment.</p>
 <Queue requests={requests} demo={false} role={role} onNewRequest={()=>{}} onCorrection={async()=>{throw Error('Synthetic provider unavailable');}}/>
 <PremiumContentPanel seoReport={demoGrowthReport('clinic','2026-10-14T00:00:00Z')}/>
</main></React.StrictMode>);
