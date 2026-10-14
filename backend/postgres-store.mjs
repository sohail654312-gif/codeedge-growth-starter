import { DomainError, ownerWorkspaceId } from './core.mjs';
import { authorizeTransactionalActor } from './transactional.mjs';

// pg pool is injected. This is a separate managed DB adapter, never the
// non-transactional AppDeploy SDK database. Production binding remains disabled.
const capabilities=Object.freeze({
  serializableTransactions:true, rowLocks:true, uniqueMembership:true, durableAudit:true,
  atomicMediaAuthorization:true, workspaceOperations:true
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
    notes:r.notes||'',assignedTo:r.assigned_to||null,dueDate:r.due_date||null,
    ...(r.cursor_at?{cursorAt:r.cursor_at}:{}),
    updatedAt:new Date(r.updated_at).getTime()};
}
function sqlError(error) {
  if(error?.code==='23505')return new DomainError('Unique workspace or invitation constraint.',409);
  if(error?.code==='23503')return new DomainError('Unknown workspace reference.',404);
  if(error?.code==='23514')return new DomainError('Record failed database validation.',400);
  if(['57014','55P03','40001','40P01'].includes(error?.code))return new DomainError('Transaction unavailable; retry with the same idempotency key.',503);
  return error;
}
export function createPostgresStore({pool,maxRetries=2}) {
  if(!pool || typeof pool.connect!=='function')throw new DomainError('PostgreSQL connection is required.',503);
  if(!Number.isInteger(maxRetries)||maxRetries<0||maxRetries>3)throw new DomainError('Invalid transaction retry budget.');
  const retryBound=Math.min(3,Math.max(0,maxRetries));
  async function transaction(fn) {
    for(let attempt=0;attempt<=retryBound;attempt++) {
      const client=await pool.connect();
      let started=false;
      try {
        await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
        started=true;
        await client.query("SET LOCAL statement_timeout='5s'");
        await client.query("SET LOCAL lock_timeout='2s'");
        await client.query("SET LOCAL idle_in_transaction_session_timeout='10s'");
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
          confirmDeleted:async(id,key,attempts)=>{
            const row=await query(`SELECT * FROM growth_starter.media_delete_outbox
              WHERE id=$1 AND storage_key=$2 AND state='processing' AND attempts=$3 FOR UPDATE`,[id,key,attempts]);
            if(!row.rows.length)throw new DomainError('Deletion job not leased.',409);
            const event=row.rows[0];
            await query(`UPDATE growth_starter.media SET lifecycle='deleted',consent_state='withdrawn'
              WHERE workspace_id=$1 AND id=$2 AND lifecycle='delete_pending'`,
              [event.workspace_id,event.media_id]);
            await query(`UPDATE growth_starter.media_delete_outbox
              SET state='done',leased_until=NULL,processed_at=now() WHERE id=$1`,[id]);
            return {done:true};
          },
          retryDeletion:async(id,attempts)=>{
            const row=await query(`UPDATE growth_starter.media_delete_outbox
              SET state='pending',leased_until=NULL,last_error='storage delete unavailable'
              WHERE id=$1 AND state='processing' AND attempts=$2 RETURNING id`,[id,attempts]);
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
            ON CONFLICT(workspace_id,media_id) DO NOTHING`,[ws,id,storageKey]),
          readReceipt:async(ws,actor,key)=>(await query(`SELECT payload_digest,result FROM growth_starter.operation_receipts
            WHERE workspace_id=$1 AND actor_user_id=$2 AND idempotency_key=$3`,[ws,actor,key])).rows[0]||null,
          saveReceipt:async(ws,actor,key,digest,result)=>query(`INSERT INTO growth_starter.operation_receipts
            (workspace_id,actor_user_id,idempotency_key,payload_digest,result) VALUES($1,$2,$3,$4,$5)`,[ws,actor,key,digest,result]),
          lockProfile:async ws=>(await query('SELECT fields,version FROM growth_starter.business_profiles WHERE workspace_id=$1 FOR UPDATE',[ws])).rows[0]||null,
          saveProfile:async(ws,fields,version)=>query(`INSERT INTO growth_starter.business_profiles(workspace_id,fields,version)
            VALUES($1,$2,$3) ON CONFLICT(workspace_id) DO UPDATE SET fields=EXCLUDED.fields,version=EXCLUDED.version,updated_at=now()`,[ws,fields,version]),
          createRequest:async(ws,v)=>query(`INSERT INTO growth_starter.work_requests(workspace_id,id,title,kind,notes,created_by)
            VALUES($1,$2,$3,$4,$5,$6)`,[ws,v.id,v.title,v.kind,v.notes,v.createdBy]),
          assignRequest:async(ws,id,v)=>query(`UPDATE growth_starter.work_requests SET assigned_to=$3,due_date=$4,
            version=version+1,updated_at=$5 WHERE workspace_id=$1 AND id=$2`,[ws,id,v.assignedTo,v.dueDate,new Date(v.updatedAt)]),
          appendNote:async(ws,id,actor,note)=>query(`INSERT INTO growth_starter.request_notes(workspace_id,request_id,actor_user_id,note)
            VALUES($1,$2,$3,$4)`,[ws,id,actor,note]),
          listRequests:async(ws,{status,kind,assignedTo,after,limit})=>(await query(`SELECT *,to_char(updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_at FROM growth_starter.work_requests
            WHERE workspace_id=$1 AND ($2::text IS NULL OR status=$2) AND ($3::text IS NULL OR kind=$3)
            AND ($4::text IS NULL OR assigned_to=$4) AND ($5::timestamptz IS NULL OR (updated_at,id)<($5::timestamptz,$6::text))
            ORDER BY updated_at DESC,id DESC LIMIT $7`,[ws,status,kind,assignedTo,after?.at||null,after?.id||null,limit])).rows.map(rowRequest),
          requestNotes:async(ws,id)=>(await query(`SELECT id::text,actor_user_id AS "actorId",note,created_at AS "createdAt"
            FROM growth_starter.request_notes WHERE workspace_id=$1 AND request_id=$2 ORDER BY id DESC LIMIT 50`,[ws,id])).rows,
          listAudit:async(ws,before,limit)=>(await query(`SELECT id::text,actor_user_id AS "actorId",action,target,happened_at AS "at"
            FROM growth_starter.audit_events WHERE workspace_id=$1 AND ($2::bigint IS NULL OR id<$2::bigint)
            ORDER BY id DESC LIMIT $3`,[ws,before,limit])).rows
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
    async acknowledgeMediaDeletion({outboxId,storageKey,attempts}) {
      if(!Number.isSafeInteger(attempts)||attempts<1)throw new DomainError('Deletion lease generation required.',409);
      return transaction(async tx=>tx.confirmDeleted(outboxId,storageKey,attempts));
    },
    async retryMediaDeletion({outboxId,attempts}) {
      if(!Number.isSafeInteger(attempts)||attempts<1)throw new DomainError('Deletion lease generation required.',409);
      return transaction(async tx=>tx.retryDeletion(outboxId,attempts));
    },
    async getReadyMedia({workspaceId,id}) {
      const record=await single(`SELECT storage_key,content_type FROM growth_starter.media
        WHERE workspace_id=$1 AND id=$2 AND lifecycle='stored'
        AND consent_state='approved' AND scan_state='clean'
        AND declared_rights=true`,[workspaceId,id]);
      return record||null;
    },
    async authorizedReadyMedia({workspaceId,id,actorUserId}) {
      return transaction(async tx=>{
        await authorizeTransactionalActor(tx,workspaceId,actorUserId,'overview:read');
        const r=await tx.lockMedia(workspaceId,id);
        return r?.lifecycle==='stored'&&r.consent_state==='approved'&&r.scan_state==='clean'&&r.declared_rights===true
          ?{storage_key:r.storage_key,content_type:r.content_type}:null;
      });
    },
    async queueMediaDeletion({workspaceId,id,actorUserId}) {
      return transaction(async tx=>{
        await authorizeTransactionalActor(tx,workspaceId,actorUserId,'asset:delete');
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
