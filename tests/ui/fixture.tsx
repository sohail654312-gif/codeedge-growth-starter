import React from 'react';
import {createRoot} from 'react-dom/client';
import WorkProgress from '../../src/WorkProgress';
import PremiumContentPanel from '../../src/PremiumContentPanel';
import {demoGrowthReport} from '../../backend/seo-fixtures.mjs';
import '../../src/work-progress.css';
import './qa.css';
const requests=Array.from({length:1000},(_,i)=>({id:'fiction_'+i,title:'Fictional task '+String(i).padStart(4,'0'),kind:i%2?'Local SEO':'Website update',
 notes:'Synthetic UI fixture',status:i%2?'Requested':'Awaiting approval',createdAt:new Date(Date.UTC(2026,9,14,0,0,i)).toISOString()}));
const role=new URLSearchParams(location.search).get('role')||'owner';
createRoot(document.getElementById('root')!).render(<React.StrictMode><main><h1>Isolated Growth Starter QA</h1>
 <p>Fictional local fixtures. No server, provider connection or deployment.</p>
 <WorkProgress requests={requests} demo={false} role={role} onNewRequest={()=>{}} onCorrection={async()=>{throw Error('Synthetic provider unavailable');}}/>
 <PremiumContentPanel seoReport={demoGrowthReport('clinic','2026-10-14T00:00:00Z')}/>
</main></React.StrictMode>);
