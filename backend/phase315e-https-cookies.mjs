/**
 * Phase 3.15E — synthetic-only HTTPS callback and cookie/CSRF boundary.
 * No hosted listener or real Supabase provider adapter is enabled.
 */
import {createHmac,timingSafeEqual} from 'node:crypto';
const FLOW='__Host-ce_flow',SESSION='__Host-ce_session',CSRF='__Host-ce_csrf';
const OPAQUE=/^[A-Za-z0-9_-]{43}$/;
const TOKEN=/^ce1\.[a-f0-9-]{36}\.[A-Za-z0-9_-]{43}$/i;
const CODE=/^[A-Za-z0-9_.~-]{16,512}$/;
const WS=/^ws_[A-Za-z0-9_-]{8,128}$/;
const HEADERS=Object.freeze({
 'cache-control':'private, no-store, max-age=0','pragma':'no-cache',
 'expires':'0','content-type':'application/json; charset=utf-8',
 'x-content-type-options':'nosniff','referrer-policy':'no-referrer',
 'content-security-policy':"default-src 'none'; base-uri 'none'; frame-ancestors 'none'",
 'strict-transport-security':'max-age=31536000','vary':'Cookie',
 'x-frame-options':'DENY'
});
function blocked(){throw Error('Hosted HTTPS gateway unavailable until provider and tenant acceptance.');}
function equal(a,b){
 if(typeof a!=='string'||typeof b!=='string')return false;
 const x=Buffer.from(a,'utf8'),y=Buffer.from(b,'utf8');
 return x.length===y.length&&timingSafeEqual(x,y);
}
function cookiesOf(raw){
 if(raw===undefined)return new Map();
 if(typeof raw!=='string'||raw.length>8192)throw Error('Invalid cookie header');
 const out=new Map();
 for(const part of raw.split(';')){
  const item=part.trim();if(!item)continue;
  const idx=item.indexOf('=');
  if(idx<1)throw Error('Invalid cookie header');
  const k=item.slice(0,idx).trim(),v=item.slice(idx+1);
  if(!/^[A-Za-z0-9_!#$%&'*+.^|~-]+$/.test(k)||
     !/^[\x21-\x7e]*$/.test(v)||out.has(k))throw Error('Invalid cookie header');
  out.set(k,v);
 }
 return out;
}
function csrfFor(key,token){
 return createHmac('sha256',key).update('codeedge-growth-starter:csrf:v1\0')
  .update(token).digest('base64url');
}
function cookie(name,value,{httpOnly=true,ttl=0}={}){
 return name+'='+value+'; Path=/; Secure; SameSite=Lax'+
  (httpOnly?'; HttpOnly':'')+'; Max-Age='+ttl;
}
function response(res,status,body=null,{setCookies=null,location=null}={}){
 res.writeHead(status,{...HEADERS,...(setCookies?{'set-cookie':setCookies}:{}),
  ...(location?{location}:{}),...(status===204?{'content-length':'0'}:{})});
 if(status===204||status===303)return res.end();
 return res.end(JSON.stringify(body??{error:'Request denied.'}));
}
export function createHostedHttpsCookieGateway(){blocked();}
export function createDisposableHttpsCookieGateway({
 bridge,authority,appOrigin,csrfSigningKey,fictionalTestOnly=false
}={}){
 if(fictionalTestOnly!==true||!process.env.TEST_DATABASE_URL||
    !bridge||typeof bridge.begin!=='function'||typeof bridge.completeAndIssue!=='function'||
    !authority||typeof authority.issue!=='function'||
    typeof authority.withAuthorizedRead!=='function'||typeof authority.revoke!=='function'||
    !Buffer.isBuffer(csrfSigningKey)||csrfSigningKey.length<32)blocked();
 return createPrivateHttpsCookieHandler({bridge,authority,appOrigin,csrfSigningKey});
}
// Transport shared with the real restricted SQL adapter. Legacy hosted
// factories stay disabled; this function does not create a listener.
export function createPrivateHttpsCookieHandler({bridge,authority,appOrigin,csrfSigningKey,
 emailLogin=false,operations=null,secureIngress=req=>req.socket?.encrypted===true}={}){
 if(!bridge||typeof bridge.begin!=='function'||typeof bridge.completeAndIssue!=='function'||
    !authority||typeof authority.withAuthorizedRead!=='function'||typeof authority.revoke!=='function'||
    !Buffer.isBuffer(csrfSigningKey)||csrfSigningKey.length<32||typeof secureIngress!=='function')blocked();
 let origin,host;
 try{
  const u=new URL(appOrigin);
  if(u.protocol!=='https:'||u.pathname!=='/'||u.search||u.hash||
     u.username||u.password)blocked();
  origin=u.origin;host=u.host;
 }catch{blocked();}
 const handler=async(req,res)=>{
  // Default is direct TLS. A production proxy adapter must authenticate the
  // actual socket peer; forwarded headers alone are never sufficient.
  if(secureIngress(req)!==true||req.headers.host!==host)
   return response(res,421,{error:'HTTPS origin required.'});
  if(typeof req.url!=='string'||req.url.length>1800)return response(res,400);
  let url,jar;
  try{
   url=new URL(req.url,origin);
   if(url.origin!==origin)throw Error();
   jar=cookiesOf(req.headers.cookie);
  }catch{return response(res,400);}
  if(req.headers.origin!==undefined&&req.headers.origin!==origin)
   return response(res,403);
  const site=req.headers['sec-fetch-site'];
  const sameSite=site===undefined||site==='same-origin'||site==='none';
  const {pathname,searchParams}=url;
  if(pathname==='/auth/start'&&req.method==='GET'){
   if(url.search||!sameSite)return response(res,403);
   if(jar.has(SESSION))return response(res,409,{error:'Sign out before changing accounts.'});
   if(emailLogin){
    const nonce=(await import('node:crypto')).randomBytes(32).toString('base64url');
    const csrf=csrfFor(csrfSigningKey,nonce);
    return response(res,200,{csrfToken:csrf},{setCookies:[cookie(FLOW,nonce,{ttl:300})]});
   }
   try{
    const flow=await bridge.begin();
    if(!OPAQUE.test(flow.state)||!OPAQUE.test(flow.browserBinding)||
       !OPAQUE.test(flow.codeChallenge)||flow.codeChallengeMethod!=='S256'||
       flow.redirectTo!==origin+'/auth/callback')throw Error();
    return response(res,200,{state:flow.state,
     codeChallenge:flow.codeChallenge,codeChallengeMethod:'S256',
     redirectTo:flow.redirectTo},{
      setCookies:[cookie(FLOW,flow.browserBinding,{ttl:300})]});
   }catch{return response(res,503,{error:'Login unavailable.'});}
  }
  if(emailLogin&&pathname==='/auth/start'&&req.method==='POST'){
   const nonce=jar.get(FLOW);
   if(url.search||req.headers.origin!==origin||!sameSite||jar.has(SESSION)||
      !OPAQUE.test(nonce||'')||!equal(req.headers['x-csrf-token'],csrfFor(csrfSigningKey,nonce)))
     return response(res,403);
   if(req.headers['content-type']!=='application/json'||req.headers['transfer-encoding']!==undefined||
      !/^[1-9][0-9]{0,3}$/.test(req.headers['content-length']||'')||
      Number(req.headers['content-length'])>1024)return response(res,400);
   let body;
   try{
    let raw='';req.setTimeout?.(4000,()=>req.destroy());
    for await(const chunk of req){raw+=chunk.toString('utf8');if(Buffer.byteLength(raw)>1024)throw Error();}
    body=JSON.parse(raw);
    if(!body||Array.isArray(body)||Object.keys(body).length!==1||
       typeof body.email!=='string'||body.email.length>254||
       !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email))throw Error();
   }catch{return response(res,400);}
   try{
    const flow=await bridge.begin({email:body.email});
    if(!OPAQUE.test(flow.browserBinding||''))throw Error();
    return response(res,202,{message:'If eligible, check your email to continue.'},
     {setCookies:[cookie(FLOW,flow.browserBinding,{ttl:300})]});
   }catch{return response(res,503,{error:'Login unavailable. Retry later.'});}
  }
  if(pathname==='/auth/callback'&&req.method==='GET'){
   const bad=()=>response(res,303,null,{
    setCookies:[cookie(FLOW,'',{ttl:0})],location:'/login?auth=failed'});
   if(searchParams.size!==2||searchParams.getAll('state').length!==1||
      searchParams.getAll('code').length!==1||
      !OPAQUE.test(searchParams.get('state')||'')||
      !CODE.test(searchParams.get('code')||'')||
      !OPAQUE.test(jar.get(FLOW)||'')||jar.has(SESSION))return bad();
   try{
    const issued=await bridge.completeAndIssue({
     state:searchParams.get('state'),browserBinding:jar.get(FLOW),
     authCode:searchParams.get('code')
    },authority.issue);
    const token=issued?.token,expires=Date.parse(issued?.expiresAt);
    const ttl=Math.floor((expires-Date.now())/1000);
    if(!TOKEN.test(token||'')||!Number.isFinite(expires)||
       ttl<1||ttl>1800)throw Error('Untrusted issued session');
    return response(res,303,null,{location:'/dashboard',setCookies:[
     cookie(FLOW,'',{ttl:0}),cookie(SESSION,token,{ttl}),
     cookie(CSRF,csrfFor(csrfSigningKey,token),{httpOnly:false,ttl})
    ]});
   }catch{return bad();}
  }
  if(pathname==='/auth/logout'&&req.method==='POST'){
   if(url.search||req.headers.origin!==origin||!sameSite)
    return response(res,403);
   if(req.headers['transfer-encoding']!==undefined||
      req.headers['content-length']!==undefined&&req.headers['content-length']!=='0')
    return response(res,400);
   const token=jar.get(SESSION),csrf=jar.get(CSRF);
   if(!TOKEN.test(token||'')||!equal(csrf,csrfFor(csrfSigningKey,token))||
      !equal(req.headers['x-csrf-token'],csrf))return response(res,403);
   try{
    const result=await authority.revoke({token});
    if(result?.revoked!==true)throw Error();
    return response(res,204,null,{setCookies:[
     cookie(SESSION,'',{ttl:0}),cookie(CSRF,'',{httpOnly:false,ttl:0}),
     cookie(FLOW,'',{ttl:0})
    ]});
   }catch{return response(res,503,{error:'Revocation unavailable. Retry logout.'});}
  }
  if(pathname==='/v1/requests'&&req.method==='GET'){
   if(!sameSite||searchParams.size<1||searchParams.size>2||
      searchParams.getAll('workspaceId').length!==1||
      searchParams.getAll('limit').length>1||
      !Array.from(searchParams.keys()).every(k=>k==='workspaceId'||k==='limit'))
    return response(res,400);
   const workspaceId=searchParams.get('workspaceId');
   const limit=searchParams.get('limit');
   if(!WS.test(workspaceId||'')||
      limit!==null&&!/^(?:[1-9]|[1-4]\d|50)$/.test(limit))return response(res,400);
   const token=jar.get(SESSION);
   if(!TOKEN.test(token||''))return response(res,401);
   try{
    const items=await authority.withAuthorizedRead({token,workspaceId},
     reader=>reader.listRequests(limit===null?20:Number(limit)));
    return response(res,200,{items});
   }catch{return response(res,403,{error:'Session or workspace denied.'});}
  }
  if(pathname.startsWith('/v1/operations/')){
   if(!sameSite)return response(res,403);
   if(operations?.capabilities?.fixedPurpose!==true||typeof operations.run!=='function')
    return response(res,503,{error:'Private operations unavailable.'});
   const token=jar.get(SESSION);if(!TOKEN.test(token||''))return response(res,401);
   const reads={'workspaces':'workspaces','authorize':'authorize','profile':'profile','requests':'list','history':'history'};
   const writes={'onboard':'onboard','profile':'saveProfile','requests':'createRequest','members/revoke':'revokeMember'};
   const part=pathname.slice('/v1/operations/'.length),detail=/^requests\/([A-Za-z0-9_-]{1,128})$/.exec(part),
    transition=/^requests\/([A-Za-z0-9_-]{1,128})\/(assignment|review|decision|correction)$/.exec(part),
    media=/^media\/([A-Za-z0-9_-]{1,128})\/delete$/.exec(part);
   let action,input={};
   if(req.method==='GET'){
    action=reads[part]||(detail?'detail':null);if(detail)input.id=detail[1];
   }else if(req.method==='POST'){
    // Session-bound double submit plus exact Origin, before body/SQL work.
    const csrf=jar.get(CSRF);
    if(req.headers.origin!==origin||!equal(csrf,csrfFor(csrfSigningKey,token))||!equal(req.headers['x-csrf-token'],csrf))return response(res,403);
    action=writes[part]||(transition?{assignment:'assign',review:'review',decision:'decision',correction:'correction'}[transition[2]]:media?'mediaDelete':null);
    if(req.headers['content-type']!=='application/json'||req.headers['transfer-encoding']!==undefined||
     !/^[1-9]\d{0,4}$/.test(req.headers['content-length']||'')||Number(req.headers['content-length'])>8192)return response(res,400);
    try{
     const chunks=[];let bytes=0;req.setTimeout?.(4000,()=>req.destroy());
     for await(const chunk of req){const b=Buffer.from(chunk);bytes+=b.length;if(bytes>8192)throw Error();chunks.push(b);}
     if(bytes!==Number(req.headers['content-length']))throw Error();
     input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
     if(!input||Array.isArray(input)||typeof input!=='object')throw Error();
     // Caller actor/role/token fields never become trusted context.
     delete input.actor;delete input.role;delete input.token;delete input.workspaceId;
     if(transition)input.id=transition[1];if(media)input.id=media[1];
    }catch{return response(res,400);}
   }
   if(!action)return response(res,404);
   const keys=action==='list'?['workspaceId','limit','cursor','status','kind','assignedTo']:
    action==='history'?['workspaceId','limit','cursor']:['onboard','workspaces'].includes(action)?[]:['workspaceId'];
   if(Array.from(searchParams.keys()).some(k=>!keys.includes(k)||searchParams.getAll(k).length!==1)||
    !['onboard','workspaces'].includes(action)&&!WS.test(searchParams.get('workspaceId')||''))return response(res,400);
   try{
    const result=await operations.run({token,workspaceId:searchParams.get('workspaceId'),action,input,query:Object.fromEntries(searchParams)});
    return response(res,200,result);
   }catch(e){
    const status=[400,401,403,404,409].includes(e?.status)?e.status:503;
    return response(res,status,{error:status===409?'Version or idempotency conflict; refresh before saving.':status===503?'Private operation unavailable.':'Operation denied.'},
     {setCookies:status===401?[cookie(SESSION,'',{ttl:0}),cookie(CSRF,'',{httpOnly:false,ttl:0}),cookie(FLOW,'',{ttl:0})]:null});
   }
  }
  return response(res,404);
 };
 return Object.freeze({handler,status:'test_only_not_hosted'});
}
