import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import pg from 'pg';
import {CATALOG_SQL,checkAcceptedCatalog} from '../../backend/pg-rls-catalog.mjs';
if(!process.env.TEST_DATABASE_URL)throw Error('Disposable PostgreSQL only; hosted Supabase forbidden.');
const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,max:2});
const read=p=>readFileSync(p,'utf8');
test('disposable policy catalog reads real SQL state and detects legacy grant/role-switch, then verifies transactional cutover',async()=>{
 const c=await pool.connect();
 try{
  for(const name of ['0001_growth_starter.sql','0002_staging_readonly.sql','0003_staging_default_deny_rls.sql','0004_prepare_runtime_role.sql'])
   await c.query(read('db/migrations/'+name));
  await c.query('CREATE SCHEMA IF NOT EXISTS auth');
  await c.query(`DO $$BEGIN
   IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
   IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
   IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
  END$$`);
  await c.query(`CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
   $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$`);
  await c.query('BEGIN');
  try{
   await c.query('CREATE TABLE IF NOT EXISTS auth.users(id uuid primary key,deleted_at timestamptz,banned_until timestamptz)');
   await c.query('CREATE TABLE IF NOT EXISTS auth.sessions(id uuid primary key,user_id uuid references auth.users(id),not_after timestamptz)');
   await c.query(read('db/drafts/0010_session_checker_minimal_auth_columns_REVIEW_ONLY.sql'));
   await c.query(read('db/drafts/0008_authenticated_read_rls_REVIEW_ONLY.sql'));
   const before=(await c.query(CATALOG_SQL)).rows[0];
   assert.equal(before.tables.length,7);
   assert.equal(before.policies.length,3);
   assert.ok(before.legacy.some(x=>x.roles.some(r=>r.role==='growth_starter_reader'&&r.execute)));
   assert.ok(before.role_paths.some(x=>x.role==='growth_starter_runtime'&&x.target==='growth_starter_reader'&&x.canSet));
   assert.throws(()=>checkAcceptedCatalog(before),/unavailable/);
   await c.query(read('db/drafts/0007_disable_legacy_actor_definers_REVIEW_ONLY.sql'));
   await c.query(read('db/drafts/0009_cutover_assertions_REVIEW_ONLY.sql'));
   const after=(await c.query(CATALOG_SQL)).rows[0];
   assert.equal(after.policies.length,3);
   assert.ok(after.legacy.every(x=>x.roles.every(r=>!r.execute)&&!x.publicExecute));
   assert.ok(after.role_paths.every(x=>!x.canSet));
   // This is PostgreSQL 16 in CI; reviewed production snapshot was PostgreSQL 17.
   // If its deparser differs, security verifier MUST fail closed, never adapt automatically.
   const expectedNames=new Set(['gs32_active_workspace_read','gs32_membership_self_read','gs32_active_workspace_requests_read']);
   assert.ok(after.policies.every(x=>expectedNames.has(x.name)));
   // Intentionally don't elevate a simulated JWT/PG16 text match to hosted approval.
  }finally{await c.query('ROLLBACK');}
 }finally{c.release();await pool.end();}
});
