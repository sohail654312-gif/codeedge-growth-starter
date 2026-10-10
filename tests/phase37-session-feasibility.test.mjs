/**
 * Phase 3.7: independent, synthetic source-only session feasibility checks.
 * No production credentials, network requests, DB mutations or new packages.
 * These tests do not make the Supabase Auth session checker operational.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPgSessionAuthority} from '../backend/pg-session-authority.mjs';
import {CATALOG_SQL,APPROVED_POLICIES,syntheticAcceptedCatalogForTests}
  from '../backend/pg-rls-catalog.mjs';
import {createPostgrestReadBoundary} from '../backend/postgrest-read-boundary.mjs';
import {createTrustedSessionGate} from '../backend/trusted-session-gate.mjs';

const A='329d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const S='539d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const BAD='639d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const URL='https://fictional-phase37.supabase.co';
const NOW=1791570000;
const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
const token=()=>[encode({alg:'ES256',kid:'synthetic-only'}),encode({
  iss:URL+'/auth/v1',aud:'authenticated',role:'authenticated',sub:A,
  session_id:S,iat:NOW-60,exp:NOW+300
}),Buffer.alloc(64,9).toString('base64url')].join('.');

function pgFixture({login=true,authSchema=true}={}){
  const calls=[];
  const security={
    actor:'growth_starter_session_checker',login:'growth_starter_session_checker',
    rolcanlogin:login,rolsuper:false,rolbypassrls:false,rolinherit:false,
    rolcreaterole:false,rolcreatedb:false,rolreplication:false,
    can_set_authenticated:false,can_set_service_role:false,can_set_postgres:false,
    can_set_legacy_reader:false,auth_schema:authSchema,
    session_id:true,session_user:true,session_until:true,
    user_id:true,banned_until:true,deleted_at:true,
    session_insert:false,session_update:false,session_delete:false,user_update:false,
    session_full_select:false,user_full_select:false,growth_schema:false,db_create:false
  };
  const policy={
    expected_policies:3,rls_tables:7,auth_schema_usage:true,ws_select:true,
    member_select:true,request_select:true,legacy_list:false,legacy_requests:false,
    runtime_list:false,runtime_requests:false
  };
  const pool={connect:async()=>({
    async query(sql){
      calls.push(sql);
      if(sql.includes('FROM pg_roles r'))return{rows:[security]};
      if(sql===CATALOG_SQL)return{rows:[syntheticAcceptedCatalogForTests()]};
      if(sql.includes('FROM pg_policies'))return{rows:[policy]};
      if(sql.includes('FROM auth.sessions'))throw Error('Session rows MUST NOT be read in this fixture');
      return{rows:[]};
    },
    release(){}
  })};
  return{pool,calls};
}
test('session checker with permitted columns but missing effective Auth schema USAGE is rejected before session reads',async()=>{
  const f=pgFixture({authSchema:false});
  await assert.rejects(createPgSessionAuthority({pool:f.pool}),
    /Trusted staging session authority unavailable/);
  assert.ok(f.calls.includes('BEGIN READ ONLY'));
  assert.ok(f.calls.includes('ROLLBACK'));
  assert.ok(f.calls.every(sql=>!sql.includes('FROM auth.sessions')));
});
test('NOLOGIN session checker remains blocked even if column and schema privilege readback were positive',async()=>{
  const f=pgFixture({login:false});
  await assert.rejects(createPgSessionAuthority({pool:f.pool}),
    /Trusted staging session authority unavailable/);
  assert.ok(f.calls.every(sql=>!sql.includes('FROM auth.sessions')));
});
test('auth /user HTTP 200 alone cannot authorise a revoked still-unexpired bearer',async()=>{
  const calls=[];
  const reader=createPostgrestReadBoundary({
    projectUrl:URL,publishableKey:'sb_publishable_synthetic_phase37_only',
    verifyCurrentSession:async()=>false,
    fetchImpl:async (url,opts)=>{
      calls.push(new URL(url).pathname);
      assert.equal(opts.headers.authorization,'Bearer '+token());
      return{status:200,json:async()=>({
        id:A,email:'fictional@example.invalid',email_confirmed_at:'2026-10-10T00:00:00Z'
      })};
    }
  });
  await assert.rejects(reader.listWorkspaces('Bearer '+token()),e=>e.status===401);
  assert.deepEqual(calls,['/auth/v1/user']); // not one protected Data API read
});
test('trusted-session callback requires matching user ID, session ID and active evidence',async()=>{
  const create=fn=>createTrustedSessionGate({
    projectUrl:URL,now:()=>NOW*1000,checkAuthoritativeSession:fn});
  for(const result of [
    {active:true,userId:A,sessionId:BAD},
    {active:true,userId:BAD,sessionId:S},
    {active:true,userId:A},
    {active:false,userId:A,sessionId:S},
    {active:true,userId:A,sessionId:S,expiresAt:NOW-1}
  ])assert.equal(await create(async()=>result).verifyCurrentSession({userId:A,token:token()}),false);
  assert.equal(await create(async()=>{throw Error('provider unavailable')})
    .verifyCurrentSession({userId:A,token:token()}),false);
  assert.equal(await create(async()=>({active:true,userId:A,sessionId:S}))
    .verifyCurrentSession({userId:A,token:token()}),true);
  // This last PASS is a synthetic callback only, NOT a provider-issued session.
});
test('reviewed Data API policies currently lack per-read current-session checks; direct exposure cannot be accepted',()=>{
  assert.equal(APPROVED_POLICIES.length,3);
  assert.ok(APPROVED_POLICIES.every(p=>!/\bauth\.sessions\b|\bsession_id\b/i.test(p.qual)));
  const source=readFileSync(new URL('../backend/postgrest-read-boundary.mjs',import.meta.url),'utf8');
  assert.ok(source.includes("'accept-profile':'growth_starter'"));
  assert.ok(source.includes('/rest/v1/'));
  // Invariant documents the reviewed limitation, not a proof of safe API exposure.
});
