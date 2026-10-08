import {
  DomainError, ownerWorkspaceId, tableFor, resolveWorkspace, profileInput,
  enquiryInput, requestInput, statusInput, pageArgs, validateImageUpload, validGrant
} from './core.mjs';

// The SDK primitives are dependency-injected so the exact route handlers can
// be tested against a deterministic fake without production credentials.
export function makeGrowthStarterRoutes({db,storage,requireAuth,json,error,cryptoRandomUUID}) {
  const protect=requireAuth();
  async function safe(ctx,action,fn) {
    try {
      const workspace=await resolveWorkspace(ctx,db,action);
      return await fn(workspace);
    } catch (caught) {
      if(caught instanceof DomainError) return error(caught.message,caught.status);
      throw caught;
    }
  }
  async function safePersonal(ctx,fn) {
    try {
      const uid=ctx.user?.userId;
      // This endpoint lists only server-verified personal and active grant IDs.
      const own=ownerWorkspaceId(uid);
      const {items}=await db.list(tableFor('memberships',uid),{limit:25});
      const grants=items.filter(entry=>validGrant(entry,uid,entry?.workspaceId))
        .map(entry=>({workspaceId:entry.workspaceId,role:entry.role}));
      return await fn([{workspaceId:own,role:'owner'},...grants]);
    } catch (caught) {
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
          const [signed]=await storage.url([asset.path]);
          return {...asset,url:signed?.url||''};
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
        const id=ctx.params?.id;
        if(typeof id!=='string'||id.length>128||! /^[a-zA-Z0-9_-]+$/.test(id)) throw new DomainError('Invalid enquiry ID.');
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
    'POST /api/assets': [
      protect,
      async ctx => safe(ctx,'asset:upload',async workspace=>{
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
