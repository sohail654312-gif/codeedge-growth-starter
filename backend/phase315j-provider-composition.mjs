/**
 * Phase 3.15J — source-only composition of the real Supabase PKCE HTTP
 * protocol adapter, fictional login verifier, Codeedge sessions and HTTPS
 * cookies. No live client/auth account or network deployment permitted.
 *
 * This intentionally runs ONLY inside disposable PG17 tests. It does NOT
 * implement login initiation, registered Supabase redirect allowlists,
 * production secrets, provider-global revocation, or a hosted entrypoint.
 */
import {createSupabasePkceHttpAdapter}
 from './phase315g-supabase-pkce-adapter.mjs';
import {createDisposableFreshLoginBridge}
 from './phase315d-fresh-login.mjs';
import {createDisposableCodeedgeSessionProof}
 from './codeedge-session-proof.mjs';
import {createDisposableHttpsCookieGateway}
 from './phase315e-https-cookies.mjs';

export function createHostedPhase315jGateway(){
 throw Error('Phase 3.15J hosted activation unavailable without staged acceptance.');
}
export function createDisposablePhase315jProviderComposition({
 pool,projectUrl,appOrigin,publishableKey,fetchImpl,csrfSigningKey,
 fictionalTestOnly=false
}={}){
 if(fictionalTestOnly!==true||!process.env.TEST_DATABASE_URL||
    typeof appOrigin!=='string')throw Error('Disposable-only provider composition.');
 let callbackUrl;
 try{
  const app=new URL(appOrigin);
  if(app.protocol!=='https:'||app.pathname!=='/'||app.search||app.hash||
     app.username||app.password)throw Error();
  callbackUrl=app.origin+'/auth/callback';
 }catch{throw Error('Trusted HTTPS app origin required.');}
 const provider=createSupabasePkceHttpAdapter({
  projectUrl,callbackUrl,publishableKey,fetchImpl
 });
 const bridge=createDisposableFreshLoginBridge({
  pool,projectUrl,allowedOrigin:appOrigin,
  exchangeAuthCode:provider.exchangeAuthCode,
  verifyUser:provider.verifyUser,fictionalTestOnly:true
 });
 const authority=createDisposableCodeedgeSessionProof({
  pool,verifyFreshLogin:bridge.consumeFreshProof,fictionalTestOnly:true
 });
 const {handler}=createDisposableHttpsCookieGateway({
  bridge,authority,appOrigin,csrfSigningKey,fictionalTestOnly:true
 });
 return Object.freeze({
  handler,bridge,authority,
  status:'test_only_provider_adapter_not_deployed',
  mayDeploy:false
 });
}
