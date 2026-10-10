/**
 * Separate configuration for a future operator-approved, isolated staging
 * HTTPS reverse-proxy + loopback Node service. No shared legacy SQL runtime
 * password; no service_role/anon secret or production credentials.
 */
function fail(){throw Error('Accepted staging configuration unavailable.');}
export function readAcceptedStagingConfig(env={}){
 const keys=['STAGING_SUPABASE_URL','STAGING_SUPABASE_PUBLISHABLE_KEY',
  'STAGING_ALLOWED_ORIGIN','STAGING_SESSION_DATABASE_URL',
  'STAGING_POSTGRES_CA_PEM','STAGING_PUBLIC_HOST','STAGING_DEPLOYMENT_SHA'];
 if(keys.some(k=>typeof env[k]!=='string' || !env[k].trim()))fail();
 let p,db,front;
 try {
  p=new URL(env.STAGING_SUPABASE_URL);
  db=new URL(env.STAGING_SESSION_DATABASE_URL);
  front=new URL(env.STAGING_ALLOWED_ORIGIN);
 }catch{fail();}
 if(p.protocol!=='https:' || p.pathname!=='/' || p.search || p.hash ||
    p.username || p.password || !/^[a-z0-9-]+\.supabase\.co$/i.test(p.hostname))fail();
 const ref=p.hostname.replace(/\.supabase\.co$/i,'');
 if(!['postgres:','postgresql:'].includes(db.protocol) || db.search ||
    db.hash || db.pathname!=='/postgres' || !db.password ||
    db.password.length<32 || !/^growth_starter_session_checker(?:\.[a-z0-9-]+)?$/.test(decodeURIComponent(db.username)))fail();
 const direct=db.hostname===`db.${ref}.supabase.co`;
 const pool=db.hostname.endsWith('.pooler.supabase.com');
 const username=decodeURIComponent(db.username);
 if((!direct&&!pool) ||
    (direct&&username!=='growth_starter_session_checker') ||
    (pool&&username!==`growth_starter_session_checker.${ref}`))fail();
 if(front.protocol!=='https:' || front.pathname!=='/' || front.search ||
    front.hash || front.username || front.password)fail();
 if(!/^sb_publishable_[a-zA-Z0-9_-]{10,}$/.test(env.STAGING_SUPABASE_PUBLISHABLE_KEY))fail();
 if(!env.STAGING_POSTGRES_CA_PEM.includes('-----BEGIN CERTIFICATE-----') ||
    !env.STAGING_POSTGRES_CA_PEM.includes('-----END CERTIFICATE-----'))fail();
 if(typeof env.STAGING_PUBLIC_HOST!=='string' ||
    !/^[a-z0-9][a-z0-9.-]{3,253}$/.test(env.STAGING_PUBLIC_HOST) ||
    env.STAGING_PUBLIC_HOST.endsWith('.'))fail();
 if(!/^[a-f0-9]{40}$/i.test(env.STAGING_DEPLOYMENT_SHA))fail();
 const port=env.PORT===undefined?8787:Number(env.PORT);
 if(!Number.isInteger(port)||port<1||port>65535)fail();
 if(env.STAGING_BIND_HOST!==undefined && env.STAGING_BIND_HOST!=='127.0.0.1')fail();
 return Object.freeze({projectUrl:p.origin,publishableKey:env.STAGING_SUPABASE_PUBLISHABLE_KEY,
  allowedOrigin:front.origin,sessionDbUrl:env.STAGING_SESSION_DATABASE_URL,
  caPem:env.STAGING_POSTGRES_CA_PEM,publicHost:env.STAGING_PUBLIC_HOST,
  port,bindHost:'127.0.0.1',sha:env.STAGING_DEPLOYMENT_SHA});
}
