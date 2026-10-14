/**
 * Phase 3.15D — TEST-ONLY, server-held PKCE handoff to Codeedge sessions.
 * No production constructor, hosted credentials, network client or endpoints.
 * The injected exchange and user verification functions are synthetic in CI.
 * In real hosting exchangeAuthCode MUST be a trusted Supabase PKCE exchange
 * and verifyUser MUST independently validate the returned original token.
 * An old, still-valid bearer NEVER qualifies as a login authorization code.
 */
import {randomBytes,createHash} from 'node:crypto';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPAQUE=/^[A-Za-z0-9_-]{43}$/;
const CODE=/^[A-Za-z0-9_.~-]{16,512}$/;
const INVALID='Fresh login proof denied.';
const DOWN='Fresh login provider unavailable.';
function deny(){throw Error(INVALID);}
function down(){throw Error(DOWN);}
function random(){return randomBytes(32).toString('base64url');}
function hash(prefix,s){return createHash('sha256').update(prefix+'\0').update(s).digest('hex');}
function payload(token){
 if(typeof token!=='string'||token.length>12000)deny();
 const pieces=token.split('.');
 if(pieces.length!==3||!pieces.every(x=>x&&/^[A-Za-z0-9_-]+$/.test(x)))deny();
 try{
  const claim=JSON.parse(Buffer.from(pieces[1],'base64url').toString('utf8'));
  if(!claim||typeof claim!=='object'||Array.isArray(claim))deny();
  return claim;
 }catch{deny();}
}
// Shared by the disposable proof and the restricted private runtime. Decoding
// alone is never verification: callers must first obtain user from /auth/v1/user.
export function validateFreshProviderIdentity({accessToken,user,projectUrl,now=Date.now()}={}){
 const claims=payload(accessToken),t=Math.floor(now/1000);
 const issuer=new URL(projectUrl).origin+'/auth/v1';
 if(claims.iss!==issuer||claims.aud!=='authenticated'||claims.role!=='authenticated'||
    !UUID.test(claims.sub||'')||!UUID.test(claims.session_id||'')||
    !Number.isSafeInteger(claims.iat)||!Number.isSafeInteger(claims.exp)||
    claims.iat>t+30||t-claims.iat>120||claims.exp<=t||claims.exp-claims.iat>3600||
    claims.exp<=claims.iat||claims.is_anonymous===true||
    (claims.nbf!==undefined&&(!Number.isSafeInteger(claims.nbf)||claims.nbf>t))||
    !user||user.id!==claims.sub||typeof user.email!=='string'||!user.email||
    !Number.isFinite(Date.parse(user.email_confirmed_at))||user.is_anonymous===true||
    user.deleted_at!=null||user.banned_until!=null&&
    (!Number.isFinite(Date.parse(user.banned_until))||Date.parse(user.banned_until)>now))deny();
 return Object.freeze({userId:claims.sub,providerSessionId:claims.session_id,
   expiresAt:claims.exp,email:user.email.toLowerCase()});
}
export function createHostedFreshLoginBridge(){
 throw Error('Hosted fresh login unavailable until reviewed provider callback and private credentials.');
}
export function createDisposableFreshLoginBridge({
 pool,projectUrl,allowedOrigin,exchangeAuthCode,verifyUser,
 fictionalTestOnly=false,now=()=>Date.now()
}={}){
 if(fictionalTestOnly!==true||!process.env.TEST_DATABASE_URL||
    !pool||typeof pool.query!=='function'||typeof exchangeAuthCode!=='function'||
    typeof verifyUser!=='function'||typeof now!=='function')
   throw Error('Disposable-only login bridge required.');
 let issuer,redirectTo;
 try{
  const provider=new URL(projectUrl),app=new URL(allowedOrigin);
  if(provider.protocol!=='https:'||provider.pathname!=='/'||provider.search||
     provider.hash||provider.username||provider.password||
     !/^[a-z0-9-]+\.supabase\.co$/i.test(provider.hostname)||
     app.protocol!=='https:'||app.pathname!=='/'||app.search||app.hash||
     app.username||app.password)throw Error();
  issuer=provider.origin+'/auth/v1';
  redirectTo=app.origin+'/auth/callback';
 }catch{throw Error('Trusted provider and callback origins required.');}
 const unused=new Map();
 function consumeFreshProof(value){
  if(typeof value!=='string'||!OPAQUE.test(value))return null;
  const proof=unused.get(value);
  unused.delete(value);
  return proof||null;
 }
 async function begin(){
  const state=random(),binding=random(),verifier=random(),grantId=random();
  const codeChallenge=createHash('sha256').update(verifier).digest('base64url');
  const timestamp=now();
  try{
   await pool.query(
    'INSERT INTO growth_starter_private.fresh_login_flows(state_hash,binding_hash,pkce_verifier,one_time_grant_id,expires_at) VALUES($1,$2,$3,$4,$5)',
    [hash('state',state),hash('binding',binding),verifier,grantId,new Date(timestamp+300000)]);
  }catch{down();}
  // browserBinding MUST become a Secure/HttpOnly/SameSite cookie on a reviewed
  // HTTPS handler; it must never appear in redirect URL or application JS.
  return Object.freeze({state,browserBinding:binding,codeChallenge,
    codeChallengeMethod:'S256',redirectTo});
 }
 async function completeAndIssue({state,browserBinding,authCode}={},issueSession){
  if(typeof state!=='string'||!OPAQUE.test(state)||
     typeof browserBinding!=='string'||!OPAQUE.test(browserBinding)||
     typeof authCode!=='string'||!CODE.test(authCode)||
     typeof issueSession!=='function')deny();
  let matched;
  try{
   const r=await pool.query(
    'UPDATE growth_starter_private.fresh_login_flows SET consumed_at=clock_timestamp() WHERE state_hash=$1 AND binding_hash=$2 AND consumed_at IS NULL AND expires_at>clock_timestamp() RETURNING pkce_verifier,one_time_grant_id',
    [hash('state',state),hash('binding',browserBinding)]);
   if(r.rowCount!==1)deny();
   matched=r.rows[0];
  }catch(e){if(e?.message===INVALID)throw e;down();}
  // Commit the one-time state consumption BEFORE network I/O. Even a
  // timeout or invalid provider response cannot replay the same state.
  let response,user;
  try{
   response=await exchangeAuthCode({
    code:authCode,codeVerifier:matched.pkce_verifier,redirectTo
   });
   if(!response||typeof response.accessToken!=='string')deny();
   user=await verifyUser({accessToken:response.accessToken});
  }catch(e){if(e?.message===INVALID)throw e;down();}
  const identity=validateFreshProviderIdentity({accessToken:response.accessToken,user,projectUrl,now:now()});
  const proof=random();
  unused.set(proof,Object.freeze({
   freshAuthentication:true,userId:identity.userId,
   providerSessionId:identity.providerSessionId,
   oneTimeGrantId:matched.one_time_grant_id,
   authenticatedAt:now()
  }));
  try{
   // Return Codeedge's opaque credential, not the Supabase bearer or refresh
   // token. The actual cookie issuing handler remains unimplemented.
   return await issueSession({freshLoginProof:proof});
  }finally{unused.delete(proof);}
 }
 return Object.freeze({begin,completeAndIssue,consumeFreshProof,
  status:'disposable_only_not_hosted'});
}
