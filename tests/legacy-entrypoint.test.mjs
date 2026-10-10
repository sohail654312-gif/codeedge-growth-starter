import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

test('legacy actor-ID standalone staging entrypoint cannot start a network listener',()=>{
 const r=spawnSync(process.execPath,['staging/server.mjs'],{
  encoding:'utf8',timeout:3000,env:{PATH:process.env.PATH,PORT:'65535'}
 });
 assert.equal(r.status,1);
 assert.match(r.stderr,/gateway disabled pending independent security cutover/);
 assert.doesNotMatch(r.stdout,/listening|Bearer |postgresql:\/\//);
 const pkg=JSON.parse(readFileSync('staging/package.json','utf8'));
 assert.equal(pkg.scripts.start,'node server.mjs');
});
