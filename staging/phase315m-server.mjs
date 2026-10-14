/** Separate HTTPS staging listener. AppDeploy backend/index.ts is preserved.
 * Requires approved real exact-session authority injection; CLI deliberately
 * refuses to invent a provider authority or weaken the revocation contract.
 */
import {createServer as createHttpsServer} from 'node:https';
import {createServer as createHttpServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import pg from 'pg';
const {Pool}=pg;
import {readPhase315mConfig,createPhase315mIngress} from './phase315m-config.mjs';
import {createSupabasePkceHttpAdapter} from '../backend/phase315g-supabase-pkce-adapter.mjs';
import {createPhase315mPrivateRuntime} from '../backend/phase315m-private-runtime.mjs';
import {createBoundedShutdown} from './bounded-shutdown.mjs';
export async function startPhase315mStaging({env=process.env,evidence,checkProviderSession,
 poolFactory=opts=>new Pool(opts),fetchImpl=globalThis.fetch}={}){
 const config=readPhase315mConfig(env,evidence);
 if(typeof checkProviderSession!=='function')throw Error('Supported exact provider-session authority required.');
 const options=url=>({connectionString:url,ssl:{ca:config.caPem,rejectUnauthorized:true},
 max:2,connectionTimeoutMillis:3500,idleTimeoutMillis:10000,
 query_timeout:6500,statement_timeout:5000,idle_in_transaction_session_timeout:10000,
 application_name:'growth_starter_private_session_runtime'});
 const issuerPool=poolFactory(options(config.databaseUrls.issuer));
 const gatewayPool=poolFactory(options(config.databaseUrls.gateway));
 let server;
 try{
  const provider=createSupabasePkceHttpAdapter({projectUrl:config.projectUrl,
   callbackUrl:config.appOrigin+'/auth/callback',publishableKey:config.publishableKey,fetchImpl});
  const runtime=await createPhase315mPrivateRuntime({issuerPool,gatewayPool,provider,
   projectUrl:config.projectUrl,appOrigin:config.appOrigin,
   csrfSigningKey:readFileSync(config.csrfKeyPath),checkProviderSession,secureIngress:createPhase315mIngress(config)});
  const handle=(req,res)=>{
    // Public liveness does not validate authentication or expose tenant data.
    if(req.method==='GET'&&req.url==='/health'){
     res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
     return res.end('{"status":"listening","hostedAcceptance":"pending"}');
    }
    runtime.handler(req,res).catch(()=>{
     if(!res.headersSent){res.writeHead(503,{'cache-control':'no-store'});res.end();}
     else res.destroy();
    });
   };
  server=config.ingressMode==='direct_tls'?
   createHttpsServer({cert:readFileSync(config.certPath),key:readFileSync(config.keyPath),minVersion:'TLSv1.2'},handle):
   createHttpServer(handle);
  server.headersTimeout=5000;server.requestTimeout=10000;server.maxHeadersCount=40;
  await new Promise((ok,no)=>{server.once('error',no);server.listen(config.port,config.bindHost,ok);});
  return {server,close:createBoundedShutdown({server,pools:[issuerPool,gatewayPool]})};
 }catch{
  await createBoundedShutdown({server:server||{listening:false,close(){}},pools:[issuerPool,gatewayPool]})().catch(()=>{});
  throw Error('Private staging startup blocked; no security fallback.');
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 process.stderr.write('Phase 3.15M requires an independently accepted exact-session authority and approved operator bootstrap. No listener opened.\n');
 process.exitCode=1;
}
