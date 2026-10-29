import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateCutoverEvidence} from '../scripts/phase315r-cutover-evidence.mjs';

const safe=()=>({
 schemaVersion:1,snapshotKind:'growth_starter_privilege_cutover_catalog',
 roles:{gs315m_issuer:{login:true,super:false,bypassRls:false},
 gs315k_gateway:{login:true,super:false,bypassRls:false},
 gs315p_writer:{login:true,super:false,bypassRls:false},
 gs315p_ops_owner:{login:false,super:false,bypassRls:false},
 growth_starter_session_checker:{login:false,super:false,bypassRls:false}},
 legacyDefiners:0,legacyReaderExecutables:0,legacyAuthenticatedExecutables:0,
 legacyPublicExecutables:0,oldSetRole:false,authenticatedColumnSelects:0,
 authenticatedSchemaUsage:false,anonSchemaUsage:false,
 authenticatedTableReads:0,anonTableReads:0,privateTableCount:3,
 privateNotForcedRls:0,anonPrivateSchemaUsage:false,authenticatedPrivateSchemaUsage:false,
 writerCanUsePrivateSchema:true,writerCanReadRaw:0,writerCanMutateRaw:0,
 writerCanUseAuth:false,writerCanCreatePublic:false,writerCanSetOwner:false,
 checkerCanUseAuth:false
});
const report=x=>evaluateCutoverEvidence(x);
const find=(r,id)=>r.catalog.checks.find(x=>x.id===id);
test('plausible safe catalog never satisfies hosted provider or deployment acceptance',()=>{
 const r=report({...safe(),supportApproved:true,ownerApproved:true,realApiNegativeTestsPassed:true});
 assert.equal(r.catalog.status,'MATCHES_EXPECTED_VALUES_UNATTESTED');
 assert.equal(r.hostedStaging,'BLOCKED');assert.equal(r.production,'BLOCKED');
 assert.equal(r.finalVerdict,'BLOCKED');assert.ok(r.external.gates.every(g=>g.status==='UNVERIFIED'));
});
test('current historical live baseline rejects reader edge, definers and direct authenticated grants',()=>{
 const x=safe();x.roles={growth_starter_reader:{login:false,super:false,bypassRls:false},
 growth_starter_runtime:{login:false,super:false,bypassRls:false},
 growth_starter_session_checker:{login:false,super:false,bypassRls:false}};
 Object.assign(x,{legacyDefiners:3,legacyReaderExecutables:3,oldSetRole:true,
 authenticatedColumnSelects:15,authenticatedSchemaUsage:true,privateTableCount:0,
 anonPrivateSchemaUsage:null,authenticatedPrivateSchemaUsage:null,
 writerCanUsePrivateSchema:null,writerCanReadRaw:null,writerCanMutateRaw:null,
 writerCanUseAuth:null,writerCanCreatePublic:null,writerCanSetOwner:null});
 const r=report(x);assert.equal(r.catalog.status,'BLOCKED');
 for(const id of ['writer_identity','writer_owner','legacy_definers','reader_exec','old_role_set','browser_columns',
  'authenticated_schema','private_tables_exist','anon_private_schema','writer_raw_read','writer_raw_write'])
 assert.equal(find(r,id).status,'BLOCKED',id);
 assert.equal(find(r,'checker_inert').status,'PASS');
});
test('malformed, missing, or deceptive evidence fails closed',()=>{
 for(const x of [undefined,null,{},[],true,'APPROVED',{schemaVersion:1,snapshotKind:'wrong'}]){
  const r=report(x);assert.equal(r.catalog.status,'BLOCKED');
  assert.equal(find(r,'snapshot_integrity').status,'BLOCKED');
  assert.equal(r.production,'BLOCKED');
 }
});
test('role privilege drift blocks non-superuser, no-bypass and exact login contract',()=>{
 for(const [role,key,value] of [['gs315p_writer','super',true],['gs315p_writer','login',false],
  ['gs315p_ops_owner','bypassRls',true],['growth_starter_session_checker','login',true]]){
  const x=safe();x.roles[role][key]=value;
  const r=report(x);assert.equal(r.catalog.status,'BLOCKED',role+':'+key);
 }
});
test('column-only reads and writes are explicitly blocked',()=>{
 for(const field of ['writerCanReadRaw','writerCanMutateRaw']){
  const x=safe();x[field]=1;const r=report(x);
  assert.equal(find(r,field==='writerCanReadRaw'?'writer_raw_read':'writer_raw_write').status,'BLOCKED');
 }
});
test('missing counts, misleading strings, partial private RLS never pass',()=>{
 const x=safe();delete x.legacyDefiners;x.privateNotForcedRls=1;
 x.writerCanCreatePublic='false';x.authenticatedColumnSelects='0';
 const r=report(x);
 for(const id of ['legacy_definers','private_forced_rls','writer_public_create','browser_columns'])
  assert.equal(find(r,id).status,'BLOCKED',id);
});
test('existing legacy roles can remain only when inert',()=>{
 const x=safe();x.roles.growth_starter_runtime={login:true,super:false,bypassRls:false};
 assert.equal(find(report(x),'legacy_reader_inert').status,'BLOCKED');
 x.roles.growth_starter_runtime.login=false;
 assert.equal(find(report(x),'legacy_reader_inert').status,'PASS');
});

test('missing or privileged private issuer and gateway cannot pass catalog review',()=>{
 for(const roleName of ['gs315m_issuer','gs315k_gateway']){
  const id=roleName==='gs315m_issuer'?'issuer_identity':'gateway_identity';
  const missing=safe();delete missing.roles[roleName];
  assert.equal(find(report(missing),id).status,'BLOCKED');
  assert.equal(report(missing).catalog.status,'BLOCKED');
  for(const [field,value] of [['login',false],['super',true],['bypassRls',true]]){
   const drift=safe();drift.roles[roleName][field]=value;
   assert.equal(find(report(drift),id).status,'BLOCKED',roleName+':'+field);
  }
  assert.equal(find(report(safe()),id).status,'PASS');
 }
});
