import {DomainError} from './core.mjs';

// Explicit one-shot manual runner. This MUST NOT be scheduled by default.
// Storage adapter.delete() must be idempotent and report not-found as success.
export async function processDeletionOutboxOnce({store,storage,limit=5,timeoutMs=2000}) {
  if(!store?.claimDeleteBatch||!store?.acknowledgeMediaDeletion||!store?.retryMediaDeletion||
    !storage?.delete)throw new DomainError('Durable deletion adapters required.',503);
  if(!Number.isInteger(timeoutMs)||timeoutMs<50||timeoutMs>10000)throw new DomainError('Invalid storage timeout.');
  const batch=await store.claimDeleteBatch(limit);
  const results=[];
  for(const item of batch) {
    const abort=new AbortController();let timer;
    try {
      const outcome=await Promise.race([Promise.resolve().then(()=>storage.delete(item.storageKey,{signal:abort.signal})),new Promise((_,reject)=>{
        timer=setTimeout(()=>{abort.abort();reject(new DomainError('Storage deletion timed out.',503));},timeoutMs);
      })]);
      if(outcome!==true && outcome?.deleted!==true && outcome?.notFound!==true)
        throw new DomainError('Storage deletion not confirmed.',503);
      await store.acknowledgeMediaDeletion({outboxId:item.outboxId,storageKey:item.storageKey,attempts:item.attempts});
      results.push({outboxId:item.outboxId,status:'done'});
    }catch(error){
      await store.retryMediaDeletion({outboxId:item.outboxId,attempts:item.attempts});
      results.push({outboxId:item.outboxId,status:'retry_required'});
    }finally{clearTimeout(timer);abort.abort();}
  }
  return results;
}
