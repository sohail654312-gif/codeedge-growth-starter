import {createHmac,timingSafeEqual} from 'node:crypto';
import {DomainError,profileInput,requestInput,validRecordId,textField} from './core.mjs';

export const OPERATION_SIGNATURES=Object.freeze([
 'ops_onboard(text)','ops_workspaces(text)','ops_authorize(text,text)','ops_profile_read(text,text)',
 'ops_profile_save(text,text,text,jsonb,integer)','ops_request_create(text,text,text,text,text,text)',
 'ops_request_assign(text,text,text,text,text,text,integer)','ops_request_review(text,text,text,text,text,integer)',
 'ops_request_decide(text,text,text,text,text,integer,text)',
 'ops_requests_page(text,text,text,text,text,timestamp with time zone,text,integer)',
 'ops_request_detail(text,text,text)','ops_history_page(text,text,bigint,integer)',
 'ops_member_revoke(text,text,text,text)','ops_media_read(text,text,text)',
 'ops_media_delete(text,text,text,text)','ops_automation_authorize(text,text)',
 'session_context(text)'
].sort());
export const WRITER_PREFLIGHT=`SELECT current_user AS actor,session_user AS login,
 r.rolcanlogin,r.rolinherit,r.rolsuper,r.rolbypassrls,r.rolcreaterole,r.rolcreatedb,r.rolreplication,
 EXISTS(SELECT FROM pg_auth_members m WHERE m.member=r.oid) AS memberships,
 has_schema_privilege(current_user,'growth_starter','USAGE') AS business_schema,
 coalesce((SELECT has_schema_privilege(current_user,n.oid,'USAGE') FROM pg_namespace n WHERE n.nspname='auth'),false) AS auth_schema,
 has_schema_privilege(current_user,'growth_starter_private','CREATE') AS schema_create,
 has_database_privilege(current_user,current_database(),'CREATE') AS db_create,
 (SELECT count(*)::int FROM pg_namespace n WHERE n.nspname NOT LIKE 'pg_temp%' AND n.nspname NOT LIKE 'pg_toast_temp%'
 AND has_schema_privilege(current_user,n.oid,'CREATE')) AS writable_schemas,
 (SELECT coalesce(jsonb_agg(n.nspname||'.'||c.relname),'[]') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname NOT IN('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%'
 AND c.relkind IN('r','p','v','m','f') AND
 (has_any_column_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,REFERENCES')
 OR has_table_privilege(current_user,c.oid,'DELETE,TRUNCATE,TRIGGER'))) AS tables,
 (SELECT coalesce(jsonb_agg(p.proname||'('||oidvectortypes(p.proargtypes)||')' ORDER BY p.proname||'('||oidvectortypes(p.proargtypes)||')'),'[]')
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE (n.nspname IN('growth_starter','growth_starter_private') OR
 (n.nspname='auth' AND has_schema_privilege(current_user,n.oid,'USAGE'))) AND has_function_privilege(current_user,p.oid,'EXECUTE')) AS functions,
 (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='growth_starter_private' AND EXISTS(SELECT FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
 WHERE a.grantee=0 AND a.privilege_type='EXECUTE')) AS public_functions,
 (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles o ON o.oid=p.proowner
 WHERE n.nspname='growth_starter_private' AND left(p.proname,4)='ops_' AND
 (o.rolname<>'gs315p_ops_owner' OR NOT p.prosecdef OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp'])) AS unsafe_operations,
 (SELECT count(*)::int FROM pg_roles o WHERE o.rolname='gs315p_ops_owner' AND
 NOT o.rolcanlogin AND NOT o.rolinherit AND NOT o.rolsuper AND NOT o.rolbypassrls AND
 NOT o.rolcreaterole AND NOT o.rolcreatedb AND NOT o.rolreplication AND NOT EXISTS(SELECT FROM pg_auth_members m WHERE m.member=o.oid)) AS safe_owner,
 (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='growth_starter' AND c.relname IN('workspaces','memberships','work_requests','business_profiles','request_notes',
 'operation_receipts','audit_events','media','media_delete_outbox') AND c.relrowsecurity AND c.relforcerowsecurity) AS rls,
 (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname NOT IN('pg_catalog','information_schema','growth_starter_private') AND p.prosecdef AND
 has_function_privilege(current_user,p.oid,'EXECUTE')) AS other_definers,
 (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname NOT IN('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND c.relkind IN('r','p','v','m','f')
 AND (has_any_column_privilege('gs315p_ops_owner',c.oid,'SELECT,INSERT,UPDATE,REFERENCES') OR has_table_privilege('gs315p_ops_owner',c.oid,'DELETE,TRUNCATE,TRIGGER'))
 AND NOT (n.nspname='growth_starter' AND c.relname IN('workspaces','memberships','work_requests','business_profiles','request_notes',
 'operation_receipts','audit_events','media','media_delete_outbox'))) AS owner_extra_tables,
 (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname IN('growth_starter','growth_starter_private') AND (c.relowner=(SELECT oid FROM pg_roles WHERE rolname='gs315p_ops_owner')
 OR has_table_privilege('gs315p_ops_owner',c.oid,'DELETE,TRUNCATE,TRIGGER'))) AS owner_destructive,
 has_schema_privilege('gs315p_ops_owner','growth_starter','CREATE') OR has_schema_privilege('gs315p_ops_owner','growth_starter_private','CREATE')
 OR has_database_privilege('gs315p_ops_owner',current_database(),'CREATE') OR EXISTS(SELECT FROM pg_namespace n
 WHERE n.nspname NOT LIKE 'pg_temp%' AND n.nspname NOT LIKE 'pg_toast_temp%' AND has_schema_privilege('gs315p_ops_owner',n.oid,'CREATE')) AS owner_create,
 (SELECT count(*)::int FROM pg_roles b WHERE b.rolname IN('anon','authenticated','service_role') AND
 (has_schema_privilege(b.oid,'growth_starter_private','USAGE') OR EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='growth_starter_private' AND has_function_privilege(b.oid,p.oid,'EXECUTE')))) AS browser_private
 FROM pg_roles r WHERE r.rolname=current_user`;
export function verifyWriterCatalog(r){
 if(!r||r.actor!=='gs315p_writer'||r.login!==r.actor||r.rolcanlogin!==true||
 ['rolinherit','rolsuper','rolbypassrls','rolcreaterole','rolcreatedb','rolreplication','memberships','business_schema','auth_schema','schema_create','db_create'].some(k=>r[k]!==false)||
 !Array.isArray(r.tables)||r.tables.length||!Array.isArray(r.functions)||JSON.stringify(r.functions.map(s=>s.replace(/,\s+/g,',')).sort())!==JSON.stringify(OPERATION_SIGNATURES)||
 r.public_functions!==0||r.unsafe_operations!==0||r.safe_owner!==1||r.rls!==9||r.other_definers!==0||r.browser_private!==0||
 r.owner_extra_tables!==0||r.owner_destructive!==0||r.owner_create!==false||r.writable_schemas!==0)
 throw new DomainError('Restricted writer catalog denied.',503);
 return Object.freeze({role:r.actor,verified:true});
}
const TOKEN=/^ce1\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[A-Za-z0-9_-]{43}$/;
const WS=/^ws_[A-Za-z0-9_-]{8,128}$/;
const SUBJECT=/^[A-Za-z0-9_-]{8,128}$/;
const statuses=['Requested','In progress','Awaiting approval','Approved','Changes requested','Completed'];
const kinds=['Website update','Social content','Local SEO','Other'];
const denied=()=>{throw new DomainError('Session or workspace denied.',403);};
const unavailable=()=>{throw new DomainError('Private operation unavailable.',503);};
const version=v=>{if(!Number.isInteger(v)||v<0||v>2147483646)throw new DomainError('Invalid version.');return v;};
const key=v=>{if(typeof v!=='string'||! /^[A-Za-z0-9_-]{16,80}$/.test(v))throw new DomainError('Idempotency key required.');return v;};
const subject=v=>{if(typeof v!=='string'||!SUBJECT.test(v))throw new DomainError('Invalid member.');return v;};
const choice=(v,list)=>{if(v==null||v==='')return null;if(!list.includes(v))throw new DomainError('Invalid filter.');return v;};

// Separate actual LOGIN pool. No actor/role claim, SDK call, privileged raw SQL
// endpoint or production administrative store. Fixed statements only.
export async function createPrivateWorkspaceOperations({pool,checkProviderSession,cursorKey,now=()=>Date.now()}={}){
 if(!pool||typeof pool.query!=='function'||typeof pool.connect!=='function'||typeof checkProviderSession!=='function'||
 typeof cursorKey!=='string'||cursorKey.length<32||typeof now!=='function')unavailable();
 verifyWriterCatalog((await pool.query(WRITER_PREFLIGHT)).rows?.[0]);
 const sign=s=>createHmac('sha256',cursorKey).update(s).digest('base64url');
 const encode=(binding,position)=>{
  const s=Buffer.from(JSON.stringify({binding,position,expires:now()+900000})).toString('base64url');return s+'.'+sign(s);
 };
 function decode(token,binding){
  if(token==null||token==='')return null;
  try{
   if(typeof token!=='string'||token.length>2048||! /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token))throw Error();
   const [s,mac]=token.split('.'),a=Buffer.from(mac),b=Buffer.from(sign(s));
   if(a.length!==b.length||!timingSafeEqual(a,b))throw Error();
   const value=JSON.parse(Buffer.from(s,'base64url').toString('utf8')),t=now();
   if(!Number.isSafeInteger(t)||value.binding!==binding||!Number.isSafeInteger(value.expires)||value.expires<=t||value.expires>t+900000)throw Error();
   return value.position;
  }catch{throw new DomainError('Invalid or expired page cursor.');}
 }
 async function transaction(token,fn){
  if(typeof token!=='string'||!TOKEN.test(token))denied();
  let c,started=false,timer,sessionVerified=false;const controller=new AbortController();
  try{
   c=await pool.connect();await c.query('BEGIN ISOLATION LEVEL READ COMMITTED');started=true;
   await c.query("SET LOCAL statement_timeout='4s'");await c.query("SET LOCAL lock_timeout='2s'");
   await c.query("SET LOCAL idle_in_transaction_session_timeout='6s'");
   // A startup pool.query() may use a different physical connection. Fail closed
   // on the actual transaction connection before reading a session or writing.
   verifyWriterCatalog((await c.query(WRITER_PREFLIGHT)).rows?.[0]);
   const context=(await c.query('SELECT * FROM growth_starter_private.session_context($1)',[token])).rows?.[0];
   if(!context)throw new DomainError('Sign in to continue.',401);
   sessionVerified=true;
   const facts=await Promise.race([Promise.resolve().then(()=>checkProviderSession({userId:context.user_id,sessionId:context.provider_session_id,signal:controller.signal})),
    new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error()),3000);})]);
   const t=Math.floor(now()/1000);
   if(!Number.isSafeInteger(t)||facts?.active!==true||facts.userId!==context.user_id||facts.sessionId!==context.provider_session_id||
    !Number.isSafeInteger(facts.expiresAt)||facts.expiresAt<=t)denied();
   clearTimeout(timer);
   // Credentials stay inside this closure; callers receive only the result.
   const value=await fn(c,context.user_id,context);await c.query('COMMIT');started=false;return value;
  }catch(e){
   if(started)await c.query('ROLLBACK').catch(()=>{});
   if(e instanceof DomainError)throw e;
   if(e?.code==='28000'){if(!sessionVerified)throw new DomainError('Sign in to continue.',401);denied();}
   if(e?.code==='23505')throw new DomainError('Version or idempotency conflict; refresh before saving.',409);
   if(e?.code==='P0002')throw new DomainError('Record not found.',404);
   if(['22023','22007','22008','23514'].includes(e?.code))throw new DomainError('Invalid operation input.');
   unavailable();
  }finally{clearTimeout(timer);controller.abort();c?.release();}
 }
 const scalar=async(c,sql,args)=>(await c.query(sql,args)).rows?.[0]?.result;
 async function run({token,workspaceId,action,input={},query={}}={}){
  if(!['onboard','workspaces'].includes(action)&&(typeof workspaceId!=='string'||!WS.test(workspaceId)))throw new DomainError('Invalid workspace.');
  return transaction(token,async(c,actor,context)=>{
   const p=[token,workspaceId],k=()=>key(input.idempotencyKey),id=()=>validRecordId(input.id);
   switch(action){
    case 'onboard':return scalar(c,'SELECT growth_starter_private.ops_onboard($1) AS result',[token]);
    case 'workspaces':return {...await scalar(c,'SELECT growth_starter_private.ops_workspaces($1) AS result',[token]),sessionExpiresAt:new Date(context.expires_at).toISOString()};
    case 'authorize':return scalar(c,'SELECT growth_starter_private.ops_authorize($1,$2) AS result',p);
    case 'profile':return scalar(c,'SELECT growth_starter_private.ops_profile_read($1,$2) AS result',p);
    case 'saveProfile':return scalar(c,'SELECT growth_starter_private.ops_profile_save($1,$2,$3,$4,$5) AS result',[...p,k(),profileInput(input.fields),version(input.version)]);
    case 'createRequest':{
     const f=requestInput(input.fields);return scalar(c,'SELECT growth_starter_private.ops_request_create($1,$2,$3,$4,$5,$6) AS result',[...p,k(),f.title,f.kind,f.notes]);
    }
    case 'assign':{
     const assignee=input.assignedTo===null?null:subject(input.assignedTo),due=input.dueDate??null;
     if(due!==null&&(typeof due!=='string'||! /^\d{4}-\d{2}-\d{2}$/.test(due)||!Number.isFinite(Date.parse(due))||new Date(due).toISOString().slice(0,10)!==due))throw new DomainError('Invalid due date.');
     return scalar(c,'SELECT growth_starter_private.ops_request_assign($1,$2,$3,$4,$5,$6,$7) AS result',[...p,k(),id(),assignee,due,version(input.version)]);
    }
    case 'review':return scalar(c,'SELECT growth_starter_private.ops_request_review($1,$2,$3,$4,$5,$6) AS result',[...p,k(),id(),input.status,version(input.version)]);
    case 'decision':case 'correction':return scalar(c,'SELECT growth_starter_private.ops_request_decide($1,$2,$3,$4,$5,$6,$7) AS result',[...p,k(),id(),action==='correction'?'Changes requested':input.status,version(input.version),textField(input.note,'Note',600,action==='correction')]);
    case 'detail':return scalar(c,'SELECT growth_starter_private.ops_request_detail($1,$2,$3) AS result',[...p,id()]);
    case 'revokeMember':return scalar(c,'SELECT growth_starter_private.ops_member_revoke($1,$2,$3,$4) AS result',[...p,k(),subject(input.userId)]);
    case 'mediaRead':return scalar(c,'SELECT growth_starter_private.ops_media_read($1,$2,$3) AS result',[...p,id()]);
    case 'mediaDelete':return scalar(c,'SELECT growth_starter_private.ops_media_delete($1,$2,$3,$4) AS result',[...p,k(),id()]);
    case 'automationAuthorize':return scalar(c,'SELECT growth_starter_private.ops_automation_authorize($1,$2) AS result',p);
    case 'list':case 'history':{
     const size=Number(query.limit??20);if(!Number.isInteger(size)||size<1||size>50)throw new DomainError('Invalid page size.');
     const filters=action==='list'?{status:choice(query.status,statuses),kind:choice(query.kind,kinds),assignedTo:query.assignedTo?subject(query.assignedTo):null}:{};
     const binding=JSON.stringify({actor,workspaceId,action,...filters}),after=decode(query.cursor,binding);
     let rows;
     if(action==='list'){
      if(after&&(! /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(after.at||'')||!Number.isFinite(Date.parse(after.at))))throw new DomainError('Invalid page position.');
      if(after)validRecordId(after.id);
      rows=await scalar(c,'SELECT growth_starter_private.ops_requests_page($1,$2,$3,$4,$5,$6,$7,$8) AS result',[...p,filters.status,filters.kind,filters.assignedTo,after?.at??null,after?.id??null,size+1]);
     }else{
      if(after!==null&&(typeof after!=='string'||! /^[1-9]\d{0,18}$/.test(after)))throw new DomainError('Invalid history position.');
      rows=await scalar(c,'SELECT growth_starter_private.ops_history_page($1,$2,$3,$4) AS result',[...p,after,size+1]);
     }
     if(!Array.isArray(rows))unavailable();const items=rows.slice(0,size),last=items.at(-1);
     return {items:items.map(({cursorAt,...r})=>r),nextCursor:rows.length>size?encode(binding,action==='list'?{at:last.cursorAt,id:last.id}:last.id):null,scope:'loaded_page_only'};
    }
    default:throw new DomainError('Unknown private operation.',404);
   }
  });
 }
 return Object.freeze({run,ready:async()=>verifyWriterCatalog((await pool.query(WRITER_PREFLIGHT)).rows?.[0]),capabilities:Object.freeze({fixedPurpose:true,transactionalAuthorization:true,persistentOperations:true,hostedVerified:false})});
}
