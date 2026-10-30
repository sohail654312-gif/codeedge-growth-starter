/** Restricted SQL runtime, shared with the existing PKCE and cookie transport.
 * No administrative pool, direct Auth-table access or caller-provided actor.
 * A separately supported exact provider-session authority is mandatory; there
 * is no default JWT/getUser-only fallback for administrator/global revocation.
 */
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {validateFreshProviderIdentity} from './phase315d-fresh-login.mjs';
import {createPrivateHttpsCookieHandler} from './phase315e-https-cookies.mjs';
const OPAQUE=/^[A-Za-z0-9_-]{43}$/;
const CODE=/^[A-Za-z0-9_-]{16,512}$/;
const TOKEN=/^ce1\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[A-Za-z0-9_-]{43}$/;
const WS=/^ws_[A-Za-z0-9_-]{8,128}$/;
const random=()=>randomBytes(32).toString('base64url');
const hash=(purpose,value)=>createHash('sha256').update(purpose+'\0').update(value).digest('hex');
const denied=()=>{throw Error('Private session denied.');};
const unavailable=()=>{throw Error('Private session dependency unavailable.');};

// Read-only effective privilege check, executed on the actual login pool.
export const PRIVATE_RUNTIME_PREFLIGHT=`SELECT current_user AS actor,session_user AS login,
 r.rolcanlogin,r.rolinherit,r.rolsuper,r.rolbypassrls,r.rolcreaterole,r.rolcreatedb,r.rolreplication,
 EXISTS(SELECT FROM pg_auth_members m WHERE m.member=r.oid) AS memberships,
 has_schema_privilege(current_user,'growth_starter','USAGE') AS business_schema,
 (SELECT coalesce(jsonb_agg(c.relname),'[]') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname IN('growth_starter','growth_starter_private','auth') AND c.relkind IN('r','p','v')
 AND (has_any_column_privilege(current_user,c.oid,'SELECT') OR has_any_column_privilege(current_user,c.oid,'INSERT')
 OR has_any_column_privilege(current_user,c.oid,'UPDATE') OR has_table_privilege(current_user,c.oid,'DELETE,TRUNCATE,TRIGGER'))) AS accessible_tables,
 (SELECT coalesce(jsonb_agg(p.proname ORDER BY p.proname),'[]') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN('growth_starter','growth_starter_private') AND has_function_privilege(current_user,p.oid,'EXECUTE')) AS executable,
 (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='growth_starter_private' AND EXISTS(SELECT FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
 WHERE a.grantee=0 AND a.privilege_type='EXECUTE')) AS public_functions,
 (SELECT count(*)::int FROM pg_roles o WHERE o.rolname IN('gs315k_read_owner','gs315k_revoke_owner','gs315m_issue_owner')
 AND NOT o.rolcanlogin AND NOT o.rolinherit AND NOT o.rolsuper AND NOT o.rolbypassrls AND NOT o.rolcreaterole AND NOT o.rolcreatedb) AS safe_owners,
 (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='growth_starter_private' AND c.relname IN('codeedge_sessions','fresh_login_flows')
 AND c.relrowsecurity AND c.relforcerowsecurity) AS private_rls,
 has_database_privilege(current_user,current_database(),'CREATE') AS db_create
 FROM pg_roles r WHERE r.rolname=current_user`;

async function preflight(pool,role,functions){
 const row=(await pool.query(PRIVATE_RUNTIME_PREFLIGHT)).rows?.[0];
 // A missing or null PostgreSQL privilege flag is UNKNOWN, not false.
 // Every forbidden privilege must be explicitly false for both LOGIN pools.
 const forbidden=['rolinherit','rolsuper','rolbypassrls','rolcreaterole',
  'rolcreatedb','rolreplication','memberships','business_schema','db_create'];
 if(!row||row.actor!==role||row.login!==role||row.rolcanlogin!==true||
  forbidden.some(key=>row[key]!==false)||
  row.public_functions!==0||row.safe_owners!==3||row.private_rls!==2||
  !Array.isArray(row.accessible_tables)||row.accessible_tables.length||
  JSON.stringify(row.executable)!==JSON.stringify([...functions].sort()))unavailable();
}
async function transaction(pool,role,functions,run){
 let c,open=false;
 try{
  c=await pool.connect();await c.query('BEGIN ISOLATION LEVEL READ COMMITTED');open=true;
  await c.query("SET LOCAL statement_timeout='4000ms'");
  await c.query("SET LOCAL lock_timeout='2000ms'");
  await c.query("SET LOCAL idle_in_transaction_session_timeout='6000ms'");
  // Pool-level startup checks cannot authorize a different acquired connection.
  // Validate the effective principal and grants on THIS connection before any
  // login, session or workspace operation executes inside its transaction.
  await preflight(c,role,functions);
  const result=await run(c);await c.query('COMMIT');open=false;return result;
 }catch(e){
  if(open)await c.query('ROLLBACK').catch(()=>{});
  if(e?.code==='28000'||e?.message==='Private session denied.')denied();
  unavailable();
 }finally{c?.release();}
}
function sessionHash(id,secret){
 return createHash('sha256').update('codeedge-growth-starter:session:v1\0')
 .update(id).update('\0').update(secret).digest('hex');
}
export async function createPhase315mPrivateRuntime({issuerPool,gatewayPool,provider,
 projectUrl,appOrigin,csrfSigningKey,checkProviderSession,operations=null,secureIngress,now=()=>Date.now()}={}){
 if(!issuerPool||!gatewayPool||issuerPool===gatewayPool||
 ![issuerPool,gatewayPool].every(p=>typeof p.connect==='function'&&typeof p.query==='function')||
 !provider||!['sendLoginEmail','exchangeAuthCode','verifyUser'].every(k=>typeof provider[k]==='function')||
 typeof checkProviderSession!=='function'||typeof now!=='function')unavailable();
 const project=new URL(projectUrl),app=new URL(appOrigin);
 if(project.protocol!=='https:'||project.pathname!=='/'||project.search||project.hash||project.username||project.password||
 !/^[a-z0-9-]+\.supabase\.co$/.test(project.hostname)||app.protocol!=='https:'||app.pathname!=='/'||
 app.username||app.password||app.search||app.hash)unavailable();
 await preflight(issuerPool,'gs315m_issuer',['begin_login','consume_login','issue_session']);
 await preflight(gatewayPool,'gs315k_gateway',['read_requests','revoke_session','session_context']);
 async function providerActive(userId,sessionId){
  // Bound the network wait while session locks are held. Never cache active
  // results; provider failure or mismatched identity must fail every read.
  let timer;const controller=new AbortController();
  try{
   const result=await Promise.race([Promise.resolve().then(()=>checkProviderSession({userId,sessionId,signal:controller.signal})),
    new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error()),3000);})]);
   const t=Math.floor(now()/1000);
   if(!Number.isSafeInteger(t)||result?.active!==true||result.userId!==userId||result.sessionId!==sessionId||
      !Number.isSafeInteger(result.expiresAt)||result.expiresAt<=t)denied();
  }finally{clearTimeout(timer);controller.abort();}
 }
 const bridge=Object.freeze({
  async begin({email}={}){
   if(typeof email!=='string'||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))denied();
   const canonical=email.toLowerCase(),state=random(),binding=random(),verifier=random(),grant=random();
   const codeChallenge=createHash('sha256').update(verifier).digest('base64url');
   await transaction(issuerPool,'gs315m_issuer',['begin_login','consume_login','issue_session'],c=>c.query('SELECT growth_starter_private.begin_login($1,$2,$3,$4,$5)',
    [hash('state',state),hash('binding',binding),verifier,grant,hash('email',canonical)]));
   // The verifier stays in the restricted database. No response carries a
   // provider bearer, refresh token, verifier or one-time issuance grant.
   await provider.sendLoginEmail({email:canonical,codeChallenge,state});
   return Object.freeze({browserBinding:binding});
  },
  async completeAndIssue({state,browserBinding,authCode}={}){
   if(!OPAQUE.test(state||'')||!OPAQUE.test(browserBinding||'')||!CODE.test(authCode||''))denied();
   const flow=await transaction(issuerPool,'gs315m_issuer',['begin_login','consume_login','issue_session'],async c=>{
    const r=await c.query('SELECT * FROM growth_starter_private.consume_login($1,$2)',
     [hash('state',state),hash('binding',browserBinding)]);
    if(r.rowCount!==1)denied();return r.rows[0];
   });
   // Consumption commits BEFORE exchange, so timeouts and invalid responses
   // cannot replay the callback. No Supabase token login route exists.
   const exchanged=await provider.exchangeAuthCode({code:authCode,codeVerifier:flow.pkce_verifier,
    redirectTo:app.origin+'/auth/callback'});
   const user=await provider.verifyUser({accessToken:exchanged.accessToken});
   const identity=validateFreshProviderIdentity({accessToken:exchanged.accessToken,user,projectUrl,now:now()});
   if(hash('email',identity.email)!==flow.email_sha256)denied();
   await providerActive(identity.userId,identity.providerSessionId);
   const id=randomUUID(),secret=random(),expiresAt=new Date(Math.min(now()+900000,identity.expiresAt*1000));
   await transaction(issuerPool,'gs315m_issuer',['begin_login','consume_login','issue_session'],c=>c.query(
    'SELECT growth_starter_private.issue_session($1,$2,$3,$4,$5,$6,$7)',
    [flow.one_time_grant_id,flow.email_sha256,identity.userId,identity.providerSessionId,id,
     sessionHash(id,secret),expiresAt]));
   return Object.freeze({token:'ce1.'+id+'.'+secret,expiresAt:expiresAt.toISOString()});
  }
 });
 const authority=Object.freeze({
  async withAuthorizedRead({token,workspaceId}={},operation){
   if(!TOKEN.test(token||'')||!WS.test(workspaceId||'')||typeof operation!=='function')denied();
   return transaction(gatewayPool,'gs315k_gateway',['read_requests','revoke_session','session_context'],async c=>{
    const context=(await c.query('SELECT * FROM growth_starter_private.session_context($1)',[token])).rows?.[0];
    if(!context)denied();await providerActive(context.user_id,context.provider_session_id);
    let active=true;
    try{return await operation(Object.freeze({async listRequests(limit=20){
     if(!active||!Number.isInteger(limit)||limit<1||limit>50)denied();
     return (await c.query('SELECT * FROM growth_starter_private.read_requests($1,$2,$3)',
      [token,workspaceId,limit])).rows;
    }}));}finally{active=false;}
   });
  },
  async revoke({token}={}){
   if(!TOKEN.test(token||''))denied();
   return transaction(gatewayPool,'gs315k_gateway',['read_requests','revoke_session','session_context'],async c=>{
    const r=await c.query('SELECT growth_starter_private.revoke_session($1) AS revoked',[token]);
    if(r.rows?.[0]?.revoked!==true)denied();return Object.freeze({revoked:true});
   });
  }
 });
 const {handler}=createPrivateHttpsCookieHandler({bridge,authority,appOrigin,csrfSigningKey,emailLogin:true,operations,secureIngress});
 return Object.freeze({bridge,authority,handler,async ready(){
  await preflight(issuerPool,'gs315m_issuer',['begin_login','consume_login','issue_session']);
  await preflight(gatewayPool,'gs315k_gateway',['read_requests','revoke_session','session_context']);
  if(operations)await operations.ready();
  return {status:'database_runtime_available',providerAcceptance:'pending',releaseReady:false};
 },status:'restricted_source_runtime_hosted_acceptance_pending'});
}
