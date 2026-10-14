import test from 'node:test';
import assert from 'node:assert/strict';
import {createHostedFinanceConnector,createSyntheticFinanceConnector,
 FINANCE_INTEGRATION_CONTRACT} from '../backend/finance-suite-contract.mjs';
const W='ws_123456789abcdefg',W2='ws_987654321abcdefg';
const token='fictional-codeedge-session-owner-1234567890';
const mapping={status:'finance_verified',growthWorkspaceId:W,
 financeTenantId:'tenant_fictional_a',financeLegalEntityId:'entity_a',
 scope:'finance:summary:read'};
const read=async args=>({...args,currency:'PKR',
 receivables:'1000.00',payables:'220.50',
 taxReviewStatus:'pending_human_review',
 privateBankNumber:'do-not-leak',secret:'never-return'});
function bridge(override={}){
 return createSyntheticFinanceConnector({
  fictionalTestOnly:true,authorizeCodeedge:async()=>true,
  resolveServerMapping:async()=>mapping,readSyntheticFinance:read,...override
 });
}
const ask=(b,options={})=>b.readMonthlySummary({
 codeedgeSession:token,workspaceId:W,month:'2026-10',...options
});
test('hosted integration disabled and all finance writes unavailable',()=>{
 assert.throws(()=>createHostedFinanceConnector(),/blocked/);
 assert.throws(()=>createSyntheticFinanceConnector(),/source-only/);
 assert.equal(FINANCE_INTEGRATION_CONTRACT.hostedEnabled,false);
 assert.equal('postJournal' in bridge(),false);
 assert.equal('fileTax' in bridge(),false);
});
test('source-only verified mapping returns minimal scoped summary',async()=>{
 let authCalls=0,financeCalls=0;
 const b=bridge({authorizeCodeedge:async x=>{
  authCalls++;assert.deepEqual(x,{codeedgeSession:token,workspaceId:W,
   scope:'finance:summary:read'});return true;},
  readSyntheticFinance:async x=>{financeCalls++;return read(x);}
 });
 const got=await ask(b);
 assert.deepEqual(got,{version:'codeedge.finance.summary.v1',
  workspaceId:W,month:'2026-10',currency:'PKR',
  receivables:'1000.00',payables:'220.50',
  taxReviewStatus:'pending_human_review',live:false,taxFilingConfirmed:false});
 assert.equal(authCalls,1);assert.equal(financeCalls,1);
 assert.ok(!JSON.stringify(got).includes('privateBankNumber'));
});
test('authorization denied before a finance request',async()=>{
 let calls=0;
 const b=bridge({authorizeCodeedge:async()=>false,
  readSyntheticFinance:async a=>{calls++;return read(a);}});
 await assert.rejects(ask(b),/denied/);
 assert.equal(calls,0);
 await assert.rejects(ask(b,{codeedgeSession:'invalid'}),/denied/);
 await assert.rejects(ask(b,{month:'2026-99'}),/denied/);
});
test('finance-tenant mapping and response mixups fail closed',async()=>{
 for(const v of [{growthWorkspaceId:W2},{status:'unverified'},
  {financeTenantId:'other; DROP'},{scope:'finance:write'}]){
  await assert.rejects(ask(bridge({
   resolveServerMapping:async()=>({...mapping,...v})
  })),/denied/);
 }
 for(const v of [{financeTenantId:'other_tenant'},{financeLegalEntityId:'other_entity'},
  {month:'2026-09'},{receivables:999},{payables:'NaN'},
  {taxReviewStatus:'filed'}]){
  await assert.rejects(ask(bridge({
   readSyntheticFinance:async args=>({...await read(args),...v})
  })),/denied/);
 }
});
test('independent service outages fail closed',async()=>{
 await assert.rejects(ask(bridge({readSyntheticFinance:async()=>{throw Error('down');}})),/denied/);
 await assert.rejects(ask(bridge({authorizeCodeedge:async()=>{throw Error('down');}})),/denied/);
});
