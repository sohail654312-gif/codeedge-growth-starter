/**
 * Phase 3.15H: DISPOSABLE PostgreSQL17 proof with THREE genuine login roles.
 * No real Supabase host, users, tenant data, connections or grants.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {createDisposableRestrictedRuntime,createHostedRestrictedRuntime}
 from '../../backend/phase315h-restricted-runtime.mjs';

if(!process.env.TEST_DATABASE_URL ||
   /supabase\.co|supabase\.com/i.test(process.env.TEST_DATABASE_URL))
 throw Error('Phase 3.15H requires disposable PostgreSQL17, never Supabase.');
const admin=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,max:2});
const OWNER_A='owner_A315H11111',OWNER_B='owner_B315H22222';
const WA='ws_'+OWNER_A,WB='ws_'+OWNER_B;
const RA='gs315h_test_a',RB='gs315h_test_b',WR='gs315h_test_writer';
const roles=[RA,RB,WR];
function loginPool(role,secret){
 const u=new URL(process.env.TEST_DATABASE_URL);
 u.username=role;u.password=secret;
 return new pg.Pool({connectionString:u.toString(),max:2});
}
function digest(id,secret){
 return createHash('sha256').update('codeedge-growth-starter:session:v1\0')
  .update(id).update('\0').update(secret).digest('hex');
}
function alterLast(value){
 const char=value.slice(-1);
 return value.slice(0,-1)+(char==='A'?'B':'A');
}
async function snapshot(pool){
 const r=await pool.query(
  'SELECT current_user AS actor,'+
  "has_table_privilege(current_user,'gs315h.requests','UPDATE') AS work_update,"+
  "has_table_privilege(current_user,'gs315h.requests','INSERT') AS work_insert,"+
  "has_column_privilege(current_user,'gs315h.sessions','revoked_at','UPDATE') AS revocation_update,"+
  "has_table_privilege(current_user,'gs315h.sessions','INSERT') AS session_insert,"+
  "(SELECT rolbypassrls FROM pg_roles WHERE rolname=current_user) AS bypass,"+
  "(SELECT rolsuper FROM pg_roles WHERE rolname=current_user) AS superuser"
 );
 return r.rows[0];
}
test('real PG17 LOGIN roles: tenant RLS, no write grants, serialized Codeedge revocation',async()=>{
 assert.throws(()=>createHostedRestrictedRuntime(),/disabled/);
 assert.throws(()=>createDisposableRestrictedRuntime({}),/Disposable-only/);
 const version=Number((await admin.query('SHOW server_version_num')).rows[0].server_version_num);
 assert.ok(version>=170000&&version<180000);
 const connections=new Map();
 let schemaCreated=false;
 try{
  await admin.query('CREATE SCHEMA gs315h');
  schemaCreated=true;
  await admin.query('REVOKE ALL ON SCHEMA gs315h FROM PUBLIC');
  await admin.query("CREATE TABLE gs315h.sessions ("+
   "id uuid PRIMARY KEY,owner text NOT NULL,secret_sha256 text NOT NULL,"+
   "expires_at timestamptz NOT NULL,revoked_at timestamptz,"+
   "internal_provider_token text NOT NULL DEFAULT 'fictional-private')");
  await admin.query("CREATE TABLE gs315h.requests ("+
   "id text PRIMARY KEY,workspace text NOT NULL,title text NOT NULL,"+
   "internal_note text NOT NULL DEFAULT 'never expose')");
  for(const table of ['sessions','requests']){
   await admin.query('REVOKE ALL ON gs315h.'+table+' FROM PUBLIC');
   await admin.query('ALTER TABLE gs315h.'+table+' ENABLE ROW LEVEL SECURITY');
   await admin.query('ALTER TABLE gs315h.'+table+' FORCE ROW LEVEL SECURITY');
  }
  await admin.query("INSERT INTO gs315h.requests(id,workspace,title) VALUES "+
   "('r315h_a',$1,'Fictional A'),('r315h_b',$2,'Fictional B')",[WA,WB]);
  const tokens=new Map();
  for(const [key,owner] of [['a',OWNER_A],['b',OWNER_B]]){
   const id=randomUUID(),secret=randomBytes(32).toString('base64url');
   tokens.set(key,'ce1.'+id+'.'+secret);
   await admin.query(
    "INSERT INTO gs315h.sessions(id,owner,secret_sha256,expires_at) VALUES($1,$2,$3,$4)",
    [id,owner,digest(id,secret),new Date(Date.now()+900000)]
   );
  }
  for(const role of roles){
   const password=randomBytes(32).toString('base64url');
   assert.match(password,/^[A-Za-z0-9_-]{43}$/);
   await admin.query("CREATE ROLE "+role+" LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS "+
    "NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '"+password+"'");
   connections.set(role,loginPool(role,password));
  }
  for(const [role,owner,workspace] of [[RA,OWNER_A,WA],[RB,OWNER_B,WB]]){
   await admin.query('GRANT USAGE ON SCHEMA gs315h TO '+role);
   await admin.query('GRANT SELECT(id,owner,secret_sha256,expires_at,revoked_at) '+
    'ON gs315h.sessions TO '+role);
   await admin.query('GRANT SELECT(id,workspace,title) ON gs315h.requests TO '+role);
   await admin.query('CREATE POLICY h_session_'+role+' ON gs315h.sessions '+
    "FOR SELECT TO "+role+" USING(owner='"+owner+"')");
   await admin.query('CREATE POLICY h_requests_'+role+' ON gs315h.requests '+
    "FOR SELECT TO "+role+" USING(workspace='"+workspace+"')");
  }
  await admin.query('GRANT USAGE ON SCHEMA gs315h TO '+WR);
  await admin.query('GRANT SELECT(id,secret_sha256,revoked_at) ON gs315h.sessions TO '+WR);
  await admin.query('GRANT UPDATE(revoked_at) ON gs315h.sessions TO '+WR);
  await admin.query('CREATE POLICY h_writer_read ON gs315h.sessions '+
   'FOR SELECT TO '+WR+' USING(true)');
  await admin.query('CREATE POLICY h_writer_update ON gs315h.sessions '+
   'FOR UPDATE TO '+WR+' USING(true) WITH CHECK(true)');
  const pa=connections.get(RA),pb=connections.get(RB),pw=connections.get(WR);
  for(const [role,pool] of [[RA,pa],[RB,pb],[WR,pw]]){
   const s=await snapshot(pool);
   assert.equal(s.actor,role);
   assert.equal(s.bypass,false);
   assert.equal(s.superuser,false);
   assert.equal(s.work_update,false);
   assert.equal(s.work_insert,false);
   assert.equal(s.session_insert,false);
   assert.equal(s.revocation_update,role===WR);
  }
  assert.deepEqual((await pa.query('SELECT id FROM gs315h.requests')).rows.map(r=>r.id),['r315h_a']);
  assert.deepEqual((await pb.query('SELECT id FROM gs315h.requests')).rows.map(r=>r.id),['r315h_b']);
  assert.deepEqual((await pa.query('SELECT id FROM gs315h.requests WHERE workspace=$1',[WB])).rows,[]);
  await assert.rejects(pa.query('SELECT * FROM gs315h.requests'),e=>e.code==='42501');
  await assert.rejects(pa.query('SELECT internal_provider_token FROM gs315h.sessions'),e=>e.code==='42501');
  await assert.rejects(pa.query("UPDATE gs315h.sessions SET revoked_at=now()"),e=>e.code==='42501');
  await assert.rejects(pb.query('SET ROLE '+WR),e=>e.code==='42501');
  await assert.rejects(pw.query('SET ROLE '+RA),e=>e.code==='42501');
  await assert.rejects(pw.query('SELECT title FROM gs315h.requests'),e=>e.code==='42501');
  await assert.rejects(pw.query("INSERT INTO gs315h.sessions(id,owner,secret_sha256,expires_at) "+
   "VALUES(gen_random_uuid(),'evil','a',now())"),e=>e.code==='42501');

  const api=createDisposableRestrictedRuntime({tenantPools:new Map([[WA,pa],[WB,pb]]),
   revocationPool:pw,fictionalTestOnly:true});
  assert.deepEqual((await api.read({token:tokens.get('a'),workspaceId:WA})).map(r=>r.id),['r315h_a']);
  assert.deepEqual((await api.read({token:tokens.get('b'),workspaceId:WB})).map(r=>r.id),['r315h_b']);
  await assert.rejects(api.read({token:tokens.get('a'),workspaceId:WB}),/denied/);
  await assert.rejects(api.read({token:tokens.get('b'),workspaceId:WA}),/denied/);
  await assert.rejects(api.read({token:alterLast(tokens.get('a')),workspaceId:WA}),/denied/);
  let release,entered;
  const hold=new Promise(resolve=>{release=resolve;});
  const ready=new Promise(resolve=>{entered=resolve;});
  const activeRead=api.read({token:tokens.get('a'),workspaceId:WA,
   holdForTest:async()=>{entered();await hold;}});
  await ready;
  let completed=false;
  const pending=api.revoke({token:tokens.get('a')}).then(r=>{completed=true;return r;});
  try{
   await new Promise(resolve=>setTimeout(resolve,125));
   assert.equal(completed,false,'revocation waits on a shared lock without reader UPDATE');
  }finally{release();}
  assert.deepEqual((await activeRead).map(x=>x.id),['r315h_a']);
  assert.deepEqual(await pending,{revoked:true});
  await assert.rejects(api.read({token:tokens.get('a'),workspaceId:WA}),/denied/);
  assert.deepEqual((await api.read({token:tokens.get('b'),workspaceId:WB})).map(x=>x.id),['r315h_b']);
  await assert.rejects(api.revoke({token:alterLast(tokens.get('b'))}),/denied/);
  assert.deepEqual(await api.revoke({token:tokens.get('b')}),{revoked:true});
  await assert.rejects(api.read({token:tokens.get('b'),workspaceId:WB}),/denied/);
 }finally{
  for(const pool of connections.values())await pool.end();
  if(schemaCreated)await admin.query('DROP SCHEMA gs315h CASCADE');
  for(const role of roles){
   await admin.query('DROP OWNED BY '+role+' CASCADE');
   await admin.query('DROP ROLE '+role);
  }
  await admin.end();
 }
});
