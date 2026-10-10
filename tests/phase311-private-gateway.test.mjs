import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrivateReadContract,PRIVATE_READ_SQL,createHostedPrivateReadAdapter}
  from '../backend/private-read-adapter.mjs';
import {createSyntheticPrivateSqlReadGateway,createHostedAuthenticatedReadGateway}
  from '../backend/authenticated-read-gateway.mjs';

const ISS='https://fictional-phase311.supabase.co/auth/v1';
const NOW=1791570000;
const A='329d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const B='429d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const C='529d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const SA='629d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const SB='729d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const SC='829d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const WA='ws_'+A,WB='ws_'+B,allowedOrigin='https://ui.fixture.invalid';
const token=new Map([[A,'fictional.a.sig'],[B,'fictional.b.sig'],[C,'fictional.c.sig']]);
const session=new Map([[A,SA],[B,SB],[C,SC]]);
const sample=(uid,ws)=>({
  id:'req_'+ws.slice(-8),workspace_id:ws,title:'Fictional content',
  kind:'Social content',status:'Requested',version:0,updated_at:'2026-10-10T00:00:00.000Z'
});
function fixture(){
  const members=new Set([C]),revoked=new Set(),sqlCalls=[];
  let providerDown=false,dbDown=false;
  const allowed=(id,ws)=>ws===WA?(id===A||id===C&&members.has(C)):ws===WB&&id===B;
  const claims=new Map([...token].map(([id,value])=>[value,{
    verified:true,userId:id,sessionId:session.get(id),issuer:ISS,role:'authenticated',
    audience:'authenticated',issuedAt:NOW-60,expiresAt:NOW+300,isAnonymous:false
  }]));
  const reader=createPrivateReadContract({
    fictionalTestOnly:true,expectedIssuer:ISS,now:()=>NOW*1000,
    verifyBearer:async value=>{
      if(providerDown)throw Error('unavailable provider secret');
      return claims.get(value)??null;
    },
    checkCurrentSession:async({token:value,userId,sessionId})=>{
      if(providerDown)throw Error('unavailable session');
      return {active:!revoked.has(userId)&&value===token.get(userId)&&sessionId===session.get(userId),
        userId,sessionId};
    },
    executeRead:async({id,sql,params})=>{
      sqlCalls.push({id,sql,params});
      if(dbDown)throw Error('sql secret should not leak');
      assert.equal(sql,PRIVATE_READ_SQL[id]);
      const uid=params[0];
      if(id==='workspaces')return [WA,WB].filter(ws=>allowed(uid,ws)).map(ws=>({
        workspace_id:ws,role:uid===C?'client':'owner'
      }));
      if(id==='requests')return allowed(uid,params[1])?
        [sample(uid,params[1])].slice(params[3],params[3]+params[2]):[];
      throw Error('unapproved SQL');
    }
  });
  const gateway=createSyntheticPrivateSqlReadGateway({
    fictionalTestOnly:true,reader,allowedOrigin
  });
  return {gateway,claims,members,revoked,sqlCalls,
    providerUnavailable:()=>{providerDown=true},dbUnavailable:()=>{dbDown=true}};
}
async function serve(gateway,fn) {
  const server=gateway.createServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  try{
    return await fn(async (route,{id,method='GET',headers={}}={})=>{
      const response=await fetch(base+route,{method,headers:{
        ...(id?{authorization:'Bearer '+token.get(id)}:{}),...headers
      }});
      return {status:response.status,headers:response.headers,
        body:response.status===204?null:await response.json()};
    });
  }finally{
    await new Promise(resolve=>server.close(resolve));
  }
}
test('hosted PostgREST factory is permanently denied, even with a forged branded session and flags',()=>{
  assert.throws(()=>createHostedAuthenticatedReadGateway(),/not approved/);
  assert.throws(()=>createHostedAuthenticatedReadGateway({
    enableForSyntheticTesting:true,sessionAuthority:{
      checkAuthoritativeSession:async()=>({active:true})
    }
  }),/not approved/);
  assert.throws(()=>createHostedPrivateReadAdapter(),e=>e.status===503);
  assert.throws(()=>createSyntheticPrivateSqlReadGateway({
    fictionalTestOnly:true,reader:{listWorkspaces(){return {workspaces:[]}}},
    allowedOrigin
  }),/not approved/);
  assert.throws(()=>createSyntheticPrivateSqlReadGateway({
    reader:fixture().gateway,allowedOrigin
  }),/not approved/);
});
test('actual loopback HTTP private SQL contract: 3 fictional identities, tenant denial, no REST fallback',async()=>{
  const f=fixture();
  await serve(f.gateway,async request=>{
    for(const [id,own,other] of [[A,WA,WB],[B,WB,WA],[C,WA,WB]]){
      const ws=await request('/v1/workspaces',{id});
      assert.equal(ws.status,200);
      assert.deepEqual(ws.body.workspaces.map(x=>x.workspace_id),[own]);
      const allowed=await request('/v1/requests?workspaceId='+own+'&limit=2&page=0',{id});
      assert.equal(allowed.status,200);
      assert.equal(allowed.body.items.length,1);
      assert.equal(allowed.body.page,0);
      const blocked=await request('/v1/requests?workspaceId='+other,{id});
      assert.equal(blocked.status,403);
    }
    assert.equal((await request('/v1/workspaces')).status,401);
    assert.equal((await request('/v1/workspaces',{headers:{authorization:'Bearer forged'}})).status,401);
    assert.equal((await request('/v1/requests?workspaceId='+WA+'&actorId='+B,{id:A})).status,400);
    assert.equal((await request('/v1/requests?workspaceId='+WA+'&page=20',{id:A})).status,400);
    assert.equal((await request('/v1/requests?workspaceId='+WA,{id:A,method:'POST'})).status,405);
    assert.equal((await request('/v1/workspaces',{id:A,headers:{origin:'https://attacker.invalid'}})).status,403);
    const first=await request('/v1/workspaces',{id:A});
    assert.equal(first.headers.get('cache-control'),'no-store');
    assert.equal(first.headers.get('content-security-policy'),"default-src 'none'");
    assert.equal(first.headers.get('access-control-allow-origin'),null);
    const preflight=await request('/v1/workspaces',{method:'OPTIONS',headers:{
      origin:allowedOrigin,'access-control-request-method':'GET',
      'access-control-request-headers':'Authorization'
    }});
    assert.equal(preflight.status,204);
    assert.equal(preflight.headers.get('access-control-allow-origin'),allowedOrigin);
  });
  assert.ok(f.sqlCalls.every(x=>x.sql===PRIVATE_READ_SQL[x.id]));
  assert.ok(f.sqlCalls.every(x=>!x.sql.includes('/rest/v1')&&!x.sql.includes('staging_list_')));
});
test('session and membership revocation, provider outage and SQL outage fail closed over HTTP',async()=>{
  const f=fixture();
  await serve(f.gateway,async request=>{
    assert.equal((await request('/v1/requests?workspaceId='+WA,{id:C})).status,200);
    f.members.delete(C);
    assert.equal((await request('/v1/requests?workspaceId='+WA,{id:C})).status,403);
    f.revoked.add(A);
    const count=f.sqlCalls.length;
    assert.equal((await request('/v1/workspaces',{id:A})).status,401);
    assert.equal(f.sqlCalls.length,count,'revoked session must never reach SQL');
    f.providerUnavailable();
    const gone=await request('/v1/workspaces',{id:B});
    assert.equal(gone.status,503);
    assert.equal(JSON.stringify(gone.body).includes('secret'),false);
  });
  const q=fixture();
  q.dbUnavailable();
  await serve(q.gateway,async request=>{
    const broken=await request('/v1/workspaces',{id:A});
    assert.equal(broken.status,503);
    assert.equal(JSON.stringify(broken.body).includes('sql secret'),false);
  });
});
