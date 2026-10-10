import { DomainError, ownerWorkspaceId } from './core.mjs';

// pg pool is injected. This is a separate managed DB adapter, never the
// non-transactional AppDeploy SDK database. Production binding remains disabled.
const capabilities=Object.freeze({
  serializableTransactions:true, rowLocks:true, uniqueMembership:true, durableAudit:true
});
function rowWorkspace(r) {
  if(!r)return null;
  return {id:r.id,ownerUserId:r.owner_user_id,state:r.state};
}
function rowMembership(r) {
  if(!r)return null;
  return {workspaceId:r.workspace_id,userId:r.user_id,ownerUserId:r.owner_user_id,
    role:r.role,state:r.state};
}
function rowInvite(r) {
  if(!r)return null;
  return {id:r.id,workspaceId:r.workspace_id,email:r.email,role:r.role,
    secretDigest:r.secret_digest,expiresAt:new Date(r.expires_at).getTime(),
    state:r.state,createdBy:r.created_by};
}
function rowRequest(r) {
  if(!r)return null;
  return {id:r.id,workspaceId:r.workspace_id,title:r.title,kind:r.kind,status:r.status,
    version:r.version,reviewedBy:r.reviewed_by,decidedBy:r.decided_by,
    updatedAt:new Date(r.updated_at).getTime()};
}
function sqlError(error) {
  if(error?.code==='23505')return new DomainError('Unique workspace or invitation constraint.',409);
  if(error?.code==='23503')return new DomainError('Unknown workspace reference.',404);
  if(error?.code==='23514')return new DomainError('Record failed database validation.',400);
  return error;
}
export function createPostgresStore({pool,maxRetries=2}) {
  if(!pool || typeof pool.connect!=='function')throw new DomainError('PostgreSQL connection is required.',503);
  const retryBound=Math.min(3,Math.max(0,maxRetries));
  async function transaction(fn) {
    for(let attempt=0;attempt<=retryBound;attempt++) {
      const client=await pool.connect();
      let started=false;
      try {
        await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
        started=true;
        const query=(sql,args=[])=>client.query(sql,args);
        const tx={
          lockWorkspace:async id=>rowWorkspace((await query('SELECT * FROM growth_starter.workspaces WHERE id=$1 FOR UPDATE',[id])).rows[0]),
          lockInvitation:async id=>rowInvite((await query('SELECT * FROM growth_starter.invitations WHERE id=$1 FOR UPDATE',[id])).rows[0]),
          lockMembership:async(ws,user)=>rowMembership((await query('SELECT * FROM growth_starter.memberships WHERE workspace_id=$1 AND user_id=$2 FOR UPDATE',[ws,user])).rows[0]),
          insertInvitation:async v=>query(`INSERT INTO growth_starter.invitations
            (id,workspace_id,email,role,secret_digest,expires_at,state,created_by)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
            [v.id,v.workspaceId,v.email,v.role,v.secretDigest,new Date(v.expiresAt),v.state,v.createdBy]),
          consumeInvitation:async(id,user,at)=>{
            const r=await query(`UPDATE growth_starter.invitations SET state='consumed', accepted_by=$2,
              accepted_at=$3 WHERE id=$1 AND state='pending' RETURNING id`,[id,user,new Date(at)]);
            if(r.rowCount!==1)throw new DomainError('Invitation already used.',409);
          },
          upsertMembership:async v=>{
            const w=await query('SELECT owner_user_id FROM growth_starter.workspaces WHERE id=$1',[v.workspaceId]);
            if(w.rows[0]?.owner_user_id!==v.ownerUserId)throw new DomainError('Owner mismatch.',403);
            await query(`INSERT INTO growth_starter.memberships
              (workspace_id,user_id,owner_user_id,role,state,created_by)
              VALUES($1,$2,$3,$4,$5,$6)
              ON CONFLICT(workspace_id,user_id) DO UPDATE SET
              role=EXCLUDED.role,state='active',owner_user_id=EXCLUDED.owner_user_id,
              created_by=EXCLUDED.created_by,revoked_at=NULL,updated_at=now()`,
              [v.workspaceId,v.userId,v.ownerUserId,v.role,v.state,v.createdBy]);
          },
          revokeMembership:async(ws,user,at)=>{
            const r=await query(`UPDATE growth_starter.memberships SET state='revoked',
              revoked_at=$3, updated_at=now() WHERE workspace_id=$1 AND user_id=$2
              AND state='active' RETURNING workspace_id`,[ws,user,new Date(at)]);
            if(r.rowCount!==1)throw new DomainError('Membership already revoked.',409);
          },
          audit:async v=>query(`INSERT INTO growth_starter.audit_events
            (workspace_id,actor_user_id,action,target,happened_at) VALUES($1,$2,$3,$4,$5)`,
            [v.workspaceId,v.actorId,v.action,v.target,new Date(v.at)]),
          lockRequest:async(ws,id)=>rowRequest((await query(`SELECT * FROM growth_starter.work_requests
            WHERE workspace_id=$1 AND id=$2 FOR UPDATE`,[ws,id])).rows[0]),
          updateRequest:async(ws,id,v)=>{
            const r=await query(`UPDATE growth_starter.work_requests SET status=$3,version=$4,
              reviewed_by=$5,decided_by=$6,updated_at=$7 WHERE workspace_id=$1 AND id=$2
              AND version=$8 RETURNING id`,
              [ws,id,v.status,v.version,v.reviewedBy||null,v.decidedBy||null,new Date(v.updatedAt),v.version-1]);
            if(r.rowCount!==1)throw new DomainError('Request version changed.',409);
          },
          claimDeletions:async limit=>{
            const found=await query(`WITH chosen AS (
              SELECT id FROM growth_starter.media_delete_outbox
              WHERE state='pending' OR (state='processing' AND leased_until<now())
              ORDER BY id FOR UPDATE SKIP LOCKED LIMIT $1
            ) UPDATE growth_starter.media_delete_outbox o SET state='processing',
              attempts=attempts+1,leased_until=now()+interval '5 minutes',last_error=NULL
              FROM chosen WHERE o.id=chosen.id
              RETURNING o.id,o.workspace_id,o.media_id,o.storage_key,o.attempts`,[limit]);
            return found.rows.map(x=>({outboxId:x.id,workspaceId:x.workspace_id,
              mediaId:x.media_id,storageKey:x.storage_key,attempts:x.attempts}));
          },
          confirmDeleted:async(id,key)=>{
            const row=await query(`SELECT * FROM growth_starter.media_delete_outbox
              WHERE id=$1 AND storage_key=$2 AND state='processing' FOR UPDATE`,[id,key]);
            if(!row.rows.length)throw new DomainError('Deletion job not leased.',409);
            const event=row.rows[0];
            await query(`UPDATE growth_starter.media SET lifecycle='deleted',consent_state='withdrawn'
              WHERE workspace_id=$1 AND id=$2 AND lifecycle='delete_pending'`,
              [event.workspace_id,event.media_id]);
            await query(`UPDATE growth_starter.media_delete_outbox
              SET state='done',leased_until=NULL,processed_at=now() WHERE id=$1`,[id]);
            return {done:true};
          },
          retryDeletion:async id=>{
            const row=await query(`UPDATE growth_starter.media_delete_outbox
              SET state='pending',leased_until=NULL,last_error='storage delete unavailable'
              WHERE id=$1 AND state='processing' RETURNING id`,[id]);
            if(!row.rowCount)throw new DomainError('Deletion job not leased.',409);
            return {retry:true};
          },
          lockMedia:async(ws,id)=>(await query(`SELECT * FROM growth_starter.media
            WHERE workspace_id=$1 AND id=$2 FOR UPDATE`,[ws,id])).rows[0]||null,
          tombstoneMedia:async(ws,id)=>{
            const r=await query(`UPDATE growth_starter.media SET lifecycle='delete_pending',
              consent_state='withdrawn' WHERE workspace_id=$1 AND id=$2
              AND lifecycle='stored' RETURNING storage_key`,[ws,id]);
            if(r.rowCount!==1)throw new DomainError('Media already deleted or missing.',409);
            return r.rows[0].storage_key;
          },
          queueMediaDelete:async(ws,id,storageKey)=>query(`INSERT INTO growth_starter.media_delete_outbox
            (workspace_id,media_id,storage_key) VALUES($1,$2,$3)
            ON CONFLICT(workspace_id,media_id) DO NOTHING`,[ws,id,storageKey])
        };
        const value=await fn(tx);
        await client.query('COMMIT');
        return value;
      } catch(err) {
        if(started)try{await client.query('ROLLBACK');}catch{}
        if((err?.code==='40001'||err?.code==='40P01') && attempt<retryBound)continue;
        throw sqlError(err);
      } finally {client.release();}
    }
    throw new DomainError('Transaction retry budget exhausted.',503);
  }
  const single=async(sql,args)=> (await pool.query(sql,args)).rows[0]||null;
  return Object.freeze({
    capabilities,transaction,
    readWorkspace:async id=>rowWorkspace(await single('SELECT * FROM growth_starter.workspaces WHERE id=$1',[id])),
    readMembership:async(ws,user)=>rowMembership(await single('SELECT * FROM growth_starter.memberships WHERE workspace_id=$1 AND user_id=$2',[ws,user])),
    listUserMemberships:async user=>(await pool.query(`SELECT * FROM growth_starter.memberships
      WHERE user_id=$1 AND state='active' ORDER BY workspace_id LIMIT 25`,[user])).rows.map(rowMembership),
    async claimDeleteBatch(limit=5) {
      if(!Number.isInteger(limit)||limit<1||limit>20)
        throw new DomainError('Invalid deletion batch size.',400);
      return transaction(async tx=>{
        // Claim/lease must be transactional to support idempotent retry.
        const result=await tx.claimDeletions(limit);
        return result;
      });
    },
    async acknowledgeMediaDeletion({outboxId,storageKey}) {
      return transaction(async tx=>tx.confirmDeleted(outboxId,storageKey));
    },
    async retryMediaDeletion({outboxId}) {
      return transaction(async tx=>tx.retryDeletion(outboxId));
    },
    async getReadyMedia({workspaceId,id}) {
      const record=await single(`SELECT storage_key,content_type FROM growth_starter.media
        WHERE workspace_id=$1 AND id=$2 AND lifecycle='stored'
        AND consent_state='approved' AND scan_state='clean'
        AND declared_rights=true`,[workspaceId,id]);
      return record||null;
    },
    async queueMediaDeletion({workspaceId,id,actorUserId}) {
      return transaction(async tx=>{
        const row=await tx.lockMedia(workspaceId,id);
        if(!row)throw new DomainError('Media not found.',404);
        const key=await tx.tombstoneMedia(workspaceId,id);
        await tx.queueMediaDelete(workspaceId,id,key);
        await tx.audit({workspaceId,actorId:actorUserId,action:'media.delete_queued',target:id,at:Date.now()});
        return {queued:true,mediaId:id};
      });
    }
  });
}
