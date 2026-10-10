/**
 * Phase 3.8: real disposable PG16 SQL compatibility and tenant filters.
 * Tests SQL predicates under a fixture owner. Does NOT prove a deployable
 * least-privileged role or provider-trusted Auth/RLS.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import pg from 'pg';
import {PRIVATE_READ_SQL} from '../../backend/private-read-adapter.mjs';
if(!process.env.TEST_DATABASE_URL)throw Error('Disposable PostgreSQL only; hosted Supabase forbidden.');
const {Pool}=pg;
const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL,max:1});
const A='a38d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const B='b38d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const C='c38d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const D='d38d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const WA='ws_'+A,WB='ws_'+B;
test('real disposable SQL: text IDs, scoped rows, membership owner binding and immediate revocation',async()=>{
 const c=await pool.connect();
 try{
  for(const f of ['0001_growth_starter.sql','0002_staging_readonly.sql','0003_staging_default_deny_rls.sql'])
   await c.query(readFileSync('db/migrations/'+f,'utf8'));
  await c.query('BEGIN');
  try{
   await c.query('INSERT INTO growth_starter.workspaces(id,owner_user_id) VALUES ($1,$2),($3,$4)',[WA,A,WB,B]);
   await c.query("INSERT INTO growth_starter.memberships(workspace_id,user_id,owner_user_id,role,created_by) VALUES ($1,$2,$3,'client',$3),($1,$4,$5,'staff',$3)",[WA,C,A,D,B]);
   await c.query("INSERT INTO growth_starter.work_requests(workspace_id,id,title,kind) VALUES($1,'a38_request','Fictional request A','Local SEO'),($2,'b38_request','Fictional request B','Website update')",[WA,WB]);
   const workspaces=async id=>(await c.query(PRIVATE_READ_SQL.workspaces,[id])).rows;
   const requests=async(id,ws)=>(await c.query(PRIVATE_READ_SQL.requests,[id,ws,20,0])).rows;
   assert.deepEqual((await workspaces(A)).map(x=>x.workspace_id),[WA]);
   assert.deepEqual((await workspaces(B)).map(x=>x.workspace_id),[WB]);
   assert.deepEqual((await workspaces(C)).map(x=>x.workspace_id),[WA]);
   assert.deepEqual(await workspaces(D),[],'forged membership owner cannot authorize access');
   assert.deepEqual((await requests(A,WA)).map(x=>x.id),['a38_request']);
   assert.deepEqual((await requests(B,WB)).map(x=>x.id),['b38_request']);
   assert.deepEqual((await requests(C,WA)).map(x=>x.id),['a38_request']);
   assert.deepEqual(await requests(A,WB),[]);
   assert.deepEqual(await requests(B,WA),[]);
   assert.deepEqual(await requests(D,WA),[]);
   const [row]=await requests(A,WA);
   assert.deepEqual(Object.keys(row).sort(),['id','workspace_id','title','kind','status','version','updated_at'].sort());
   assert.equal(typeof row.updated_at,'string');
   assert.ok(Number.isFinite(Date.parse(row.updated_at)));
   assert.deepEqual(await workspaces("' OR true --"),[]);
   assert.deepEqual(await requests("' OR true --",WA),[]);
   await c.query("UPDATE growth_starter.memberships SET state='revoked',revoked_at=now() WHERE workspace_id=$1 AND user_id=$2",[WA,C]);
   assert.deepEqual(await workspaces(C),[]);
   assert.deepEqual(await requests(C,WA),[]);
   await c.query("UPDATE growth_starter.workspaces SET state='suspended' WHERE id=$1",[WA]);
   assert.deepEqual(await workspaces(A),[]);
   assert.deepEqual(await requests(A,WA),[]);
  }finally{await c.query('ROLLBACK');}
  await c.query('BEGIN');
  try {
   await c.query('SET LOCAL ROLE growth_starter_reader');
   await assert.rejects(c.query(PRIVATE_READ_SQL.workspaces,[A]),e=>e.code==='42501');
  }finally{await c.query('ROLLBACK');}
 }finally{c.release();await pool.end();}
});
