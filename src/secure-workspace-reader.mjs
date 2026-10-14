/**
 * Opt-in client-facing contract for future approved Growth Starter HTTPS API.
 * Not imported by App.tsx until hosted JWT/RLS/role acceptance has passed.
 * This adapter is presentation logic only. Server-side RLS is authoritative.
 */
const WORKSPACE=/^ws_[A-Za-z0-9_-]{8,128}$/;
const ROLES=new Set(['owner','agency_admin','staff','client']);
export class WorkspaceReadError extends Error {
  constructor(kind){super(kind==='SESSION_EXPIRED'?'Sign in again to view this workspace.':
    kind==='ACCESS_DENIED'?'This workspace is not available.':'Unable to load workspace.');
    this.kind=kind;}
}
function urlOrigin(value){
 try{
  const u=new URL(value);
  if(u.protocol!=='https:' || u.username || u.password || u.pathname!=='/' ||
     u.search || u.hash)throw Error();
  return u.origin;
 }catch{throw new WorkspaceReadError('UNAVAILABLE');}
}
export function createSecureWorkspaceReader({gatewayUrl,getAccessToken,onSessionExpired=()=>{},fetchImpl=globalThis.fetch}={}){
 const origin=urlOrigin(gatewayUrl);
 if(typeof getAccessToken!=='function' || typeof fetchImpl!=='function' ||
    typeof onSessionExpired!=='function')throw new WorkspaceReadError('UNAVAILABLE');
 async function request(path){
  let bearer;
  try{bearer=await getAccessToken();}catch{throw new WorkspaceReadError('SESSION_EXPIRED');}
  if(typeof bearer!=='string' || bearer.length<30 || bearer.length>12000 ||
     bearer.split('.').length!==3)throw new WorkspaceReadError('SESSION_EXPIRED');
  let res;
  try{
   res=await fetchImpl(origin+path,{method:'GET',redirect:'error',
    headers:{authorization:'Bearer '+bearer,accept:'application/json'},
    signal:AbortSignal.timeout(5000)});
  }catch{throw new WorkspaceReadError('UNAVAILABLE');}
  if(res.status===401){onSessionExpired();throw new WorkspaceReadError('SESSION_EXPIRED');}
  if(res.status===403)throw new WorkspaceReadError('ACCESS_DENIED');
  if(res.status!==200)throw new WorkspaceReadError('UNAVAILABLE');
  try{return await res.json();}catch{throw new WorkspaceReadError('UNAVAILABLE');}
 }
 async function listWorkspaces(){
  const data=await request('/v1/workspaces');
  if(!Array.isArray(data?.workspaces) || data.workspaces.length>25)
   throw new WorkspaceReadError('UNAVAILABLE');
  const seen=new Set();
  return data.workspaces.map(w=>{
   if(!WORKSPACE.test(w?.workspace_id||'') || !ROLES.has(w.role) || seen.has(w.workspace_id))
    throw new WorkspaceReadError('UNAVAILABLE');
   seen.add(w.workspace_id);
   return Object.freeze({workspaceId:w.workspace_id,role:w.role});
  });
 }
 return Object.freeze({
  listWorkspaces,
  async listRequests(workspaceId,{page=0,limit=20}={}){
   if(!WORKSPACE.test(workspaceId||'') || !Number.isInteger(page) || page<0 || page>19 ||
      !Number.isInteger(limit) || limit<1 || limit>50)
    throw new WorkspaceReadError('ACCESS_DENIED');
   // Re-check the allowed list each time. It is NOT a permanent cached
   // authorization grant; server-side RLS still revalidates every query.
   if(!(await listWorkspaces()).some(w=>w.workspaceId===workspaceId))
    throw new WorkspaceReadError('ACCESS_DENIED');
   const path='/v1/requests?'+new URLSearchParams({workspaceId,page:String(page),limit:String(limit)});
   const data=await request(path);
   if(data?.workspaceId!==workspaceId || !Array.isArray(data.items) ||
      data.items.length>limit || data.page!==page ||
      (data.nextPage!==null && (!Number.isInteger(data.nextPage) || data.nextPage!==page+1)))
    throw new WorkspaceReadError('UNAVAILABLE');
   for(const row of data.items){
    if(row?.workspace_id!==workspaceId || typeof row.id!=='string' ||
       !/^[A-Za-z0-9_-]{1,128}$/.test(row.id) || typeof row.title!=='string' ||
       row.title.length>100)throw new WorkspaceReadError('UNAVAILABLE');
   }
   return Object.freeze({workspaceId,page,nextPage:data.nextPage,items:data.items});
  }
 });
}
