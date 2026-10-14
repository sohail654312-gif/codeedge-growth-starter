import test from 'node:test';
import assert from 'node:assert/strict';
import {readStagingConfig} from '../staging/config.mjs';
const ref='dbppeymhsemvghbvuvof';
const env=()=>({
  STAGING_DATABASE_URL:'postgresql://growth_starter_runtime:'+('A'.repeat(40))+'@db.'+ref+'.supabase.co:5432/postgres',
  STAGING_POSTGRES_CA_PEM:'-----BEGIN CERTIFICATE-----\nSYNTHETIC-TEST-ONLY\n-----END CERTIFICATE-----',
  STAGING_SUPABASE_URL:'https://'+ref+'.supabase.co',
  STAGING_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_synthetic_staging_testing_only',
  STAGING_ALLOWED_ORIGIN:'https://growth-starter-phase-2-qa-sandbox-gve53p.v2.appdeploy.ai/'
});
test('requires pinned staging database and TLS trust material',()=>{
 const cfg=readStagingConfig(env());
 assert.equal(cfg.supabaseUrl,'https://'+ref+'.supabase.co');
 assert.equal(cfg.host,'127.0.0.1');
 assert.equal(cfg.port,8787);
});
test('rejects privilege escalation and wrong database or project',()=>{
 const e=env();
 for(const url of [
   'postgresql://postgres:'+('A'.repeat(40))+'@db.'+ref+'.supabase.co:5432/postgres',
   'postgresql://growth_starter_runtime:'+('A'.repeat(40))+'@db.other.supabase.co:5432/postgres',
   'postgresql://growth_starter_runtime:'+('A'.repeat(40))+'@db.'+ref+'.supabase.co:5432/postgres?sslmode=disable',
   'postgresql://growth_starter_runtime:bad@db.'+ref+'.supabase.co:5432/postgres',
   'postgresql://growth_starter_runtime:'+('A'.repeat(40))+'@evil.invalid:5432/postgres'
 ])assert.throws(()=>readStagingConfig({...e,STAGING_DATABASE_URL:url}));
});
test('rejects missing secrets, invalid CORS and plain HTTP exposure',()=>{
 const e=env();
 assert.throws(()=>readStagingConfig({...e,STAGING_POSTGRES_CA_PEM:''}));
 assert.throws(()=>readStagingConfig({...e,STAGING_ALLOWED_ORIGIN:'http://evil.invalid'}));
 assert.throws(()=>readStagingConfig({...e,STAGING_BIND_HOST:'0.0.0.0'}));
 assert.equal(readStagingConfig({...e,STAGING_BIND_HOST:'0.0.0.0',STAGING_TLS_TERMINATED:'true'}).host,'0.0.0.0');
});
test('restricted session pooler connection username matches the exact project',()=>{
 const e=env(), host='aws-0-ap-south-1.pooler.supabase.com';
 const u='postgresql://growth_starter_runtime.'+ref+':'+('A'.repeat(40))+'@'+host+':5432/postgres';
 assert.equal(readStagingConfig({...e,STAGING_DATABASE_URL:u}).port,8787);
 assert.throws(()=>readStagingConfig({...e,STAGING_DATABASE_URL:u.replace(ref,'otherproject')}));
});
