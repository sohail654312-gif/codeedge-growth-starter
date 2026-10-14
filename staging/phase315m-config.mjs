// Staging-only source configuration. Missing approvals never become defaults.
export function readPhase315mConfig(env,evidence){
 const fail=()=>{throw Error('Phase 3.15M approved staging prerequisites unavailable.');};
 if(!env||!evidence||evidence.projectRef!=='dbppeymhsemvghbvuvof'||
 evidence.privateSchemaExcluded!==true||evidence.directApiClosed!==true||
 evidence.exactProviderRevocationAccepted!==true||typeof evidence.independentReviewer!=='string'||
 !evidence.independentReviewer.trim()||typeof evidence.ownerApprovalId!=='string'||!evidence.ownerApprovalId.trim()||
 !/^[a-f0-9]{40}$/.test(env.GS315M_COMMIT_SHA||'')||evidence.commitSha!==env.GS315M_COMMIT_SHA||
 env.GS315M_ACTIVATE!=='dbppeymhsemvghbvuvof')fail();
 let app;try{app=new URL(env.GS315M_APP_ORIGIN);}catch{fail();}
 if(app.protocol!=='https:'||app.pathname!=='/'||app.username||app.password||app.search||app.hash||
 evidence.appOrigin!==app.origin)fail();
 const databaseUrls={};
 for(const [name,role] of [['ISSUER','gs315m_issuer'],['GATEWAY','gs315k_gateway']]){
  let u;try{u=new URL(env['GS315M_'+name+'_DATABASE_URL']);}catch{fail();}
  const direct=u.hostname==='db.dbppeymhsemvghbvuvof.supabase.co';
  const pooler=/^[a-z0-9-]+\.pooler\.supabase\.com$/.test(u.hostname);
  if(!['postgres:','postgresql:'].includes(u.protocol)||u.pathname!=='/postgres'||u.search||u.hash||
   (!direct&&!pooler)||decodeURIComponent(u.username)!==(direct?role:role+'.dbppeymhsemvghbvuvof')||
   decodeURIComponent(u.password).length<32||
   (u.port&&u.port!=='5432'))fail(); // session-mode only; no transaction pooler.
  databaseUrls[name.toLowerCase()]=u.href;
 }
 if(!/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(env.GS315M_PUBLISHABLE_KEY||'')||
 !env.GS315M_DATABASE_CA_PEM?.includes('-----BEGIN CERTIFICATE-----')||
 !env.GS315M_DATABASE_CA_PEM?.includes('-----END CERTIFICATE-----')||
 typeof env.GS315M_TLS_CERT_PATH!=='string'||!env.GS315M_TLS_CERT_PATH||
 typeof env.GS315M_TLS_KEY_PATH!=='string'||!env.GS315M_TLS_KEY_PATH||
 typeof env.GS315M_CSRF_KEY_PATH!=='string'||!env.GS315M_CSRF_KEY_PATH)fail();
 const port=Number(env.GS315M_PORT||8443);if(!Number.isInteger(port)||port<1||port>65535)fail();
 return Object.freeze({appOrigin:app.origin,projectUrl:'https://dbppeymhsemvghbvuvof.supabase.co/',
  databaseUrls,caPem:env.GS315M_DATABASE_CA_PEM,publishableKey:env.GS315M_PUBLISHABLE_KEY,
  certPath:env.GS315M_TLS_CERT_PATH,keyPath:env.GS315M_TLS_KEY_PATH,
  csrfKeyPath:env.GS315M_CSRF_KEY_PATH,port,commitSha:env.GS315M_COMMIT_SHA});
}
