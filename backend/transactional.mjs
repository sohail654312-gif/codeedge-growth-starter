import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { DomainError, ROLES, ownerWorkspaceId, authorize, reviewRequestTransition, clientRequestDecision, validRecordId } from './core.mjs';

// REVIEW-ONLY CONTRACT. An AppDeploy db.list/get/update sequence is NOT a transaction.
// This adapter must be backed by a separately verified ACID/serializable store.
// This module has no live binding, routes or publicly callable admin methods.
const requiredCapabilities = ['serializableTransactions','rowLocks','uniqueMembership','durableAudit'];
function requireTransactional(store) {
  if(!store || typeof store.transaction!=='function' ||
    requiredCapabilities.some(k=>store.capabilities?.[k]!==true))
    throw new DomainError('A verified transactional membership store is required.',503);
}
function uid(value) {
  if(typeof value!=='string'||! /^[A-Za-z0-9_-]{8,128}$/.test(value)) throw new DomainError('Invalid authenticated subject.',403);
  return value;
}
function identity(actor) {
  const userId=uid(actor?.userId);
  if(actor?.emailVerified!==true || typeof actor?.email!=='string')
    throw new DomainError('Verified email identity required.',403);
  const email=actor.email.trim().toLowerCase();
  if(email.length>254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    throw new DomainError('Invalid verified email.',403);
  return {userId,email};
}
function inviteeEmail(value) {
  if(typeof value!=='string'||value.length>254)throw new DomainError('Invalid invite email.');
  const email=value.trim().toLowerCase();
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))throw new DomainError('Invalid invite email.');
  return email;
}
function digest(pepper,secret) {
  return createHmac('sha256',pepper).update(secret).digest('hex');
}
function matchesDigest(provided,expected) {
  if(typeof expected!=='string'||! /^[0-9a-f]{64}$/.test(expected))return false;
  const a=Buffer.from(provided,'hex'),b=Buffer.from(expected,'hex');
  return a.length===b.length && timingSafeEqual(a,b);
}
function ensureWorkspace(value) {
  if(typeof value!=='string'||! /^ws_[A-Za-z0-9_-]{8,128}$/.test(value))throw new DomainError('Invalid workspace.');
  return value;
}
function requireOwner(workspace,actorId) {
  if(!workspace || workspace.id!==ownerWorkspaceId(workspace.ownerUserId) ||
    workspace.ownerUserId!==actorId || workspace.state!=='active')
    throw new DomainError('Workspace management denied.',403);
}
export function createTransactionalWorkspaceService({store,pepper,clock=()=>Date.now(),makeSecret=()=>randomBytes(32).toString('base64url'),makeId=()=>randomUUID()}) {
  requireTransactional(store);
  if(typeof pepper!=='string'||pepper.length<32) throw new DomainError('Missing secure invitation HMAC key.',503);
  const capabilities=Object.freeze({authoritativeRead:true,atomicInvitationConsume:true});
  async function issue({actor,workspaceId,email,role}) {
    const caller=identity(actor), id=ensureWorkspace(workspaceId),target=inviteeEmail(email);
    if(!['agency_admin','staff','client'].includes(role))throw new DomainError('Invited role is invalid.');
    if(target===caller.email)throw new DomainError('Use the owner workspace for your own account.');
    const secret=makeSecret();
    if(typeof secret!=='string'||secret.length<32||! /^[A-Za-z0-9_-]+$/.test(secret))throw new DomainError('Invalid entropy provider.',503);
    const inviteId=makeId(),token=inviteId+'.'+secret,secretDigest=digest(pepper,secret);
    const expiresAt=clock()+48*60*60*1000;
    await store.transaction(async tx=>{
      const workspace=await tx.lockWorkspace(id);
      requireOwner(workspace,caller.userId);
      await tx.insertInvitation({id:inviteId,workspaceId:id,email:target,role,
        secretDigest,expiresAt,state:'pending',createdBy:caller.userId});
      await tx.audit({workspaceId:id,actorId:caller.userId,action:'invitation.created',target:inviteId,at:clock()});
    });
    return {token,expiresAt,workspaceId:id,role}; // token must be delivered once over a verified channel; never logged
  }
  async function accept({actor,token}) {
    const caller=identity(actor);
    if(typeof token!=='string'||token.length>250)throw new DomainError('Invitation invalid.',403);
    const [inviteId,secret,...extra]=token.split('.');
    if(extra.length||! /^[0-9a-f-]{36}$/i.test(inviteId||'')||! /^[A-Za-z0-9_-]{32,}$/.test(secret||''))
      throw new DomainError('Invitation invalid.',403);
    return store.transaction(async tx=>{
      const invitation=await tx.lockInvitation(inviteId);
      if(!invitation||invitation.state!=='pending'||invitation.email!==caller.email||
        !Number.isFinite(invitation.expiresAt)||invitation.expiresAt<=clock()||
        !matchesDigest(digest(pepper,secret),invitation.secretDigest))
        throw new DomainError('Invitation invalid or expired.',403);
      const workspace=await tx.lockWorkspace(invitation.workspaceId);
      if(!workspace||workspace.state!=='active'||workspace.ownerUserId===caller.userId)
        throw new DomainError('Invitation invalid or expired.',403);
      if(!['agency_admin','staff','client'].includes(invitation.role))
        throw new DomainError('Invalid invitation role.',403);
      // Unique (workspace_id, user_id), plus transaction locking prevent parallel replay.
      const existing=await tx.lockMembership(invitation.workspaceId,caller.userId);
      if(existing?.state==='active')throw new DomainError('Active membership already exists.',409);
      await tx.upsertMembership({workspaceId:invitation.workspaceId,userId:caller.userId,
        ownerUserId:workspace.ownerUserId,role:invitation.role,state:'active',createdBy:invitation.createdBy});
      await tx.consumeInvitation(inviteId,caller.userId,clock());
      await tx.audit({workspaceId:invitation.workspaceId,actorId:caller.userId,action:'invitation.accepted',target:inviteId,at:clock()});
      return {workspaceId:invitation.workspaceId,role:invitation.role};
    });
  }
  async function revoke({actor,workspaceId,userId}) {
    const caller=identity(actor),id=ensureWorkspace(workspaceId),subject=uid(userId);
    return store.transaction(async tx=>{
      const workspace=await tx.lockWorkspace(id);
      requireOwner(workspace,caller.userId);
      if(subject===caller.userId)throw new DomainError('Cannot revoke owner.',403);
      const existing=await tx.lockMembership(id,subject);
      if(!existing||existing.state!=='active')throw new DomainError('Membership not found.',404);
      await tx.revokeMembership(id,subject,clock());
      await tx.audit({workspaceId:id,actorId:caller.userId,action:'membership.revoked',target:subject,at:clock()});
      return {revoked:true};
    });
  }
  async function authorizeMember({userId,workspaceId}) {
    const subject=uid(userId),id=ensureWorkspace(workspaceId);
    const [record,workspace]=await Promise.all([store.readMembership(id,subject),store.readWorkspace(id)]);
    if(!workspace||workspace.state!=='active'||workspace.id!==id||
      workspace.ownerUserId===subject||id!==ownerWorkspaceId(workspace.ownerUserId)||
      !record||record.state!=='active'||record.userId!==subject||
      record.workspaceId!==id||record.ownerUserId!==workspace.ownerUserId||
      !ROLES.includes(record.role)||record.role==='owner')
      throw new DomainError('Workspace access denied.',403);
    return {userId:subject,workspaceId:id,ownerUserId:workspace.ownerUserId,role:record.role,state:'active'};
  }
  async function list({userId}) {
    const subject=uid(userId);
    const records=await store.listUserMemberships(subject);
    if(!Array.isArray(records))throw new DomainError('Membership list unavailable.',503);
    const verified=[];
    for(const record of records.slice(0,25)) {
      try { verified.push(await authorizeMember({userId:subject,workspaceId:record.workspaceId})); }
      catch(e) {if(!(e instanceof DomainError))throw e;}
    }
    return verified;
  }
  return Object.freeze({capabilities,issue,accept,revoke,authorize:authorizeMember,list});
}
export function createTransactionalWorkflowService({store,clock=()=>Date.now()}) {
  requireTransactional(store);
  return Object.freeze({
    capabilities:Object.freeze({atomicTransitions:true}),
    async review({workspace,actor,id,requested,expectedVersion}) {
      validRecordId(id);uid(actor);
      return store.transaction(async tx=>{
        const request=await tx.lockRequest(workspace.workspaceId,id);
        if(!request)throw new DomainError('Request not found.',404);
        if(!Number.isSafeInteger(expectedVersion)||request.version!==expectedVersion)
          throw new DomainError('Request version changed; refresh before saving.',409);
        const status=reviewRequestTransition(request.status,requested,workspace.role);
        const updated={...request,status,version:request.version+1,reviewedBy:actor,updatedAt:clock()};
        await tx.updateRequest(workspace.workspaceId,id,updated);
        await tx.audit({workspaceId:workspace.workspaceId,actorId:actor,action:'request.review',target:id,at:clock()});
        return updated;
      });
    },
    async decision({workspace,actor,id,decision,expectedVersion}) {
      validRecordId(id);uid(actor);
      return store.transaction(async tx=>{
        const request=await tx.lockRequest(workspace.workspaceId,id);
        if(!request)throw new DomainError('Request not found.',404);
        if(!Number.isSafeInteger(expectedVersion)||request.version!==expectedVersion)
          throw new DomainError('Request version changed; refresh before saving.',409);
        const status=clientRequestDecision(request.status,decision,workspace.role);
        const updated={...request,status,version:request.version+1,decidedBy:actor,updatedAt:clock()};
        await tx.updateRequest(workspace.workspaceId,id,updated);
        await tx.audit({workspaceId:workspace.workspaceId,actorId:actor,action:'request.decision',target:id,at:clock()});
        return updated;
      });
    }
  });
}
