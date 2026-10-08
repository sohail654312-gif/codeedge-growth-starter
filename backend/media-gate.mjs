import {DomainError,ownerWorkspaceId} from './core.mjs';
// This is not a publicly wired route. Caller must supply a server-authenticated
// principal, and the object reference stays tenant-scoped inside the database.
export function createMediaGate({store,authorizer}) {
  if(!store||!authorizer?.authorize)throw new DomainError('Trusted media gate unavailable.',503);
  return Object.freeze({
    async lookup({actorUserId,workspaceId,id}) {
      if(typeof actorUserId!=='string')throw new DomainError('Unauthorized.',403);
      if(workspaceId!==ownerWorkspaceId(actorUserId)) {
        await authorizer.authorize({userId:actorUserId,workspaceId});
      }
      // PG checks consent, scan, rights, lifecycle & exact workspace in SQL.
      const object=await store.getReadyMedia({workspaceId,id});
      if(!object)throw new DomainError('Media not available.',404);
      if(typeof object.storage_key!=='string'||!object.storage_key.startsWith('growth-starter/'+workspaceId+'/'))
        throw new DomainError('Media ownership violation.',403);
      return {key:object.storage_key,contentType:object.content_type};
    }
  });
}
