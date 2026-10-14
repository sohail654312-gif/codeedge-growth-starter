/**
 * Phase 3.15C: DISPOSABLE-ONLY Codeedge session proof. No hosted entrypoint.
 * All protected reads are guarded inside a transaction holding FOR SHARE
 * locks on session and tenant authorization rows. Revocation uses FOR UPDATE.
 * Supabase getUser() is NOT a fresh-login grant after logout.
 */
import {randomBytes,randomUUID,createHash,timingSafeEqual} from 'node:crypto';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN=/^ce1\.([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/i;
const WORKSPACE=/^ws_[A-Za-z0-9_-]{8,128}$/;
const GRANT=/^[A-Za-z0-9_-]{24,96}$/;
const DENIED='Codeedge session denied.';
const UNAVAILABLE='Codeedge session store unavailable.';
const SESSION_TABLE='growth_starter_private.codeedge_sessions';
function deny(){throw Error(DENIED);}
function unavailable(){throw Error(UNAVAILABLE);}
function parseToken(token){
 if(typeof token!=='string'||token.length>128)deny();
 const match=TOKEN.exec(token);
 if(!match)deny();
 return {id:match[1],secret:match[2]};
}
function digest(id,secret){
 return createHash('sha256').update('codeedge-growth-starter:session:v1\0')
   .update(id).update('\0').update(secret).digest();
}
function matches(row,id,secret){
 if(!row||row.id!==id||typeof row.secret_sha256!=='string'||
    !/^[0-9a-f]{64}$/.test(row.secret_sha256))return false;
 return timingSafeEqual(digest(id,secret),Buffer.from(row.secret_sha256,'hex'));
}
export function createHostedCodeedgeSessionAuthority(){
 throw Error('Hosted Codeedge fallback unavailable until trusted fresh login and hosted acceptance.');
}
export function createDisposableCodeedgeSessionProof({
 pool,verifyFreshLogin,fictionalTestOnly=false,now=()=>Date.now(),ttlSeconds=900
}={}){
 if(fictionalTestOnly!==true||!process.env.TEST_DATABASE_URL||
    !pool||typeof pool.connect!=='function'||typeof verifyFreshLogin!=='function'||
    typeof now!=='function'||!Number.isInteger(ttlSeconds)||
    ttlSeconds<300||ttlSeconds>1800)
   throw Error('Disposable-only session proof configuration required.');
 async function connect(){
  try{return await pool.connect();}catch{unavailable();}
 }
 async function issue({freshLoginProof}={}){
  if(typeof freshLoginProof!=='string'||freshLoginProof.length<24||
     freshLoginProof.length>256)deny();
  let verified;
  try{verified=await verifyFreshLogin(freshLoginProof);}catch{unavailable();}
  const current=now();
  if(!verified||verified.freshAuthentication!==true||
     !UUID.test(verified.userId||'')||!UUID.test(verified.providerSessionId||'')||
     !GRANT.test(verified.oneTimeGrantId||'')||
     !Number.isSafeInteger(verified.authenticatedAt)||
     verified.authenticatedAt>current+1000||
     current-verified.authenticatedAt>120000)deny();
  const id=randomUUID(),secret=randomBytes(32).toString('base64url');
  const expiration=new Date(current+ttlSeconds*1000);
  const c=await connect();
  let open=false;
  try{
   await c.query('BEGIN');open=true;
   await c.query('INSERT INTO '+SESSION_TABLE+
     ' (id,secret_sha256,user_id,provider_session_id,one_time_grant_id,expires_at) VALUES($1,$2,$3,$4,$5,$6)',
     [id,digest(id,secret).toString('hex'),verified.userId,
      verified.providerSessionId,verified.oneTimeGrantId,expiration]);
   await c.query('COMMIT');open=false;
   return Object.freeze({token:'ce1.'+id+'.'+secret,expiresAt:expiration.toISOString()});
  }catch{
   if(open)try{await c.query('ROLLBACK');}catch{}
   unavailable();
  }finally{c.release();}
 }
 async function withAuthorizedRead({token,workspaceId}={},operation){
  const {id,secret}=parseToken(token);
  if(!WORKSPACE.test(workspaceId||'')||typeof operation!=='function')deny();
  const c=await connect();
  let began=false,active=false;
  try{
   await c.query('BEGIN ISOLATION LEVEL READ COMMITTED');began=true;
   await c.query("SET LOCAL statement_timeout = '4000ms'");
   await c.query("SET LOCAL lock_timeout = '2000ms'");
   const session=(await c.query('SELECT id::text,user_id::text,secret_sha256,expires_at,revoked_at FROM '+
     SESSION_TABLE+' WHERE id=$1::uuid FOR SHARE',[id])).rows?.[0];
   if(!matches(session,id,secret)||session.revoked_at!==null||
      !(new Date(session.expires_at).getTime()>now()))deny();
   const workspace=(await c.query('SELECT owner_user_id,state FROM growth_starter.workspaces WHERE id=$1 FOR SHARE',
     [workspaceId])).rows?.[0];
   if(!workspace||workspace.state!=='active')deny();
   if(workspace.owner_user_id!==session.user_id){
    const member=(await c.query('SELECT owner_user_id,state,role FROM growth_starter.memberships WHERE workspace_id=$1 AND user_id=$2 FOR SHARE',
      [workspaceId,session.user_id])).rows?.[0];
    if(!member||member.state!=='active'||
       member.owner_user_id!==workspace.owner_user_id||
       !['agency_admin','staff','client'].includes(member.role))deny();
   }
   active=true;
   const read=Object.freeze({
    async listRequests(limit=20){
     if(!active||!Number.isInteger(limit)||limit<1||limit>50)deny();
     const r=await c.query('SELECT id,workspace_id,title,kind,status,version,updated_at FROM growth_starter.work_requests WHERE workspace_id=$1 ORDER BY updated_at DESC,id LIMIT $2',
       [workspaceId,limit]);
     return r.rows;
    }
   });
   const result=await operation(read);
   active=false;
   await c.query('COMMIT');began=false;
   return result;
  }catch(e){
   active=false;
   if(began)try{await c.query('ROLLBACK');}catch{}
   if(e?.message===DENIED)throw e;
   unavailable();
  }finally{active=false;c.release();}
 }
 async function revoke({token}={}){
  const {id,secret}=parseToken(token);
  const c=await connect();
  let began=false;
  try{
   await c.query('BEGIN ISOLATION LEVEL READ COMMITTED');began=true;
   await c.query("SET LOCAL lock_timeout = '2000ms'");
   const record=(await c.query('SELECT id::text,secret_sha256,revoked_at FROM '+
     SESSION_TABLE+' WHERE id=$1::uuid FOR UPDATE',[id])).rows?.[0];
   if(!matches(record,id,secret))deny();
   if(record.revoked_at===null)
    await c.query('UPDATE '+SESSION_TABLE+
      ' SET revoked_at=clock_timestamp() WHERE id=$1::uuid AND revoked_at IS NULL',[id]);
   await c.query('COMMIT');began=false;
   return Object.freeze({revoked:true});
  }catch(e){
   if(began)try{await c.query('ROLLBACK');}catch{}
   if(e?.message===DENIED)throw e;
   unavailable();
  }finally{c.release();}
 }
 return Object.freeze({issue,withAuthorizedRead,revoke,
  status:'disposable_only_not_for_hosting'});
}
