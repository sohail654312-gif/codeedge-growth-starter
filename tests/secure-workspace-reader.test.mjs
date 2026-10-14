import test from 'node:test';
import assert from 'node:assert/strict';
import {createSecureWorkspaceReader} from '../src/secure-workspace-reader.mjs';
const wa='ws_329d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const wb='ws_429d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const JWT='aaa'.repeat(20)+'.'+'bbb'.repeat(20)+'.'+'ccc'.repeat(20);
function setup({mode='good',token=JWT,workspaces=[{workspace_id:wa,role:'client'}]}={}){
 let invalidated=0;
 const calls=[];
 const r=createSecureWorkspaceReader({
  gatewayUrl:'https://synthetic-api.invalid/',
  getAccessToken:async()=>token,
  onSessionExpired:()=>invalidated++,
  fetchImpl:async(url,opts)=>{
   calls.push({url,opts});
   if(mode==='expired')return{status:401};
   if(mode==='error')return{status:503};
   if(mode==='broken')throw Error('Offline');
   if(new URL(url).pathname==='/v1/workspaces')
     return{status:200,json:async()=>({workspaces})};
   return{status:200,json:async()=>({
    workspaceId:mode==='foreign'?wb:wa,page:0,nextPage:null,
    items:[{id:'only_own',workspace_id:mode==='foreign'?wb:wa,title:'SEO correction'}]
   })};
  }
 });
 return{r,calls,invalidations:()=>invalidated};
}
test('client adapter accepts its permitted workspace and pages but never blindly switches tenants',async()=>{
 const x=setup();
 assert.deepEqual(await x.r.listWorkspaces(),[{workspaceId:wa,role:'client'}]);
 assert.equal((await x.r.listRequests(wa)).items.length,1);
 await assert.rejects(x.r.listRequests(wb),e=>e.kind==='ACCESS_DENIED');
 await assert.rejects(x.r.listRequests(wa,{page:20}),e=>e.kind==='ACCESS_DENIED');
 assert.equal(x.calls.length,4);
 assert.ok(x.calls.every(c=>c.opts.method==='GET' && c.opts.headers.authorization==='Bearer '+JWT));
});
test('expired session explicitly triggers UI reset signal, provider outage fails closed',async()=>{
 const e=setup({mode:'expired'});
 await assert.rejects(e.r.listWorkspaces(),x=>x.kind==='SESSION_EXPIRED');
 assert.equal(e.invalidations(),1);
 for(const mode of ['error','broken']){
  await assert.rejects(setup({mode}).r.listWorkspaces(),x=>x.kind==='UNAVAILABLE');
 }
 await assert.rejects(setup({token:'malformed'}).r.listWorkspaces(),x=>x.kind==='SESSION_EXPIRED');
});
test('foreign result, privilege escalation and malformed response rejected at presentation boundary',async()=>{
 await assert.rejects(setup({mode:'foreign'}).r.listRequests(wa),x=>x.kind==='UNAVAILABLE');
 await assert.rejects(setup({workspaces:[{workspace_id:wa,role:'superadmin'}]}).r.listWorkspaces(),
  x=>x.kind==='UNAVAILABLE');
 await assert.rejects(setup({workspaces:[{workspace_id:wa,role:'client'},{workspace_id:wa,role:'client'}]})
  .r.listWorkspaces(),x=>x.kind==='UNAVAILABLE');
 assert.throws(()=>createSecureWorkspaceReader({gatewayUrl:'http://unsafe.invalid'}),x=>x.kind==='UNAVAILABLE');
});
