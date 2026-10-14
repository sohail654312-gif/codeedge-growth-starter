/**
 * PHASE 3.9 — disposable database-enforced tenant isolation experiment.
 * NEVER install these fixture roles or policies into hosted Supabase.
 * Proves scoped PG role + RLS separation under SET LOCAL ROLE from disposable
 * CI superuser. Does NOT prove how a production backend safely chooses that role.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import pg from 'pg';
import {PRIVATE_READ_SQL} from '../../backend/private-read-adapter.mjs';

if(!process.env.TEST_DATABASE_URL)throw Error('Disposable PostgreSQL only; hosted DB forbidden.');
const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,max:2});
const ids={
 A:'a39d2e94-f1f0-4cd9-8bfa-0983be1434ab',
 B:'b39d2e94-f1f0-4cd9-8bfa-0983be1434ab',
 C:'c39d2e94-f1f0-4cd9-8bfa-0983be1434ab'
};
const WA='ws_'+ids.A,WB='ws_'+ids.B;
const ROLE_A='gs39_private_tenant_a',ROLE_B='gs39_private_tenant_b';

async function asTenant(client,role,sql,args=[]){
  assert.ok([ROLE_A,ROLE_B].includes(role),'only fixed approved test principal');
  await client.query('SAVEPOINT gs39_tenant');
  try{
    // CI database superuser simulates a *dedicated* tenant principal.
    // Production cannot use a universal role-switching superuser/login.
    await client.query('SET LOCAL ROLE '+role);
    return await client.query(sql,args);
  }finally{
    await client.query('ROLLBACK TO SAVEPOINT gs39_tenant');
    await client.query('RELEASE SAVEPOINT gs39_tenant');
  }
}
async function denied(client,role,sql,args=[]){
  await assert.rejects(asTenant(client,role,sql,args),e=>e.code==='42501');
}
test('PG17 disposable: tenant principals, FORCE RLS, hidden columns, GUC spoofing, revoked membership',async()=>{
  const c=await pool.connect();
  try{
    for(const file of ['0001_growth_starter.sql','0002_staging_readonly.sql','0003_staging_default_deny_rls.sql'])
      await c.query(readFileSync('db/migrations/'+file,'utf8'));
    await c.query('BEGIN');
    try{
      await c.query("INSERT INTO growth_starter.workspaces(id,owner_user_id) VALUES($1,$2),($3,$4)",[WA,ids.A,WB,ids.B]);
      await c.query("INSERT INTO growth_starter.memberships(workspace_id,user_id,owner_user_id,role,created_by) VALUES($1,$2,$3,'client',$3)",[WA,ids.C,ids.A]);
      await c.query("INSERT INTO growth_starter.work_requests(workspace_id,id,title,kind) VALUES($1,'gs39_a','Fictional website','Website update'),($2,'gs39_b','Fictional SEO','Local SEO')",[WA,WB]);
      for(const role of [ROLE_A,ROLE_B]){
        await c.query('CREATE ROLE '+role+' NOLOGIN NOINHERIT NOBYPASSRLS NOCREATEDB NOCREATEROLE NOSUPERUSER');
        await c.query('GRANT USAGE ON SCHEMA growth_starter TO '+role);
        await c.query('GRANT SELECT(id,owner_user_id,state) ON growth_starter.workspaces TO '+role);
        await c.query('GRANT SELECT(workspace_id,user_id,owner_user_id,role,state) ON growth_starter.memberships TO '+role);
        await c.query('GRANT SELECT(id,workspace_id,title,kind,status,version,updated_at) ON growth_starter.work_requests TO '+role);
      }
      for(const table of ['workspaces','memberships','work_requests']){
        await c.query('ALTER TABLE growth_starter.'+table+' FORCE ROW LEVEL SECURITY');
        await c.query("CREATE POLICY gs39_a_"+table+" ON growth_starter."+table+" FOR SELECT TO "+ROLE_A+" USING ("+(table==='workspaces'?"id":'workspace_id')+" = '"+WA+"')");
        await c.query("CREATE POLICY gs39_b_"+table+" ON growth_starter."+table+" FOR SELECT TO "+ROLE_B+" USING ("+(table==='workspaces'?"id":'workspace_id')+" = '"+WB+"')");
      }
      for(const [principal,own,other,id] of [[ROLE_A,WA,WB,ids.A],[ROLE_B,WB,WA,ids.B]]){
        const workspaces=(await asTenant(c,principal,PRIVATE_READ_SQL.workspaces,[id])).rows;
        assert.deepEqual(workspaces.map(x=>x.workspace_id),[own]);
        const requests=(await asTenant(c,principal,PRIVATE_READ_SQL.requests,[id,own,20,0])).rows;
        assert.equal(requests.length,1);
        assert.deepEqual((await asTenant(c,principal,PRIVATE_READ_SQL.requests,[id,other,20,0])).rows,[]);
        assert.deepEqual((await asTenant(c,principal,'SELECT id FROM growth_starter.workspaces ORDER BY id')).rows.map(x=>x.id),[own],
          'direct SQL bypass must still be tenant-scoped');
        assert.deepEqual((await asTenant(c,principal,'SELECT workspace_id FROM growth_starter.work_requests ORDER BY id')).rows.map(x=>x.workspace_id),[own]);
        assert.deepEqual((await asTenant(c,principal,'SELECT workspace_id FROM growth_starter.memberships')).rows.map(x=>x.workspace_id),principal===ROLE_A?[WA]:[]);
        await denied(c,principal,'SELECT reviewed_by FROM growth_starter.work_requests');
        await denied(c,principal,'SELECT id FROM growth_starter.invitations');
        await denied(c,principal,'SELECT id FROM growth_starter.media');
        await denied(c,principal,"UPDATE growth_starter.workspaces SET state='suspended'");
        await denied(c,principal,'ALTER TABLE growth_starter.workspaces DISABLE ROW LEVEL SECURITY');
        const audit=(await c.query(
          "SELECT rolcanlogin,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb FROM pg_roles WHERE rolname=$1",[principal])).rows[0];
        assert.ok(Object.values(audit).every(v=>v===false));
        assert.equal((await c.query('SELECT pg_has_role($1,$2,$3) AS allowed',[principal,principal===ROLE_A?ROLE_B:ROLE_A,'SET'])).rows[0].allowed,false);
        for(const fn of [
          'growth_starter.staging_list_workspaces(text)',
          'growth_starter.staging_list_requests(text,text,integer)'
        ])assert.equal((await c.query('SELECT has_function_privilege($1,$2,$3) AS allowed',[principal,fn,'EXECUTE'])).rows[0].allowed,false);
      }
      // Spoofing the client actor argument and writable request GUC never
      // changes the database-enforced row boundary.
      await c.query('SAVEPOINT gs39_spoof');
      try{
        await c.query('SET LOCAL ROLE '+ROLE_A);
        await c.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[ids.B]);
        await c.query("SELECT set_config('app.current_user_id',$1,true)",[ids.B]);
        assert.deepEqual((await c.query('SELECT id FROM growth_starter.workspaces ORDER BY id')).rows.map(x=>x.id),[WA]);
        assert.deepEqual((await c.query(PRIVATE_READ_SQL.requests,[ids.B,WB,20,0])).rows,[]);
      }finally{
        await c.query('ROLLBACK TO SAVEPOINT gs39_spoof');
        await c.query('RELEASE SAVEPOINT gs39_spoof');
      }
      assert.deepEqual((await asTenant(c,ROLE_A,PRIVATE_READ_SQL.workspaces,[ids.C])).rows.map(x=>x.workspace_id),[WA]);
      await c.query("UPDATE growth_starter.memberships SET state='revoked',revoked_at=now() WHERE workspace_id=$1 AND user_id=$2",[WA,ids.C]);
      assert.deepEqual((await asTenant(c,ROLE_A,PRIVATE_READ_SQL.workspaces,[ids.C])).rows,[]);
      assert.deepEqual((await asTenant(c,ROLE_A,PRIVATE_READ_SQL.requests,[ids.C,WA,20,0])).rows,[]);
      // A role-scoped tenant principal STILL reads other rows within its own
      // tenant when issuing raw SQL. User-level membership must remain a
      // separate authenticated server check. A compromised multi-tenant
      // server holding both principals still has both tenants' credentials.
      assert.deepEqual((await asTenant(c,ROLE_A,'SELECT id FROM growth_starter.workspaces')).rows.map(x=>x.id),[WA]);
    }finally{await c.query('ROLLBACK');}
  }finally{c.release();await pool.end();}
});
