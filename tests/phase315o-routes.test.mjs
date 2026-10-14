import test from 'node:test';
import assert from 'node:assert/strict';
import {makeWorkspaceOperationRoutes} from '../backend/workspace-routes.mjs';
import {processDeletionOutboxOnce} from '../backend/media-delete-worker.mjs';
const deps={requireAuth:()=>()=>{},json:data=>({status:200,data}),error:(message,status)=>({status,message})};
test('operations routes refuse an unwired service and discard body actor/role claims',async()=>{
 const route='POST /api/operations/requests';
 assert.equal((await makeWorkspaceOperationRoutes(deps)[route][1]({user:{userId:'fiction_owner_111'},body:{}})).status,503);
 let args;const service={capabilities:{transactionalAuthorization:true,persistentOperations:true},createRequest:async v=>{args=v;return {id:'fixture'};}};
 const result=await makeWorkspaceOperationRoutes({...deps,workspaceOperations:service})[route][1]({user:{userId:'fiction_owner_111'},query:{workspaceId:'ws_fiction_owner_222'},body:{actor:'fiction_owner_222',role:'owner',idempotencyKey:'fixture_key_123456',fields:{}}});
 assert.equal(result.status,200);assert.equal(args.actor,'fiction_owner_111');assert.equal(args.role,undefined);
 service.createRequest=async()=>{throw Error('postgres credential=secret');};
 assert.equal((await makeWorkspaceOperationRoutes({...deps,workspaceOperations:service})[route][1]({user:{userId:'fiction_owner_111'}})).message,'Workspace operation unavailable.');
});
test('hung deletion adapter aborts, retries its lease and never acknowledges late completion',async()=>{
 let aborted=false,acked=0,retried=0,resolveDelete;
 const store={claimDeleteBatch:async()=>[{outboxId:1,storageKey:'fixture',attempts:3}],acknowledgeMediaDeletion:async()=>{acked++;},retryMediaDeletion:async v=>{assert.equal(v.attempts,3);retried++;}};
 const storage={delete:(key,{signal})=>new Promise(resolve=>{resolveDelete=resolve;signal.addEventListener('abort',()=>{aborted=true;});})};
 assert.equal((await processDeletionOutboxOnce({store,storage,timeoutMs:50}))[0].status,'retry_required');assert.equal(aborted,true);
 resolveDelete(true);await new Promise(resolve=>setImmediate(resolve));assert.equal(acked,0);assert.equal(retried,1);
});
