import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import pg from 'pg';
const {Pool}=pg;
if(!process.env.TEST_DATABASE_URL)throw Error('Disposable PostgreSQL TEST_DATABASE_URL required; not Supabase.');
const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL,max:2});
test('SEO review-only DDL is default deny, has composite tenant keys and never persists after rollback',async()=>{
 const c=await pool.connect();
 try{
  for(const f of ['0001_growth_starter.sql','0002_staging_readonly.sql','0004_prepare_runtime_role.sql'])
    await c.query(readFileSync('db/migrations/'+f,'utf8'));
  await c.query('BEGIN');
  try{
   await c.query(readFileSync('db/drafts/0006_seo_reports_REVIEW_ONLY.sql','utf8'));
   for(const name of ['seo_reports','seo_report_revisions','seo_review_events']){
    const q="SELECT c.relrowsecurity AS rls, has_table_privilege('growth_starter_reader',c.oid,'SELECT') AS reader_select, has_table_privilege('growth_starter_runtime',c.oid,'INSERT') AS runtime_insert, (SELECT count(*)::int FROM pg_policies p WHERE p.schemaname='growth_starter' AND p.tablename=c.relname) AS policies FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='growth_starter' AND c.relname=$1";
    const meta=(await c.query(q,[name])).rows[0];
    assert.ok(meta,name);
    assert.equal(meta.rls,true);
    assert.equal(meta.reader_select,false);
    assert.equal(meta.runtime_insert,false);
    assert.equal(meta.policies,0);
   }
   await c.query("INSERT INTO growth_starter.workspaces(id,owner_user_id) VALUES ('ws_seo_test_owner_A','seo_test_owner_A'),('ws_seo_test_owner_B','seo_test_owner_B')");
   await c.query("INSERT INTO growth_starter.seo_reports(id,workspace_id,business_ref,created_by_verified_subject,source_class) VALUES ('7902eaa1-4290-4a2f-99b8-c9fe4c2a6db8','ws_seo_test_owner_A','biz_synthetic_ownerA_01','seo_test_owner_A','offline_supplied_html_only')");
   const insert="INSERT INTO growth_starter.seo_report_revisions(report_id,revision,workspace_id,report_type,source_digest,report_digest,created_by_verified_subject,evidence) VALUES ('7902eaa1-4290-4a2f-99b8-c9fe4c2a6db8',1,'ws_seo_test_owner_B','offline',$1,$2,'seo_test_owner_B','{}')";
   await assert.rejects(c.query(insert,['a'.repeat(64),'b'.repeat(64)]),e=>e.code==='23503');
  }finally{await c.query('ROLLBACK');}
  const q=await c.query("SELECT to_regclass('growth_starter.seo_reports') AS name");
  assert.equal(q.rows[0].name,null);
 }finally{c.release();await pool.end();}
});
