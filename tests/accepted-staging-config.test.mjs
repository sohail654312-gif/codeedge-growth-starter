import test from 'node:test';
import assert from 'node:assert/strict';
import {readAcceptedStagingConfig} from '../staging/accepted-config.mjs';
const fixture=()=>({
 STAGING_SUPABASE_URL:'https://synthetic-project.supabase.co/',
 STAGING_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_synthetic_only_not_real',
 STAGING_ALLOWED_ORIGIN:'https://client.synthetic.invalid/',
 STAGING_SESSION_DATABASE_URL:'postgres://growth_starter_session_checker:very-long-synthetic-password-000001@db.synthetic-project.supabase.co/postgres',
 STAGING_POSTGRES_CA_PEM:'-----BEGIN CERTIFICATE-----\nSYNTHETIC\n-----END CERTIFICATE-----',
 STAGING_PUBLIC_HOST:'api.synthetic.invalid',
 STAGING_DEPLOYMENT_SHA:'a'.repeat(40)
});
test('isolated session checker config requires HTTPS, dedicated login and pinned deployment SHA',()=>{
 const x=readAcceptedStagingConfig(fixture());
 assert.equal(x.bindHost,'127.0.0.1');
 assert.equal(x.publicHost,'api.synthetic.invalid');
 for(const [key,value] of Object.entries({
  STAGING_SESSION_DATABASE_URL:'postgres://postgres:very-long-synthetic-password-000001@db.synthetic-project.supabase.co/postgres',
  STAGING_SUPABASE_URL:'https://malicious.example/',
  STAGING_ALLOWED_ORIGIN:'http://unsafe.invalid/',
  STAGING_PUBLIC_HOST:'bad/path',
  STAGING_DEPLOYMENT_SHA:'broken',
  STAGING_BIND_HOST:'0.0.0.0'
 })){
  assert.throws(()=>readAcceptedStagingConfig({...fixture(),[key]:value}),/unavailable/);
 }
 assert.throws(()=>readAcceptedStagingConfig({}),/unavailable/);
});
