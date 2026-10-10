import test from 'node:test';
import assert from 'node:assert/strict';
import {createTransactionalWorkspaceService,createTransactionalWorkflowService} from '../backend/transactional.mjs';
import {DomainError,ownerWorkspaceId} from '../backend/core.mjs';

const owner={userId:'owner123456',email:'owner@example.test',emailVerified:true};
const client={userId:'client123456',email:'client@example.test',emailVerified:true};
const staff={userId:'staff123456',email:'staff@example.test',emailVerified:true};
const workspaceId=ownerWorkspaceId(owner.userId);
const pepper='local-test-pepper-only-not-for-real-use-123456789';
function makeStore() {
  let state={
    workspaces:{[workspaceId]:{id:workspaceId,ownerUserId:owner.userId,state:'active'}},
    invitations:{},memberships:{},requests:{},audit:[]
  };
  let pending=Promise.resolve();
  function memkey(workspace,user){return workspace+'|'+user;}
  function reqkey(workspace,id){return workspace+'|'+id;}
  const caps={serializableTransactions:true,rowLocks:true,uniqueMembership:true,durableAudit:true};
  const store={
    capabilities:caps,
    async transaction(fn){
      let done;
      const next=new Promise(resolve=>{done=resolve;});
      const previous=pending;
      pending=next;
      await previous;
      const save=structuredClone(state);
      const tx={
        lockWorkspace:async id=>state.workspaces[id]&&structuredClone(state.workspaces[id]),
        lockInvitation:async id=>state.invitations[id]&&structuredClone(state.invitations[id]),
        insertInvitation:async r=>{if(state.invitations[r.id])throw Error('unique invite');state.invitations[r.id]=structuredClone(r);},
        consumeInvitation:async(id,user,at)=>{if(state.invitations[id].state!=='pending')throw Error('replay');Object.assign(state.invitations[id],{state:'consumed',acceptedBy:user,acceptedAt:at});},
        lockMembership:async(ws,user)=>state.memberships[memkey(ws,user)]&&structuredClone(state.memberships[memkey(ws,user)]),
        upsertMembership:async r=>{state.memberships[memkey(r.workspaceId,r.userId)]=structuredClone(r);},
        revokeMembership:async(ws,user,at)=>{const r=state.memberships[memkey(ws,user)];if(!r)throw Error('missing membership');Object.assign(r,{state:'revoked',revokedAt:at});},
        lockRequest:async(ws,id)=>state.requests[reqkey(ws,id)]&&structuredClone(state.requests[reqkey(ws,id)]),
        updateRequest:async(ws,id,value)=>{if(!state.requests[reqkey(ws,id)])throw Error('missing request');state.requests[reqkey(ws,id)]=structuredClone(value);},
        audit:async item=>{state.audit.push(structuredClone(item));}
      };
      try{return await fn(tx);}
      catch(e){state=save;throw e;}
      finally{done();}
    },
    async readMembership(ws,user){const r=state.memberships[memkey(ws,user)];return r?structuredClone(r):null;},
    async readWorkspace(ws){return state.workspaces[ws]?structuredClone(state.workspaces[ws]):null;},
    async listUserMemberships(user){return Object.values(state.memberships).filter(r=>r.userId===user).map(r=>structuredClone(r));},
    seedRequest(id,record){state.requests[reqkey(workspaceId,id)]=structuredClone(record);},
    auditCount(){return state.audit.length;},
    getInvitation(id){return state.invitations[id]&&structuredClone(state.invitations[id]);},
    getRequest(id){return structuredClone(state.requests[reqkey(workspaceId,id)]);},
    getMembership(user){return structuredClone(state.memberships[memkey(workspaceId,user)]);}
  };
  return store;
}
function createFixture(now=Date.now()) {
  const store=makeStore();
  let number=0;
  const members=createTransactionalWorkspaceService({
    store,pepper,clock:()=>now,
    makeSecret:()=>String(++number).padStart(40,'A'),
    makeId:()=>('00000000-0000-4000-8000-'+String(number).padStart(12,'0'))
  });
  return {store,members,workflow:createTransactionalWorkflowService({store,clock:()=>now})};
}
test('unverified or client-claimed identity cannot issue invitations',async()=>{
  const x=createFixture();
  await assert.rejects(x.members.issue({actor:{...owner,emailVerified:false},workspaceId,email:client.email,role:'client'}),e=>e.status===403);
  await assert.rejects(x.members.issue({actor:client,workspaceId,email:staff.email,role:'staff'}),e=>e.status===403);
  await assert.rejects(x.members.issue({actor:owner,workspaceId,email:client.email,role:'owner'}),e=>e.status===400);
  assert.equal(x.store.auditCount(),0);
});
test('one-time email-bound invitation accepted by only one concurrent request',async()=>{
  const x=createFixture();
  const invitation=await x.members.issue({actor:owner,workspaceId,email:client.email.toUpperCase(),role:'client'});
  const [a,b]=await Promise.allSettled([
    x.members.accept({actor:client,token:invitation.token}),
    x.members.accept({actor:client,token:invitation.token})
  ]);
  assert.equal([a,b].filter(r=>r.status==='fulfilled').length,1);
  assert.equal([a,b].filter(r=>r.status==='rejected').length,1);
  assert.equal(x.store.auditCount(),2);
  assert.equal(x.store.getInvitation(invitation.token.split('.')[0]).state,'consumed');
  assert.equal(x.store.getMembership(client.userId).role,'client');
  assert.equal((await x.members.authorize({userId:client.userId,workspaceId})).role,'client');
});
test('email mismatch and token substitution never burn invitation',async()=>{
  const x=createFixture();
  const issued=await x.members.issue({actor:owner,workspaceId,email:client.email,role:'client'});
  await assert.rejects(x.members.accept({actor:staff,token:issued.token}),e=>e.status===403);
  const tampered=issued.token.replace(/.$/,'Z');
  await assert.rejects(x.members.accept({actor:client,token:tampered}),e=>e.status===403);
  assert.equal(x.store.getInvitation(issued.token.split('.')[0]).state,'pending');
  const accepted=await x.members.accept({actor:client,token:issued.token});
  assert.equal(accepted.role,'client');
});
test('expired tokens fail and leave no membership',async()=>{
  const now=Date.now(),x=createFixture(now);
  const issued=await x.members.issue({actor:owner,workspaceId,email:client.email,role:'client'});
  const expired=createTransactionalWorkspaceService({
    store:x.store,pepper,clock:()=>now+49*60*60*1000,
    makeSecret:()=> 'A'.repeat(40),makeId:()=> '00000000-0000-4000-8000-000000000222'
  });
  await assert.rejects(expired.accept({actor:client,token:issued.token}),e=>e.status===403);
  assert.equal(x.store.getMembership(client.userId),undefined);
});
test('revocation is immediate and cannot be self-issued by invited client',async()=>{
  const x=createFixture();
  const invitation=await x.members.issue({actor:owner,workspaceId,email:client.email,role:'staff'});
  await x.members.accept({actor:client,token:invitation.token});
  await assert.rejects(x.members.revoke({actor:client,workspaceId,userId:client.userId}),e=>e.status===403);
  assert.equal((await x.members.list({userId:client.userId})).length,1);
  await x.members.revoke({actor:owner,workspaceId,userId:client.userId});
  await assert.rejects(x.members.authorize({userId:client.userId,workspaceId}),e=>e.status===403);
  assert.deepEqual(await x.members.list({userId:client.userId}),[]);
});
test('transactional store capabilities required, cannot use AppDeploy list/update as a substitute',()=>{
  assert.throws(()=>createTransactionalWorkspaceService({store:{transaction:async()=>{}},pepper}),e=>e.status===503);
  assert.throws(()=>createTransactionalWorkflowService({store:{capabilities:{}}}),e=>e.status===503);
});
test('atomic request state revisions reject stale and conflicting approvals',async()=>{
  const x=createFixture();
  const record={id:'request1',status:'Requested',version:0,title:'Synthetic clinic campaign'};
  x.store.seedRequest(record.id,record);
  const own={workspaceId,role:'owner'};
  const [a,b]=await Promise.allSettled([
    x.workflow.review({workspace:own,actor:owner.userId,id:record.id,requested:'In progress',expectedVersion:0}),
    x.workflow.review({workspace:own,actor:owner.userId,id:record.id,requested:'In progress',expectedVersion:0})
  ]);
  assert.equal([a,b].filter(r=>r.status==='fulfilled').length,1);
  assert.equal(x.store.getRequest(record.id).version,1);
  const requested=await x.workflow.review({workspace:own,actor:owner.userId,id:record.id,requested:'Awaiting approval',expectedVersion:1});
  assert.equal(requested.version,2);
  await assert.rejects(x.workflow.decision({workspace:{workspaceId,role:'staff'},actor:staff.userId,id:record.id,decision:'Approved',expectedVersion:2}),e=>e.status===403);
  const approved=await x.workflow.decision({workspace:{workspaceId,role:'client'},actor:client.userId,id:record.id,decision:'Approved',expectedVersion:2});
  assert.equal(approved.status,'Approved');
  assert.equal(approved.version,3);
  await assert.rejects(x.workflow.decision({workspace:{workspaceId,role:'client'},actor:client.userId,id:record.id,decision:'Changes requested',expectedVersion:2}),e=>e.status===409);
  assert.equal(x.store.getRequest(record.id).status,'Approved');
  assert.equal(x.store.auditCount(),3);
});
test('failed transaction rolls back request state and audit',async()=>{
  const x=createFixture();
  x.store.seedRequest('request2',{id:'request2',status:'Requested',version:0});
  const before=x.store.auditCount();
  await assert.rejects(x.workflow.review({
    workspace:{workspaceId,role:'owner'},actor:owner.userId,id:'request2',requested:'Published',expectedVersion:0
  }),e=>e.status===409);
  assert.equal(x.store.getRequest('request2').version,0);
  assert.equal(x.store.auditCount(),before);
});
