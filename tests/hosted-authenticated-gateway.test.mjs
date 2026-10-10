import test from 'node:test';
import assert from 'node:assert/strict';
import {createHostedAuthenticatedReadGateway} from '../backend/authenticated-read-gateway.mjs';
import {createPgSessionAuthority} from '../backend/pg-session-authority.mjs';
const projectUrl='https://fixture-source.supabase.co';
const allowedOrigin='https://fixture-client.invalid';
test('hosted gateway construction rejects synthetic true callback and unverified plain session object',()=>{
 assert.throws(()=>createHostedAuthenticatedReadGateway({
  sessionAuthority:{checkAuthoritativeSession:async()=>({active:true})},
  projectUrl,publishableKey:'sb_publishable_contract_only_fixture',allowedOrigin
 }),/not approved/);
 assert.throws(()=>createHostedAuthenticatedReadGateway({
  projectUrl,publishableKey:'sb_publishable_contract_only_fixture',allowedOrigin
 }),/not approved/);
});
test('only security-readback-branded PostgreSQL authority enables hosted construction path',async()=>{
 const flags={actor:'growth_starter_session_checker',login:'growth_starter_session_checker',
  rolcanlogin:true,rolsuper:false,rolbypassrls:false,rolinherit:false,
  rolcreaterole:false,rolcreatedb:false,rolreplication:false,can_set_authenticated:false,
  can_set_service_role:false,can_set_postgres:false,can_set_legacy_reader:false,
  auth_schema:true,session_id:true,session_user:true,session_until:true,user_id:true,
  banned_until:true,deleted_at:true,session_insert:false,session_update:false,
  session_delete:false,user_update:false,session_full_select:false,user_full_select:false,
  growth_schema:false,db_create:false};
 const grants={expected_policies:3,rls_tables:7,auth_schema_usage:true,ws_select:true,
  member_select:true,request_select:true,legacy_list:false,legacy_requests:false,
  runtime_list:false,runtime_requests:false};
 const pool={connect:async()=>({
  query:async(sql)=>{
   if(sql.includes('FROM pg_roles r'))return{rows:[flags]};
   if(sql.includes('FROM pg_policies'))return{rows:[grants]};
   return{rows:[]};
  },release(){}
 })};
 const sessionAuthority=await createPgSessionAuthority({pool});
 const g=createHostedAuthenticatedReadGateway({
  sessionAuthority,projectUrl,publishableKey:'sb_publishable_contract_only_fixture',
  allowedOrigin
 });
 assert.equal(typeof g.createServer,'function');
 assert.equal(typeof g.handler,'function');
 assert.equal('enableForSyntheticTesting' in g,false);
});
