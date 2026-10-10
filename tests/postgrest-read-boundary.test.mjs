import test from 'node:test';
import assert from 'node:assert/strict';
import {createPostgrestReadBoundary} from '../backend/postgrest-read-boundary.mjs';
const uid='329d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const other='429d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const wa='ws_'+uid,wb='ws_'+other;
const bearer='Bearer '+['aaa','bbb','ccc'].map(x=>x.repeat(15)).join('.');
const opts={
  projectUrl:'https://example-project.supabase.co',
  publishableKey:'sb_publishable_synthetic_contract_only',
  verifyCurrentSession:async()=>true,
};
function fixture({authStatus=200,active=true,foreignWorkspace=false,foreignRow=false}={}) {
  const calls=[];
  const fetchImpl=async(url,init)=>{
    const u=new URL(url),path=u.pathname;
    calls.push({url,init});
    if(path==='/auth/v1/user')return {status:authStatus,json:async()=>({
      id:uid,email:'fiction@example.invalid',email_confirmed_at:'2026-10-10T00:00:00Z',is_anonymous:false
    })};
    if(path==='/rest/v1/workspaces')return {status:200,json:async()=>[
      {id:foreignWorkspace?wb:wa,owner_user_id:foreignWorkspace?other:uid,state:'active'}
    ]};
    if(path==='/rest/v1/memberships')return {status:200,json:async()=>[]};
    if(path==='/rest/v1/work_requests')return {status:200,json:async()=>[
      {id:'req_test',workspace_id:foreignRow?wb:wa,title:'Test',kind:'Other',
        status:'Requested',version:0,updated_at:'2026-10-10T00:00:00Z'}
    ]};
    throw Error('Unexpected network path '+path);
  };
  return {calls,reader:createPostgrestReadBoundary({...opts,verifyCurrentSession:async()=>active,fetchImpl})};
}
test('forwards exact bearer to provider user endpoint and RLS reads, never actor-ID SQL',async()=>{
  const {reader,calls}=fixture();
  assert.deepEqual(await reader.listWorkspaces(bearer),{workspaces:[{workspace_id:wa,role:'owner'}]});
  assert.equal((await reader.listRequests(bearer,wa)).items[0].id,'req_test');
  assert.ok(calls.every(c=>c.init.method==='GET' && c.init.redirect==='error'));
  assert.ok(calls.every(c=>c.init.headers.authorization===bearer));
  assert.ok(calls.filter(c=>c.url.includes('/rest/v1/')).every(c=>c.init.headers['accept-profile']==='growth_starter'));
  assert.ok(calls.every(c=>!c.url.includes('staging_list_') && !c.url.includes('service_role')));
});
test('missing trusted session revocation checker and bad project/key fail at construction',()=>{
  assert.throws(()=>createPostgrestReadBoundary({...opts,verifyCurrentSession:undefined}));
  assert.throws(()=>createPostgrestReadBoundary({...opts,projectUrl:'https://attacker.invalid'}));
  assert.throws(()=>createPostgrestReadBoundary({...opts,publishableKey:'service_role_key'}));
});
test('anonymous and forged bearer, rejected provider token, revoked session fail closed',async()=>{
  const f=fixture();
  await assert.rejects(f.reader.listWorkspaces(undefined),e=>e.status===401);
  await assert.rejects(f.reader.listWorkspaces('Bearer caller_supplied_actor'),e=>e.status===401);
  const invalid=fixture({authStatus:401});
  await assert.rejects(invalid.reader.listWorkspaces(bearer),e=>e.status===401);
  assert.equal(invalid.calls.filter(c=>c.url.includes('/rest/v1/')).length,0);
  const revoked=fixture({active:false});
  await assert.rejects(revoked.reader.listWorkspaces(bearer),e=>e.status===401);
  assert.equal(revoked.calls.filter(c=>c.url.includes('/rest/v1/')).length,0);
});
test('foreign workspace list, foreign request and malformed scope never release rows',async()=>{
  const foreign=fixture({foreignWorkspace:true});
  await assert.rejects(foreign.reader.listWorkspaces(bearer),e=>e.status===503);
  const denial=fixture();
  await assert.rejects(denial.reader.listRequests(bearer,wb),e=>e.status===403);
  assert.equal(denial.calls.filter(c=>c.url.includes('/rest/v1/work_requests')).length,0);
  const wrongRow=fixture({foreignRow:true});
  await assert.rejects(wrongRow.reader.listRequests(bearer,wa),e=>e.status===503);
  await assert.rejects(wrongRow.reader.listRequests(bearer,'ws_wrong',20),e=>e.status===400);
  await assert.rejects(wrongRow.reader.listRequests(bearer,wa,51),e=>e.status===400);
});

test('bounded page offsets are passed to PostgREST and invalid pagination denied before access',async()=>{
  const {reader,calls}=fixture();
  await reader.listRequests(bearer,wa,10,20);
  const request=calls.find(c=>c.url.includes('/rest/v1/work_requests'));
  assert.equal(new URL(request.url).searchParams.get('limit'),'10');
  assert.equal(new URL(request.url).searchParams.get('offset'),'20');
  await assert.rejects(reader.listRequests(bearer,wa,10,21),e=>e.status===400);
  await assert.rejects(reader.listRequests(bearer,wa,10,960),e=>e.status===400);
});
