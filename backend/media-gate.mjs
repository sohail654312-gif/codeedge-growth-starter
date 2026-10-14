import {DomainError,ownerWorkspaceId} from './core.mjs';
// This is not a publicly wired route. Caller must supply a server-authenticated
// principal, and the object reference stays tenant-scoped inside the database.
export function createMediaGate({store,authorizer}) {
  if(!store||!authorizer?.authorize)throw new DomainError('Trusted media gate unavailable.',503);
  return Object.freeze({
    async requestDeletion({actorUserId,workspaceId,id}) {
      if(typeof actorUserId!=='string'||workspaceId!==ownerWorkspaceId(actorUserId))
        throw new DomainError('Only the workspace owner can request deletion.',403);
      if(!store.queueMediaDeletion)throw new DomainError('Durable media deletion unavailable.',503);
      return store.queueMediaDeletion({workspaceId,id,actorUserId});
    },
    async lookup({actorUserId,workspaceId,id}) {
      if(typeof actorUserId!=='string')throw new DomainError('Unauthorized.',403);
      if(store.capabilities?.atomicMediaAuthorization!==true||!store.authorizedReadyMedia)
        throw new DomainError('Transactional media authorization required.',503);
      // The actor, workspace and consent are checked in the same transaction.
      const object=await store.authorizedReadyMedia({workspaceId,id,actorUserId});
      if(!object)throw new DomainError('Media not available.',404);
      if(typeof object.storage_key!=='string'||!object.storage_key.startsWith('growth-starter/'+workspaceId+'/'))
        throw new DomainError('Media ownership violation.',403);
      return {key:object.storage_key,contentType:object.content_type};
    }
  });
}
