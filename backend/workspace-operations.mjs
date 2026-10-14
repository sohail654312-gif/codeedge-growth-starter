import {createHash,createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
import {DomainError,profileInput,requestInput,validRecordId,textField,clientRequestDecision} from './core.mjs';
import {authorizeTransactionalActor} from './transactional.mjs';

const statuses=['Requested','In progress','Awaiting approval','Approved','Changes requested','Completed'];
const kinds=['Website update','Social content','Local SEO','Other'];
const denied=()=>{throw new DomainError('Operation denied.',403);};
function subject(v){if(typeof v!=='string'||! /^[A-Za-z0-9_-]{8,128}$/.test(v))denied();return v;}
function version(v,r){if(!Number.isSafeInteger(v)||v<0||v!==r)throw new DomainError('Version changed; refresh before saving.',409);}
function limit(v=20){const n=Number(v);if(!Number.isInteger(n)||n<1||n>50)throw new DomainError('Invalid page size.');return n;}
function choice(v,list){if(v==null||v==='')return null;if(!list.includes(v))throw new DomainError('Invalid filter.');return v;}

// Trusted server composition only. Caller actor must come from verified identity,
// never JSON, query parameters, a role hint or an arbitrary actor-header.
export function createWorkspaceOperations({store,cursorKey,now=()=>Date.now(),makeId=randomUUID}={}){
 if(store?.capabilities?.workspaceOperations!==true||store?.capabilities?.serializableTransactions!==true||
    typeof store.transaction!=='function'||typeof cursorKey!=='string'||cursorKey.length<32)
   throw new DomainError('Transactional operations configuration required.',503);
 const sign=raw=>createHmac('sha256',cursorKey).update(raw).digest('base64url');
 function encode(binding,position){const raw=Buffer.from(JSON.stringify({binding,position,expires:now()+900000})).toString('base64url');return raw+'.'+sign(raw);}
 function decode(token,binding){
  if(token==null||token==='')return null;
  try{
   if(typeof token!=='string'||token.length>2048||! /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token))throw Error();
   const [raw,sig]=token.split('.');const a=Buffer.from(sig),b=Buffer.from(sign(raw));
   if(a.length!==b.length||!timingSafeEqual(a,b))throw Error();
   const obj=JSON.parse(Buffer.from(raw,'base64url').toString('utf8'));
   if(obj.binding!==binding||!Number.isSafeInteger(obj.expires)||obj.expires<=now()||obj.expires>now()+900000)throw Error();
   return obj.position;
  }catch{throw new DomainError('Invalid or expired page cursor.');}
 }
 async function mutation({workspaceId,actor,key,action,operation,payload},fn){
  subject(actor);
  if(typeof key!=='string'||! /^[A-Za-z0-9_-]{16,80}$/.test(key))throw new DomainError('Idempotency key required.');
  const digest=createHash('sha256').update(JSON.stringify({operation,payload})).digest('hex');
  return store.transaction(async tx=>{
   const live=await authorizeTransactionalActor(tx,workspaceId,actor,action);
   // Authorization comes BEFORE replay lookup: revoked actors cannot recover results.
   const old=await tx.readReceipt(workspaceId,actor,key);
   if(old){if(old.payload_digest!==digest)throw new DomainError('Idempotency key reused for a different operation.',409);return old.result;}
   const result=await fn(tx,live);
   await tx.audit({workspaceId,actorId:actor,action:operation,target:result.id||workspaceId,at:now()});
   await tx.saveReceipt(workspaceId,actor,key,digest,result);
   return result;
  });
 }
 return Object.freeze({capabilities:Object.freeze({transactionalAuthorization:true,persistentOperations:true}),
  async authorize({workspaceId,actor}){
   return store.transaction(tx=>authorizeTransactionalActor(tx,workspaceId,actor,'overview:read'));
  },
  async saveProfile({workspaceId,actor,key,fields,expectedVersion}){
   const payload={fields:profileInput(fields),expectedVersion};
   return mutation({workspaceId,actor,key,action:'profile:write',operation:'profile.saved',payload},async tx=>{
    const old=await tx.lockProfile(workspaceId);version(expectedVersion,old?.version||0);
    const result={fields:payload.fields,version:expectedVersion+1};
    await tx.saveProfile(workspaceId,result.fields,result.version);return result;
   });
  },
  async createRequest({workspaceId,actor,key,fields}){
   const payload=requestInput(fields),id=validRecordId(makeId());
   return mutation({workspaceId,actor,key,action:'request:create',operation:'request.created',payload},async tx=>{
    await tx.createRequest(workspaceId,{...payload,id,createdBy:actor});
    return {id,...payload,status:'Requested',version:0};
   });
  },
  async assign({workspaceId,actor,key,id,assignedTo,dueDate=null,expectedVersion}){
   validRecordId(id);if(assignedTo!==null)subject(assignedTo);
   if(dueDate!==null&&(! /^\d{4}-\d{2}-\d{2}$/.test(dueDate)||!Number.isFinite(Date.parse(dueDate))||new Date(dueDate).toISOString().slice(0,10)!==dueDate))
    throw new DomainError('Invalid due date.');
   const payload={id,assignedTo,dueDate,expectedVersion};
   return mutation({workspaceId,actor,key,action:'request:review',operation:'request.assigned',payload},async(tx,live)=>{
    if(!['owner','agency_admin'].includes(live.role))denied();
    if(assignedTo!==null&&assignedTo!==live.ownerUserId){
     const member=await tx.lockMembership(workspaceId,assignedTo);
     if(!member||member.workspaceId!==workspaceId||member.userId!==assignedTo||member.state!=='active'||member.ownerUserId!==live.ownerUserId||!['agency_admin','staff'].includes(member.role))denied();
    }
    const r=await tx.lockRequest(workspaceId,id);if(!r)throw new DomainError('Request not found.',404);version(expectedVersion,r.version);
    if(r.status==='Completed')throw new DomainError('Completed work cannot be assigned.',409);
    await tx.assignRequest(workspaceId,id,{assignedTo,dueDate,updatedAt:now()});
    return {id,assignedTo,dueDate,version:r.version+1};
   });
  },
  async correction({workspaceId,actor,key,id,note,expectedVersion}){
   validRecordId(id);const payload={id,note:textField(note,'Correction',600),expectedVersion};
   return mutation({workspaceId,actor,key,action:'request:decide',operation:'request.correction',payload},async(tx,live)=>{
    const r=await tx.lockRequest(workspaceId,id);if(!r)throw new DomainError('Request not found.',404);version(expectedVersion,r.version);
    const status=clientRequestDecision(r.status,'Changes requested',live.role);
    const updated={...r,status,version:r.version+1,decidedBy:actor,updatedAt:now()};
    await tx.updateRequest(workspaceId,id,updated);await tx.appendNote(workspaceId,id,actor,payload.note);
    return updated;
   });
  },
  async list({workspaceId,actor,query={}}){
   subject(actor);const filters={status:choice(query.status,statuses),kind:choice(query.kind,kinds),assignedTo:query.assignedTo?subject(query.assignedTo):null};
   const size=limit(query.limit),binding=JSON.stringify({workspaceId,actor,type:'requests',...filters});
   const after=decode(query.cursor,binding);
   if(after&&(!after.at||!/^\d{4}-\d{2}-\d{2}T/.test(after.at)||!Number.isFinite(Date.parse(after.at))||typeof after.id!=='string'))throw new DomainError('Invalid page position.');
   return store.transaction(async tx=>{
    await authorizeTransactionalActor(tx,workspaceId,actor,'overview:read');
    const rows=await tx.listRequests(workspaceId,{...filters,after,limit:size+1}),items=rows.slice(0,size);
    const last=items.at(-1);
    const nextCursor=rows.length>size?encode(binding,{at:last.cursorAt||new Date(last.updatedAt).toISOString(),id:last.id}):null;
    return {items:items.map(({cursorAt,...r})=>r),nextCursor,scope:'loaded_page_only'};
   });
  },
  async detail({workspaceId,actor,id}){
   validRecordId(id);
   return store.transaction(async tx=>{
    await authorizeTransactionalActor(tx,workspaceId,actor,'overview:read');
    const r=await tx.lockRequest(workspaceId,id);if(!r)throw new DomainError('Request not found.',404);
    return {...r,notesHistory:await tx.requestNotes(workspaceId,id),historyLimit:50};
   });
  },
  async history({workspaceId,actor,query={}}){
   const size=limit(query.limit),binding=JSON.stringify({workspaceId,actor,type:'audit'}),before=decode(query.cursor,binding);
   if(before!==null&&(typeof before!=='string'||! /^[1-9]\d{0,18}$/.test(before)))throw new DomainError('Invalid history position.');
   return store.transaction(async tx=>{
    const live=await authorizeTransactionalActor(tx,workspaceId,actor,'overview:read');
    if(!['owner','agency_admin'].includes(live.role))denied();
    const rows=await tx.listAudit(workspaceId,before,size+1),items=rows.slice(0,size);
    return {items,nextCursor:rows.length>size?encode(binding,items.at(-1).id):null};
   });
  }
 });
}
