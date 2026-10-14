import test from 'node:test';
import assert from 'node:assert/strict';
import {createDisabledProviderPort,createSyntheticReadOnlyGscPort,PROVIDER_READ_PERMISSIONS,CONNECTOR_VERSION} from '../backend/seo-provider-adapters.mjs';
import {FICTIONAL_GSC} from '../backend/search-fixtures.mjs';
const seed=FICTIONAL_GSC;
const port=()=>createSyntheticReadOnlyGscPort({grants:[{workspaceId:seed.business.workspaceId,property:seed.manifest.property}],
 fixtures:[{workspaceId:seed.business.workspaceId,property:seed.manifest.property,
  startDate:seed.manifest.startDate,endDate:seed.manifest.endDate,dimensions:seed.manifest.dimensions,csv:seed.csv}]});
test('read-only mock discovers only workspace-granted properties without OAuth',()=>{
 const p=port();
 assert.equal(p.discover({workspaceId:seed.business.workspaceId}).length,1);
 assert.deepEqual(p.discover({workspaceId:'ws_someone_else_123'}),[]);
 assert.equal(p.read({workspaceId:seed.business.workspaceId,business:seed.business,manifest:seed.manifest}).rows.length,3);
 assert.equal(p.mode,'mock_synthetic_no_network');
 assert.throws(()=>p.connect(),/disabled/);
 assert.throws(()=>p.publish(),/disabled/);
});
test('mock GSC port refuses foreign workspace and property grants',()=>{
 const p=port();
 assert.throws(()=>p.read({workspaceId:'ws_someone_else_123',business:seed.business,manifest:seed.manifest}),/Foreign/);
 assert.throws(()=>p.read({workspaceId:seed.business.workspaceId,business:seed.business,
 manifest:{...seed.manifest,property:'sc-domain:other.example'}}),/grant denied/);
 assert.throws(()=>p.read({workspaceId:seed.business.workspaceId,business:seed.business,
 manifest:{...seed.manifest,startDate:'2026-09-02'}}),/No matching/);
});
test('all production Google ports stay completely disconnected',()=>{
 for(const kind of ['search_console','ga4','business_profile']){
  const port=createDisabledProviderPort(kind);
  assert.equal(port.status,'not_connected');
  for(const action of ['discover','read','connect','publish'])assert.throws(()=>port[action](),/disabled/);
 }
 assert.ok(PROVIDER_READ_PERMISSIONS.search_console.scope.endsWith('webmasters.readonly'));
 assert.equal(CONNECTOR_VERSION,'codeedge.search-provider-read.v1');
 assert.throws(()=>createDisabledProviderPort('unknown'),/Unsupported/);
});
