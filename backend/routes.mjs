import {
  DomainError, ownerWorkspaceId, tableFor, resolveWorkspace, profileInput,
  enquiryInput, requestInput, statusInput, pageArgs, validateImageUpload, validGrant, reviewRequestTransition, clientRequestDecision, validRecordId
} from './core.mjs';

// The SDK primitives are dependency-injected so the exact route handlers can
// be tested against a deterministic fake without production credentials.
export function makeGrowthStarterRoutes({db,storage,requireAuth,json,error,cryptoRandomUUID,trustedMembership=null,workflowMutations=null,mediaLifecycle=null}) {
  const protect=requireAuth();
  async function safe(ctx,action,fn) {
    try {
      const workspace=await resolveWorkspace(ctx,db,action,trustedMembership);
      return await fn(workspace);
    } catch (caught) {
      if(caught instanceof DomainError) return error(caught.message,caught.status);
      throw caught;
    }
  }
  async function safePersonal(ctx,fn) {
    try {
      const uid=ctx.user?.userId;
      const own=ownerWorkspaceId(uid);
      // Only the owner's workspace is visible by default.
      // No legacy grant tables are trusted for workspace discovery.
      let visible=[{workspaceId:own,role:'owner'}];
      if(trustedMembership?.capabilities?.authoritativeRead) {
        const permitted=await trustedMembership.list({userId:uid});
        if(!Array.isArray(permitted)) throw new DomainError('Membership response invalid.',403);
        visible=[...visible,...permitted.filter(g=>validGrant(g,uid,g?.workspaceId))
          .map(g=>({workspaceId:g.workspaceId,role:g.role}))];
      }
      return await fn(visible);
    } catch(caught) {
      if(caught instanceof DomainError) return error(caught.message,caught.status);
      throw caught;
    }
  }
  return {
    'GET /api/_healthcheck': [async () => json({status:'ok'})],
    'GET /api/workspaces': [
      protect,
      async ctx => safePersonal(ctx,workspaces=>json({workspaces,invitesEnabled:false}))
    ],
    'GET /api/overview': [
      protect,
      async ctx => safe(ctx,'overview:read',async workspace=>{
        const owner=workspace.ownerUserId;
        const [profiles,enquiries,requests,assets]=await Promise.all([
          db.list(tableFor('profiles',owner),{limit:1}),
          db.list(tableFor('enquiries',owner),{limit:50}),
          db.list(tableFor('requests',owner),{limit:50}),
          db.list(tableFor('assets',owner),{limit:24})
        ]);
        const assetRows=await Promise.all(assets.items.map(async asset=>{
          // Never sign forged/cross-tenant paths or unapproved material.
          const ownedPath=typeof asset.path==='string' &&
            /^growth-starter\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\.(png|jpg|webp)$/.test(asset.path) &&
            asset.path.startsWith('growth-starter/'+owner+'/');
          if(!ownedPath || asset.consentStatus!=='approved') return {...asset,path:undefined,url:''};
          const [signed]=await storage.url([asset.path]);
          return {...asset,path:undefined,url:signed?.url||''};
        }));
        return json({
          workspaceId:workspace.workspaceId, role:workspace.role,
          profile:profiles.items[0]||null,enquiries:enquiries.items,
          requests:requests.items,assets:assetRows,
          hasMore:{enquiries:Boolean(enquiries.nextToken),requests:Boolean(requests.nextToken),assets:Boolean(assets.nextToken)}
        });
      })
    ],
    'GET /api/enquiries': [
      protect,
      async ctx => safe(ctx,'overview:read',async workspace=>{
        const page=pageArgs(ctx.query);
        const result=await db.list(tableFor('enquiries',workspace.ownerUserId),page);
        return json({items:result.items,nextCursor:result.nextToken||null});
      })
    ],
    'GET /api/requests': [
      protect,
      async ctx => safe(ctx,'overview:read',async workspace=>{
        const page=pageArgs(ctx.query);
        const result=await db.list(tableFor('requests',workspace.ownerUserId),page);
        return json({items:result.items,nextCursor:result.nextToken||null});
      })
    ],
    'POST /api/profile': [
      protect,
      async ctx => safe(ctx,'profile:write',async workspace=>{
        const fields=profileInput(ctx.body);
        const record={...fields,updatedAt:new Date().toISOString()};
        const key=tableFor('profiles',workspace.ownerUserId);
        const current=await db.list(key,{limit:1});
        if(current.items.length) {
          const [ok]=await db.update(key,[{id:current.items[0].id,record}]);
          return ok?json({...record,id:current.items[0].id}):error('Could not save profile.',500);
        }
        const [id]=await db.add(key,[record]);
        return id?json({...record,id},201):error('Could not save profile.',500);
      })
    ],
    'POST /api/enquiries': [
      protect,
      async ctx => safe(ctx,'enquiry:create',async workspace=>{
        const fields=enquiryInput(ctx.body);
        const record={...fields,status:'New',createdAt:new Date().toISOString()};
        const [id]=await db.add(tableFor('enquiries',workspace.ownerUserId),[record]);
        return id?json({...record,id},201):error('Could not create enquiry.',500);
      })
    ],
    'PUT /api/enquiries/:id': [
      protect,
      async ctx => safe(ctx,'enquiry:update',async workspace=>{
        const status=statusInput(ctx.body);
        const key=tableFor('enquiries',workspace.ownerUserId);
        const id=validRecordId(ctx.params?.id);
        const [original]=await db.get(key,[id]);
        // An ID can only be edited in the workspace partition selected via authorization.
        if(!original) return error('Enquiry not found.',404);
        const updated={...original,status};
        const [ok]=await db.update(key,[{id,record:updated}]);
        return ok?json({...updated,id}):error('Could not update enquiry.',500);
      })
    ],
    'POST /api/requests': [
      protect,
      async ctx => safe(ctx,'request:create',async workspace=>{
        const fields=requestInput(ctx.body);
        const record={...fields,status:'Requested',createdAt:new Date().toISOString()};
        const [id]=await db.add(tableFor('requests',workspace.ownerUserId),[record]);
        return id?json({...record,id},201):error('Could not create request.',500);
      })
    ],
    'PUT /api/requests/:id/status': [
      protect,
      async ctx => safe(ctx,'request:review',async workspace=>{
        // AppDeploy list/get+update is not verified atomic. Never perform
        // consequence-bearing state transitions with that operation.
        if(!workflowMutations?.capabilities?.atomicTransitions) return error('Review transitions require verified transactional persistence.',503);
        const id=validRecordId(ctx.params?.id);
        const result=await workflowMutations.review({workspace,actor:ctx.user.userId,id,
          requested:ctx.body?.status,expectedVersion:ctx.body?.version});
        return json(result);
      })
    ],
    'POST /api/requests/:id/decision': [
      protect,
      async ctx => safe(ctx,'request:decide',async workspace=>{
        if(!workflowMutations?.capabilities?.atomicTransitions) return error('Approval requires verified transactional persistence.',503);
        const result=await workflowMutations.decision({workspace,actor:ctx.user.userId,
          id:validRecordId(ctx.params?.id),decision:ctx.body?.decision,
          expectedVersion:ctx.body?.version});
        return json(result);
      })
    ],
    'DELETE /api/assets/:id': [
      protect,
      async ctx => safe(ctx,'asset:delete',async workspace=>{
        // Delete storage and metadata via a durable tombstone/outbox adapter;
        // never report a partial two-service deletion as success.
        if(!mediaLifecycle?.capabilities?.durableDeletion) return error('Durable media deletion is not yet available.',503);
        return await mediaLifecycle.remove({workspace,actor:ctx.user.userId,
          id:validRecordId(ctx.params?.id),json,error});
      })
    ],
    'POST /api/assets': [
      protect,
      async ctx => safe(ctx,'asset:upload',async workspace=>{
        // Shared-media quotas and consent need a transactional service.
        if(workspace.role!=='owner') return error('Shared media uploads are not yet enabled.',503);
        const file=validateImageUpload(ctx.body);
        const key=tableFor('assets',workspace.ownerUserId);
        // Soft quota guard, not an atomic cross-request rate limit.
        const {items,nextToken}=await db.list(key,{limit:25});
        if(items.length>=25||nextToken) return error('Media quota reached for this workspace.',429);
        const path='growth-starter/'+workspace.ownerUserId+'/'+cryptoRandomUUID()+'.'+file.extension;
        const [saved]=await storage.write([{path,content:file.base64,contentType:file.mime}]);
        if(!saved) return error('Could not upload image.',500);
        const data={filename:file.filename,mime:file.mime,path,createdAt:new Date().toISOString(),consentStatus:'not_verified'};
        try {
          const [id]=await db.add(key,[data]);
          if(!id) {
            await storage.delete([path]);
            return error('Could not save image metadata.',500);
          }
          const [signed]=await storage.url([path]);
          return json({...data,id,url:signed?.url||''},201);
        } catch(caught) {
          await storage.delete([path]);
          throw caught;
        }
      })
    ]
  };
}
