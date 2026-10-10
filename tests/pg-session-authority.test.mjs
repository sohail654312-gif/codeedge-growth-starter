import test from 'node:test';
import assert from 'node:assert/strict';
import {createPgSessionAuthority,isVerifiedPgSessionAuthority} from '../backend/pg-session-authority.mjs';
const A='329d2e94-f1f0-4cd9-8bfa-0983be1434ab',SID='539d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const fields=['rolcanlogin','auth_schema','session_id','session_user','session_until','user_id',
 'banned_until','deleted_at'];
function fixture({revoke=false,missing=false,security={},policy={},queryError=false}={}){
 const calls=[];
 const flags={actor:'growth_starter_session_checker',login:'growth_starter_session_checker',
  rolcanlogin:true,rolsuper:false,rolbypassrls:false,rolinherit:false,rolcreaterole:false,
  rolcreatedb:false,rolreplication:false,can_set_authenticated:false,can_set_service_role:false,
  can_set_legacy_reader:false,can_set_postgres:false,auth_schema:true,session_id:true,session_user:true,
  session_until:true,user_id:true,banned_until:true,deleted_at:true,
  session_insert:false,session_update:false,session_delete:false,user_update:false,
  growth_schema:false,db_create:false,session_full_select:false,user_full_select:false,...security};
 const policies={expected_policies:3,rls_tables:7,auth_schema_usage:true,ws_select:true,
  member_select:true,request_select:true,legacy_list:false,legacy_requests:false,
  runtime_list:false,runtime_requests:false,...policy};
 const pool={connect:async()=>({
  query:async(sql,args)=>{
   calls.push({sql,args});
   if(queryError && sql.includes('FROM auth.sessions'))throw Error('backend outage');
   if(sql.includes('FROM pg_roles r'))return{rows:[flags]};
   if(sql.includes('FROM pg_policies'))return{rows:[policies]};
   if(sql.includes('FROM auth.sessions'))return{rows:missing||revoke?[]:[{
    session_id:SID,user_id:A,not_after:null,deleted_at:null,banned_until:null
   }]};
   return{rows:[]};
  },release(){}
 })};
 return{pool,calls,fields};
}
test('fail-closed PostgreSQL principal and effective RLS/grants are checked before startup',async()=>{
 const f=fixture();
 const a=await createPgSessionAuthority({pool:f.pool});
 assert.equal(isVerifiedPgSessionAuthority(a),true);
 assert.equal(isVerifiedPgSessionAuthority({checkAuthoritativeSession:async()=>({active:true})}),false);
 assert.equal((await a.checkAuthoritativeSession({userId:A,sessionId:SID})).active,true);
 assert.ok(f.calls.some(x=>x.sql.includes('FROM auth.sessions') && x.args[0]===SID && x.args[1]===A));
 for(const bad of [{security:{rolsuper:true}},{security:{rolinherit:true}},
   {security:{actor:'postgres'}},{security:{session_id:false}},
   {security:{growth_schema:true}},{security:{can_set_authenticated:true}},
   {security:{can_set_postgres:true}},
   {security:{session_full_select:true}},
   {policy:{expected_policies:0}},{policy:{legacy_list:true}},
   {policy:{auth_schema_usage:false}},{policy:{member_select:false}}]){
  await assert.rejects(createPgSessionAuthority({pool:fixture(bad).pool}),/unavailable/);
 }
});
test('session row absence, outage and malformed identity deny without bypass',async()=>{
 const x=await createPgSessionAuthority({pool:fixture({missing:true}).pool});
 assert.equal((await x.checkAuthoritativeSession({userId:A,sessionId:SID})).active,false);
 assert.equal((await x.checkAuthoritativeSession({userId:'malformed',sessionId:SID})).active,false);
 const down=await createPgSessionAuthority({pool:fixture({queryError:true}).pool});
 await assert.rejects(down.checkAuthoritativeSession({userId:A,sessionId:SID}),/unavailable/);
 await assert.rejects(createPgSessionAuthority({pool:null}),/unavailable/);
});
