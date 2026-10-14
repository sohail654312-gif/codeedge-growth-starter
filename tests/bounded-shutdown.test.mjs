import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,get} from 'node:http';
import {createBoundedShutdown} from '../staging/bounded-shutdown.mjs';
test('shutdown stops admission, drains bounded requests and closes pools exactly once',async()=>{
 let seen;const entered=new Promise(r=>{seen=r;}),server=createServer(()=>seen());
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const request=get('http://127.0.0.1:'+server.address().port);request.on('error',()=>{});await entered;
 let ended=0;const close=createBoundedShutdown({server,pools:[{end:async()=>{ended++;}}],graceMs:50,poolTimeoutMs:50});
 const first=close();assert.equal(first,close());await first;assert.equal(server.listening,false);assert.equal(ended,1);request.destroy();
});
test('unavailable pool shutdown is bounded and exposes only a generic error',async()=>{
 const server=createServer();const close=createBoundedShutdown({server,pools:[{end:()=>new Promise(()=>{})}],graceMs:50,poolTimeoutMs:50});
 await assert.rejects(close(),/Private staging shutdown did not finish/);assert.equal(close(),close());
 assert.throws(()=>createBoundedShutdown({server,pools:[],graceMs:0}),/configuration/);
});
