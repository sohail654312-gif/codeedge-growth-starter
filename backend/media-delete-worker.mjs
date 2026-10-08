import {DomainError} from './core.mjs';

// Explicit one-shot manual runner. This MUST NOT be scheduled by default.
// Storage adapter.delete() must be idempotent and report not-found as success.
export async function processDeletionOutboxOnce({store,storage,limit=5}) {
  if(!store?.claimDeleteBatch||!store?.acknowledgeMediaDeletion||!store?.retryMediaDeletion||
    !storage?.delete)throw new DomainError('Durable deletion adapters required.',503);
  const batch=await store.claimDeleteBatch(limit);
  const results=[];
  for(const item of batch) {
    try {
      const outcome=await storage.delete(item.storageKey);
      if(outcome!==true && outcome?.deleted!==true && outcome?.notFound!==true)
        throw new DomainError('Storage deletion not confirmed.',503);
      await store.acknowledgeMediaDeletion({outboxId:item.outboxId,storageKey:item.storageKey});
      results.push({outboxId:item.outboxId,status:'done'});
    }catch(error){
      await store.retryMediaDeletion({outboxId:item.outboxId});
      results.push({outboxId:item.outboxId,status:'retry_required'});
    }
  }
  return results;
}
