import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generateKeyPairSync,sign} from 'node:crypto';
import pg from 'pg';
import {createStagingIdentityVerifier} from '../../backend/staging-identity.mjs';
import {createRestrictedStagingPool,createRestrictedStagingGateway} from '../../backend/staging-restricted-runtime.mjs';

const {Pool}=pg;
if(!process.env.TEST_DATABASE_URL) throw Error('Disposable TEST_DATABASE_URL required');
const admin=new Pool({connectionString:process.env.TEST_DATABASE_URL,max:4});
const users=[{userId:'pilot_owner_R101',email:'a@synthetic.invalid'}, {userId:'pilot_owner_R202',email:'b@synthetic.invalid'}];
const workspace=users.map(u=>'ws_'+u.userId);
const key=generateKeyPairSync('rsa',{modulusLength:2048});
const epoch=Math.floor(Date.now()/1000);
const encode=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
function tokenFor(user,overrides={}) {
  const head=encode({alg:'RS256',typ:'JWT',kid:'pilot_key_v1'});
  const body=encode({iss:'https://synthetic.invalid',aud:'pilot-staging',
    sub:user.userId,email:user.email,email_verified:true,
    sid:'pilot_session_123',jti:'pilot_token_123',iat:epoch,exp:epoch+300,...overrides});
  const joined=head+'.'+body;
  return joined+'.'+sign('RSA-SHA256',Buffer.from(joined),key.privateKey).toString('base64url');
}
let limited,restricted,gateway,server,origin,revoked;
async function call(user,path,{method='GET',token}={}) {
  const r=await fetch(origin+path,{method,headers:token!==undefined?{authorization:'Bearer '+token}:user?{authorization:'Bearer '+tokenFor(user)}:{}});
  return {status:r.status,payload:await r.json()};
}
before(async()=>{
  await admin.query(readFileSync('db/migrations/0001_growth_starter.sql','utf8'));
  await admin.query(readFileSync('db/migrations/0002_staging_readonly.sql','utf8'));
  await admin.query("CREATE ROLE gs_pilot_runtime_test LOGIN NOINHERIT NOBYPASSRLS PASSWORD 'test_only_not_real_secret'");
  await admin.query('GRANT growth_starter_reader TO gs_pilot_runtime_test');
  await admin.query('INSERT INTO growth_starter.workspaces(id,owner_user_id) VALUES($1,$2),($3,$4)',[workspace[0],users[0].userId,workspace[1],users[1].userId]);
  await admin.query("INSERT INTO growth_starter.work_requests(workspace_id,id,title,kind) VALUES($1,'pilotReqOne','One','Website update'),($2,'pilotReqTwo','Two','Local SEO')",[workspace[0],workspace[1]]);
  const uri=new URL(process.env.TEST_DATABASE_URL);
  uri.username='gs_pilot_runtime_test';
  uri.password='test_only_not_real_secret';
  limited=new Pool({connectionString:uri.href,max:4,connectionTimeoutMillis:2000});
  revoked=new Set();
  const verifier=createStagingIdentityVerifier({
    keys:[{kid:'pilot_key_v1',publicKeyPem:key.publicKey.export({format:'pem',type:'spki'})}],
    issuer:'https://synthetic.invalid',audience:'pilot-staging',
    clock:()=>epoch*1000,checkSession:async actor=>!revoked.has(actor.userId),
  });
  // Temporary sanitized CI investigation of reader-role permission profile.
  const profile=(await limited.query(`SELECT
    current_user AS name,
    (SELECT rolinherit FROM pg_roles WHERE rolname='growth_starter_reader') AS reader_inherit,
    (SELECT rolcanlogin FROM pg_roles WHERE rolname='growth_starter_reader') AS reader_login,
    has_schema_privilege('growth_starter_reader','growth_starter','CREATE') AS reader_create,
    (SELECT count(*)::integer FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid
      WHERE n.nspname='growth_starter' AND c.relkind IN ('r','p','v','m','f')
      AND (has_table_privilege('growth_starter_reader',c.oid,'SELECT')
        OR has_table_privilege('growth_starter_reader',c.oid,'INSERT')
        OR has_table_privilege('growth_starter_reader',c.oid,'UPDATE')
        OR has_table_privilege('growth_starter_reader',c.oid,'DELETE'))) AS reader_table_grants,
    (SELECT array_agg(p.proname ORDER BY p.proname) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
      WHERE n.nspname='growth_starter' AND has_function_privilege('growth_starter_reader',p.oid,'EXECUTE')
      AND NOT (
       COALESCE(p.oid=to_regprocedure('growth_starter.staging_list_workspaces(text)'),false)
       OR COALESCE(p.oid=to_regprocedure('growth_starter.staging_list_requests(text,text,integer)'),false)
       OR COALESCE(p.oid=to_regprocedure('growth_starter.staging_session_active(text,text,text)'),false)
      )) AS extra_routines`)).rows[0];
  console.error('SANITIZED_PG_ROLE_DIAG',JSON.stringify(profile));
  restricted=await createRestrictedStagingPool({rawPool:limited});
  gateway=await createRestrictedStagingGateway({rawPool:limited,identityVerifier:verifier,allowedOrigin:'https://staging.synthetic.invalid'});
  server=gateway.createServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  origin='http://127.0.0.1:'+server.address().port;
});
after(async()=>{
  if(server)await new Promise(resolve=>server.close(resolve));
  if(limited)await limited.end();
  await admin.end();
});
test('the actual PostgreSQL network login is not owner/superuser and cannot read tables',async()=>{
  const r=await limited.query('SELECT current_user AS actual_login');
  assert.equal(r.rows[0].actual_login,'gs_pilot_runtime_test');
  await assert.rejects(limited.query('SELECT * FROM growth_starter.workspaces'),e=>e.code==='42501');
  await assert.rejects(limited.query("INSERT INTO growth_starter.workspaces(id,owner_user_id) VALUES('ws_forged_123','forged_123')"),e=>e.code==='42501');
  await assert.rejects(limited.query('SELECT * FROM growth_starter.staging_list_workspaces($1)',[users[0].userId]),e=>e.code==='42501');
});
test('superuser or unverified client connection is rejected before binding gateway',async()=>{
  await assert.rejects(createRestrictedStagingPool({rawPool:admin}),e=>e.status===503);
  await assert.rejects(createRestrictedStagingPool({rawPool:{query:async()=>({rows:[]})}}),e=>e.status===503);
  await assert.rejects(restricted.query('SELECT * FROM growth_starter.workspaces'),e=>e.status===503);
  await assert.rejects(restricted.query('SELECT workspace_id, role FROM growth_starter.staging_list_workspaces($1)', ['../forged']),e=>e.status===503);
});
test('real restricted-login gateway shows only the separately signed account workspace',async()=>{
  const a=await call(users[0],'/v1/workspaces');
  assert.equal(a.status,200);
  assert.deepEqual(a.payload.workspaces.map(x=>x.workspace_id),[workspace[0]]);
  const own=await call(users[1],'/v1/requests?workspaceId='+workspace[1]);
  assert.equal(own.status,200);
  assert.deepEqual(own.payload.items.map(x=>x.id),['pilotReqTwo']);
  const forbidden=await call(users[0],'/v1/requests?workspaceId='+workspace[1]);
  assert.equal(forbidden.status,403);
});
test('staging session revocation, spoofed JWT role and writes fail closed',async()=>{
  const forged=await call(users[0],'/v1/requests?workspaceId='+workspace[1],
    {token:tokenFor(users[0],{role:'owner',workspaceId:workspace[1]})});
  assert.equal(forged.status,403);
  revoked.add(users[0].userId);
  assert.equal((await call(users[0],'/v1/workspaces')).status,401);
  revoked.delete(users[0].userId);
  assert.equal((await call(users[0],'/v1/workspaces',{method:'DELETE'})).status,405);
  assert.equal((await call(users[0],'/v1/workspaces',{token:tokenFor(users[0],{exp:epoch-1})})).status,401);
});

test('reader-role table privilege drift aborts gateway preflight before serving users',async()=>{
  // Deliberate permission drift occurs ONLY in disposable CI.
  await admin.query('GRANT SELECT ON growth_starter.workspaces TO growth_starter_reader');
  try{
    await assert.rejects(createRestrictedStagingPool({rawPool:limited}),e=>e.status===503);
  }finally{
    await admin.query('REVOKE SELECT ON growth_starter.workspaces FROM growth_starter_reader');
  }
  // After revocation, a fresh preflight must succeed again.
  assert.equal((await createRestrictedStagingPool({rawPool:limited})).capabilities.readOnly,true);
});
test('unapproved extra database routine EXECUTE privilege blocks the staging gateway',async()=>{
  await admin.query('CREATE FUNCTION growth_starter.gs_unapproved_test_routine() RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$');
  await admin.query('REVOKE ALL ON FUNCTION growth_starter.gs_unapproved_test_routine() FROM PUBLIC');
  await admin.query('GRANT EXECUTE ON FUNCTION growth_starter.gs_unapproved_test_routine() TO growth_starter_reader');
  try{
    await assert.rejects(createRestrictedStagingPool({rawPool:limited}),e=>e.status===503);
  }finally{
    await admin.query('REVOKE ALL ON FUNCTION growth_starter.gs_unapproved_test_routine() FROM growth_starter_reader');
    await admin.query('DROP FUNCTION growth_starter.gs_unapproved_test_routine()');
  }
  assert.equal((await createRestrictedStagingPool({rawPool:limited})).capabilities.readOnly,true);
});
