import {createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {PrivateWorkspaceApp} from './PrivateWorkspaceApp';
import {createPrivateWorkspaceClient} from './private-workspace-client.mjs';
const root=document.getElementById('root');
if(root){
 try{createRoot(root).render(createElement(PrivateWorkspaceApp,{client:createPrivateWorkspaceClient()}));}
 catch{root.textContent='Workspace unavailable. Open the approved HTTPS workspace to continue.';}
}
