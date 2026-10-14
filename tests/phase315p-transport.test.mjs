import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {randomBytes,randomUUID,createHmac} from 'node:crypto';
import {createPrivateHttpsCookieHandler} from '../backend/phase315e-https-cookies.mjs';
import {createPrivateWorkspaceClient} from '../src/private-workspace-client.mjs';
const origin='https://fictional.example.invalid',secret=randomBytes(32),token='ce1.'+randomUUID()+'.'+randomBytes(32).toString('base64url');
const csrf=createHmac('sha256',secret).update('codeedge-growth-starter:csrf:v1\0').update(token).digest('base64url');
const jar='__Host-ce_session='+token+'; __Host-ce_csrf='+csrf;
async function send(handler,path,{method='GET',body=null,headers={}}={}){
 const raw=body===null?'':JSON.stringify(body),req=Readable.from(raw?[Buffer.from(raw)]:[]);
 req.method=method;req.url=path;req.socket={encrypted:true};req.headers={host:new URL(origin).host,cookie:jar,origin,
 ...(method==='POST'?{'content-type':'application/json','content-length':String(Buffer.byteLength(raw)),'x-csrf-token':csrf}:{}),...headers};
 const out={};await handler(req,{writeHead(status,h){out.status=status;out.headers=h;},end(raw){out.body=raw?JSON.parse(raw):null;}});return out;
}
const handlerFor=operations=>createPrivateHttpsCookieHandler({bridge:{begin:async()=>{},completeAndIssue:async()=>{}},
 authority:{withAuthorizedRead:async()=>{},revoke:async()=>{}},operations,appOrigin:origin,csrfSigningKey:secret}).handler;
test('private transport uses cookie context, discards forged actor/role and denies CSRF before SQL',async()=>{
 const calls=[],handler=handlerFor({capabilities:{fixedPurpose:true},run:async args=>{calls.push(args);return {id:'fictional'};}});
 const body={idempotencyKey:'fixture_idempotent_1234',fields:{title:'Draft',kind:'Other'},actor:'attacker',role:'owner',token:'attacker'};
 assert.equal((await send(handler,'/v1/operations/requests?workspaceId=ws_fictional_owner_A',{method:'POST',body})).status,200);
 assert.equal(calls[0].token,token);assert.equal(calls[0].input.actor,undefined);assert.equal(calls[0].input.role,undefined);
 for(const headers of [{origin:'https://attacker.invalid'},{'x-csrf-token':'forged'},{'sec-fetch-site':'cross-site'},{cookie:''},{'transfer-encoding':'chunked'}]){
  assert.notEqual((await send(handler,'/v1/operations/requests?workspaceId=ws_fictional_owner_A',{method:'POST',body,headers})).status,200);
 }
 assert.equal(calls.length,1);
 assert.equal((await send(handler,'/v1/operations/requests?workspaceId=ws_fictional_owner_A&workspaceId=ws_other_owner_B')).status,400);
 assert.equal((await send(handlerFor(null),'/v1/operations/requests?workspaceId=ws_fictional_owner_A')).status,503);
 assert.equal((await send(handler,'/v1/operations/sql?workspaceId=ws_fictional_owner_A',{method:'POST',body})).status,404);
});
test('private browser client uses bounded same-origin cookie requests and caller-retained idempotency key',async()=>{
 const calls=[],client=createPrivateWorkspaceClient({origin,getCsrf:()=>csrf,fetchImpl:async(url,opts)=>{
  calls.push({url,opts});return new Response(JSON.stringify({items:[],nextCursor:null}),{status:200});}});
 await client.list('ws_fictional_owner_A',{limit:'10'});
 await client.createRequest('ws_fictional_owner_A',{title:'Draft',kind:'Other'},'fictional_retained_key_1234');
 assert.equal(calls[0].opts.credentials,'same-origin');assert.equal(calls[0].opts.headers.authorization,undefined);
 assert.equal(calls[1].opts.headers['x-csrf-token'],csrf);assert.equal(JSON.parse(calls[1].opts.body).idempotencyKey,'fictional_retained_key_1234');
 for(const status of [401,403,409,503]){
  const broken=createPrivateWorkspaceClient({origin,fetchImpl:async()=>new Response('{}',{status})});
  await assert.rejects(broken.list('ws_fictional_owner_A'),e=>e.status===status);
 }
 const huge=createPrivateWorkspaceClient({origin,fetchImpl:async()=>new Response('x'.repeat(131073),{status:200})});
 await assert.rejects(huge.list('ws_fictional_owner_A'),e=>e.status===503);
 assert.throws(()=>createPrivateWorkspaceClient({origin:'http://fictional.invalid'}));
});
