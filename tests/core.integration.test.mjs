import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DomainError,ownerWorkspaceId,tableFor,authorize,resolveWorkspace,
  validGrant,profileInput,requestInput,enquiryInput,pageArgs,validateImageUpload
} from '../backend/core.mjs';
import {makeGrowthStarterRoutes} from '../backend/routes.mjs';

const alice='alice123456';
const bob='bob12345678';
const workspaceA=ownerWorkspaceId(alice);
const workspaceB=ownerWorkspaceId(bob);
const jpeg=Buffer.concat([
  Buffer.from([255,216,255,224]),Buffer.alloc(32,1),Buffer.from([255,217])
]).toString('base64');
const png=Buffer.concat([
 Buffer.from([137,80,78,71,13,10,26,10]),
 Buffer.from([0,0,0,13]),Buffer.from('IHDR'),Buffer.alloc(20,0)
]).toString('base64');
function fixture() {
  const tables=new Map(),written=[];
  let seq=0;
  const rows=key=>{if(!tables.has(key))tables.set(key,[]);return tables.get(key)};
  const db={
    list:async(key,{limit=20,nextToken}={})=>{
      const start=Number(nextToken||0);
      const source=rows(key);
      return {items:source.slice(start,start+limit).map(x=>({...x})),nextToken:source.length>start+limit?String(start+limit):undefined};
    },
    get:async(key,ids)=>ids.map(id=>rows(key).find(x=>x.id===id)||null),
    add:async(key,records)=>records.map(record=>{
      const id='obj'+(++seq);
      rows(key).push({...record,id});
      return id;
    }),
    update:async(key,items)=>items.map(({id,record})=>{
      const list=rows(key);
      const idx=list.findIndex(x=>x.id===id);
      if(idx<0)return false;
      list[idx]={...record,id};return true;
    }),
    delete:async(key,ids)=>ids.map(id=>{
      const list=rows(key);const idx=list.findIndex(x=>x.id===id);
      if(idx<0)return false;
      list.splice(idx,1);return true;
    })
  };
  const storage={
    write:async(items)=>{written.push(...items);return items.map(()=>true)},
    delete:async()=>[true],
    url:async(paths)=>paths.map(path=>({url:'https://storage.invalid/'+encodeURIComponent(path)}))
  };
  const json=(data,status=200)=>({status,data});
  const error=(message,status=400)=>({status,data:{error:message}});
  const requireAuth=()=>async ctx=>ctx.user?undefined:error('Unauthorized',401);
  const routes=makeGrowthStarterRoutes({db,storage,json,error,requireAuth,cryptoRandomUUID:()=>String(++seq).padStart(12,'0')});
  async function call(method,path,{user,body,query={},params={}}={}) {
    const handlers=routes[method+' '+path];
    assert.ok(handlers,'Unknown route '+method+' '+path);
    const ctx={user:user?{userId:user,email:user+'@example.test'}:undefined,body,query,params};
    for(const handler of handlers){
      const result=await handler(ctx);
      if(result!==undefined)return result;
    }
    throw Error('Missing handler response');
  }
  return {rows,db,storage,written,call,routes};
}
function expectReject(fn,status=400){assert.throws(fn,error=>error instanceof DomainError&&error.status===status);}
test('owner workspace is deterministic and preserves existing v1 table keys',()=>{
  assert.equal(ownerWorkspaceId(alice),workspaceA);
  assert.equal(tableFor('enquiries',alice),'gs_enquiries_'+alice);
  assert.equal(tableFor('profiles',bob),'gs_profiles_'+bob);
  assert.notEqual(workspaceA,workspaceB);
});
test('roles are explicit: client cannot mutate enquiry status or manage members',()=>{
  assert.equal(authorize('owner','members:manage'),true);
  assert.equal(authorize('agency_admin','request:review'),true);
  assert.equal(authorize('staff','enquiry:update'),true);
  assert.equal(authorize('client','enquiry:create'),true);
  expectReject(()=>authorize('client','enquiry:update'),403);
  expectReject(()=>authorize('agency_admin','members:manage'),403);
  expectReject(()=>authorize('totally_admin','overview:read'),403);
});
test('authentication enforced for every route except healthcheck',async()=>{
  const x=fixture();
  assert.equal((await x.call('GET','/api/_healthcheck')).status,200);
  for(const [key] of Object.entries(x.routes)){
    if(key==='GET /api/_healthcheck')continue;
    const [method,...p]=key.split(' ');
    const response=await x.call(method,p.join(' '));
    assert.equal(response.status,401,key);
  }
});
test('owner cross-tenant selectors fail closed across all CRUD, media and pagination endpoints',async()=>{
  const x=fixture();
  for(const [method,path,body] of [
    ['GET','/api/overview',undefined],
    ['GET','/api/enquiries',undefined],
    ['GET','/api/requests',undefined],
    ['POST','/api/profile',{name:'Fake',industry:'Clinic',city:'Bannu'}],
    ['POST','/api/enquiries',{name:'Test',service:'ENT'}],
    ['PUT','/api/enquiries/:id',{status:'Booked'}],
    ['POST','/api/requests',{title:'Hello',kind:'Local SEO'}],
    ['POST','/api/assets',{filename:'test.jpg',mime:'image/jpeg',content:jpeg}]
  ]) {
    const result=await x.call(method,path,{user:bob,query:{workspaceId:workspaceA},body,params:{id:'obj1'}});
    assert.equal(result.status,403,method+' '+path);
  }
  assert.equal(x.rows(tableFor('enquiries',alice)).length,0);
  assert.equal(x.rows(tableFor('enquiries',bob)).length,0);
  assert.equal(x.written.length,0);
});
test('role grant belongs to the authenticated member and exact owner workspace',()=>{
  const grant={userId:bob,ownerUserId:alice,workspaceId:workspaceA,role:'client',state:'active'};
  assert.equal(validGrant(grant,bob,workspaceA),true);
  assert.equal(validGrant({...grant,userId:alice},bob,workspaceA),false);
  assert.equal(validGrant({...grant,role:'owner'},bob,workspaceA),false);
  assert.equal(validGrant({...grant,state:'revoked'},bob,workspaceA),false);
  assert.equal(validGrant({...grant,ownerUserId:'invalid'},bob,workspaceA),false);
});
test('server-only membership authorizes client read but denies status change',async()=>{
  const x=fixture();
  await x.db.add(tableFor('memberships',bob),[{userId:bob,ownerUserId:alice,workspaceId:workspaceA,role:'client',state:'active'}]);
  const created=await x.call('POST','/api/enquiries',{user:alice,body:{name:'Synthetic Lead',service:'ENT'}});
  assert.equal(created.status,201);
  const read=await x.call('GET','/api/overview',{user:bob,query:{workspaceId:workspaceA}});
  assert.equal(read.status,200);
  assert.equal(read.data.enquiries[0].name,'Synthetic Lead');
  assert.equal(read.data.role,'client');
  const change=await x.call('PUT','/api/enquiries/:id',{user:bob,query:{workspaceId:workspaceA},params:{id:created.data.id},body:{status:'Won'}});
  assert.equal(change.status,403);
  const ownerRead=await x.call('GET','/api/overview',{user:alice});
  assert.equal(ownerRead.data.enquiries[0].status,'New');
});
test('clients cannot use another user identity or foreign record ID',async()=>{
  const x=fixture();
  const a=await x.call('POST','/api/enquiries',{user:alice,body:{name:'Synthetic',service:'Sinus'}});
  const b=await x.call('PUT','/api/enquiries/:id',{user:bob,params:{id:a.data.id},body:{status:'Won'}});
  assert.equal(b.status,404);
  const overview=await x.call('GET','/api/overview',{user:bob});
  assert.equal(overview.data.enquiries.length,0);
});
test('owner can save existing profile and enquiry records without migration',async()=>{
  const x=fixture();
  const first=await x.call('POST','/api/profile',{user:alice,body:{name:'Test Clinic',industry:'ENT',city:'Bannu',website:'https://example.org'}});
  assert.equal(first.status,201);
  const again=await x.call('POST','/api/profile',{user:alice,body:{name:'Updated Clinic',industry:'ENT',city:'Bannu'}});
  assert.equal(again.status,200);
  assert.equal(x.rows(tableFor('profiles',alice)).length,1);
  assert.equal(x.rows(tableFor('profiles',alice))[0].name,'Updated Clinic');
  const e=await x.call('POST','/api/enquiries',{user:alice,body:{name:'Demo',service:'ENT'}});
  assert.equal(e.status,201);
  const changed=await x.call('PUT','/api/enquiries/:id',{user:alice,body:{status:'Booked'},params:{id:e.data.id}});
  assert.equal(changed.status,200);
  const overview=await x.call('GET','/api/overview',{user:alice});
  assert.equal(overview.data.enquiries[0].status,'Booked');
});
test('pagination stays bounded with stable server cursors',async()=>{
  const x=fixture();
  for(let i=0;i<3;i++)await x.call('POST','/api/requests',{user:alice,body:{title:'Task '+i,kind:'Local SEO'}});
  const a=await x.call('GET','/api/requests',{user:alice,query:{limit:'2'}});
  assert.equal(a.status,200);assert.equal(a.data.items.length,2);assert.ok(a.data.nextCursor);
  const b=await x.call('GET','/api/requests',{user:alice,query:{limit:'2',cursor:a.data.nextCursor}});
  assert.equal(b.data.items.length,1);assert.equal(b.data.nextCursor,null);
  const bad=await x.call('GET','/api/requests',{user:alice,query:{limit:'99999'}});
  assert.equal(bad.status,400);
});
test('strict fields reject malformed and dangerous inputs',()=>{
  expectReject(()=>profileInput({name:'  ',industry:'Clinic',city:'Bannu'}));
  expectReject(()=>profileInput({name:'X',industry:'Clinic',city:'Bannu',website:'javascript:alert(1)'}));
  expectReject(()=>profileInput({name:123,industry:'Clinic',city:'Bannu'}));
  expectReject(()=>requestInput({title:'Hi',kind:'Unknown'}));
  expectReject(()=>enquiryInput({name:'Hi',service:'ENT',channel:'Unexpected'}));
  expectReject(()=>pageArgs({cursor:'a\nattack'}));
});
test('media signatures, extensions and base64 encoding verified before storage',async()=>{
  const x=fixture();
  const bad=[
    {filename:'fake.png',mime:'image/png',content:jpeg},
    {filename:'../../private.jpg',mime:'image/jpeg',content:jpeg},
    {filename:'photo.svg',mime:'image/jpeg',content:jpeg},
    {filename:'photo.jpg',mime:'image/jpeg',content:'!!!!'}
  ];
  for(const body of bad){
    const result=await x.call('POST','/api/assets',{user:alice,body});
    assert.equal(result.status,400);
  }
  assert.equal(x.written.length,0);
  assert.equal(x.rows(tableFor('assets',alice)).length,0);
  const ok=await x.call('POST','/api/assets',{user:alice,body:{filename:'clinic-demo.png',mime:'image/png',content:png}});
  assert.equal(ok.status,201);
  assert.ok(x.written[0].path.includes('/'+alice+'/'));
  assert.equal(ok.data.consentStatus,'not_verified');
});
test('media upload cannot cross account boundary or grant itself membership',async()=>{
  const x=fixture();
  let r=await x.call('POST','/api/assets',{user:bob,query:{workspaceId:workspaceA},body:{filename:'x.jpg',mime:'image/jpeg',content:jpeg}});
  assert.equal(r.status,403);
  r=await x.call('GET','/api/workspaces',{user:bob});
  assert.deepEqual(r.data.workspaces,[{workspaceId:workspaceB,role:'owner'}]);
  assert.equal(r.data.invitesEnabled,false);
});
test('agency progress and client approval require valid state transitions',async()=>{
  const x=fixture();
  const a=await x.call('POST','/api/requests',{user:alice,body:{title:'Poster',kind:'Social content'}});
  const id=a.data.id;
  let invalid=await x.call('PUT','/api/requests/:id/status',{user:alice,params:{id},body:{status:'Published'}});
  assert.equal(invalid.status,409);
  let a1=await x.call('PUT','/api/requests/:id/status',{user:alice,params:{id},body:{status:'In progress'}});
  assert.equal(a1.status,200);
  let a2=await x.call('PUT','/api/requests/:id/status',{user:alice,params:{id},body:{status:'Awaiting approval'}});
  assert.equal(a2.status,200);
  let a3=await x.call('POST','/api/requests/:id/decision',{user:alice,params:{id},body:{decision:'Changes requested'}});
  assert.equal(a3.status,200);
  assert.equal(a3.data.status,'Changes requested');
  let review=await x.call('PUT','/api/requests/:id/status',{user:alice,params:{id},body:{status:'In progress'}});
  assert.equal(review.status,200);
  await x.call('PUT','/api/requests/:id/status',{user:alice,params:{id},body:{status:'Awaiting approval'}});
  let approved=await x.call('POST','/api/requests/:id/decision',{user:alice,params:{id},body:{decision:'Approved'}});
  assert.equal(approved.status,200);
  let done=await x.call('PUT','/api/requests/:id/status',{user:alice,params:{id},body:{status:'Completed'}});
  assert.equal(done.status,200);
  assert.equal(x.rows(tableFor('requests',alice))[0].status,'Completed');
});
test('staff cannot approve a request and client cannot claim completion',async()=>{
  const x=fixture();
  await x.db.add(tableFor('memberships',bob),[{userId:bob,ownerUserId:alice,workspaceId:workspaceA,role:'staff',state:'active'}]);
  const request=await x.call('POST','/api/requests',{user:alice,body:{title:'Google SEO',kind:'Local SEO'}});
  const decision=await x.call('POST','/api/requests/:id/decision',{user:bob,query:{workspaceId:workspaceA},params:{id:request.data.id},body:{decision:'Approved'}});
  assert.equal(decision.status,403);
  const a=await x.call('PUT','/api/requests/:id/status',{user:bob,query:{workspaceId:workspaceA},params:{id:request.data.id},body:{status:'In progress'}});
  assert.equal(a.status,200);
  const foreign=await x.call('PUT','/api/requests/:id/status',{user:bob,params:{id:request.data.id},body:{status:'Awaiting approval'}});
  assert.equal(foreign.status,404);
});
test('private image delete checks role, workspace, and stored owner path',async()=>{
  const x=fixture();
  const created=await x.call('POST','/api/assets',{user:alice,body:{filename:'demo.jpg',mime:'image/jpeg',content:jpeg}});
  const id=created.data.id;
  const denied=await x.call('DELETE','/api/assets/:id',{user:bob,params:{id},query:{workspaceId:workspaceA}});
  assert.equal(denied.status,403);
  const foreign=await x.call('DELETE','/api/assets/:id',{user:bob,params:{id}});
  assert.equal(foreign.status,404);
  const removed=await x.call('DELETE','/api/assets/:id',{user:alice,params:{id}});
  assert.equal(removed.status,200);
  assert.equal(x.rows(tableFor('assets',alice)).length,0);
});
