/**
 * Phase 3.10: actual two-connection PostgreSQL 17 revocation visibility.
 * Disposable CI database only. Fixture-authenticated PostgreSQL roles are NOT
 * Supabase-authenticated identities and must never be promoted to hosted use.
 *
 * This regression demonstrates READ COMMITTED next-statement visibility and
 * the opposite, dangerous REPEATABLE READ behavior. It does not establish
 * atomic per-request revocation or immediate cancellation of in-flight reads.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import pg from 'pg';
import {PRIVATE_READ_SQL} from '../../backend/private-read-adapter.mjs';

if (!process.env.TEST_DATABASE_URL)
  throw Error('Disposable TEST_DATABASE_URL required; never use hosted Supabase');

const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,max:3});
const A='a310d2e9-f1f0-4cd9-8bfa-0983be1434ab';
const C='c310d2e9-f1f0-4cd9-8bfa-0983be1434ab';
const WS='ws_'+A,ROLE='gs310_revocation_reader';
const REQ='phase310_request';

async function visible(c) {
  const {rows}=await c.query(PRIVATE_READ_SQL.requests,[C,WS,20,0]);
  return rows.map(x=>x.id);
}
async function asReader(conn,isolation) {
  await conn.query('BEGIN ISOLATION LEVEL '+isolation+' READ ONLY');
  await conn.query('SET LOCAL ROLE '+ROLE);
}
async function restore(conn) {
  try{await conn.query('ROLLBACK');}catch{}
}

test('PG17 two-connection membership revocation: READ COMMITTED denies next read; REPEATABLE READ preserves stale snapshot',async()=>{
  const admin=await pool.connect();
  const reader=await pool.connect();
  try {
    const version=Number((await admin.query('SHOW server_version_num')).rows[0].server_version_num);
    assert.ok(version>=170000 && version<180000,'Requires real disposable PostgreSQL 17');

    for(const f of ['0001_growth_starter.sql','0002_staging_readonly.sql','0003_staging_default_deny_rls.sql'])
      await admin.query(readFileSync('db/migrations/'+f,'utf8'));

    await admin.query('INSERT INTO growth_starter.workspaces(id,owner_user_id) VALUES($1,$2)',[WS,A]);
    await admin.query("INSERT INTO growth_starter.memberships(workspace_id,user_id,owner_user_id,role,created_by) VALUES($1,$2,$3,'client',$3)",[WS,C,A]);
    await admin.query("INSERT INTO growth_starter.work_requests(workspace_id,id,title,kind) VALUES($1,$2,'Fictional consent-free test','Other')",[WS,REQ]);

    await admin.query('CREATE ROLE '+ROLE+' NOLOGIN NOINHERIT NOBYPASSRLS NOCREATEROLE NOCREATEDB NOSUPERUSER');
    await admin.query('GRANT USAGE ON SCHEMA growth_starter TO '+ROLE);
    await admin.query('GRANT SELECT(id,owner_user_id,state) ON growth_starter.workspaces TO '+ROLE);
    await admin.query('GRANT SELECT(workspace_id,user_id,owner_user_id,state,role) ON growth_starter.memberships TO '+ROLE);
    await admin.query('GRANT SELECT(id,workspace_id,title,kind,status,version,updated_at) ON growth_starter.work_requests TO '+ROLE);

    // Entirely fictional principal uses a fixed member identity in policies.
    // It cannot choose an identity by forged request.jwt.claim.sub.
    await admin.query("CREATE POLICY gs310_member ON growth_starter.memberships FOR SELECT TO "+ROLE+
      " USING (user_id='"+C+"' AND owner_user_id='"+A+"' AND state='active')");
    await admin.query("CREATE POLICY gs310_ws ON growth_starter.workspaces FOR SELECT TO "+ROLE+
      " USING (state='active' AND EXISTS (SELECT 1 FROM growth_starter.memberships m WHERE m.workspace_id=workspaces.id AND m.owner_user_id=workspaces.owner_user_id AND m.user_id='"+C+"' AND m.state='active'))");
    await admin.query("CREATE POLICY gs310_requests ON growth_starter.work_requests FOR SELECT TO "+ROLE+
      " USING (EXISTS (SELECT 1 FROM growth_starter.workspaces w WHERE w.id=work_requests.workspace_id AND w.state='active'))");

    // Each READ COMMITTED statement obtains a new committed snapshot.
    await asReader(reader,'READ COMMITTED');
    assert.deepEqual(await visible(reader),[REQ]);
    await admin.query("UPDATE growth_starter.memberships SET state='revoked',revoked_at=now() WHERE workspace_id=$1 AND user_id=$2",[WS,C]);
    assert.deepEqual(await visible(reader),[],'Committed revoke must deny the following SQL statement');
    await reader.query('COMMIT');

    // A new request after revocation must also deny.
    await asReader(reader,'READ COMMITTED');
    assert.deepEqual(await visible(reader),[]);
    await reader.query('COMMIT');

    // Negative acceptance evidence: a long-lived REPEATABLE READ transaction
    // retains old authorization rows even after another connection revokes.
    await admin.query("UPDATE growth_starter.memberships SET state='active',revoked_at=NULL WHERE workspace_id=$1 AND user_id=$2",[WS,C]);
    await asReader(reader,'REPEATABLE READ');
    assert.deepEqual(await visible(reader),[REQ]);
    await admin.query("UPDATE growth_starter.memberships SET state='revoked',revoked_at=now() WHERE workspace_id=$1 AND user_id=$2",[WS,C]);
    assert.deepEqual(await visible(reader),[REQ],
      'Negative finding: same repeatable-read snapshot still exposes revoked member');
    await reader.query('COMMIT');

    await asReader(reader,'READ COMMITTED');
    assert.deepEqual(await visible(reader),[]);
    await reader.query('COMMIT');

    // No SQL-based test can prove a revocation cancels a statement already
    // executing on an earlier MVCC snapshot. Hosted acceptance remains BLOCKED.
  }finally {
    await restore(reader);
    reader.release();
    try{
      await admin.query('DELETE FROM growth_starter.work_requests WHERE workspace_id=$1',[WS]);
      await admin.query('DELETE FROM growth_starter.memberships WHERE workspace_id=$1',[WS]);
      await admin.query('DELETE FROM growth_starter.workspaces WHERE id=$1',[WS]);
      // DROP OWNED revokes test-only grants and removes its three policies.
      await admin.query('DROP OWNED BY '+ROLE);
      await admin.query('DROP ROLE '+ROLE);
    }catch{/* Disposable CI database will be discarded regardless. */}
    admin.release();
    await pool.end();
  }
});
