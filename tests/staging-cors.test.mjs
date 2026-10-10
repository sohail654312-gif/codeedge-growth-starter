import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createStagingGateway} from '../backend/staging-gateway.mjs';

let server,base,dbCalls=0,identityCalls=0;
const allowedOrigin='https://client.example.invalid';
before(async()=>{
  const gateway=createStagingGateway({
    pool:{async query(sql){dbCalls++;if(sql.includes('staging_list_workspaces'))return {rows:[{workspace_id:'ws_testowner123',role:'owner'}]};return {rows:[]};}},
    identityVerifier:{async verifyAuthorization(value){identityCalls++;if(value!=='Bearer synthetic.test')throw Error('No valid token');return {userId:'testowner123'};}},
    allowedOrigin,
  });
  server=gateway.createServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  base='http://127.0.0.1:'+server.address().port;
});
after(async()=>{if(server)await new Promise(resolve=>server.close(resolve));});
const preflight=(path='/v1/workspaces',override={})=>fetch(base+path,{method:'OPTIONS',headers:{
  origin:allowedOrigin,
  'access-control-request-method':'GET',
  'access-control-request-headers':'Authorization',...override,
}});
test('authorized browser CORS preflight is narrow, credential-free and never touches identity/DB',async()=>{
 const prior=[dbCalls,identityCalls];
 const result=await preflight();
 assert.equal(result.status,204);
 assert.equal(await result.text(),'');
 assert.equal(result.headers.get('access-control-allow-origin'),allowedOrigin);
 assert.equal(result.headers.get('access-control-allow-methods'),'GET');
 assert.equal(result.headers.get('access-control-allow-headers'),'Authorization');
 assert.equal(result.headers.get('access-control-allow-credentials'),null);
 assert.deepEqual([dbCalls,identityCalls],prior);
 const authenticated=await fetch(base+'/v1/workspaces',{headers:{
  origin:allowedOrigin,authorization:'Bearer synthetic.test'
 }});
 assert.equal(authenticated.status,200);
 assert.equal(authenticated.headers.get('access-control-allow-origin'),allowedOrigin);
 assert.deepEqual((await authenticated.json()).workspaces.map(w=>w.workspace_id),['ws_testowner123']);
});
test('wrong-origin, extra headers, foreign routes and write preflights are denied',async()=>{
 const cases=[
  [{'origin':'https://evil.example.invalid'},403],
  [{'access-control-request-headers':'Authorization, Content-Type'},403],
  [{'access-control-request-headers':'X-Actor-Id'},403],
  [{'access-control-request-method':'POST'},405],
 ];
 for(const [headers,status] of cases){
  const response=await preflight('/v1/workspaces',headers);
  assert.equal(response.status,status);
  if(status===403 && headers.origin)assert.equal(response.headers.get('access-control-allow-origin'),null);
 }
 assert.equal((await preflight('/v1/media')).status,404);
 assert.equal((await fetch(base+'/v1/workspaces',{method:'POST',headers:{origin:allowedOrigin}})).status,405);
});
test('all authorization remains enforced on actual GET, preflight alone cannot read private rows',async()=>{
 const beforeAuth=identityCalls;
 const response=await fetch(base+'/v1/workspaces',{headers:{origin:allowedOrigin}});
 assert.equal(response.status,503); // Failed injected identity verifier is treated as unavailable.
 assert.equal(identityCalls,beforeAuth+1);
});
