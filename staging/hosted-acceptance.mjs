import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

/**
 * Manual-only, token-redacting acceptance runner. Never scheduled in public CI.
 * CLI requires independently logged-in REAL staging test users and seeded
 * fictional workspace/request records; never invokes mutating API routes.
 */
const workspaceRx=/^ws_[A-Za-z0-9_-]{8,128}$/;
const requestRx=/^[A-Za-z0-9_-]{1,128}$/;
function requireValue(env,key){
  const value=env[key];
  if(typeof value!=='string' || value.length===0)throw Error('Missing acceptance configuration: '+key);
  return value;
}
function tokenMetadata(token){
  const parts=token.split('.');
  if(parts.length!==3 || parts.some(p=>!p || !/^[A-Za-z0-9_-]+$/.test(p)))throw Error('Invalid test token format.');
  try{
    const p=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
    if(!p || typeof p.sub!=='string' || !p.session_id)throw Error();
    return {subject:p.sub,sessionId:p.session_id,signature:parts[2]};
  }catch{throw Error('Invalid test token format.');}
}
export function readAcceptanceConfig(env){
  const address=requireValue(env,'GS_ACCEPT_GATEWAY_URL');
  let url;
  try{url=new URL(address);}catch{throw Error('Staging URL is invalid.');}
  if(url.protocol!=='https:' || url.username || url.password || url.pathname!=='/' ||
     url.search || url.hash)throw Error('HTTPS-only staging gateway required.');
  const a=requireValue(env,'GS_ACCEPT_TOKEN_A');
  const b=requireValue(env,'GS_ACCEPT_TOKEN_B');
  if(a===b)throw Error('Two independent sessions required.');
  const ma=tokenMetadata(a),mb=tokenMetadata(b);
  if(ma.subject===mb.subject || ma.sessionId===mb.sessionId)throw Error('Two distinct staging users and sessions required.');
  const wa=requireValue(env,'GS_ACCEPT_WORKSPACE_A'),wb=requireValue(env,'GS_ACCEPT_WORKSPACE_B');
  if(!workspaceRx.test(wa) || !workspaceRx.test(wb) || wa===wb)throw Error('Two distinct staging workspaces required.');
  const ra=requireValue(env,'GS_ACCEPT_REQUEST_A'),rb=requireValue(env,'GS_ACCEPT_REQUEST_B');
  if(!requestRx.test(ra) || !requestRx.test(rb))throw Error('Two synthetic request IDs required.');
  const origin=requireValue(env,'GS_ACCEPT_ALLOWED_ORIGIN');
  let o;try{o=new URL(origin);}catch{throw Error('Invalid test origin.');}
  if(o.protocol!=='https:' || o.pathname!=='/' || o.search || o.hash || o.username || o.password)
    throw Error('Invalid test origin.');
  return Object.freeze({base:url.origin,tokens:[a,b],workspaces:[wa,wb],requests:[ra,rb],allowedOrigin:o.origin});
}
function modifySignature(jwt){
  const parts=jwt.split('.');
  const signature=parts[2];
  parts[2]=(signature[0]==='A'?'B':'A')+signature.slice(1);
  return parts.join('.');
}
function spoofPayload(jwt,otherWorkspace){
  const parts=jwt.split('.');
  const data=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
  parts[1]=Buffer.from(JSON.stringify({...data,workspaceId:otherWorkspace,agencyRole:'owner'})).toString('base64url');
  return parts.join('.');
}
/** Actual hosted HTTP acceptance, never a replacement for DB role & revocation tests. */
export async function runHostedAcceptance(config,{fetchImpl=fetch,report=()=>{},timeoutMs=5000}={}){
  if(!config || !Array.isArray(config.tokens) || config.tokens.length!==2)throw Error('Acceptance config missing.');
  const outcomes=[];
  async function request(path,token,opts={}){
    const t=Date.now();
    const response=await fetchImpl(config.base+path,{
      method:opts.method||'GET',
      headers:{
        ...(token?{authorization:'Bearer '+token}:{}),
        ...(opts.origin?{origin:opts.origin}:{})
      },
      redirect:'manual',signal:AbortSignal.timeout(timeoutMs)
    });
    let body;
    try{body=await response.json();}catch{throw Error('Non-JSON gateway response.');}
    return {status:response.status,body,elapsed:Date.now()-t};
  }
  async function check(name,expected,fn){
    const r=await fn();
    assert.equal(r.status,expected,name+' HTTP status');
    outcomes.push({check:name,status:r.status,elapsedMs:r.elapsed});
    report({check:name,status:r.status,elapsedMs:r.elapsed});
    return r.body;
  }
  const [a,b]=config.tokens,[wa,wb]=config.workspaces,[ra,rb]=config.requests;
  const health=await check('health_readonly',200,()=>request('/healthz'));
  assert.equal(health.mode,'staging-read-only');
  await check('anonymous_denied',401,()=>request('/v1/workspaces'));
  const listA=await check('owner_a_workspaces',200,()=>request('/v1/workspaces',a));
  const listB=await check('owner_b_workspaces',200,()=>request('/v1/workspaces',b));
  for(const [list,own,other] of [[listA,wa,wb],[listB,wb,wa]]){
    assert.ok(Array.isArray(list.workspaces) && list.workspaces.some(w=>w.workspace_id===own));
    assert.ok(!list.workspaces.some(w=>w.workspace_id===other),'Cross-workspace listing leak.');
  }
  const ownA=await check('owner_a_requests',200,()=>request('/v1/requests?workspaceId='+wa,a));
  const ownB=await check('owner_b_requests',200,()=>request('/v1/requests?workspaceId='+wb,b));
  assert.ok(ownA.items?.some(x=>x.id===ra && x.workspace_id===wa),'Missing synthetic A record.');
  assert.ok(ownB.items?.some(x=>x.id===rb && x.workspace_id===wb),'Missing synthetic B record.');
  await check('a_to_b_denied',403,()=>request('/v1/requests?workspaceId='+wb,a));
  await check('b_to_a_denied',403,()=>request('/v1/requests?workspaceId='+wa,b));
  await check('forged_actor_query_denied',403,()=>request('/v1/requests?workspaceId='+wb+'&actorId='+encodeURIComponent(tokenMetadata(b).subject),a));
  await check('invalid_signature_denied',401,()=>request('/v1/workspaces',modifySignature(a)));
  await check('forged_role_token_denied',401,()=>request('/v1/requests?workspaceId='+wb,spoofPayload(a,wb)));
  await check('wrong_origin_denied',403,()=>request('/v1/workspaces',a,{origin:'https://forbidden.synthetic.invalid'}));
  await check('http_write_denied',405,()=>request('/v1/workspaces',a,{method:'POST'}));
  await check('unavailable_media_route',404,()=>request('/v1/media/test-media-id',a));
  // Revoked/expired sessions need separately supplied *real* tokens after
  // an independently verified provider revocation/expiry operation.
  return {passed:outcomes.length,results:outcomes,requiresSeparateEvidence:[
    'real revoked/expired session probes','restricted LOGIN and SQL denials',
    'session logout and deletion','synthetic record cleanup/readback',
    'deployed SHA and HTTPS/CA acceptance'
  ]};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const config=readAcceptanceConfig(process.env);
    const result=await runHostedAcceptance(config,{report:x=>process.stdout.write(
      x.check+' HTTP '+x.status+' ('+x.elapsedMs+' ms)\n')});
    process.stdout.write(result.passed+' hosted HTTP checks passed. This is NOT complete Phase 2.4 acceptance.\n');
    process.stdout.write('Still requires independent expiry/revocation, SQL login and cleanup evidence.\n');
  }catch{
    // Never expose token, URL containing credentials, or response payload.
    process.stderr.write('Hosted acceptance failed or is not configured; no acceptance claim.\n');
    process.exitCode=1;
  }
}
