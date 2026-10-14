// Same-origin cookie API; never handles Supabase bearer or refresh tokens.
export class PrivateWorkspaceError extends Error{
 constructor(status){super(status===401?'Sign in to continue.':status===403?'This workspace is unavailable.':status===409?'This item changed. Refresh before saving.':'Unable to complete the request. Try again.');this.status=status;}
}
export function createPrivateWorkspaceClient({origin=globalThis.location?.origin,fetchImpl=globalThis.fetch,getCsrf=()=>{
 const values=globalThis.document?.cookie.split(';').map(x=>x.trim()).filter(x=>x.startsWith('__Host-ce_csrf='))||[];
 return values.length===1?values[0].slice('__Host-ce_csrf='.length):null;
}}={}){
 const u=new URL(origin);if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash||typeof fetchImpl!=='function')throw new PrivateWorkspaceError(503);
 async function request(path,{method='GET',body,csrf}={}){
  const headers={accept:'application/json'};
  if(method==='POST'){
   const value=csrf??getCsrf();if(!/^[A-Za-z0-9_-]{43}$/.test(value||''))throw new PrivateWorkspaceError(403);
   headers['x-csrf-token']=value;if(body!==undefined)headers['content-type']='application/json';
  }
  const controller=new AbortController();let timer;
  try{
   // Includes response streaming, not just receiving HTTP headers.
   const data=await Promise.race([(async()=>{
    const res=await fetchImpl(u.origin+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),
     credentials:'same-origin',cache:'no-store',redirect:'error',signal:controller.signal});
    if(![200,202,204].includes(res.status))throw new PrivateWorkspaceError([401,403,409].includes(res.status)?res.status:503);
    if(res.status===204)return null;
    if(!res.body?.getReader)throw new PrivateWorkspaceError(503);
    const reader=res.body.getReader(),parts=[];let size=0;
    try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>131072)throw Error();parts.push(value);}}
    finally{await reader.cancel().catch(()=>{});}
    const bytes=new Uint8Array(size);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.byteLength;}
    return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
   })(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new PrivateWorkspaceError(503)),7000);})]);
   return data;
  }catch(e){if(e instanceof PrivateWorkspaceError)throw e;throw new PrivateWorkspaceError(503);}
  finally{clearTimeout(timer);controller.abort();}
 }
 const workspace=v=>{if(typeof v!=='string'||! /^ws_[A-Za-z0-9_-]{8,128}$/.test(v))throw new PrivateWorkspaceError(403);return v;};
 const record=v=>{if(typeof v!=='string'||! /^[A-Za-z0-9_-]{1,128}$/.test(v))throw new PrivateWorkspaceError(403);return v;};
 const query=(ws,extra={})=>'?'+new URLSearchParams({workspaceId:workspace(ws),...Object.fromEntries(Object.entries(extra).filter(([,v])=>v!=null&&v!==''))});
 const write=(path,ws,body)=>request('/v1/operations/'+path+(ws?query(ws):''),{method:'POST',body});
 return Object.freeze({
  async login(email){const flow=await request('/auth/start');return request('/auth/start',{method:'POST',body:{email},csrf:flow.csrfToken});},
  logout:()=>request('/auth/logout',{method:'POST'}),onboard:()=>write('onboard',null,{}),
  async workspaces(){
   const result=await request('/v1/operations/workspaces');
   if(!Array.isArray(result?.workspaces)||result.workspaces.length>25||result.workspaces.some(w=>
    ! /^ws_[A-Za-z0-9_-]{8,128}$/.test(w?.workspaceId||'')||!['owner','agency_admin','staff','client'].includes(w.role)||typeof w.name!=='string'||w.name.length>90))throw new PrivateWorkspaceError(503);
   return result;
  },
  authorize:ws=>request('/v1/operations/authorize'+query(ws)),profile:ws=>request('/v1/operations/profile'+query(ws)),
  list:(ws,filters={})=>request('/v1/operations/requests'+query(ws,filters)),
  detail:(ws,id)=>request('/v1/operations/requests/'+record(id)+query(ws)),
  history:(ws,filters={})=>request('/v1/operations/history'+query(ws,filters)),
  saveProfile:(ws,fields,version,idempotencyKey)=>write('profile',ws,{fields,version,idempotencyKey}),
  createRequest:(ws,fields,idempotencyKey)=>write('requests',ws,{fields,idempotencyKey}),
  assign:(ws,id,assignedTo,dueDate,version,idempotencyKey)=>write('requests/'+record(id)+'/assignment',ws,{assignedTo,dueDate,version,idempotencyKey}),
  review:(ws,id,status,version,idempotencyKey)=>write('requests/'+record(id)+'/review',ws,{status,version,idempotencyKey}),
  decision:(ws,id,status,note,version,idempotencyKey)=>write('requests/'+record(id)+'/decision',ws,{status,note,version,idempotencyKey}),
  correction:(ws,id,note,version,idempotencyKey)=>write('requests/'+record(id)+'/correction',ws,{note,version,idempotencyKey}),
  revokeMember:(ws,userId,idempotencyKey)=>write('members/revoke',ws,{userId,idempotencyKey}),
  deleteMedia:(ws,id,idempotencyKey)=>write('media/'+record(id)+'/delete',ws,{idempotencyKey})
 });
}
