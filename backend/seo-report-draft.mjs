/**
 * Phase 2.8 SOURCE-ONLY SEO report envelope/revision preparation.
 * Never accepts client-supplied identity as authoritative. No storage, network,
 * credential handling, approvals, database access or exposed HTTP endpoints.
 */
import {createHash} from 'node:crypto';
const assert=(ok,message)=>{if(!ok)throw Error(message);};
const WS=/^ws_[A-Za-z0-9_-]{8,128}$/;
const BUSINESS=/^biz_[A-Za-z0-9_-]{8,128}$/;
const SOURCE_TYPES=Object.freeze({
 'growth-starter.seo-report.v1':'offline_supplied_html_only',
 'growth-starter.search-analysis.v1':'user_supplied_search_console_export_unverified'
});
const SHA=/^[0-9a-f]{64}$/;
const checkedClock=(clock)=>{const now=new Date(clock).getTime();assert(Number.isFinite(now),'Valid review clock required.');return now;};
const fingerprint=value=>createHash('sha256').update(value,'utf8').digest('hex');
export const SEO_REPORT_STORAGE_GATE=Object.freeze({
 version:'codeedge.seo-report-draft.v1',
 status:'source_only_disabled',
 acceptedHostedTwoUserEvidence:false,
 persistentReads:false,persistentWrites:false,clientReviewMutations:false,
 agencyAssignments:false,publishing:false
});
function enforceSource(report){
  assert(report&&typeof report==='object'&&!Array.isArray(report),'SEO report required.');
  const accepted=SOURCE_TYPES[report.version];
  assert(accepted,'Unsupported SEO report version.');
  if(report.version==='growth-starter.seo-report.v1'){
    assert(report.mode==='offline_supplied_html_only' &&
      report.publication?.enabled===false,
      'Offline SEO provenance or publication gate invalid.');
  }else{
    assert(report.source===accepted &&
      report.verification==='not_live_api_verified' &&
      report.externalActions?.persistentWrites===false &&
      report.externalActions?.publishing===false,
      'Imported Search Console evidence must remain unverified and nonpublishing.');
  }
  return accepted;
}
export function prepareSeoReportDraft({workspaceId,businessRef,report,sourceEvidence,observedAt,
  clock=new Date().toISOString()}){
  assert(typeof workspaceId==='string'&&WS.test(workspaceId),'Valid workspace scope required.');
  assert(typeof businessRef==='string'&&BUSINESS.test(businessRef),'Valid business identity reference required.');
  assert(report?.workspaceId===workspaceId,'Cross-workspace report refused.');
  if(report.business)assert(report.business.workspaceId===workspaceId,'Cross-workspace business refused.');
  const evidenceType=enforceSource(report);
  assert(typeof sourceEvidence==='string'&&sourceEvidence.length>0 &&
    Buffer.byteLength(sourceEvidence,'utf8')<=512000,'Bounded exact source evidence required.');
  let serialized;try{serialized=JSON.stringify(report);}catch{throw Error('Report must be JSON serializable.');}
  assert(typeof serialized==='string' && Buffer.byteLength(serialized,'utf8')<=512000,
    'Bounded serializable SEO report required.');
  const now=checkedClock(clock),observed=Date.parse(observedAt);
  assert(typeof observedAt==='string'&&Number.isFinite(observed)&&observed<=now+60000,
    'Source observation time invalid or in future.');
  // Recentness never turns an operator-supplied export into Google-verified data.
  const age=Math.max(0,Math.floor((now-observed)/86400000));
  return Object.freeze({
    contract:'codeedge.seo-report-draft.v1',workspaceId,businessRef,
    reportVersion:report.version,provenance:evidenceType,verifiedByGoogle:false,
    sourceDigest:fingerprint(sourceEvidence),reportDigest:fingerprint(serialized),
    observedAt:new Date(observed).toISOString(),preparedAt:new Date(now).toISOString(),
    staleEvidence:age>90,sourceAgeDays:age,
    reviewStatus:'draft_not_submitted',storageStatus:'not_persisted',
    authorisationStatus:'hosted_two_user_gate_blocked',
    dataBytes:Buffer.byteLength(serialized,'utf8')
  });
}
export function prepareSeoReportRevision({history,draft,expectedRevision}){
  assert(Array.isArray(history)&&history.length<=100,'Bounded revision history required.');
  assert(draft?.contract===SEO_REPORT_STORAGE_GATE.version&&
    draft.storageStatus==='not_persisted' &&
    draft.authorisationStatus==='hosted_two_user_gate_blocked' &&
    WS.test(draft.workspaceId),'Only scoped source-only report drafts are accepted.');
  assert(Number.isSafeInteger(expectedRevision)&&expectedRevision===history.length,
    'Revision conflict; refresh the report before proposing changes.');
  for(let i=0;i<history.length;i++){
    const prior=history[i];
    assert(prior?.revision===i+1 && prior.workspaceId===draft.workspaceId &&
      prior.businessRef===draft.businessRef &&
      SHA.test(prior.sourceDigest) && SHA.test(prior.reportDigest),
      'Invalid or cross-workspace revision history.');
  }
  assert(!history.some(entry=>entry.sourceDigest===draft.sourceDigest||
    entry.reportDigest===draft.reportDigest),'Duplicate source/report fingerprint.');
  const previous=history.at(-1)||null;
  assert(!previous||Date.parse(draft.preparedAt)>=Date.parse(previous.preparedAt),
    'Revision timestamp goes backwards.');
  // Immutable append-only suggestion, never a DB write or authorization grant.
  return Object.freeze({
    revision:history.length+1,previousReportDigest:previous?.reportDigest||null,
    ...draft,reviewStatus:'proposed_requires_server_authorization',
    storageStatus:'not_persisted',approval:null,reviewEvents:Object.freeze([])
  });
}
const blocked=()=>{throw Error('Hosted tenant authorization not verified: SEO report persistence and approvals disabled.');};
export function createDisabledSeoReportRepository(){
  return Object.freeze({capabilities:SEO_REPORT_STORAGE_GATE,
    save:blocked,list:blocked,read:blocked,review:blocked,assign:blocked,publish:blocked});
}
