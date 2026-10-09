/**
 * Phase 3.1 SOURCE-ONLY read boundary. Supabase's PostgREST verifies the
 * ORIGINAL user bearer token and enforces database RLS. The legacy direct
 * PostgreSQL actor-ID SECURITY DEFINER functions must NOT be used here.
 *
 * NOT deployable until actual authenticated RLS, active-session checking,
 * narrow grants and independent hosted two-user evidence are accepted.
 */
const WS=/^ws_[A-Za-z0-9_-]{8,128}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROLES=new Set(['agency_admin','staff','client']);
export class PostgrestBoundaryError extends Error {
  constructor(message='Read boundary unavailable.',status=503){super(message);this.status=status;}
}
function deny(status=503){throw new PostgrestBoundaryError(status===401?'Authentication required.':status===403?'Workspace access denied.':undefined,status);}
function originOf(url) {
  try {
    const u=new URL(url);
    if(u.protocol!=='https:' || u.username || u.password || u.pathname!=='/' || u.search || u.hash ||
       !/^[a-z0-9-]+\.supabase\.co$/i.test(u.hostname))deny();
    return u.origin;
  }catch{deny();}
}
function requireBearer(authorization) {
  if(typeof authorization!=='string' || authorization.length>12000 || !authorization.startsWith('Bearer '))deny(401);
  const token=authorization.slice(7);
  if(token.length<30 || token.split('.').length!==3 || !/^[A-Za-z0-9_.-]+$/.test(token))deny(401);
  return token;
}
async function json(response) {
  try{return await response.json();}catch{deny();}
}
export function createPostgrestReadBoundary({projectUrl,publishableKey,verifyCurrentSession,fetchImpl=globalThis.fetch}) {
  const origin=originOf(projectUrl);
  if(typeof publishableKey!=='string' || !/^sb_publishable_[A-Za-z0-9_-]{10,}$/.test(publishableKey) ||
     typeof verifyCurrentSession!=='function' || typeof fetchImpl!=='function')deny();
  async function request(path,token,profile=false){
    let response;
    try {
      response=await fetchImpl(origin+path,{
        method:'GET',redirect:'error',signal:AbortSignal.timeout(4000),
        headers:{apikey:publishableKey,authorization:'Bearer '+token,accept:'application/json',
          ...(profile?{'accept-profile':'growth_starter'}:{})}
      });
    }catch{deny();}
    if(response.status===401)deny(401);
    if(response.status===403)deny(403);
    if(response.status!==200)deny();
    return json(response);
  }
  async function subject(authorization) {
    const token=requireBearer(authorization);
    // /user verifies the exact token at the trusted provider. Parsed browser
    // claims, caller-provided actor IDs and membership hints are never used.
    const user=await request('/auth/v1/user',token);
    if(!user || !UUID.test(user.id||'') || typeof user.email!=='string' ||
       !user.email_confirmed_at || user.is_anonymous===true ||
       (user.banned_until && Date.parse(user.banned_until)>Date.now()))deny(401);
    let active=false;
    try {active=await verifyCurrentSession({userId:user.id,token});}
    catch{deny();}
    if(active!==true)deny(401);
    return {userId:user.id,token};
  }
  async function select(table,token,params,maximum) {
    const qs=new URLSearchParams(params).toString();
    const rows=await request('/rest/v1/'+table+'?'+qs,token,true);
    if(!Array.isArray(rows) || rows.length>maximum)deny();
    return rows;
  }
  async function workspacesFor(actor) {
    // No actor-ID SQL function or claim-derived PostgreSQL session GUC.
    // Database policies MUST independently limit BOTH results.
    const [ws,member]=await Promise.all([
      select('workspaces',actor.token,{select:'id,owner_user_id,state',state:'eq.active',order:'id.asc',limit:'100'},100),
      select('memberships',actor.token,{select:'workspace_id,user_id,role,state',user_id:'eq.'+actor.userId,state:'eq.active',limit:'100'},100)
    ]);
    const roles=new Map();
    for(const m of member) {
      if(!m || !WS.test(m.workspace_id||'') || m.user_id!==actor.userId ||
         m.state!=='active' || !ROLES.has(m.role))deny();
      roles.set(m.workspace_id,m.role);
    }
    const output=[];
    for(const w of ws){
      if(!w || !WS.test(w.id||'') || w.state!=='active' ||
         typeof w.owner_user_id!=='string')deny();
      const role=w.owner_user_id===actor.userId?'owner':roles.get(w.id);
      // Refuse to present records outside independently checked identity.
      if(!role)deny();
      if(output.some(x=>x.workspace_id===w.id))deny();
      output.push({workspace_id:w.id,role});
    }
    if(output.length>25)deny();
    return output;
  }
  return Object.freeze({
    async listWorkspaces(authorization) {
      const actor=await subject(authorization);
      return Object.freeze({workspaces:await workspacesFor(actor)});
    },
    async listRequests(authorization,workspaceId,limit=20) {
      if(!WS.test(workspaceId||'') || !Number.isInteger(limit) || limit<1 || limit>50)
        throw new PostgrestBoundaryError('Invalid workspace or limit.',400);
      const actor=await subject(authorization);
      const allowed=await workspacesFor(actor);
      if(!allowed.some(w=>w.workspace_id===workspaceId))deny(403);
      const rows=await select('work_requests',actor.token,{
        select:'id,workspace_id,title,kind,status,version,updated_at',
        workspace_id:'eq.'+workspaceId,order:'updated_at.desc,id.asc',limit:String(limit)
      },limit);
      for(const row of rows) {
        if(!row || row.workspace_id!==workspaceId ||
           typeof row.id!=='string' || !/^[A-Za-z0-9_-]{1,128}$/.test(row.id) ||
           typeof row.title!=='string' || typeof row.kind!=='string' ||
           typeof row.status!=='string' || !Number.isInteger(row.version))deny();
      }
      return Object.freeze({workspaceId,items:rows});
    }
  });
}
