import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluateStagingPreflight,STAGING_BASELINE} from '../scripts/supabase-staging-preflight.mjs';
const good=()=>({
 schemaVersion:1,snapshotKind:'growth_starter_staging_catalog',databaseMajor:17,
 migrationVersions:[...STAGING_BASELINE],privateSchemaExists:true,
 roles:{gs315m_issuer:{exists:true,canLogin:true},gs315k_gateway:{exists:true,canLogin:true},
  gs315p_writer:{exists:true,canLogin:true},growth_starter_session_checker:{exists:true,canLogin:false}},
 checkerAuthSchemaUsage:false,legacyDefinerCount:0,legacyReaderCallableCount:0,
 runtimeCanSetOldReader:false,authenticatedColumnGrants:0,authenticatedSchemaUsage:false,
 growthTables:7,growthTablesWithoutRls:0,privateTables:3,privateTablesWithoutRls:0,
});
const check=(result,id)=>result.catalog.checks.find(x=>x.id===id);
test('catalog consistency is NOT hosted readiness; external facts cannot be asserted by fixture',()=>{
 const result=evaluateStagingPreflight({...good(),providerApproved:true,liveSessionVerified:true,
  actualDataApiTested:true,productionReady:true});
 assert.equal(result.catalog.verdict,'CATALOG_CONSISTENT_UNATTESTED');
 assert.equal(result.hostedStaging.verdict,'BLOCKED');
 assert.equal(result.production.verdict,'BLOCKED');
 assert.equal(result.finalVerdict,'BLOCKED');
 assert.ok(result.external.checks.every(c=>c.status==='UNVERIFIED'));
});
test('current historical staging baseline fails closed for missing private roles, grants and old definer paths',()=>{
 const s=good();s.privateSchemaExists=false;s.privateTables=0;
 for(const k of ['gs315m_issuer','gs315k_gateway','gs315p_writer'])s.roles[k]={exists:false,canLogin:null};
 s.legacyDefinerCount=3;s.legacyReaderCallableCount=3;s.runtimeCanSetOldReader=true;
 s.authenticatedColumnGrants=15;s.authenticatedSchemaUsage=true;
 const report=evaluateStagingPreflight(s);
 for(const k of ['private_schema','role_gs315m_issuer','role_gs315k_gateway','role_gs315p_writer',
  'legacy_definers_retired','legacy_reader_exec_retired','legacy_set_role_retired',
  'browser_column_grants_retired','browser_schema_usage_retired','private_rls']){
  assert.equal(check(report,k)?.status,'BLOCKED',k);
 }
 assert.equal(check(report,'managed_auth_not_granted').status,'PASS');
 assert.equal(check(report,'checker_stays_disabled').status,'PASS');
});
test('missing, malformed, and forged result cannot become passed evidence',()=>{
 for(const s of [undefined,null,{},[],{schemaVersion:1,snapshotKind:'other'},'APPROVED']){
  const result=evaluateStagingPreflight(s);
  assert.equal(result.catalog.verdict,'BLOCKED');
  assert.equal(result.finalVerdict,'BLOCKED');
  assert.equal(check(result,'valid_snapshot').status,'BLOCKED');
 }
});
test('missing individual facts and wrong types fail closed',()=>{
 const s=good();delete s.authenticatedColumnGrants;s.legacyDefinerCount='0';
 s.runtimeCanSetOldReader='false';s.privateTablesWithoutRls=null;
 s.roles.gs315p_writer.canLogin='true';s.checkerAuthSchemaUsage=null;
 const result=evaluateStagingPreflight(s);
 for(const k of ['browser_column_grants_retired','legacy_definers_retired','legacy_set_role_retired',
  'private_rls','role_gs315p_writer','managed_auth_not_granted'])
  assert.equal(check(result,k).status,'BLOCKED',k);
});
test('unexpected migration and missing RLS are blocked; no naive counts',()=>{
 const s=good();s.migrationVersions.push('20261015123456');s.growthTablesWithoutRls=1;
 const result=evaluateStagingPreflight(s);
 assert.equal(check(result,'migration_baseline').status,'BLOCKED');
 assert.equal(check(result,'growth_rls').status,'BLOCKED');
});
test('provider-exact-session gate is always independent of database catalog',()=>{
 const s=good();s.checkerAuthSchemaUsage=true;s.roles.growth_starter_session_checker.canLogin=true;
 const result=evaluateStagingPreflight(s);
 assert.equal(check(result,'checker_stays_disabled').status,'BLOCKED');
 assert.equal(check(result,'managed_auth_not_granted').status,'BLOCKED');
 assert.equal(result.external.checks.find(x=>x.id==='provider_exact_session').status,'UNVERIFIED');
});
