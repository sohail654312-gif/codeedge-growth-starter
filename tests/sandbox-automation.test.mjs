import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createPersistentSandboxStore} from '../backend/persistent-sandbox-store.mjs';
import {createSandboxAutomationEngine,createSandboxProviderAdapters} from '../backend/sandbox-automation.mjs';
const ws='ws_fiction_owner_111',actor='fiction_owner_111',key='sandbox_key_00000001';
const definition={id:'reviewed_content',trigger:'content.ready',conditions:[{field:'status',op:'eq',value:'reviewed'}],
 actions:[{type:'social.publish',label:'Fictional social simulation'}],requiresApproval:false};
const event={workspaceId:ws,type:'content.ready',status:'reviewed'};
async function fixture(options={}){
 const directory=await mkdtemp(join(tmpdir(),'growth-sandbox-'));
 const store=await createPersistentSandboxStore({directory});let role='owner';
 const authorizer={capabilities:{transactionalAuthorization:true},authorize:async({workspaceId,actor})=>({workspaceId,userId:actor,role})};
 const engine=createSandboxAutomationEngine({store,authorizer,...options});
 return {directory,engine,store,authorizer,revoke:()=>{role='revoked';},staff:()=>{role='staff';},cleanup:()=>rm(directory,{recursive:true,force:true})};
}
test('dry run cannot create approval, communication actions mandate owner approval and records survive restart',async()=>{
 const f=await fixture();try{
  const args={workspaceId:ws,actor,key,definition,event};
  assert.equal((await f.engine.simulate(args)).requiresApproval,true);
  await assert.rejects(f.engine.run(args),e=>e.status===403);
  assert.equal(await f.engine.history(args),null);
  await f.engine.approve(args);assert.equal((await f.engine.run(args)).status,'completed');
  const second=createSandboxAutomationEngine({store:await createPersistentSandboxStore({directory:f.directory}),authorizer:f.authorizer});
  assert.equal((await second.run(args)).replayed,true);assert.equal((await second.history(args)).log[0].status,'simulated');
  await assert.rejects(second.run({...args,definition:{...definition,actions:[{type:'social.publish',label:'Changed draft'}]}}),e=>e.status===409);
  await assert.rejects(second.run({...args,mode:'live'}),e=>e.status===403);
  f.revoke();await assert.rejects(second.run(args),e=>e.status===403);await assert.rejects(second.history(args),e=>e.status===403);
 }finally{await f.cleanup();}
});
test('conditions and foreign triggers fail closed; staff cannot approve or execute',async()=>{
 const f=await fixture();try{
  const args={workspaceId:ws,actor,key,definition,event};
  assert.equal((await f.engine.simulate({...args,event:{...event,status:'draft'}})).matches,false);
  await assert.rejects(f.engine.run({...args,event:{...event,workspaceId:'ws_foreign_owner_222'}}),e=>e.status===400);
  await assert.rejects(f.engine.run({...args,definition:{...definition,conditions:[{field:'__proto__',op:'eq',value:'x'}]}}),e=>e.status===400);
  f.staff();await assert.rejects(f.engine.approve(args),e=>e.status===403);await assert.rejects(f.engine.run(args),e=>e.status===403);
 }finally{await f.cleanup();}
});
test('deadline/retry logs redact provider failures, recover manually and ignore late completions',async()=>{
 let attempts=0,abortCount=0,resolveLate;const adapters={...createSandboxProviderAdapters(),social:{mode:'sandbox',externalActionsEnabled:false,
  execute:({signal})=>{attempts++;signal.addEventListener('abort',()=>{abortCount++;});return new Promise(resolve=>{resolveLate=resolve;});}}};
 const f=await fixture({adapters,timeoutMs:50,maxRetries:1});try{
  const args={workspaceId:ws,actor,key,definition,event};await f.engine.approve(args);
  assert.equal((await f.engine.run(args)).status,'failed');assert.equal(attempts,2);assert.equal(abortCount,2);
  resolveLate({simulated:true,connected:false,workspaceId:ws,secret:'should not persist'});await new Promise(r=>setImmediate(r));
  assert.equal((await f.engine.history(args)).status,'failed');
  await f.engine.recover(args);
  const good=createSandboxAutomationEngine({store:f.store,authorizer:f.authorizer});assert.equal((await good.run(args)).status,'completed');
  const raw=await readFile(join(f.directory,'sandbox-state.json'),'utf8');assert.doesNotMatch(raw,/should not persist|secret/);
 }finally{await f.cleanup();}
});
test('bounded concurrency refuses extra work, duplicate claims do not execute twice, external adapter flags denied',async()=>{
 let release,calls=0;const adapters={...createSandboxProviderAdapters(),codeedge:{mode:'sandbox',externalActionsEnabled:false,
  execute:()=>{calls++;return new Promise(resolve=>{release=()=>resolve({simulated:true,connected:false,workspaceId:ws});});}}};
 const f=await fixture({adapters,maxConcurrency:1});try{
  const d={...definition,actions:[{type:'codeedge.task',label:'Fictional internal task'}]},args={workspaceId:ws,actor,key,definition:d,event};
  const first=f.engine.run(args);while(!release)await new Promise(r=>setTimeout(r,5));
  await assert.rejects(f.engine.run({...args,key:'sandbox_key_00000002'}),e=>e.status===429);
  const other=createSandboxAutomationEngine({store:await createPersistentSandboxStore({directory:f.directory}),authorizer:f.authorizer,adapters});
  assert.equal((await other.run(args)).status,'running');assert.equal(calls,1);release();assert.equal((await first).status,'completed');
  const unsafe=createSandboxAutomationEngine({store:f.store,authorizer:f.authorizer,adapters:{codeedge:{...adapters.codeedge,externalActionsEnabled:true}}});
  assert.equal((await unsafe.run({...args,key:'sandbox_key_00000003'})).status,'failed');assert.equal(calls,1);
 }finally{await f.cleanup();}
});
test('local persistence serializes independent store instances and rolls back failed mutations',async()=>{
 const f=await fixture();try{
  const second=await createPersistentSandboxStore({directory:f.directory});
  await Promise.all(Array.from({length:10},(_,i)=>(i%2?second:f.store).transaction(state=>{state.approvals['test'+i]={fixture:true};})));
  assert.equal(await second.transaction(state=>Object.keys(state.approvals).length),10);
  await assert.rejects(f.store.transaction(state=>{state.runs.bad={};throw Error('rollback');}),/rollback/);
  assert.equal(await second.transaction(state=>Object.keys(state.runs).length),0);
 }finally{await f.cleanup();}
});
test('all five provider contracts are explicit disconnected simulations and approval expiry denies execution',async()=>{
 let clock=Date.now();const f=await fixture({now:()=>clock});try{
  const all={...definition,actions:['search_console.inspect','business_profile.review','social.publish','notifications.send','codeedge.task'].map(type=>({type,label:'Fictional disconnected simulation'}))};
  const args={workspaceId:ws,actor,key,definition:all,event};await f.engine.approve(args);
  clock+=3600001;await assert.rejects(f.engine.run(args),e=>e.status===403);await f.engine.approve(args);
  assert.equal((await f.engine.run(args)).status,'completed');assert.equal((await f.engine.history(args)).log.length,5);
  const invalid=createSandboxAutomationEngine({store:f.store,authorizer:f.authorizer,now:()=>NaN});
  await assert.rejects(invalid.approve(args),e=>e.status===503);
 }finally{await f.cleanup();}
});
