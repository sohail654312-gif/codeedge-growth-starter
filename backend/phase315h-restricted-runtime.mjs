/**
 * Phase 3.15H: offline PostgreSQL privilege-separation experiment ONLY.
 * Tenant readers cannot UPDATE or SET ROLE. A writer revokes Codeedge sessions.
 * Both paths acquire cooperative transaction-scoped advisory locks.
 * NO production or Supabase hosted entrypoint is enabled.
 */
import {createHash,timingSafeEqual} from 'node:crypto';
const TOKEN=/^ce1\.([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/i;
const WORKSPACE=/^ws_[A-Za-z0-9_-]{8,128}$/;
const DENIED='Restricted Codeedge session denied.';
const DOWN='Restricted session datastore unavailable.';
function deny(){throw Error(DENIED);}
function down(){throw Error(DOWN);}
function parse(token){
 const m=typeof token==='string'&&token.length<=128?TOKEN.exec(token):null;
 if(!m)deny();
 return {id:m[1].toLowerCase(),secret:m[2]};
}
function lockKey(id){
 return createHash('sha256').update('growth-starter:session-lock:v1\0'+id)
  .digest().readBigInt64BE(0).toString();
}
function digest(id,secret){
 return createHash('sha256').update('codeedge-growth-starter:session:v1\0')
  .update(id).update('\0').update(secret).digest();
}
function verified(record,id,secret){
 return record?.id===id&&typeof record.secret_sha256==='string'&&
  /^[0-9a-f]{64}$/.test(record.secret_sha256)&&
  timingSafeEqual(digest(id,secret),Buffer.from(record.secret_sha256,'hex'));
}
export function createHostedRestrictedRuntime(){
 throw Error('Restricted hosted runtime disabled pending independent approval.');
}
export function createDisposableRestrictedRuntime({
 tenantPools,revocationPool,fictionalTestOnly=false,now=()=>Date.now()
}={}){
 if(fictionalTestOnly!==true||!process.env.TEST_DATABASE_URL||
    !(tenantPools instanceof Map)||tenantPools.size===0||
    !revocationPool||typeof revocationPool.connect!=='function'||
    typeof now!=='function')throw Error('Disposable-only restricted runtime required.');
 const pools=new Map(tenantPools);
 for(const [name,pool] of pools){
  if(!WORKSPACE.test(name)||!pool||typeof pool.connect!=='function')
   throw Error('Invalid disposable tenant pool.');
 }
 async function acquire(pool){
  try{return await pool.connect();}catch{down();}
 }
 async function read({token,workspaceId,holdForTest}={}){
  if(!WORKSPACE.test(workspaceId||''))deny();
  const {id,secret}=parse(token),pool=pools.get(workspaceId);
  if(!pool)deny();
  const client=await acquire(pool);
  let open=false;
  try{
   await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');open=true;
   await client.query("SET LOCAL lock_timeout = '2000ms'");
   await client.query("SET LOCAL statement_timeout = '4000ms'");
   await client.query('SELECT pg_advisory_xact_lock_shared($1::bigint)',[lockKey(id)]);
   const session=(await client.query(
    'SELECT id::text,owner,secret_sha256,expires_at,revoked_at '+
    'FROM gs315h.sessions WHERE id=$1::uuid',[id])).rows?.[0];
   if(!verified(session,id,secret)||session.owner!==workspaceId.slice(3)||
      session.revoked_at!==null||
      !(new Date(session.expires_at).getTime()>now()))deny();
   if(holdForTest!==undefined){
    if(typeof holdForTest!=='function')deny();
    await holdForTest();
   }
   const rows=(await client.query(
    'SELECT id,workspace,title FROM gs315h.requests '+
    'WHERE workspace=$1 ORDER BY id',[workspaceId])).rows;
   await client.query('COMMIT');open=false;
   return rows;
  }catch(e){
   if(open)try{await client.query('ROLLBACK');}catch{}
   if(e?.message===DENIED)throw e;
   down();
  }finally{client.release();}
 }
 async function revoke({token}={}){
  const {id,secret}=parse(token);
  const client=await acquire(revocationPool);
  let open=false;
  try{
   await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');open=true;
   await client.query("SET LOCAL lock_timeout = '2000ms'");
   await client.query("SET LOCAL statement_timeout = '4000ms'");
   await client.query('SELECT pg_advisory_xact_lock($1::bigint)',[lockKey(id)]);
   const row=(await client.query(
    'SELECT id::text,secret_sha256,revoked_at FROM gs315h.sessions '+
    'WHERE id=$1::uuid FOR UPDATE',[id])).rows?.[0];
   if(!verified(row,id,secret))deny();
   if(row.revoked_at===null){
    const updated=await client.query(
     'UPDATE gs315h.sessions SET revoked_at=clock_timestamp() '+
     'WHERE id=$1::uuid AND revoked_at IS NULL',[id]);
    if(updated.rowCount!==1)down();
   }
   await client.query('COMMIT');open=false;
   return Object.freeze({revoked:true});
  }catch(e){
   if(open)try{await client.query('ROLLBACK');}catch{}
   if(e?.message===DENIED)throw e;
   down();
  }finally{client.release();}
 }
 return Object.freeze({read,revoke,status:'disposable_only_real_login_roles'});
}
