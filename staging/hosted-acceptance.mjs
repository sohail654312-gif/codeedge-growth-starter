import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

/**
 * Manual-only, token-redacting acceptance runner. Never scheduled in public CI.
 * CLI requires independently logged-in REAL staging test users and seeded
 * fictional workspace/request records; never invokes mutating API routes.
 */
const workspaceRx=/^ws_[A-Za-z0-9_-]{8,128}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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
    return {subject:p.sub,sessionId:p.session_id,signature:parts[2],expiresAt:p.exp};
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
  if(!UUID.test(ma.subject) || !UUID.test(mb.subject) ||
     !UUID.test(ma.sessionId) || !UUID.test(mb.sessionId))
    throw Error('Real Supabase synthetic users and session IDs required.');
  const wa=requireValue(env,'GS_ACCEPT_WORKSPACE_A'),wb=requireValue(env,'GS_ACCEPT_WORKSPACE_B');
  if(!workspaceRx.test(wa) || !workspaceRx.test(wb) || wa===wb ||
     wa!=='ws_'+ma.subject || wb!=='ws_'+mb.subject)
    throw Error('Two owner-keyed synthetic staging workspaces required.');
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
  // A legacy gateway can pass a health probe. Requiring the explicit review
  // marker rejects the known unsafe old implementation at first contact.
  assert.equal(health.security,'review-only','Unexpected or legacy gateway process.');
  await check('anonymous_denied',401,()=>request('/v1/workspaces'));
  const listA=await check('owner_a_workspaces',200,()=>request('/v1/workspaces',a));
  const listB=await check('owner_b_workspaces',200,()=>request('/v1/workspaces',b));
  for(const [list,own,other] of [[listA,wa,wb],[listB,wb,wa]]){
    assert.ok(Array.isArray(list.workspaces) && list.workspaces.length===1 &&
      list.workspaces[0].workspace_id===own && list.workspaces[0].role==='owner');
    assert.ok(!list.workspaces.some(w=>w.workspace_id===other),'Cross-workspace listing leak.');
  }
  const ownA=await check('owner_a_requests',200,()=>request('/v1/requests?workspaceId='+wa,a));
  const ownB=await check('owner_b_requests',200,()=>request('/v1/requests?workspaceId='+wb,b));
  assert.ok(Array.isArray(ownA.items) && ownA.items.some(x=>x.id===ra && x.workspace_id===wa) &&
    ownA.items.every(x=>x.workspace_id===wa),'Missing or foreign synthetic A records.');
  assert.ok(Array.isArray(ownB.items) && ownB.items.some(x=>x.id===rb && x.workspace_id===wb) &&
    ownB.items.every(x=>x.workspace_id===wb),'Missing or foreign synthetic B records.');
  await check('a_to_b_denied',403,()=>request('/v1/requests?workspaceId='+wb,a));
  await check('b_to_a_denied',403,()=>request('/v1/requests?workspaceId='+wa,b));
  await check('forged_actor_query_denied',400,()=>request('/v1/requests?workspaceId='+wb+'&actorId='+encodeURIComponent(tokenMetadata(b).subject),a));
  await check('forged_role_query_denied',400,()=>request('/v1/requests?workspaceId='+wa+'&role=agency_admin',a));
  await check('bad_pagination_denied',400,()=>request('/v1/requests?workspaceId='+wa+'&page=20',a));
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
/**
 * Manual second-stage AUTH acceptance. Run only after an authorized operator
 * has revoked test User A's actual Supabase session, while the ORIGINAL A
 * access token is still unexpired. It does not perform logout or mutation.
 * This isolates immediate revocation from normal JWT expiration. User B must
 * continue working so a full provider outage does not look like successful
 * revocation. The DB membership-revocation scenario remains a SEPARATE gate.
 */
export async function runHostedSessionRevocation(config,{fetchImpl=fetch,report=()=>{},clock=()=>Date.now()}={}){
  const [a,b]=config.tokens;
  const meta=tokenMetadata(a);
  if(!Number.isSafeInteger(meta.expiresAt) || meta.expiresAt*1000<=clock()+30000)
    throw Error('Original synthetic session token expired or too close to expiry; revocation not provable.');
  async function query(token){
    const r=await fetchImpl(config.base+'/v1/workspaces',{
      method:'GET',headers:{authorization:'Bearer '+token},redirect:'manual',
      signal:AbortSignal.timeout(5000)
    });
    if(r.status===301 || r.status===302 || r.status===307 || r.status===308)
      throw Error('Unexpected redirect in hosted acceptance.');
    return r;
  }
  const revoked=await query(a);
  assert.equal(revoked.status,401,'revoked original A bearer denied before JWT expiry');
  report({check:'nonexpired_revoked_a_denied',status:401});
  const live=await query(b);
  assert.equal(live.status,200,'independent active User B must still function');
  const data=await live.json();
  assert.ok(Array.isArray(data.workspaces) &&
    data.workspaces.some(w=>w.workspace_id===config.workspaces[1]) &&
    data.workspaces.every(w=>w.workspace_id!==config.workspaces[0]),
    'Independent B isolation must survive revocation');
  report({check:'unaffected_b_healthy',status:200});
  return {passed:2,results:['nonexpired_revoked_a_denied','unaffected_b_healthy'],
    requiresSeparateEvidence:['operator recorded authoritative session revocation and timestamp',
      'membership revocation RLS probe','restricted SQL role and cutover','cleanup']};
}

/**
 * Manual second-stage membership revocation. Requires a separately
 * authenticated synthetic MEMBER C of Workspace A; owners cannot be revoked
 * through membership deletion. Uses the still-valid original MEMBER C token
 * before/after the operator's approved membership change.
 */
export async function runHostedMemberRevocation(config,{
  memberToken,fetchImpl=fetch,report=()=>{}
}={}){
  if(typeof memberToken!=='string' || !memberToken.includes('.'))throw Error('Member token missing.');
  const meta=tokenMetadata(memberToken);
  if(meta.subject===tokenMetadata(config.tokens[0]).subject ||
     meta.subject===tokenMetadata(config.tokens[1]).subject)
    throw Error('Independent member C required, not an owner.');
  const call=async path=>{
    const r=await fetchImpl(config.base+path,{
      method:'GET',headers:{authorization:'Bearer '+memberToken},redirect:'manual',
      signal:AbortSignal.timeout(5000)
    });
    return {status:r.status,body:r.status===200?await r.json():null};
  };
  const own=await call('/v1/workspaces');
  assert.equal(own.status,200);
  assert.ok(Array.isArray(own.body.workspaces) &&
    !own.body.workspaces.some(w=>w.workspace_id===config.workspaces[0]),
    'Revoked member cannot see Workspace A');
  report({check:'revoked_member_c_workspace_absent',status:200});
  const requests=await call('/v1/requests?workspaceId='+config.workspaces[0]);
  assert.equal(requests.status,403,'revoked member cannot read requests');
  report({check:'revoked_member_c_requests_denied',status:403});
  return {passed:2,requiresSeparateEvidence:['operator recorded member C pre-revocation access and DB change',
    'member C token remains unexpired','foreign tenant and SQL direct attack probes']};
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const config=readAcceptanceConfig(process.env);
    const mode=process.env.GS_ACCEPT_PHASE || 'baseline';
    const runner=mode==='session-revoked-a'?runHostedSessionRevocation:
      mode==='member-revoked-c'?runHostedMemberRevocation:runHostedAcceptance;
    if(!['baseline','session-revoked-a','member-revoked-c'].includes(mode))
      throw Error('Unknown acceptance phase.');
    const result=await runner(config,{...(mode==='member-revoked-c'?{
      memberToken:process.env.GS_ACCEPT_TOKEN_MEMBER_C}:{}),report:x=>process.stdout.write(
      x.check+' HTTP '+x.status+' ('+(x.elapsedMs??'n/a')+' ms)\n')});
    process.stdout.write(result.passed+' hosted HTTP checks passed. This is NOT complete Phase 2.4 acceptance.\n');
    process.stdout.write('Still requires independent expiry/revocation, SQL login and cleanup evidence.\n');
  }catch{
    // Never expose token, URL containing credentials, or response payload.
    process.stderr.write('Hosted acceptance failed or is not configured; no acceptance claim.\n');
    process.exitCode=1;
  }
}
