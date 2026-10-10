/**
 * Dedicated source entrypoint; NEVER use staging/server.mjs (legacy disabled).
 * This will refuse to listen unless (a) a dedicated trusted session LOGIN
 * can read minimal auth columns, (b) RLS policies are installed and required
 * scoped grants exist, and (c) unsafe actor-ID function EXECUTE is retired.
 * Only bind loopback behind an owner-approved HTTPS ingress. A CI mock or env
 * toggle cannot bypass the PostgreSQL preflight in the real runtime.
 *
 * This source is NOT deployed; independent hosted test-user acceptance is
 * still required before exposing any real clients.
 */
import {createServer} from 'node:http';
import {Pool} from 'pg';
import {readAcceptedStagingConfig} from './accepted-config.mjs';
import {createPgSessionAuthority} from '../backend/pg-session-authority.mjs';
import {createHostedAuthenticatedReadGateway} from '../backend/authenticated-read-gateway.mjs';

export async function startAcceptedStaging({env=process.env,
 poolFactory=opts=>new Pool(opts),fetchImpl=globalThis.fetch}={}){
 const config=readAcceptedStagingConfig(env);
 const pool=poolFactory({
  connectionString:config.sessionDbUrl,
  ssl:{ca:config.caPem,rejectUnauthorized:true},
  max:2,connectionTimeoutMillis:3500,idleTimeoutMillis:10000,
  application_name:'growth_starter_session_check_only'
 });
 let server;
 try{
  const sessionAuthority=await createPgSessionAuthority({pool});
  const gateway=createHostedAuthenticatedReadGateway({
   projectUrl:config.projectUrl,publishableKey:config.publishableKey,
   allowedOrigin:config.allowedOrigin,sessionAuthority,fetchImpl
  });
  server=createServer((req,res)=>{
   // Only trusted local reverse proxy may reach a loopback bound listener.
   // Ingress MUST replace forwarded proto/host, not blindly pass client values.
   const peer=req.socket.remoteAddress;
   if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(peer) ||
     req.headers['x-forwarded-proto']!=='https' ||
     req.headers['x-forwarded-host']!==config.publicHost){
    res.writeHead(421,{'cache-control':'no-store','content-type':'application/json'});
    return res.end('{"error":"Secure ingress required."}');
   }
   Promise.resolve(gateway.handler(req,res)).catch(()=>{
    if(!res.headersSent){
     res.writeHead(503,{'cache-control':'no-store','content-type':'application/json'});
     res.end('{"error":"Read boundary unavailable."}');
    }else res.destroy();
   });
  });
  await new Promise((ok,no)=>{server.once('error',no);server.listen(config.port,config.bindHost,ok);});
  return Object.freeze({server,close:async()=>{
   await new Promise(ok=>server.close(ok));await pool.end();
  },port:config.port,sha:config.sha});
 }catch{
  try{if(server?.listening)await new Promise(done=>server.close(done));}catch{}
  try{await pool.end();}catch{}
  throw Error('Trusted staging runtime startup blocked; verify approved security prerequisites.');
 }
}
if(process.argv[1] && import.meta.url.endsWith('/accepted-server.mjs')){
 let runtime;
 try{
  runtime=await startAcceptedStaging();
  process.stdout.write('Trusted Growth Starter staging HTTP loopback active; hosted acceptance still required.\n');
  for(const sig of ['SIGTERM','SIGINT'])process.once(sig,()=>{
   void runtime.close().then(()=>process.exit(0)).catch(()=>process.exit(1));
  });
 }catch{
  process.stderr.write('Trusted staging startup blocked: prerequisites unavailable.\n');
  process.exitCode=1;
 }
}
