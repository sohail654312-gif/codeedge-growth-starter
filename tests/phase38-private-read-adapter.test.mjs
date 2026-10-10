import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPrivateReadContract,createHostedPrivateReadAdapter,
 PRIVATE_READ_SQL} from '../backend/private-read-adapter.mjs';

const A='329d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const B='429d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const C='529d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const WA='ws_'+A,WB='ws_'+B,ISS='https://fictional-phase38.supabase.co/auth/v1';
const NOW=1791570000,SA='629d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const SB='729d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const SC='829d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const sess=new Map([[A,SA],[B,SB],[C,SC]]);
const tokens=new Map([[A,'fictional.a.signature'],[B,'fictional.b.signature'],[C,'fictional.c.signature']]);
const t=id=>'Bearer '+tokens.get(id);
function fixture() {
  const members=new Map([[C,'active']]), revoked=new Set(),calls=[];
  let authDown=false,sessionDown=false,dbDown=false,badRows=null,overPrivilege=false;
  const claims=new Map([...tokens].map(([id,token])=>[token,{
    verified:true,userId:id,sessionId:sess.get(id),issuer:ISS,
    audience:'authenticated',role:'authenticated',issuedAt:NOW-60,
    expiresAt:NOW+300,isAnonymous:false
  }]));
  const verified=async token=>{
    if(authDown)throw Error('Fictional Auth offline');
    return claims.get(token)??null;
  };
  const active=async({token,userId,sessionId})=>{
    if(sessionDown)throw Error('Fictional session registry offline');
    return {active:!revoked.has(userId)&&tokens.get(userId)===token &&
      sess.get(userId)===sessionId,userId,sessionId:sess.get(userId)};
  };
  const permitted=(uid,ws)=>ws===WA?(uid===A || (uid===C&&members.get(C)==='active')):uid===B&&ws===WB;
  const read=async({id,sql,params})=>{
    calls.push({id,sql,params});
    if(dbDown || overPrivilege)throw Error('Unaccepted database permissions');
    assert.equal(sql,PRIVATE_READ_SQL[id]);
    if(id==='workspaces'){
      assert.equal(params.length,1);
      const uid=params[0];
      const rows=[WA,WB].filter(ws=>permitted(uid,ws)).map(ws=>({
        workspace_id:ws,role:ws===WA&&uid===A||ws===WB&&uid===B?'owner':'client'
      }));
      return badRows??rows;
    }
    if(id==='requests'){
      assert.equal(params.length,4);
      const [uid,ws,limit,offset]=params;
      return permitted(uid,ws)?[{
        id:'req_'+ws.slice(-12),workspace_id:ws,title:'Fictional local SEO request',
        kind:'Local SEO',status:'Requested',version:0,updated_at:'2026-10-10T00:00:00Z'
      }].slice(offset,offset+limit):[];
    }
    throw Error('Unexpected SQL statement');
  };
  const api=createPrivateReadContract({
    fictionalTestOnly:true,expectedIssuer:ISS,verifyBearer:verified,
    checkCurrentSession:active,executeRead:read,now:()=>NOW*1000
  });
  return {api,calls,members,revoked,claims,
    authDown:()=>{authDown=true},sessionDown:()=>{sessionDown=true},
    dbDown:()=>{dbDown=true},overPrivilege:()=>{overPrivilege=true},
    rows:x=>{badRows=x}};
}
async function denied(fn,status){
  await assert.rejects(fn,err=>err?.status===status);
}
test('production adapter remains disabled; no real connection or implicit PostgREST fallback',()=>{
  assert.throws(()=>createPrivateReadContract({}),e=>e.status===503);
  assert.throws(()=>createHostedPrivateReadAdapter(),e=>e.status===503);
  const accepted=readFileSync(new URL('../staging/accepted-server.mjs',import.meta.url),'utf8');
  assert.ok(!accepted.includes('private-read-adapter'));
  assert.ok(!Object.values(PRIVATE_READ_SQL).some(s=>/rest\/v1|staging_list_|set role|set_config|auth\.uid\(/i.test(s)));
});
test('fixed queries: only SELECT and explicit columns, tenant authorization on both reads',()=>{
  for(const [name,sql] of Object.entries(PRIVATE_READ_SQL)){
    assert.match(sql,/^SELECT /);
    assert.doesNotMatch(sql,/\bselect\s+\*/i);
    assert.ok(sql.includes('$1::uuid'));
    assert.match(sql,/m\.state = 'active'/);
    assert.ok(!/;\s*(?:delete|insert|update|grant|execute)/i.test(sql),name);
  }
  assert.match(PRIVATE_READ_SQL.requests,/r\.workspace_id = \$2::text/);
  assert.match(PRIVATE_READ_SQL.requests,/LIMIT \$3::integer OFFSET \$4::integer/);
});
test('A sees only workspace A and its records; B sees only workspace B',async()=>{
  const f=fixture();
  for(const [id,yes,no] of [[A,WA,WB],[B,WB,WA]]){
    assert.deepEqual((await f.api.listWorkspaces(t(id))).workspaces.map(r=>r.workspace_id),[yes]);
    assert.equal((await f.api.listRequests(t(id),yes)).items.length,1);
    await denied(f.api.listRequests(t(id),no),403);
  }
});
test('C has A access only while actively authorized and loses it on revocation',async()=>{
  const f=fixture();
  assert.equal((await f.api.listRequests(t(C),WA)).items.length,1);
  f.members.set(C,'revoked');
  assert.deepEqual((await f.api.listWorkspaces(t(C))).workspaces,[]);
  await denied(f.api.listRequests(t(C),WA),403);
  assert.equal(f.calls.filter(c=>c.id==='requests').length,1);
});
test('revocation between application ACL and request query is denied by SQL membership predicate',async()=>{
  const f=fixture();
  f.members.set(C,'revoked');
  await denied(f.api.listRequests(t(C),WA),403);
  assert.match(PRIVATE_READ_SQL.requests,/EXISTS/);
  assert.match(PRIVATE_READ_SQL.requests,/m\.user_id = \$1::uuid/);
});
test('forged owner/admin/workspace claims cannot become SQL identity',async()=>{
  const f=fixture();
  const token=t(C),rec=f.claims.get(tokens.get(C));
  rec.ownerId=A;rec.admin=true;rec.workspaceId=WB;
  await denied(f.api.listRequests(token,WB),403);
  const all=f.calls.flatMap(c=>c.params);
  assert.ok(!all.includes(A) && !all.includes(B));
});
test('revoked sessions fail before database queries',async()=>{
  const f=fixture();f.revoked.add(A);
  await denied(f.api.listWorkspaces(t(A)),401);
  assert.equal(f.calls.length,0);
});
test('expired, mismatched and malformed provider identities cannot reach SQL',async()=>{
  const f=fixture(),record=f.claims.get(tokens.get(A));
  for(const change of [
    {expiresAt:NOW-1},{userId:B},{sessionId:SB},{issuer:'https://impostor.invalid/auth/v1'},
    {audience:'service_role'},{role:'admin'},{verified:false},{isAnonymous:true},
    {issuedAt:NOW+1000}
  ]){
    Object.assign(record,{verified:true,userId:A,sessionId:SA,issuer:ISS,
      audience:'authenticated',role:'authenticated',expiresAt:NOW+300,
      issuedAt:NOW-60,isAnonymous:false},change);
    await denied(f.api.listWorkspaces(t(A)),401);
  }
  await denied(f.api.listWorkspaces('Bearer fake.invalid.token'),401);
  await denied(f.api.listWorkspaces('Bearer !bad!'),401);
  assert.equal(f.calls.length,0);
});
test('missing Auth or session authority fails closed, without SQL or fallbacks',async()=>{
  const a=fixture();a.authDown();await denied(a.api.listWorkspaces(t(A)),503);
  assert.equal(a.calls.length,0);
  const b=fixture();b.sessionDown();await denied(b.api.listWorkspaces(t(A)),503);
  assert.equal(b.calls.length,0);
});
test('unavailable private SQL and unexpected permissions cannot fallback to legacy functions',async()=>{
  for(const mode of ['dbDown','overPrivilege']){
    const f=fixture();f[mode]();
    await denied(f.api.listWorkspaces(t(A)),503);
    assert.equal(f.calls.length,1);
    assert.ok(f.calls.every(c=>!c.sql.includes('staging_list_')));
  }
});
test('injection strings, arbitrary SQL and oversized pagination are rejected before query',async()=>{
  const f=fixture();
  for(const ws of ["' OR true --",WA+';DROP TABLE workspaces',WB+'?actorId='+B,'']){
    await denied(f.api.listRequests(t(A),ws),400);
  }
  for(const [limit,offset] of [[51,0],[1,-1],[20,1000],[20,1],['1',0],[10,19]]){
    await denied(f.api.listRequests(t(A),WA,limit,offset),400);
  }
  assert.equal(f.calls.length,0);
});
test('overbroad rows, duplicate workspaces, and hidden column leaks fail closed',async()=>{
  for(const rows of [
    Array.from({length:27},()=>({workspace_id:WA,role:'owner'})),
    [{workspace_id:WA,role:'owner'},{workspace_id:WA,role:'owner'}],
    [{workspace_id:WA,role:'owner',private_notes:'do-not-expose'}],
    [{workspace_id:WB,role:'superuser'}]
  ]){
    const f=fixture();f.rows(rows);
    await denied(f.api.listWorkspaces(t(A)),503);
  }
});
test('direct Data API bypass remains prohibited; private SQL does not call /rest/v1',()=>{
  const legacy=readFileSync(new URL('../backend/postgrest-read-boundary.mjs',import.meta.url),'utf8');
  assert.ok(legacy.includes("'/rest/v1/'"));
  assert.ok(legacy.includes("'accept-profile':'growth_starter'"));
  assert.doesNotMatch(Object.values(PRIVATE_READ_SQL).join(' '),/\/rest\/v1/);
});
test('failed private reader has no legacy privileged function or alternate API fallback',async()=>{
  const f=fixture();f.dbDown();
  await denied(f.api.listRequests(t(A),WA),503);
  assert.equal(f.calls[0].id,'workspaces');
  assert.ok(f.calls.every(c=>c.id==='workspaces'||c.id==='requests'));
});
