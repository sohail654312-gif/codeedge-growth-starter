/**
 * Phase 3.15T: fail-closed composition of the installed private Auth data bridge
 * and an independently accepted provider/account POLICY authority.
 *
 * readExactPair must call ONLY growth_starter_auth_bridge.exact_pair_snapshot
 * via an independently reviewed restricted principal. This file does NOT open
 * privileged connections, verify an original JWT, infer configured policy,
 * grant auth access, or activate staging.
 */
import {createExactSessionAuthority} from './exact-session-authority.mjs';

function until(value){
 if(value===null)return null; // Supabase may have no session timebox.
 const date=value instanceof Date?value:
  typeof value==='string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value)?new Date(value):null;
 if(!date||!Number.isFinite(date.getTime()))return NaN;
 return Math.floor(date.getTime()/1000);
}

/**
 * verifyOriginalSessionPolicy must prove the explicitly approved current
 * provider contract, including policy/account events not proved by the bridge.
 * It must not return true from a JWT, getUser, or bridge row alone. No accepted
 * default policy or provider stub exists in this module.
 */
export function createBridgeBackedSessionAuthority({
 readExactPair,verifyOriginalSessionPolicy,now=()=>Date.now(),timeoutMs=2000
}={}){
 if(typeof readExactPair!=='function'||
    typeof verifyOriginalSessionPolicy!=='function'||typeof now!=='function')
  throw Error('Reviewed bridge and original-session policy authorities required.');
 const authority=createExactSessionAuthority({
  now,timeoutMs,
  async lookup({userId,sessionId,signal}){
   if(signal.aborted)throw Error('Cancelled');
   const row=await readExactPair({userId,sessionId,signal});
   // Match the reviewed SQL's exact four-column projection; no nullable or
   // absent status is interpreted as a healthy session.
   if(!row||row.pair_exists!==true||row.banned!==false||row.deleted!==false)
    throw Error('Exact pair denied');
   const notAfter=until(row.session_not_after);
   const at=Math.floor(now()/1000);
   if(!Number.isSafeInteger(at)||(notAfter!==null&&
       (!Number.isSafeInteger(notAfter)||notAfter<=at)))throw Error('Session expired or unknown');
   if(signal.aborted)throw Error('Cancelled');
   const policy=await verifyOriginalSessionPolicy({userId,sessionId,signal});
   if(signal.aborted||!policy||policy.userId!==userId||
      policy.sessionId!==sessionId||policy.policyValid!==true||
      !Number.isSafeInteger(policy.expiresAt)||policy.expiresAt<=at)
    throw Error('Unverified original-session policy');
   const expiresAt=Math.min(policy.expiresAt,notAfter??policy.expiresAt);
   return {userId,sessionId,exists:true,revoked:false,deleted:false,
    banned:false,policyValid:true,expiresAt};
  }
 });
 return Object.freeze({
  checkProviderSession:authority.checkProviderSession,
  capabilities:Object.freeze({exactPair:true,policyVerifierRequired:true,
   liveProviderAccepted:false,hostedVerified:false})
 });
}
