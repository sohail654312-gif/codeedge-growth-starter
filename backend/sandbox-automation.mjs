import {createHash} from 'node:crypto';
import {DomainError} from './core.mjs';
const triggers=['manual','request.reviewed','content.ready','report.imported'];
const contracts=Object.freeze({
 'search_console.inspect':'search_console','business_profile.review':'business_profile',
 'social.publish':'social','notifications.send':'notifications','codeedge.task':'codeedge'
});
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const bounded=(v,max=120)=>typeof v==='string'&&v.length>0&&v.length<=max&&!/[\u0000-\u001f\u007f]/u.test(v);
function definition(v){
 if(!v||!bounded(v.id,80)||!triggers.includes(v.trigger)||!Array.isArray(v.conditions)||v.conditions.length>8||
  !Array.isArray(v.actions)||v.actions.length<1||v.actions.length>10||typeof v.requiresApproval!=='boolean')throw new DomainError('Invalid bounded automation definition.');
 const conditions=v.conditions.map(c=>{
  if(!['status','kind','evidence'].includes(c?.field)||!['eq','in'].includes(c.op))throw new DomainError('Unsupported automation condition.');
  const values=c.op==='eq'?[c.value]:c.value;
  if(!Array.isArray(values)||values.length<1||values.length>8||!values.every(x=>bounded(x)))throw new DomainError('Invalid condition values.');
  return {field:c.field,op:c.op,value:c.op==='eq'?values[0]:[...values]};
 });
 const actions=v.actions.map(a=>{
  if(!Object.hasOwn(contracts,a?.type)||!bounded(a.label,200))throw new DomainError('Unsupported sandbox action.');
  // Contract accepts bounded labels only, never arbitrary URLs, tokens or provider payloads.
  return {type:a.type,label:a.label};
 });
 return {id:v.id,trigger:v.trigger,conditions,actions,requiresApproval:v.requiresApproval};
}
export function createSandboxProviderAdapters(){
 return Object.freeze(Object.fromEntries(Object.values(contracts).map(provider=>[provider,Object.freeze({
  provider,mode:'sandbox',externalActionsEnabled:false,
  async execute({action,context,signal}){
   if(signal?.aborted)throw Error('aborted');
   return {simulated:true,provider,workspaceId:context.workspaceId,action:action.type,connected:false};
  }
 })])));
}

// Provider neutral service -> strict action interface -> explicit sandbox adapters.
// There is deliberately no live mode, credentials, scheduler, publishing or network I/O.
export function createSandboxAutomationEngine({store,authorizer,adapters=createSandboxProviderAdapters(),timeoutMs=500,maxRetries=1,maxConcurrency=2,now=()=>Date.now()}={}){
 if(store?.capabilities?.persistentSandbox!==true||typeof store.transaction!=='function'||
  authorizer?.capabilities?.transactionalAuthorization!==true||typeof authorizer.authorize!=='function')
  throw new DomainError('Persistent sandbox store and trusted authorizer required.',503);
 if(!Number.isInteger(timeoutMs)||timeoutMs<50||timeoutMs>2000||!Number.isInteger(maxRetries)||maxRetries<0||maxRetries>2||
  !Number.isInteger(maxConcurrency)||maxConcurrency<1||maxConcurrency>4)throw new DomainError('Invalid automation execution bounds.');
 let active=0;
 const clock=()=>{const value=now();if(!Number.isSafeInteger(value)||value<0)throw new DomainError('Automation clock unavailable.',503);return value;};
 async function authorize(workspaceId,actor,ownerOnly=false){
  if(!/^ws_[A-Za-z0-9_-]{8,128}$/.test(workspaceId||'')||! /^[A-Za-z0-9_-]{8,128}$/.test(actor||''))throw new DomainError('Automation access denied.',403);
  const abort=new AbortController();let timer,live;
  try{live=await Promise.race([Promise.resolve().then(()=>authorizer.authorize({workspaceId,actor,signal:abort.signal})),new Promise((_,reject)=>{
   timer=setTimeout(()=>{abort.abort();reject(new DomainError('Automation authority unavailable.',503));},2000);
  })]);}finally{clearTimeout(timer);abort.abort();}
  if(live?.workspaceId!==workspaceId||live.userId!==actor||!['owner','agency_admin'].includes(live.role)||ownerOnly&&live.role!=='owner')throw new DomainError('Automation access denied.',403);
  return live;
 }
 function identity(workspaceId,key){if(! /^[A-Za-z0-9_-]{16,80}$/.test(key||''))throw new DomainError('Automation idempotency key required.');return workspaceId+'|'+key;}
 const approvalRequired=d=>d.requiresApproval||d.actions.some(a=>['social.publish','notifications.send'].includes(a.type));
 async function log(id,event){await store.transaction(state=>{const r=state.runs[id];if(!r)throw new DomainError('Unknown sandbox run.',404);if(r.log.length<40)r.log.push({...event,at:clock()});});}
 return Object.freeze({capabilities:Object.freeze({sandboxOnly:true,externalActionsEnabled:false,persistentLogs:true}),
  async simulate({workspaceId,actor,definition:input,event={}}){
   await authorize(workspaceId,actor);const d=definition(input);
   if(event.workspaceId!==workspaceId||!triggers.includes(event.type))throw new DomainError('Tenant-bound trigger required.');
   const matches=d.trigger===event.type&&d.conditions.every(c=>c.op==='eq'?event[c.field]===c.value:c.value.includes(event[c.field]));
   return {mode:'dry_run',workspaceId,matches,requiresApproval:approvalRequired(d),actions:matches?d.actions:[],externalActionsEnabled:false};
  },
  async approve({workspaceId,actor,key,definition:input,event}){
   await authorize(workspaceId,actor,true);const d=definition(input);
   const simulation=await this.simulate({workspaceId,actor,definition:d,event});if(!simulation.matches)throw new DomainError('Trigger conditions do not match.',409);
   const id=identity(workspaceId,key),hash=digest({d,event:normalizeEvent(event,workspaceId)});
   const expiresAt=clock()+3600000;
   await store.transaction(state=>{state.approvals[id]={digest:hash,approvedBy:actor,expiresAt};});
   return {approved:true,scope:'sandbox_only',expiresAt};
  },
  async run({workspaceId,actor,key,definition:input,event,mode='sandbox'}){
   if(mode!=='sandbox')throw new DomainError('External automation is disabled.',403);
   await authorize(workspaceId,actor);const d=definition(input),e=normalizeEvent(event,workspaceId);
   const simulation=await this.simulate({workspaceId,actor,definition:d,event:e});if(!simulation.matches)return {...simulation,status:'not_matched'};
   const id=identity(workspaceId,key),hash=digest({d,event:e});
   if(active>=maxConcurrency)throw new DomainError('Sandbox concurrency limit reached; retry the same key.',429);
   active++;
   try{
    const claim=await store.transaction(state=>{
     const old=state.runs[id];if(old&&old.digest!==hash)throw new DomainError('Idempotency key payload changed.',409);
     if(old&&old.status!=='ready')return {existing:true,status:old.status};
     const approved=state.approvals[id];
     if(approvalRequired(d)&&(!approved||approved.digest!==hash||!Number.isSafeInteger(approved.expiresAt)||approved.expiresAt<=clock()))throw new DomainError('Owner sandbox approval required.',403);
     state.runs[id]={workspaceId,digest:hash,status:'running',startedAt:clock(),execution:(old?.execution||0)+1,log:old?.log||[]};
     return {existing:false};
    });
    if(claim.existing)return {status:claim.status,replayed:true,mode:'sandbox',externalActionsEnabled:false};
    try{
     for(let index=0;index<d.actions.length;index++){
      await authorize(workspaceId,actor);const action=d.actions[index],adapter=adapters[contracts[action.type]];
      if(adapter?.mode!=='sandbox'||adapter.externalActionsEnabled!==false||typeof adapter.execute!=='function')throw new DomainError('Sandbox adapter required.',503);
      let done=false;
      for(let attempt=0;attempt<=maxRetries;attempt++){
       const abort=new AbortController();let timer;
       try{
        const result=await Promise.race([Promise.resolve().then(()=>adapter.execute({action,context:{workspaceId,actor,mode:'sandbox'},idempotencyKey:id+'|'+index,signal:abort.signal})),
         new Promise((_,reject)=>{timer=setTimeout(()=>{abort.abort();reject(Error('timeout'));},timeoutMs);})]);
        if(result?.simulated!==true||result.workspaceId!==workspaceId||result.connected!==false)throw Error('invalid sandbox result');
        await log(id,{index,attempt,status:'simulated',provider:contracts[action.type]});done=true;break;
       }catch{await log(id,{index,attempt,status:'attempt_failed',reason:'sandbox_action_unavailable'});}
       finally{clearTimeout(timer);abort.abort();}
      }
      if(!done)throw new DomainError('Sandbox action retry budget exhausted.',503);
     }
     await store.transaction(state=>{state.runs[id].status='completed';});
     return {status:'completed',mode:'sandbox',externalActionsEnabled:false};
    }catch{
     await store.transaction(state=>{state.runs[id].status='failed';});
     return {status:'failed',mode:'sandbox',externalActionsEnabled:false};
    }
   }finally{active--;}
  },
  async history({workspaceId,actor,key}){
   await authorize(workspaceId,actor);const id=identity(workspaceId,key);
   return store.transaction(state=>structuredClone(state.runs[id]||null));
  },
  async recover({workspaceId,actor,key}){
   await authorize(workspaceId,actor,true);const id=identity(workspaceId,key);
   return store.transaction(state=>{
    const r=state.runs[id];if(!r)throw new DomainError('Unknown sandbox run.',404);
    const maxRuntime=10*(maxRetries+1)*timeoutMs+30000;
    if(r.status==='running'&&clock()-r.startedAt<=maxRuntime)throw new DomainError('Run is still within its bounded lease.',409);
    if(!['failed','running'].includes(r.status)||r.execution>=3)throw new DomainError('Run cannot be recovered.',409);
    r.status='ready';r.log.push({at:clock(),status:'manual_sandbox_recovery'});return {ready:true,scope:'sandbox_only'};
   });
  }
 });
}
function normalizeEvent(event,workspaceId){
 if(event?.workspaceId!==workspaceId||!triggers.includes(event.type))throw new DomainError('Tenant-bound trigger required.');
 const result={workspaceId,type:event.type};for(const field of ['status','kind','evidence']){
  if(event[field]!=null){if(!bounded(event[field]))throw new DomainError('Invalid trigger field.');result[field]=event[field];}
 }return result;
}
