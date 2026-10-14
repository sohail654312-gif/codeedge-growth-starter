import {DomainError,ownerWorkspaceId} from './core.mjs';

// No listener, database or auth SDK constructed here. Runtime must inject both
// verified requireAuth and a separately accepted transactional operations service.
export function makeWorkspaceOperationRoutes({requireAuth,json,error,workspaceOperations=null}){
 const protect=requireAuth();
 const handle=fn=>[protect,async ctx=>{
  try{
   if(workspaceOperations?.capabilities?.transactionalAuthorization!==true||workspaceOperations?.capabilities?.persistentOperations!==true)
    throw new DomainError('Transactional workspace operations are not enabled.',503);
   const actor=ctx.user?.userId,workspaceId=ctx.query?.workspaceId||ownerWorkspaceId(actor);
   return json(await fn(workspaceOperations,{workspaceId,actor,key:ctx.body?.idempotencyKey},ctx));
  }catch(e){return error(e instanceof DomainError?e.message:'Workspace operation unavailable.',e instanceof DomainError?e.status:503);}
 }];
 return {
  'GET /api/operations/requests':handle((service,args,ctx)=>service.list({...args,query:ctx.query})),
  'GET /api/operations/requests/:id':handle((service,args,ctx)=>service.detail({...args,id:ctx.params?.id})),
  'GET /api/operations/history':handle((service,args,ctx)=>service.history({...args,query:ctx.query})),
  'POST /api/operations/profile':handle((service,args,ctx)=>service.saveProfile({...args,fields:ctx.body?.fields,expectedVersion:ctx.body?.version})),
  'POST /api/operations/requests':handle((service,args,ctx)=>service.createRequest({...args,fields:ctx.body?.fields})),
  'POST /api/operations/requests/:id/assignment':handle((service,args,ctx)=>service.assign({...args,id:ctx.params?.id,
   assignedTo:ctx.body?.assignedTo,dueDate:ctx.body?.dueDate??null,expectedVersion:ctx.body?.version})),
  'POST /api/operations/requests/:id/correction':handle((service,args,ctx)=>service.correction({...args,id:ctx.params?.id,
   note:ctx.body?.note,expectedVersion:ctx.body?.version}))
 };
}
