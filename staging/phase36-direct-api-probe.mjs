/**
 * Phase 3.6: future, operator-invoked, READ-ONLY Supabase direct-Data-API
 * revoked-token probe. This is evidence collection, NOT an auth verifier.
 * Never schedule or wire into the product runtime. No credentials or JWTs
 * may be persisted, logged or returned.
 *
 * Denial without a known seeded row cannot prove immediate revocation.
 * HTTP 404/406 alone cannot independently attest Data API exposure settings.
 */
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const workspace=/^ws_[A-Za-z0-9_-]{8,128}$/;
const fail=()=>{throw Error('Approved synthetic direct-API probe prerequisites unavailable.');};
export async function probeRevokedTokenDirectApi({
  projectUrl,publishableKey,revokedBearer,expectedWorkspaceId,
  confirmedSyntheticOnly=false,confirmedRevokedBeforeExpiry=false,
  fetchImpl=globalThis.fetch
}={}){
  let origin;
  try {
    const u=new URL(projectUrl);
    if(u.protocol!=='https:'||u.pathname!=='/'||u.search||u.hash||
      u.username||u.password||!/^[a-z0-9-]+\.supabase\.co$/i.test(u.hostname))fail();
    origin=u.origin;
  }catch{fail();}
  if(confirmedSyntheticOnly!==true||confirmedRevokedBeforeExpiry!==true ||
    typeof publishableKey!=='string'||!/^sb_publishable_[A-Za-z0-9_-]{10,}$/.test(publishableKey)||
    !workspace.test(expectedWorkspaceId||'')||typeof revokedBearer!=='string'||
    !/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(revokedBearer)||
    revokedBearer.length>12000||typeof fetchImpl!=='function')fail();
  let parts,payload;
  try {
    parts=revokedBearer.slice(7).split('.');
    payload=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
    if(!payload||!uuid.test(payload.sub)||!uuid.test(payload.session_id)||
      payload.iss!==origin+'/auth/v1'||payload.aud!=='authenticated'||
      payload.role!=='authenticated'||!Number.isSafeInteger(payload.exp)||
      payload.exp<=Math.floor(Date.now()/1000))fail();
  }catch{fail();}
  const path='/rest/v1/workspaces?'+new URLSearchParams({
    select:'id',id:'eq.'+expectedWorkspaceId,limit:'1'}).toString();
  let response;
  try{
    response=await fetchImpl(origin+path,{
      method:'GET',redirect:'error',signal:AbortSignal.timeout(5000),
      headers:{apikey:publishableKey,authorization:revokedBearer,
        'accept-profile':'growth_starter',accept:'application/json'}
    });
  }catch{return Object.freeze({verdict:'BLOCKED',reason:'Provider response unavailable.'});}
  if(response?.status===200){
    let rows;try{rows=await response.json();}catch{return Object.freeze({
      verdict:'BLOCKED',reason:'Unparseable data response; not accepted.'});}
    if(!Array.isArray(rows))return Object.freeze({verdict:'BLOCKED',reason:'Unexpected response shape.'});
    if(rows.length>0)return Object.freeze({
      verdict:'FAIL',reason:'Revoked-token Data API returned rows; access bypass possible.'});
    return Object.freeze({verdict:'BLOCKED',
      reason:'Empty response does not prove session revocation; seed and role visibility unverified.'});
  }
  if([401,403,404,406].includes(response?.status))return Object.freeze({
    verdict:'PARTIAL',reason:'Request denied/unavailable; reason and API exposure require separate proof.'});
  return Object.freeze({verdict:'BLOCKED',reason:'Unrecognised response or upstream failure.'});
}
