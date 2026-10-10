import { DomainError } from './core.mjs';

// Supabase Auth provider adapter. Unlike the existing RS256-only contract,
// this validates the EXACT bearer token with the trusted provider's /user API.
// Token claims are never trusted before that successful online verification.
// Every accepted request additionally checks the live auth.sessions row.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function deny(reason='Identity could not be verified.',status=401) {
  throw new DomainError(reason,status);
}
function parsedClaimPart(part) {
  if(!part || part.length>9000 || !/^[A-Za-z0-9_-]+$/.test(part))deny();
  try { const v=JSON.parse(Buffer.from(part,'base64url').toString('utf8'));
    if(!v || typeof v!=='object' || Array.isArray(v))deny();
    return v;
  }catch { deny(); }
}
/**
 * checkSession({userId,sessionId,email}) MUST verify the current non-revoked
 * session and user in the authoritative provider DB on every request. This
 * explicitly avoids assuming /auth/v1/user alone guarantees logout revocation.
 */
export function createSupabaseStagingIdentity({
  projectUrl, publishableKey, checkSession, fetchImpl=globalThis.fetch,
  now=()=>Date.now(), maxLifetimeSeconds=3600
}) {
  let origin;
  try {
    const u=new URL(projectUrl);
    if(u.protocol!=='https:' || u.username || u.password || u.pathname!=='/' ||
       u.search || u.hash || !/^[-a-z0-9]+\.supabase\.co$/i.test(u.hostname))deny('Invalid trusted identity origin.',503);
    origin=u.origin;
  }catch { deny('Invalid trusted identity origin.',503); }
  if(typeof publishableKey!=='string' || publishableKey.length<16 ||
     /\s/.test(publishableKey) || typeof checkSession!=='function' ||
     typeof fetchImpl!=='function' || !Number.isInteger(maxLifetimeSeconds) ||
     maxLifetimeSeconds<60 || maxLifetimeSeconds>3600)deny('Identity dependencies not configured.',503);
  const issuer=origin+'/auth/v1';
  return Object.freeze({
    async verifyAuthorization(authorization) {
      if(typeof authorization!=='string' || !authorization.startsWith('Bearer ') ||
         authorization.length>12000)deny('Authentication required.',401);
      const token=authorization.slice(7);
      const parts=token.split('.');
      if(parts.length!==3 || !/^[A-Za-z0-9_-]+$/.test(parts[2]))deny();
      const header=parsedClaimPart(parts[0]),claims=parsedClaimPart(parts[1]);
      // Require asymmetric JWTs. Supabase Auth /user verifies the signature,
      // issuer and bearer token itself. Never rely on browser-provided role.
      if(!['ES256','RS256'].includes(header.alg) ||
         typeof header.kid!=='string' || !header.kid ||
         header.jku!==undefined || header.jwk!==undefined || header.x5u!==undefined ||
         header.crit!==undefined)deny('Unsupported identity signing configuration.',503);
      const timestamp=Math.floor(now()/1000);
      if(claims.iss!==issuer || claims.aud!=='authenticated' ||
         claims.role!=='authenticated' || !UUID.test(claims.sub||'') ||
         !UUID.test(claims.session_id||'') ||
         !Number.isSafeInteger(claims.iat) || !Number.isSafeInteger(claims.exp) ||
         claims.exp<=timestamp || claims.iat>timestamp+30 ||
         timestamp-claims.iat>maxLifetimeSeconds ||
         claims.exp-claims.iat>maxLifetimeSeconds)deny();
      let response;
      try {
        response=await fetchImpl(origin+'/auth/v1/user',{
          method:'GET',
          headers:{apikey:publishableKey,authorization:'Bearer '+token,accept:'application/json'},
          signal:AbortSignal.timeout(4000)
        });
      }catch { deny('Identity service unavailable.',503); }
      if(response.status===401 || response.status===403)deny();
      if(response.status!==200)deny('Identity service unavailable.',503);
      let user;
      try { user=await response.json(); }catch { deny('Identity service unavailable.',503); }
      if(!user || user.id!==claims.sub || typeof user.email!=='string' ||
         !user.email_confirmed_at || user.is_anonymous===true || user.banned_until &&
         Date.parse(user.banned_until)>now())deny('Verified email required.',403);
      const email=user.email.trim().toLowerCase();
      if(!email || email.length>254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ||
         typeof claims.email!=='string' || claims.email.trim().toLowerCase()!==email)deny('Verified email required.',403);
      const actor=Object.freeze({userId:user.id,email,emailVerified:true,
        sessionId:claims.session_id,issuer,authProvider:'supabase'});
      let active;
      try { active=await checkSession(actor); }
      catch { deny('Live session verification unavailable.',503); }
      if(active!==true)deny('Session expired or revoked.',401);
      return actor;
    }
  });
}
