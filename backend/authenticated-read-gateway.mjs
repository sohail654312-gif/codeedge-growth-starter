import {isSyntheticPrivateReadContract,PrivateReadDenied} from './private-read-adapter.mjs';
import {createServer} from 'node:http';
import {createPostgrestReadBoundary,PostgrestBoundaryError} from './postgrest-read-boundary.mjs';
import {createTrustedSessionGate} from './trusted-session-gate.mjs';

const ROUTES=new Set(['/v1/workspaces','/v1/requests']);
const WS=/^ws_[A-Za-z0-9_-]{8,128}$/;
function fail(){throw new Error('Authenticated staging gateway not approved for activation.');}
function originOf(value){
  try{
    const u=new URL(value);
    if(u.protocol!=='https:' || u.username || u.password || u.pathname!=='/' ||
       u.search || u.hash)fail();
    return u.origin;
  }catch{fail();}
}
function respond(res,status,payload,origin=null){
  res.writeHead(status,{
    'content-type':'application/json; charset=utf-8','cache-control':'no-store',
    'x-content-type-options':'nosniff','referrer-policy':'no-referrer',
    'content-security-policy':"default-src 'none'",
    ...(origin?{'access-control-allow-origin':origin,'vary':'Origin'}:{})
  });
  res.end(JSON.stringify(payload));
}
function permittedSearch(url,allowed){
  return Array.from(url.searchParams.keys()).every(k=>allowed.includes(k)) &&
         allowed.every(k=>url.searchParams.getAll(k).length<=1);
}
/**
 * REVIEW ONLY: source-level gateway; no production or staging server entrypoint
 * starts it. No fallback to the direct-PostgreSQL legacy reader exists.
 *
 * Explicit 'enableForSyntheticTesting' defaults false. This switch is NOT
 * evidence of owner approval or adequate hosted security. Never wire it into
 * the production hosting process before independent RLS, session and cutover
 * acceptance. checkAuthoritativeSession must be an isolated trusted provider,
 * not caller input or an always-true stub outside synthetic tests.
 */
function buildAuthenticatedGateway({
  projectUrl,publishableKey,allowedOrigin,checkAuthoritativeSession,
  fetchImpl=globalThis.fetch,now=()=>Date.now(),privateReader=null
}={}){
  const allowed=originOf(allowedOrigin);
  // Only the explicit synthetic-only constructor may inject a private reader.
  // Hosted construction is disabled until a non-bypassable Data API boundary
  // and independently accepted user-to-database-principal binding exist.
  const reader=privateReader ?? (()=>{
    const session=createTrustedSessionGate({projectUrl,checkAuthoritativeSession,now});
    return createPostgrestReadBoundary({
      projectUrl,publishableKey,fetchImpl,verifyCurrentSession:session.verifyCurrentSession
    });
  })();
  const handler=async(req,res)=>{
    const origin=req.headers.origin;
    const cors=typeof origin==='string' && origin===allowed?allowed:null;
    try{
      if(origin && !cors)return respond(res,403,{error:'Origin denied.'});
      if(!req.url || req.url.length>1200)return respond(res,400,{error:'Invalid path.'},cors);
      const url=new URL(req.url,'http://internal.invalid');
      if(req.method==='OPTIONS'){
        if(!cors)return respond(res,403,{error:'Origin required.'});
        if(!ROUTES.has(url.pathname) || url.search)
          return respond(res,404,{error:'Not found.'},cors);
        if(req.headers['access-control-request-method']!=='GET' ||
           (req.headers['access-control-request-headers']||'').toLowerCase().trim()!=='authorization')
          return respond(res,403,{error:'Preflight denied.'},cors);
        res.writeHead(204,{
          'access-control-allow-origin':cors,'access-control-allow-methods':'GET',
          'access-control-allow-headers':'Authorization','access-control-max-age':'300',
          'vary':'Origin, Access-Control-Request-Method, Access-Control-Request-Headers',
          'cache-control':'no-store','x-content-type-options':'nosniff'
        });
        return res.end();
      }
      if(req.method!=='GET')return respond(res,405,{error:'Read-only staging API.'},cors);
      if(url.pathname==='/healthz' && !url.search)
        return respond(res,200,{status:'ok',mode:'staging-read-only',security:'review-only'},cors);
      if(!ROUTES.has(url.pathname))return respond(res,404,{error:'Not found.'},cors);
      const bearer=req.headers.authorization;
      if(typeof bearer!=='string' || !bearer.startsWith('Bearer ') || bearer.length>12000)
        return respond(res,401,{error:'Authentication required.'},cors);
      if(url.pathname==='/v1/workspaces'){
        if(url.search)return respond(res,400,{error:'Unexpected query.'},cors);
        return respond(res,200,await reader.listWorkspaces(bearer),cors);
      }
      if(!permittedSearch(url,['workspaceId','limit','page']))
        return respond(res,400,{error:'Unexpected query.'},cors);
      const workspaceId=url.searchParams.get('workspaceId');
      if(!WS.test(workspaceId||''))return respond(res,400,{error:'Invalid workspace.'},cors);
      const rawLimit=url.searchParams.get('limit');
      const rawPage=url.searchParams.get('page');
      if(rawLimit!==null && !/^(?:[1-9]|[1-4][0-9]|50)$/.test(rawLimit))
        return respond(res,400,{error:'Invalid limit.'},cors);
      if(rawPage!==null && !/^(?:0|[1-9]|1[0-9])$/.test(rawPage))
        return respond(res,400,{error:'Invalid page.'},cors);
      const limit=rawLimit===null?20:Number(rawLimit);
      const page=rawPage===null?0:Number(rawPage);
      const result=await reader.listRequests(bearer,workspaceId,limit,page*limit);
      return respond(res,200,{...result,page,nextPage:result.items.length===limit && page<19?page+1:null},cors);
    }catch(error){
      if(error instanceof PostgrestBoundaryError || error instanceof PrivateReadDenied){
        const status=[400,401,403].includes(error.status)?error.status:503;
        return respond(res,status,{error:status===401?'Authentication required.':
          status===403?'Workspace access denied.':status===400?'Invalid request.':'Read boundary unavailable.'},cors);
      }
      return respond(res,503,{error:'Read boundary unavailable.'},cors);
    }
  };
  return Object.freeze({handler,createServer:()=>createServer(handler)});
}

/** Existing synthetic-only fixture path remains explicitly disabled by default. */
export function createAuthenticatedReadGateway({enableForSyntheticTesting=false,...options}={}){
  if(enableForSyntheticTesting!==true)fail();
  return buildAuthenticatedGateway(options);
}

/**
 * Phase 3.11: real HTTP wiring of the synthetic-only private SQL contract.
 * This exposes no hosted factory, database credentials, or PostgREST access.
 * The synthetic reader brand cannot be supplied by an arbitrary plain object.
 */
export function createSyntheticPrivateSqlReadGateway({
  fictionalTestOnly=false,reader,allowedOrigin
}={}){
  if(fictionalTestOnly!==true || !isSyntheticPrivateReadContract(reader))fail();
  return buildAuthenticatedGateway({allowedOrigin,privateReader:reader});
}

/**
 * Phase 3.11 permanent cutover gate: the previous hosted factory could
 * construct a PostgREST reader after an otherwise valid Auth checker
 * preflight. A revoked bearer could bypass the Node gateway by calling
 * exposed /rest/v1 tables directly, so that path is no longer activatable.
 * A future hosted factory requires independent Data API readback/lockdown,
 * provider current-session authority and DB-enforced tenant identity binding.
 */
export function createHostedAuthenticatedReadGateway(){
  fail();
}
