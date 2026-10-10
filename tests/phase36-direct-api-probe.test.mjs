import test from 'node:test';
import assert from 'node:assert/strict';
import {probeRevokedTokenDirectApi} from '../staging/phase36-direct-api-probe.mjs';
const projectUrl='https://phase36-fictional.supabase.co';
const A='329d2e94-f1f0-4cd9-8bfa-0983be1434ab', session='539d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const revokedBearer='Bearer '+[enc({alg:'ES256'}),enc({iss:projectUrl+'/auth/v1',
  aud:'authenticated',role:'authenticated',sub:A,session_id:session,exp:4000000000}),
  Buffer.alloc(64,1).toString('base64url')].join('.');
const config={projectUrl,publishableKey:'sb_publishable_only_synthetic_fixture',
  revokedBearer,expectedWorkspaceId:'ws_'+A,confirmedSyntheticOnly:true,
  confirmedRevokedBeforeExpiry:true};
test('fail closed without explicit fictional/revoked evidence, good origin and bearer',async()=>{
 for(const p of [{confirmedSyntheticOnly:false},{confirmedRevokedBeforeExpiry:false},
  {projectUrl:'https://attacker.invalid'},{revokedBearer:'Bearer forged'},
  {expectedWorkspaceId:'wrong'},{publishableKey:'service_role'}])
  await assert.rejects(probeRevokedTokenDirectApi({...config,...p}),/prerequisites unavailable/);
});
test('direct Supabase API returning rows with revoked JWT is a FAIL, not acceptance',async()=>{
 let calls=0;
 const result=await probeRevokedTokenDirectApi({...config,fetchImpl:async(url,init)=>{
  calls++;
  assert.equal(new URL(url).origin,projectUrl);
  assert.equal(new URL(url).pathname,'/rest/v1/workspaces');
  assert.equal(init.method,'GET');
  assert.equal(init.headers['accept-profile'],'growth_starter');
  assert.equal(init.headers.authorization,revokedBearer);
  return{status:200,json:async()=>[{id:'ws_'+A}]};
 }});
 assert.deepEqual(result,{verdict:'FAIL',reason:'Revoked-token Data API returned rows; access bypass possible.'});
 assert.equal(calls,1);
 assert.equal(JSON.stringify(result).includes(revokedBearer),false);
});
test('an empty 200 response or a denial alone never proves immediate revocation',async()=>{
 for(const [status,body,expected] of [
  [200,[],'BLOCKED'],[403,null,'PARTIAL'],[404,null,'PARTIAL'],[406,null,'PARTIAL'],
  [401,null,'PARTIAL'],[503,null,'BLOCKED']
 ]){
  const r=await probeRevokedTokenDirectApi({...config,fetchImpl:async()=>({
    status,json:async()=>body
  })});
  assert.equal(r.verdict,expected);
 }
});
test('transport failures and unparseable success responses remain blocked without leaking tokens',async()=>{
 const outage=await probeRevokedTokenDirectApi({...config,fetchImpl:async()=>{throw Error('secret '+revokedBearer)}});
 assert.equal(outage.verdict,'BLOCKED');assert.equal(JSON.stringify(outage).includes(revokedBearer),false);
 const malformed=await probeRevokedTokenDirectApi({...config,fetchImpl:async()=>({
  status:200,json:async()=>{throw Error('token '+revokedBearer)}
 })});
 assert.equal(malformed.verdict,'BLOCKED');
});
