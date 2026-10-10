/**
 * Phase 3.8 — PRIVATE READ CONTRACT, NOT A DEPLOYED DATABASE ADAPTER.
 * A new SQL role lacks a provider-authenticated RLS subject by default.
 * This contract is synthetic-only until both live-session authority AND an
 * independently audited DB enforcement boundary have been approved.
 * No connection string, PostgREST request or legacy SECURITY DEFINER calls.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WS=/^ws_[A-Za-z0-9_-]{8,128}$/;
const ROLE=new Set(['owner','agency_admin','staff','client']);
const KINDS=new Set(['Website update','Social content','Local SEO','Other']);
const STATES=new Set(['Requested','In progress','Awaiting approval','Approved','Changes requested','Completed']);

export class PrivateReadDenied extends Error {
  constructor(status=503){super('Private read boundary unavailable.');this.status=status;}
}
function deny(status=503){throw new PrivateReadDenied(status);}
function exactly(value,keys) {
  return value && typeof value==='object' && !Array.isArray(value) &&
    Object.keys(value).sort().join('|')===keys.slice().sort().join('|');
}
function validWorkspace(row) {
  return exactly(row,['workspace_id','role']) && WS.test(row.workspace_id) && ROLE.has(row.role);
}
function validRequest(row,ws) {
  return exactly(row,['id','workspace_id','title','kind','status','version','updated_at']) &&
    typeof row.id==='string' && /^[A-Za-z0-9_-]{1,128}$/.test(row.id) &&
    row.workspace_id===ws && typeof row.title==='string' &&
    row.title.length>0 && row.title.length<=100 && KINDS.has(row.kind) &&
    STATES.has(row.status) && Number.isSafeInteger(row.version) && row.version>=0 &&
    typeof row.updated_at==='string' && Number.isFinite(Date.parse(row.updated_at));
}

/* Fixed SQL, with UUID values originating ONLY from the verified server-side identity.
 * Each request query rechecks ACTIVE ownership/membership within the SQL statement.
 * These predicates are defence in depth in the app, NOT independent DB RLS.
 */
export const PRIVATE_READ_SQL=Object.freeze({
  workspaces:[
    'SELECT w.id AS workspace_id,',
    " CASE WHEN w.owner_user_id = $1::text THEN 'owner' ELSE m.role END AS role",
    'FROM growth_starter.workspaces AS w',
    'LEFT JOIN growth_starter.memberships AS m',
    " ON m.workspace_id = w.id AND m.user_id = $1::text AND m.state = 'active'",
    " AND m.owner_user_id = w.owner_user_id AND m.role IN ('agency_admin','staff','client')",
    "WHERE w.state = 'active' AND (w.owner_user_id = $1::text OR m.user_id IS NOT NULL)",
    'ORDER BY w.id ASC LIMIT 26'
  ].join('\n'),
  requests:[
    'SELECT r.id, r.workspace_id, r.title, r.kind, r.status, r.version,',
    ` to_char(r.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS updated_at`,
    'FROM growth_starter.work_requests AS r',
    'JOIN growth_starter.workspaces AS w ON w.id = r.workspace_id',
    "WHERE w.state = 'active' AND r.workspace_id = $2::text",
    ' AND (w.owner_user_id = $1::text OR EXISTS (',
    ' SELECT 1 FROM growth_starter.memberships AS m',
    " WHERE m.workspace_id = w.id AND m.user_id = $1::text AND m.state = 'active'",
    " AND m.owner_user_id = w.owner_user_id AND m.role IN ('agency_admin','staff','client')",
    ' ))',
    'ORDER BY r.updated_at DESC, r.id ASC LIMIT $3::integer OFFSET $4::integer'
  ].join('\n')
});
function bearer(authorization){
  if(typeof authorization!=='string' || authorization.length>12000 ||
     !authorization.startsWith('Bearer '))deny(401);
  const token=authorization.slice(7);
  if(token.length<8 || !/^[A-Za-z0-9_.-]+$/.test(token))deny(401);
  return token;
}
/**
 * There is deliberately NO enabled hosted factory.
 * The injected verifyBearer, checkCurrentSession and executeRead are fictional
 * test doubles; they do NOT confer cryptographic or RLS security on a DB role.
 */
export function createPrivateReadContract({
  fictionalTestOnly=false,expectedIssuer,verifyBearer,checkCurrentSession,
  executeRead,now=()=>Date.now()
}={}){
  if(fictionalTestOnly!==true || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/auth\/v1$/.test(expectedIssuer||'') ||
     typeof verifyBearer!=='function' || typeof checkCurrentSession!=='function' ||
     typeof executeRead!=='function' || typeof now!=='function')deny();
  async function actor(authorization) {
    const token=bearer(authorization);
    let identity;
    try{identity=await verifyBearer(token);}catch{deny(503);}
    const ts=Math.floor(now()/1000);
    if(!identity || identity.verified!==true || !UUID.test(identity.userId||'') ||
       !UUID.test(identity.sessionId||'') || identity.issuer!==expectedIssuer ||
       identity.audience!=='authenticated' || identity.role!=='authenticated' ||
       identity.isAnonymous===true || !Number.isSafeInteger(identity.issuedAt) ||
       !Number.isSafeInteger(identity.expiresAt) || identity.issuedAt>ts+30 ||
       identity.expiresAt<=ts || identity.expiresAt-identity.issuedAt>3600)deny(401);
    let current;
    try{current=await checkCurrentSession({
      token,userId:identity.userId,sessionId:identity.sessionId,issuedAt:identity.issuedAt
    });}catch{deny(503);}
    if(current?.active!==true || current.userId!==identity.userId ||
       current.sessionId!==identity.sessionId ||
       (current.expiresAt!==undefined &&
       (!Number.isSafeInteger(current.expiresAt) || current.expiresAt<=ts)))deny(401);
    return identity.userId;
  }
  async function query(id,sql,params,max) {
    let rows;
    try{rows=await executeRead({id,sql,params});}catch{deny();}
    if(!Array.isArray(rows) || rows.length>max)deny();
    return rows;
  }
  async function allowed(userId){
    const rows=await query('workspaces',PRIVATE_READ_SQL.workspaces,[userId],26);
    if(rows.length>25 || rows.some(row=>!validWorkspace(row)))deny();
    const unique=new Set(rows.map(x=>x.workspace_id));
    if(unique.size!==rows.length)deny();
    return rows;
  }
  return Object.freeze({
    async listWorkspaces(authorization) {
      const userId=await actor(authorization);
      return Object.freeze({workspaces:await allowed(userId)});
    },
    async listRequests(authorization,workspaceId,limit=20,offset=0) {
      if(!WS.test(workspaceId||'') || !Number.isSafeInteger(limit) || limit<1 ||
         limit>50 || !Number.isSafeInteger(offset) || offset<0 || offset>950 ||
         offset%limit!==0)deny(400);
      const userId=await actor(authorization);
      if(!(await allowed(userId)).some(w=>w.workspace_id===workspaceId))deny(403);
      const rows=await query('requests',PRIVATE_READ_SQL.requests,
        [userId,workspaceId,limit,offset],limit);
      if(rows.some(row=>!validRequest(row,workspaceId)))deny();
      return Object.freeze({workspaceId,items:rows});
    }
  });
}
/** A hosted adapter is intentionally unavailable; do not replace this gate with an environment flag. */
export function createHostedPrivateReadAdapter(){deny();}
