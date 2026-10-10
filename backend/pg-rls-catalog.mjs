/**
 * Phase 3.5 reviewed PostgreSQL 17 POLICY SNAPSHOT and least-privilege contract.
 * Source: read-only live pg_policies on 2026-10-10; compared to review-only 0008.
 * Exact-deparse match is deliberate and FAIL-CLOSED on PostgreSQL upgrades,
 * policy reformats, new policies, unknown roles or missing catalog fields.
 * Source-level verifier, never a substitute for signed-user hosted acceptance.
 */
export const APPROVED_POLICIES=Object.freeze([
  {
    "table": "memberships",
    "name": "gs32_membership_self_read",
    "roles": [
      "authenticated"
    ],
    "cmd": "SELECT",
    "permissive": "PERMISSIVE",
    "qual": "((( SELECT auth.uid() AS uid) IS NOT NULL) AND (state = 'active'::text) AND (user_id = (( SELECT auth.uid() AS uid))::text))",
    "check": null
  },
  {
    "table": "work_requests",
    "name": "gs32_active_workspace_requests_read",
    "roles": [
      "authenticated"
    ],
    "cmd": "SELECT",
    "permissive": "PERMISSIVE",
    "qual": "((( SELECT auth.uid() AS uid) IS NOT NULL) AND (EXISTS ( SELECT 1\n   FROM growth_starter.workspaces w\n  WHERE ((w.id = work_requests.workspace_id) AND (w.state = 'active'::text)))))",
    "check": null
  },
  {
    "table": "workspaces",
    "name": "gs32_active_workspace_read",
    "roles": [
      "authenticated"
    ],
    "cmd": "SELECT",
    "permissive": "PERMISSIVE",
    "qual": "((( SELECT auth.uid() AS uid) IS NOT NULL) AND (state = 'active'::text) AND ((owner_user_id = (( SELECT auth.uid() AS uid))::text) OR (EXISTS ( SELECT 1\n   FROM growth_starter.memberships m\n  WHERE ((m.workspace_id = workspaces.id) AND (m.user_id = (( SELECT auth.uid() AS uid))::text) AND (m.owner_user_id = workspaces.owner_user_id) AND (m.state = 'active'::text) AND (m.role = ANY (ARRAY['agency_admin'::text, 'staff'::text, 'client'::text])))))))",
    "check": null
  }
]);
const TABLES=Object.freeze(['audit_events','invitations','media','media_delete_outbox',
  'memberships','work_requests','workspaces']);
const ROLES=Object.freeze(['anon','authenticated','service_role','growth_starter_reader',
  'growth_starter_runtime','growth_starter_session_checker']);
const LEGACY=Object.freeze(['staging_list_workspaces(text)',
  'staging_list_requests(text,text,integer)','staging_session_active(text,text,text)']);
const ALLOWED_COLUMNS=Object.freeze({
  'workspaces':['id','owner_user_id','state'],
  'memberships':['workspace_id','user_id','owner_user_id','role','state'],
  'work_requests':['id','workspace_id','title','kind','status','version','updated_at']
});
const fail=()=>{throw Error('Trusted staging session authority unavailable.');};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function checkAcceptedCatalog(c){
  if(!c || !Array.isArray(c.policies) || !Array.isArray(c.tables) ||
     !Array.isArray(c.privileges) || !Array.isArray(c.legacy) || !Array.isArray(c.role_paths))fail();
  const policies=c.policies.map(x=>({table:x?.table,name:x?.name,
    roles:x?.roles,cmd:x?.cmd,permissive:x?.permissive,qual:x?.qual,check:x?.check}))
    .sort((a,b)=>String(a.table).localeCompare(String(b.table)));
  if(!same(policies,APPROVED_POLICIES))fail();
  const tables=c.tables.map(x=>({name:x?.name,rls:x?.rls})).sort((a,b)=>String(a.name).localeCompare(String(b.name)));
  if(!same(tables,TABLES.map(name=>({name,rls:true})).sort((a,b)=>a.name.localeCompare(b.name))))fail();
  const rights=c.privileges.map(x=>({
    role:x?.role,table:x?.table,columns:x?.columns,
    selectTable:x?.selectTable,insert:x?.insert,update:x?.update,delete:x?.delete,
    truncate:x?.truncate,references:x?.references,trigger:x?.trigger
  })).sort((a,b)=>(a.role+'|'+a.table).localeCompare(b.role+'|'+b.table));
  const expected=[];
  for(const role of ROLES)for(const table of TABLES){
    const columns=role==='authenticated'?(ALLOWED_COLUMNS[table]||[]):[];
    expected.push({role,table,columns:[...columns].sort(),selectTable:false,
      insert:false,update:false,delete:false,truncate:false,references:false,trigger:false});
  }
  expected.sort((a,b)=>(a.role+'|'+a.table).localeCompare(b.role+'|'+b.table));
  if(rights.some(x=>!Array.isArray(x.columns))||!same(rights.map(x=>({...x,columns:[...x.columns].sort()})),expected))fail();
  const funcs=c.legacy.map(x=>({signature:x?.signature,exists:x?.exists,publicExecute:x?.publicExecute,
    roles:x?.roles})).sort((a,b)=>String(a.signature).localeCompare(String(b.signature)));
  const expectedFuncs=LEGACY.map(signature=>({signature,exists:true,publicExecute:false,
    roles:ROLES.map(role=>({role,execute:false}))})).sort((a,b)=>a.signature.localeCompare(b.signature));
  // Dropping an old function is a safe cutover too. But no missing catalog records allowed.
  if(funcs.length!==expectedFuncs.length)fail();
  for(let i=0;i<funcs.length;i++){
    const f=funcs[i],e=expectedFuncs[i];
    if(f.signature!==e.signature||typeof f.exists!=='boolean'||f.publicExecute!==false||
      !Array.isArray(f.roles))fail();
    const r=f.roles.map(a=>({role:a?.role,execute:a?.execute})).sort((a,b)=>String(a.role).localeCompare(String(b.role)));
    if(!same(r,e.roles.map(x=>({...x})).sort((a,b)=>a.role.localeCompare(b.role))))fail();
  }
  // PostgreSQL NOINHERIT does NOT prohibit SET ROLE. Include indirect membership chains.
  const expectedPaths=ROLES.flatMap(role=>['authenticated','service_role','postgres',
    'growth_starter_reader','growth_starter_runtime'].filter(target=>target!==role)
    .map(target=>({role,target,canSet:false})))
    .sort((a,b)=>(a.role+'|'+a.target).localeCompare(b.role+'|'+b.target));
  const paths=c.role_paths.map(x=>({role:x?.role,target:x?.target,canSet:x?.canSet}))
    .sort((a,b)=>(String(a.role)+'|'+String(a.target)).localeCompare(String(b.role)+'|'+String(b.target)));
  if(!same(paths,expectedPaths))fail();
  if(c.anonSchema!==false||c.authSchema!==true||c.serviceSchema!==false)fail();
  return true;
}
export const CATALOG_SQL=`SELECT
  (SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'table',tablename,'name',policyname,'roles',to_jsonb(roles),
    'cmd',cmd,'permissive',permissive,'qual',qual,'check',with_check)),'[]'::jsonb)
   FROM pg_policies WHERE schemaname='growth_starter') AS policies,
  (SELECT COALESCE(jsonb_agg(jsonb_build_object('name',c.relname,'rls',c.relrowsecurity)),'[]'::jsonb)
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='growth_starter' AND c.relkind IN ('r','p')) AS tables,
  (SELECT COALESCE(jsonb_agg(jsonb_build_object('role',r.role,'table',c.relname,
   'columns',COALESCE((SELECT jsonb_agg(a.attname ORDER BY a.attname)
     FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
      AND has_column_privilege(r.role,c.oid,a.attname,'SELECT')),'[]'::jsonb),
   'selectTable',has_table_privilege(r.role,c.oid,'SELECT'),
   'insert',has_table_privilege(r.role,c.oid,'INSERT'),
   'update',has_table_privilege(r.role,c.oid,'UPDATE'),
   'delete',has_table_privilege(r.role,c.oid,'DELETE'),
   'truncate',has_table_privilege(r.role,c.oid,'TRUNCATE'),
   'references',has_table_privilege(r.role,c.oid,'REFERENCES'),
   'trigger',has_table_privilege(r.role,c.oid,'TRIGGER'))),'[]'::jsonb)
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   CROSS JOIN (VALUES ('anon'),('authenticated'),('service_role'),
    ('growth_starter_reader'),('growth_starter_runtime'),
    ('growth_starter_session_checker')) AS r(role)
   WHERE n.nspname='growth_starter' AND c.relkind IN ('r','p')) AS privileges,
  (SELECT COALESCE(jsonb_agg(jsonb_build_object('signature',x.sig,
   'exists',to_regprocedure('growth_starter.'||x.sig) IS NOT NULL,
   'publicExecute',COALESCE((SELECT bool_or(a.grantee=0 AND a.privilege_type='EXECUTE')
     FROM pg_proc p CROSS JOIN LATERAL
      aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a
     WHERE p.oid=to_regprocedure('growth_starter.'||x.sig)),false),
   'roles',(SELECT jsonb_agg(jsonb_build_object('role',r.role,
     'execute',CASE WHEN to_regprocedure('growth_starter.'||x.sig) IS NULL THEN false
      ELSE has_function_privilege(r.role,'growth_starter.'||x.sig,'EXECUTE') END))
    FROM (VALUES ('anon'),('authenticated'),('service_role'),
      ('growth_starter_reader'),('growth_starter_runtime'),
      ('growth_starter_session_checker')) AS r(role)))),'[]'::jsonb)
   FROM (VALUES ('staging_list_workspaces(text)'),
     ('staging_list_requests(text,text,integer)'),('staging_session_active(text,text,text)')) AS x(sig)) AS legacy,
  (SELECT COALESCE(jsonb_agg(jsonb_build_object('role',r.role,'target',t.target,
   'canSet',pg_has_role(r.role,t.target,'SET'))),'[]'::jsonb)
   FROM (VALUES ('anon'),('authenticated'),('service_role'),
    ('growth_starter_reader'),('growth_starter_runtime'),
    ('growth_starter_session_checker')) AS r(role)
   CROSS JOIN (VALUES ('authenticated'),('service_role'),('postgres'),
     ('growth_starter_reader'),('growth_starter_runtime')) AS t(target)
   WHERE r.role<>t.target) AS role_paths,
  has_schema_privilege('anon','growth_starter','USAGE') AS "anonSchema",
  has_schema_privilege('authenticated','growth_starter','USAGE') AS "authSchema",
  has_schema_privilege('service_role','growth_starter','USAGE') AS "serviceSchema"`;

/** Test fixture only; not consumed by application runtime. */
export function syntheticAcceptedCatalogForTests(){
  const tables=TABLES.map(name=>({name,rls:true}));
  const privileges=ROLES.flatMap(role=>TABLES.map(table=>({
    role,table,columns:role==='authenticated'?[...(ALLOWED_COLUMNS[table]||[])]:[],
    selectTable:false,insert:false,update:false,delete:false,truncate:false,references:false,trigger:false
  })));
  const legacy=LEGACY.map(signature=>({signature,exists:true,publicExecute:false,
    roles:ROLES.map(role=>({role,execute:false}))}));
  const role_paths=ROLES.flatMap(role=>['authenticated','service_role','postgres',
    'growth_starter_reader','growth_starter_runtime'].filter(target=>target!==role)
    .map(target=>({role,target,canSet:false})));
  return structuredClone({policies:APPROVED_POLICIES,tables,privileges,legacy,role_paths,
    anonSchema:false,authSchema:true,serviceSchema:false});
}
