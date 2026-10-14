/**
 * Phase 3.2 source-only adapter for PostgREST read boundary.
 * Caller MUST first send the ORIGINAL bearer to Supabase Auth /user, which
 * validates its signature, and compare the returned user ID to this input.
 * This module never verifies the JWT's cryptographic signature on its own.
 *
 * checkAuthoritativeSession MUST be an independently secured server-side
 * session registry or approved provider introspection endpoint (NOT a mock,
 * writable request claim, browser source, always-true callback or the legacy
 * direct-PG actor-ID SECURITY DEFINER path). No hosted implementation exists.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function reject(){return false;}
export function createTrustedSessionGate({projectUrl,checkAuthoritativeSession,now=()=>Date.now(),maxLifetimeSeconds=3600}={}){
  let issuer;
  try{
    const url=new URL(projectUrl);
    if(url.protocol!=='https:' || url.pathname!=='/' || url.search || url.hash ||
       url.username || url.password || !/^[a-z0-9-]+\.supabase\.co$/i.test(url.hostname))throw Error();
    issuer=url.origin+'/auth/v1';
  }catch{throw Error('Trusted session origin required.');}
  if(typeof checkAuthoritativeSession!=='function' || typeof now!=='function' ||
     !Number.isInteger(maxLifetimeSeconds) || maxLifetimeSeconds<60 ||
     maxLifetimeSeconds>3600)throw Error('Trusted session dependencies required.');
  return Object.freeze({
    async verifyCurrentSession({userId,token}={}){
      if(!UUID.test(userId||'') || typeof token!=='string' || token.length>12000)return reject();
      const parts=token.split('.');
      if(parts.length!==3 || parts.some(p=>!p || !/^[A-Za-z0-9_-]+$/.test(p)))return reject();
      let claim;
      try{claim=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));}
      catch{return reject();}
      const ts=Math.floor(now()/1000);
      if(!claim || typeof claim!=='object' || Array.isArray(claim) ||
         claim.iss!==issuer || claim.aud!=='authenticated' || claim.role!=='authenticated' ||
         claim.sub!==userId || !UUID.test(claim.session_id||'') ||
         !Number.isSafeInteger(claim.iat) || !Number.isSafeInteger(claim.exp) ||
         claim.iat>ts+30 || claim.exp<=ts ||
         claim.exp-claim.iat>maxLifetimeSeconds || ts-claim.iat>maxLifetimeSeconds ||
         claim.is_anonymous===true || (claim.nbf!==undefined &&
           (!Number.isSafeInteger(claim.nbf) || claim.nbf>ts)))return reject();
      let record;
      try {
        record=await checkAuthoritativeSession({userId,sessionId:claim.session_id,issuedAt:claim.iat});
      }catch{return reject();}
      return record?.active===true && record.userId===userId &&
             record.sessionId===claim.session_id &&
             (record.expiresAt===undefined ||
               (Number.isSafeInteger(record.expiresAt) && record.expiresAt>ts));
    }
  });
}
