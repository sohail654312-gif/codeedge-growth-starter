import {CATALOG_SQL,checkAcceptedCatalog} from './pg-rls-catalog.mjs';
/**
 * Phase 3.3D — server-only PostgreSQL-backed active-session authority.
 * Supabase documents checking auth.sessions by (session_id,user_id) to enforce
 * access denial before JWT expiry following sign-out.
 *
 * The call MUST follow /auth/v1/user validation of the ORIGINAL bearer; this
 * store NEVER authenticates a JWT signature. It cannot accept a browser SQL
 * connection or caller-controlled GUC. The dedicated LOGIN needs only column
 * SELECT on auth.sessions and auth.users, not service_role/postgres privileges.
 * No hosted grants or credentials are provisioned by this file.
 */
const validatedAuthorities=new WeakSet();
export function isVerifiedPgSessionAuthority(value){
 return typeof value==='object' && value!==null && validatedAuthorities.has(value);
}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SESSION_SQL=`SELECT s.id::text AS session_id, s.user_id::text AS user_id,
 s.not_after, u.banned_until, u.deleted_at
 FROM auth.sessions s JOIN auth.users u ON u.id=s.user_id
 WHERE s.id=$1::uuid AND s.user_id=$2::uuid LIMIT 1`;
const SECURITY_SQL=`SELECT current_user AS actor,session_user AS login,
 r.rolcanlogin,r.rolsuper,r.rolbypassrls,r.rolinherit,r.rolcreaterole,r.rolcreatedb,r.rolreplication,
 pg_has_role(current_user,'authenticated','SET') AS can_set_authenticated,
 pg_has_role(current_user,'service_role','SET') AS can_set_service_role,
 pg_has_role(current_user,'postgres','SET') AS can_set_postgres,
 pg_has_role(current_user,'growth_starter_reader','SET') AS can_set_legacy_reader,
 has_schema_privilege(current_user,'auth','USAGE') AS auth_schema,
 has_column_privilege(current_user,'auth.sessions','id','SELECT') AS session_id,
 has_column_privilege(current_user,'auth.sessions','user_id','SELECT') AS session_user,
 has_column_privilege(current_user,'auth.sessions','not_after','SELECT') AS session_until,
 has_column_privilege(current_user,'auth.users','id','SELECT') AS user_id,
 has_column_privilege(current_user,'auth.users','banned_until','SELECT') AS banned_until,
 has_column_privilege(current_user,'auth.users','deleted_at','SELECT') AS deleted_at,
 has_table_privilege(current_user,'auth.sessions','INSERT') AS session_insert,
 has_table_privilege(current_user,'auth.sessions','UPDATE') AS session_update,
 has_table_privilege(current_user,'auth.sessions','DELETE') AS session_delete,
 has_table_privilege(current_user,'auth.users','UPDATE') AS user_update,
 has_table_privilege(current_user,'auth.sessions','SELECT') AS session_full_select,
 has_table_privilege(current_user,'auth.users','SELECT') AS user_full_select,
 has_schema_privilege(current_user,'growth_starter','USAGE') AS growth_schema,
 has_database_privilege(current_user,current_database(),'CREATE') AS db_create
 FROM pg_roles r WHERE r.rolname=current_user`;
const POLICY_SQL=`SELECT
 (SELECT COUNT(*)::integer FROM pg_policies WHERE schemaname='growth_starter'
   AND policyname IN ('gs32_membership_self_read','gs32_active_workspace_read',
     'gs32_active_workspace_requests_read')) AS expected_policies,
 (SELECT COUNT(*)::integer FROM pg_tables WHERE schemaname='growth_starter' AND rowsecurity) AS rls_tables,
 has_schema_privilege('authenticated','growth_starter','USAGE') AS auth_schema_usage,
 has_column_privilege('authenticated','growth_starter.workspaces','id','SELECT') AS ws_select,
 has_column_privilege('authenticated','growth_starter.memberships','user_id','SELECT') AS member_select,
 has_column_privilege('authenticated','growth_starter.work_requests','workspace_id','SELECT') AS request_select,
 has_function_privilege('growth_starter_reader',
 'growth_starter.staging_list_workspaces(text)','EXECUTE') AS legacy_list,
 has_function_privilege('growth_starter_reader',
 'growth_starter.staging_list_requests(text,text,integer)','EXECUTE') AS legacy_requests,
 has_function_privilege('growth_starter_runtime',
 'growth_starter.staging_list_workspaces(text)','EXECUTE') AS runtime_list,
 has_function_privilege('growth_starter_runtime',
 'growth_starter.staging_list_requests(text,text,integer)','EXECUTE') AS runtime_requests`;
function blocked(){throw Error('Trusted staging session authority unavailable.');}
function timestamp(x) {
 if(x===null || x===undefined)return null;
 const t=x instanceof Date?x.getTime():Date.parse(x);
 return Number.isFinite(t)?Math.trunc(t/1000):NaN;
}
export async function createPgSessionAuthority({pool,now=()=>Date.now()}={}){
 if(!pool || typeof pool.connect!=='function' || typeof now!=='function')blocked();
 const c=await pool.connect().catch(()=>blocked());
 try {
  await c.query('BEGIN READ ONLY');
  const security=(await c.query(SECURITY_SQL)).rows?.[0];
  if(!security || security.actor!=='growth_starter_session_checker' ||
     security.login!==security.actor || !security.rolcanlogin || security.rolsuper ||
     security.rolbypassrls || security.rolinherit || security.rolcreaterole ||
     security.rolcreatedb || security.rolreplication || security.can_set_authenticated ||
     security.can_set_service_role || security.can_set_postgres || security.can_set_legacy_reader ||
     !security.auth_schema || !security.session_id || !security.session_user ||
     !security.session_until || !security.user_id || !security.banned_until ||
     !security.deleted_at || security.session_insert || security.session_update ||
     security.session_delete || security.user_update || security.session_full_select ||
     security.user_full_select || security.growth_schema ||
     security.db_create)blocked();
  const p=(await c.query(POLICY_SQL)).rows?.[0];
  if(!p || Number(p.expected_policies)!==3 || Number(p.rls_tables)<7 ||
     !p.auth_schema_usage || !p.ws_select || !p.member_select || !p.request_select ||
     p.legacy_list || p.legacy_requests || p.runtime_list || p.runtime_requests)blocked();
  const catalog=(await c.query(CATALOG_SQL)).rows?.[0];
  checkAcceptedCatalog(catalog);
  await c.query('COMMIT');
 }catch{
  try{await c.query('ROLLBACK');}catch{}
  blocked();
 }finally{c.release();}
 const authority=Object.freeze({
  async checkAuthoritativeSession({userId,sessionId}={}){
   if(!UUID.test(userId||'') || !UUID.test(sessionId||''))return {active:false};
   const conn=await pool.connect().catch(()=>blocked());
   try {
    await conn.query('BEGIN READ ONLY');
    await conn.query("SET LOCAL statement_timeout = '2000ms'");
    const result=await conn.query(SESSION_SQL,[sessionId,userId]);
    await conn.query('COMMIT');
    const row=result.rows?.[0];
    // Missing columns must never be silently interpreted as healthy data.
    if(row && !['session_id','user_id','not_after','banned_until','deleted_at']
      .every(k=>Object.prototype.hasOwnProperty.call(row,k)))blocked();
    const nowSeconds=Math.floor(now()/1000);
    const notAfter=timestamp(row?.not_after);
    const banned=timestamp(row?.banned_until);
    const deleted=row?.deleted_at!==null && row?.deleted_at!==undefined;
    const active=!!row && row.session_id===sessionId && row.user_id===userId &&
     !deleted && (notAfter===null || notAfter>nowSeconds) &&
     (banned===null || banned<=nowSeconds);
    return {active,userId,sessionId,...(notAfter!==null && Number.isFinite(notAfter)?
      {expiresAt:notAfter}:{})};
   }catch{
    try{await conn.query('ROLLBACK');}catch{}
    blocked();
   }finally{conn.release();}
  }
 });
 validatedAuthorities.add(authority);
 return authority;
}
