/**
 * Phase 3.15I: one actual restricted gateway LOGIN, NOLOGIN function owners,
 * independent fictional A/B/C accounts, direct DB bypass probes and races.
 * NEVER run on managed Supabase.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {readFileSync} from 'node:fs';
import {randomBytes,randomUUID,createHash} from 'node:crypto';

if(!process.env.TEST_DATABASE_URL||
   /supabase\.co|supabase\.com/i.test(process.env.TEST_DATABASE_URL))
 throw Error('Disposable PostgreSQL17 only; Supabase forbidden.');
const admin=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,max:3});
const GATEWAY='gs315i_gateway',ATTACKER='gs315i_attacker';
const OWNERS=['gs315i_read_owner','gs315i_revoke_owner'];
const A='owner_a_315i',B='owner_b_315i',C='staff_c_315i';
const WA='ws_'+A,WB='ws_'+B;
function makePool(role,pwd){
 const u=new URL(process.env.TEST_DATABASE_URL);
 u.username=role;u.password=pwd;
 return new pg.Pool({connectionString:u.toString(),max:3});
}
function generate(user){
 const id=randomUUID(),secret=randomBytes(32).toString('base64url');
 return {id,user,secret,token:'ce1.'+id+'.'+secret,
  sha:createHash('sha256').update('codeedge-growth-starter:session:v1\0')
   .update(id).update('\0').update(secret).digest('hex')};
}
function wait(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
function deny28000(e){return e?.code==='28000';}
const read=(pool,credential,workspace)=>
 pool.query('SELECT request_id,workspace_id,title FROM gs315i.read_requests($1,$2)',
  [credential,workspace]).then(x=>x.rows);
async function provisionRole(role){
 const password=randomBytes(32).toString('base64url');
 await admin.query('CREATE ROLE '+role+' LOGIN NOINHERIT NOBYPASSRLS NOSUPERUSER '+
   'NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '+"'"+password+"'");
 return makePool(role,password);
}
test('one private gateway principal: A/B/C membership, replay, revocation and ACL',async()=>{
 const version=Number((await admin.query('SHOW server_version_num')).rows[0].server_version_num);
 assert.ok(version>=170000&&version<180000);
 let gateway,attacker,created=false;
 try{
  gateway=await provisionRole(GATEWAY);
  attacker=await provisionRole(ATTACKER);
  await admin.query(readFileSync('tests/postgres/fixtures/phase315i-scalable-authority.sql','utf8'));
  created=true;
  const sessions=new Map([['a',generate(A)],['b',generate(B)],['c',generate(C)]]);
  await admin.query("INSERT INTO gs315i.workspaces(id,owner_user_id) VALUES($1,$2),($3,$4)",
   [WA,A,WB,B]);
  await admin.query("INSERT INTO gs315i.requests(id,workspace_id,title) VALUES"+
   "('request_a',$1,'Fictional A'),('request_b',$2,'Fictional B')",[WA,WB]);
  await admin.query("INSERT INTO gs315i.memberships(workspace_id,user_id,owner_user_id,role)"+
   "VALUES($1,$2,$3,'staff'),($4,$2,$3,'client')",[WA,C,A,WB]);
  for(const s of sessions.values())
   await admin.query('INSERT INTO gs315i.sessions(id,user_id,secret_sha256,expires_at) '+
    'VALUES($1,$2,$3,$4)',[s.id,s.user,s.sha,new Date(Date.now()+900000)]);
  const row=(await gateway.query(
   'SELECT current_user AS role,'+
   ' (SELECT rolbypassrls FROM pg_roles WHERE rolname=current_user) AS bypass,'+
   ' (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) AS superuser,'+
   " has_table_privilege(current_user,'gs315i.requests','SELECT') AS table_select,"+
   " has_table_privilege(current_user,'gs315i.sessions','UPDATE') AS session_update,"+
   " has_function_privilege(current_user,'gs315i.read_requests(text,text)','EXECUTE') AS can_read,"+
   " has_function_privilege(current_user,'gs315i.revoke_session(text)','EXECUTE') AS can_revoke"
  )).rows[0];
  assert.deepEqual(row,{role:GATEWAY,bypass:false,superuser:false,table_select:false,
   session_update:false,can_read:true,can_revoke:true});
  for(const role of OWNERS){
   const values=(await admin.query('SELECT rolcanlogin,rolsuper,rolbypassrls,rolinherit '+
    'FROM pg_roles WHERE rolname=$1',[role])).rows[0];
   assert.deepEqual(values,{rolcanlogin:false,rolsuper:false,
    rolbypassrls:false,rolinherit:false});
   assert.equal((await admin.query("SELECT pg_has_role($1,$2,'SET') AS yes",
    [GATEWAY,role])).rows[0].yes,false);
  }
  assert.equal((await admin.query(
   "SELECT has_table_privilege($1,'gs315i.sessions','UPDATE') AS yes",
   [OWNERS[0]])).rows[0].yes,false);
  assert.equal((await admin.query(
   "SELECT has_table_privilege($1,'gs315i.requests','SELECT') AS yes",
   [OWNERS[1]])).rows[0].yes,false);
  assert.equal((await admin.query(
   "SELECT has_column_privilege($1,'gs315i.sessions','revoked_at','UPDATE') AS yes",
   [OWNERS[1]])).rows[0].yes,true);
  for(const name of ['gs315i.read_requests(text,text)','gs315i.revoke_session(text)']){
   assert.equal((await admin.query("SELECT has_function_privilege($1,$2,'EXECUTE') AS yes",
    [ATTACKER,name])).rows[0].yes,false);
  }
  const meta=(await admin.query("SELECT proname,prosecdef,proconfig,"+
   " pg_get_userbyid(proowner) AS owner FROM pg_proc p JOIN pg_namespace n"+
   " ON n.oid=p.pronamespace WHERE n.nspname='gs315i' ORDER BY proname")).rows;
  assert.equal(meta.length,2);
  for(const fn of meta){
   assert.equal(fn.prosecdef,true);
   assert.ok(fn.proconfig.includes('search_path=pg_catalog, pg_temp')||
    fn.proconfig.includes('search_path=pg_catalog,pg_temp'));
  }
  assert.deepEqual((await read(gateway,sessions.get('a').token,WA)).map(x=>x.request_id),['request_a']);
  assert.deepEqual((await read(gateway,sessions.get('b').token,WB)).map(x=>x.request_id),['request_b']);
  assert.deepEqual((await read(gateway,sessions.get('c').token,WA)).map(x=>x.request_id),['request_a']);
  await assert.rejects(read(gateway,sessions.get('a').token,WB),deny28000);
  await assert.rejects(read(gateway,sessions.get('b').token,WA),deny28000);
  await assert.rejects(read(gateway,sessions.get('c').token,WB),deny28000);
  await assert.rejects(read(gateway,sessions.get('a').token.slice(0,-1)+'x',WA),deny28000);
  await assert.rejects(read(gateway,sessions.get('a').id,WA),deny28000);
  await assert.rejects(read(gateway,sessions.get('a').token,WA+';DROP TABLE x'),deny28000);
  await assert.rejects(gateway.query('SELECT id FROM gs315i.requests'),e=>e.code==='42501');
  await assert.rejects(gateway.query('SELECT secret_sha256 FROM gs315i.sessions'),e=>e.code==='42501');
  await assert.rejects(gateway.query('UPDATE gs315i.sessions SET revoked_at=now()'),e=>e.code==='42501');
  await assert.rejects(gateway.query('SET ROLE gs315i_read_owner'),e=>e.code==='42501');
  await assert.rejects(attacker.query("SELECT * FROM gs315i.read_requests($1,$2)",
   [sessions.get('a').token,WA]),e=>e.code==='42501');

  // A protected read owns its transaction locks until COMMIT. Logouts wait.
  const reader=await gateway.connect();
  let writer;
  try{
   await reader.query('BEGIN');
   assert.equal((await reader.query('SELECT * FROM gs315i.read_requests($1,$2)',
    [sessions.get('a').token,WA])).rowCount,1);
   let settled=false;
   writer=gateway.query('SELECT gs315i.revoke_session($1) AS revoked',
    [sessions.get('a').token]).then(r=>{settled=true;return r;});
   await wait(125);
   assert.equal(settled,false);
   await reader.query('COMMIT');
   assert.equal((await writer).rows[0].revoked,true);
  }finally{await reader.query('ROLLBACK').catch(()=>{});reader.release();}
  await assert.rejects(read(gateway,sessions.get('a').token,WA),deny28000);
  assert.equal((await gateway.query('SELECT gs315i.revoke_session($1) AS revoked',
   [sessions.get('a').token])).rows[0].revoked,true);

  // A member's read holds membership lock; administrative change must wait.
  const memberReader=await gateway.connect(),membershipWriter=await admin.connect();
  let pending;
  try{
   await memberReader.query('BEGIN');
   assert.equal((await memberReader.query('SELECT * FROM gs315i.read_requests($1,$2)',
    [sessions.get('c').token,WA])).rowCount,1);
   pending=(async()=>{
    await membershipWriter.query('BEGIN');
    await membershipWriter.query('SELECT pg_advisory_xact_lock('+
     "hashtextextended('gs315i:member:'||$1||':'||$2,0))",[WA,C]);
    await membershipWriter.query("UPDATE gs315i.memberships SET state='revoked'"+
     " WHERE workspace_id=$1 AND user_id=$2",[WA,C]);
    await membershipWriter.query('COMMIT');
    return true;
   })();
   let settled=false;
   pending.then(()=>{settled=true;});
   await wait(125);
   assert.equal(settled,false);
   await memberReader.query('COMMIT');
   assert.equal(await pending,true);
  }finally{
   await memberReader.query('ROLLBACK').catch(()=>{});
   await membershipWriter.query('ROLLBACK').catch(()=>{});
   memberReader.release();membershipWriter.release();
  }
  await assert.rejects(read(gateway,sessions.get('c').token,WA),deny28000);
  assert.deepEqual((await read(gateway,sessions.get('b').token,WB)).map(x=>x.request_id),['request_b']);

  // Workspace suspension must coordinate via same workspace advisory key.
  const hold=await gateway.connect(),suspender=await admin.connect();
  try{
   await hold.query('BEGIN');
   assert.equal((await hold.query('SELECT * FROM gs315i.read_requests($1,$2)',
    [sessions.get('b').token,WB])).rowCount,1);
   const ongoing=(async()=>{
    await suspender.query('BEGIN');
    await suspender.query("SELECT pg_advisory_xact_lock(hashtextextended('gs315i:workspace:'||$1,0))",[WB]);
    await suspender.query("UPDATE gs315i.workspaces SET state='suspended' WHERE id=$1",[WB]);
    await suspender.query('COMMIT');
    return true;
   })();
   let ended=false;
   ongoing.then(()=>{ended=true;});
   await wait(125);
   assert.equal(ended,false);
   await hold.query('COMMIT');
   assert.equal(await ongoing,true);
  }finally{await hold.query('ROLLBACK').catch(()=>{});await suspender.query('ROLLBACK').catch(()=>{});
   hold.release();suspender.release();}
  await assert.rejects(read(gateway,sessions.get('b').token,WB),deny28000);
 }finally{
  if(gateway)await gateway.end();
  if(attacker)await attacker.end();
  if(created)await admin.query('DROP SCHEMA IF EXISTS gs315i CASCADE');
  for(const role of [...OWNERS,GATEWAY,ATTACKER]){
   if((await admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount){
    await admin.query('DROP OWNED BY '+role+' CASCADE');
    await admin.query('DROP ROLE '+role);
   }
  }
  await admin.end();
 }
});
