/**
 * Audit-phase Finance Suite integration contract. Source-only and read-only:
 * no network connection, Finance token, posting or tax submission.
 * Finance Suite remains the accounting/tax system of record.
 */
const WS=/^ws_[A-Za-z0-9_-]{8,128}$/;
const REF=/^[A-Za-z0-9_-]{3,80}$/;
const MONTH=/^20[2-9][0-9]-(?:0[1-9]|1[0-2])$/;
const DECIMAL=/^-?(?:0|[1-9][0-9]{0,14})(?:\.[0-9]{1,2})?$/;
const BAD='Finance integration denied.';
function deny(){throw Error(BAD);}
export const FINANCE_INTEGRATION_CONTRACT=Object.freeze({
 version:'codeedge.finance.summary.v1',
 status:'source_only_release_blocked',
 capability:'read_approved_monthly_summary',
 permittedActions:Object.freeze(['summary:read']),
 prohibitedActions:Object.freeze(['journal:post','invoice:finalize','tax:file','bank:pay','approval:grant']),
 financeIsSystemOfRecord:true,
 hostedEnabled:false
});
export function createHostedFinanceConnector(){
 throw Error('Finance Suite hosted connector blocked pending Finance V1 and tenant-security acceptance.');
}
export function createSyntheticFinanceConnector({
 authorizeCodeedge,resolveServerMapping,readSyntheticFinance,
 fictionalTestOnly=false
}={}){
 if(fictionalTestOnly!==true||process.env.NODE_ENV==='production'||
    typeof authorizeCodeedge!=='function'||
    typeof resolveServerMapping!=='function'||
    typeof readSyntheticFinance!=='function')
   throw Error('Only fictional source-only Finance connector is available.');
 return Object.freeze({
  status:'synthetic_read_only',
  async readMonthlySummary({codeedgeSession,workspaceId,month}={}){
   if(typeof codeedgeSession!=='string'||codeedgeSession.length<32||
      codeedgeSession.length>256||!WS.test(workspaceId||'')||
      !MONTH.test(month||''))deny();
   // The caller may not supply Finance tenant or Finance legal-entity IDs.
   let allowed;
   try{allowed=await authorizeCodeedge({
    codeedgeSession,workspaceId,scope:'finance:summary:read'
   });}catch{deny();}
   if(allowed!==true)deny();
   let bind;
   try{bind=await resolveServerMapping(workspaceId);}catch{deny();}
   if(!bind||bind.status!=='finance_verified'||
      bind.growthWorkspaceId!==workspaceId||bind.scope!=='finance:summary:read'||
      !REF.test(bind.financeTenantId||'')||
      !REF.test(bind.financeLegalEntityId||''))deny();
   const scoped=Object.freeze({financeTenantId:bind.financeTenantId,
    financeLegalEntityId:bind.financeLegalEntityId,month});
   let data;
   try{data=await readSyntheticFinance(scoped);}catch{deny();}
   if(!data||data.financeTenantId!==scoped.financeTenantId||
      data.financeLegalEntityId!==scoped.financeLegalEntityId||
      data.month!==month||
      typeof data.currency!=='string'||!/^[A-Z]{3}$/.test(data.currency)||
      typeof data.receivables!=='string'||!DECIMAL.test(data.receivables)||
      typeof data.payables!=='string'||!DECIMAL.test(data.payables)||
      !['not_verified','pending_human_review'].includes(data.taxReviewStatus))deny();
   return Object.freeze({
    version:FINANCE_INTEGRATION_CONTRACT.version,workspaceId,month,
    currency:data.currency,receivables:data.receivables,
    payables:data.payables,taxReviewStatus:data.taxReviewStatus,
    live:false,taxFilingConfirmed:false
   });
  }
 });
}
