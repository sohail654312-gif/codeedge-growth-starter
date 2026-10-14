/**
 * Phase 3.15G — production-shaped Supabase Auth PKCE HTTP adapter.
 *
 * This adapter can only be composed by an explicitly reviewed server runtime.
 * It is NOT imported by any hosted or app entrypoint; hosted factories remain
 * disabled. No service_role or secret key is accepted. The initial PKCE code
 * must be obtained by the separate trusted flow (Phase 3.15D).
 * The adapter NEVER treats a still-valid JWT as a fresh login code.
 */
const PROVIDER_KEY=/^sb_publishable_[A-Za-z0-9_-]{16,}$/;
const PKCE_CODE=/^[A-Za-z0-9_-]{16,512}$/;
const PKCE_VERIFIER=/^[A-Za-z0-9._~-]{43,128}$/;
const TOKEN_PART=/^[A-Za-z0-9_-]+$/;
const BAD='Supabase PKCE exchange denied.';
const OUTAGE='Supabase Auth service unavailable.';
function bad(){throw Error(BAD);}
function outage(){throw Error(OUTAGE);}
function jsonResponse(response){
 if(!response || !Number.isInteger(response.status)||
    typeof response.text!=='function')outage();
 if(response.status===400||response.status===401||response.status===403)bad();
 if(response.status!==200)outage();
 return response.text().then(raw=>{
  if(typeof raw!=='string'||raw.length>32768)outage();
  try{
   const value=JSON.parse(raw);
   if(!value||typeof value!=='object'||Array.isArray(value))bad();
   return value;
  }catch(e){if(e?.message===BAD)throw e;outage();}
 });
}
function trustedOrigins(projectUrl,callbackUrl){
 try{
  const project=new URL(projectUrl),app=new URL(callbackUrl);
  if(project.protocol!=='https:'||project.username||project.password||
    project.pathname!=='/'||project.search||project.hash||
    !/^[a-z0-9-]+\.supabase\.co$/i.test(project.hostname)||
    app.protocol!=='https:'||app.username||app.password||
    app.pathname!=='/auth/callback'||app.search||app.hash)bad();
  return {provider:project.origin,redirectTo:app.toString()};
 }catch{bad();}
}
function tokenCheck(token){
 if(typeof token!=='string'||token.length>12000)bad();
 const p=token.split('.');
 if(p.length!==3||!p.every(x=>TOKEN_PART.test(x)))bad();
 return token;
}
export function createSupabasePkceHttpAdapter({
 projectUrl,callbackUrl,publishableKey,fetchImpl,timeoutMs=4000
}={}){
 const {provider,redirectTo}=trustedOrigins(projectUrl,callbackUrl);
 if(typeof publishableKey!=='string'||!PROVIDER_KEY.test(publishableKey)||
    publishableKey.includes('\n')||typeof fetchImpl!=='function'||
    !Number.isInteger(timeoutMs)||timeoutMs<250||timeoutMs>10000)
   throw Error('Trusted Supabase PKCE adapter configuration required.');
 const apikey=publishableKey;
 async function request(url,options){
  try{return await fetchImpl(url,{
   ...options,redirect:'error',cache:'no-store',credentials:'omit',
   signal:AbortSignal.timeout(timeoutMs)
  });}catch{outage();}
 }
 return Object.freeze({
  status:'provider_http_adapter_unwired_to_hosted_entrypoints',
  async sendLoginEmail({email,codeChallenge,state}={}){
   if(typeof email!=='string'||email.length>254||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||
      !/^[A-Za-z0-9_-]{43}$/.test(codeChallenge||'')||
      !/^[A-Za-z0-9_-]{43}$/.test(state||''))bad();
   const callback=new URL(redirectTo);callback.searchParams.set('state',state);
   const response=await request(provider+'/auth/v1/otp?redirect_to='+encodeURIComponent(callback.href),{
    method:'POST',headers:{apikey,'content-type':'application/json',accept:'application/json'},
    body:JSON.stringify({email,create_user:false,code_challenge:codeChallenge,
     code_challenge_method:'s256'})
   });
   // Provider errors are not an account-existence oracle for the browser.
   await jsonResponse(response);
   return Object.freeze({requested:true});
  },
  async exchangeAuthCode({code,codeVerifier,redirectTo:requestedRedirect}={}){
   if(typeof code!=='string'||!PKCE_CODE.test(code)||
      typeof codeVerifier!=='string'||!PKCE_VERIFIER.test(codeVerifier)||
      requestedRedirect!==redirectTo)bad();
   const body=JSON.stringify({auth_code:code,code_verifier:codeVerifier});
   const response=await request(provider+'/auth/v1/token?grant_type=pkce',{
    method:'POST',
    headers:{apikey,'content-type':'application/json','accept':'application/json'},
    body
   });
   const data=await jsonResponse(response);
   if(data.token_type!=='bearer'||!Number.isFinite(data.expires_in)||
      data.expires_in<=0||data.expires_in>3600)bad();
   // Never return refresh_token, provider_token or other high-value fields.
   return Object.freeze({accessToken:tokenCheck(data.access_token)});
  },
  async verifyUser({accessToken}={}){
   const jwt=tokenCheck(accessToken);
   const response=await request(provider+'/auth/v1/user',{
    method:'GET',headers:{apikey,authorization:'Bearer '+jwt,
      accept:'application/json'}
   });
   const data=await jsonResponse(response);
   if(typeof data.id!=='string'||!data.id||
      typeof data.email!=='string'||!data.email||
      !data.email_confirmed_at||data.is_anonymous===true||
      data.deleted_at!=null||data.banned_until!=null&&
      Date.parse(data.banned_until)>Date.now())bad();
   // Only return the minimum provider-verified fields the bridge uses.
   return Object.freeze({id:data.id,email:data.email,
    email_confirmed_at:data.email_confirmed_at,
    is_anonymous:data.is_anonymous===true,
    ...(data.deleted_at==null?{}:{deleted_at:data.deleted_at}),
    ...(data.banned_until==null?{}:{banned_until:data.banned_until})});
  }
 });
}
