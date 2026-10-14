import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createPrivateObservability} from '../staging/private-observability.mjs';
test('private logging omits callback secrets, tenant IDs, cookies and bodies and bounds metric labels',()=>{
 const lines=[],monitor=createPrivateObservability({write:line=>lines.push(line),now:()=>100});
 for(const url of ['/auth/callback?code=secret-code&state=private-state','/v1/operations/requests?workspaceId=private-tenant','/unknown-private-name']){
  const res=new EventEmitter();res.statusCode=403;res.setHeader=()=>{};
  monitor.observe({url,headers:{cookie:'secret-cookie'},body:{password:'secret-body'}},res);res.emit('finish');
 }
 assert.equal(lines.length,3);assert.doesNotMatch(lines.join('\n'),/secret-|private-state|private-tenant|unknown-private-name/);
 assert.deepEqual(monitor.snapshot(),{'callback:4xx':1,'private_api:4xx':1,'asset_or_unknown:4xx':1});
 const res=new EventEmitter();res.statusCode=200;res.setHeader=()=>{};createPrivateObservability({write(){throw Error('sink outage');}}).observe({url:'/'},res);assert.doesNotThrow(()=>res.emit('finish'));
});
