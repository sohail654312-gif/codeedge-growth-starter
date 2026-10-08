/**
 * Source-only configuration validator. Never prints server-side secrets.
 * Startup is fail-closed unless every network/identity input is explicitly set.
 */
function unavailable(){throw new Error('Restricted staging environment is not configured.');}
function nonblank(value){return typeof value==='string' && value.trim()!=='';}
export function readStagingConfig(env){
  if(!env || typeof env!=='object')unavailable();
  const keys=['STAGING_DATABASE_URL','STAGING_POSTGRES_CA_PEM',
    'STAGING_SUPABASE_URL','STAGING_SUPABASE_PUBLISHABLE_KEY','STAGING_ALLOWED_ORIGIN'];
  if(keys.some(key=>!nonblank(env[key])))unavailable();
  let db,project,origin;
  try{
    db=new URL(env.STAGING_DATABASE_URL);
    project=new URL(env.STAGING_SUPABASE_URL);
    origin=new URL(env.STAGING_ALLOWED_ORIGIN);
  }catch{unavailable();}
  const match=/^([a-z0-9-]+)\.supabase\.co$/i.exec(project.hostname);
  if(!match || project.protocol!=='https:' || project.pathname!=='/' ||
     project.search || project.hash || project.username || project.password)unavailable();
  const ref=match[1];
  if(db.protocol!=='postgres:' && db.protocol!=='postgresql:')unavailable();
  if(!nonblank(db.password) || db.password.length<32 || db.search || db.hash ||
     db.pathname!=='/postgres')unavailable();
  const direct=db.hostname===`db.${ref}.supabase.co`;
  const pooler=db.hostname.endsWith('.pooler.supabase.com');
  const user=decodeURIComponent(db.username);
  if((!direct&&!pooler) || (direct && user!=='growth_starter_runtime') ||
     (pooler && user!==`growth_starter_runtime.${ref}`))unavailable();
  if(!env.STAGING_POSTGRES_CA_PEM.includes('-----BEGIN CERTIFICATE-----') ||
     !env.STAGING_POSTGRES_CA_PEM.includes('-----END CERTIFICATE-----'))unavailable();
  if(origin.protocol!=='https:' || origin.username || origin.password ||
     origin.pathname!=='/' || origin.search || origin.hash)unavailable();
  const host=env.STAGING_BIND_HOST || '127.0.0.1';
  if(host!=='127.0.0.1' && host!=='0.0.0.0')unavailable();
  if(host==='0.0.0.0' && env.STAGING_TLS_TERMINATED!=='true')unavailable();
  const port=env.PORT == null ? 8787 : Number(env.PORT);
  if(!Number.isInteger(port) || port<1 || port>65535)unavailable();
  if(!/^sb_publishable_[A-Za-z0-9_-]{10,}$/.test(env.STAGING_SUPABASE_PUBLISHABLE_KEY))unavailable();
  return Object.freeze({
    databaseUrl:env.STAGING_DATABASE_URL,
    caPem:env.STAGING_POSTGRES_CA_PEM,
    supabaseUrl:project.origin,
    publishableKey:env.STAGING_SUPABASE_PUBLISHABLE_KEY,
    allowedOrigin:origin.origin,
    host,port
  });
}
