import {Pool} from 'pg';
import {readStagingConfig} from './config.mjs';
import {createSupabaseStagingGateway} from '../backend/staging-supabase-gateway.mjs';

let pool,server;
async function main(){
  const config=readStagingConfig(process.env);
  pool=new Pool({
    connectionString:config.databaseUrl,
    ssl:{ca:config.caPem,rejectUnauthorized:true},
    max:3,connectionTimeoutMillis:4500,
    idleTimeoutMillis:15000,
    application_name:'growth_starter_staging_readonly'
  });
  // Fail before listening if the connected principal can reach base tables
  // or is a privileged/owner/bypass-RLS login.
  const gateway=await createSupabaseStagingGateway({
    rawPool:pool,projectUrl:config.supabaseUrl,
    publishableKey:config.publishableKey,
    allowedOrigin:config.allowedOrigin
  });
  server=gateway.createServer();
  await new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(config.port,config.host,resolve);
  });
  // Do not log session tokens, connection URLs, database passwords or key text.
  process.stdout.write('Growth Starter restricted staging API listening.\n');
}
async function cleanup(){
  if(server)await new Promise(resolve=>server.close(resolve));
  if(pool)await pool.end();
}
for(const signal of ['SIGTERM','SIGINT']){
  process.once(signal,()=>{void cleanup().then(()=>process.exit(0)).catch(()=>process.exit(1));});
}
main().catch(async()=>{
  // Never include raw Postgres connection errors or credentials in logs.
  process.stderr.write('Restricted staging startup blocked: verify server configuration and permissions.\n');
  try{await cleanup();}catch{}
  process.exitCode=1;
});
