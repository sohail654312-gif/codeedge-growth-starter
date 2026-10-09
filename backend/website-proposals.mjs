/**
 * Phase 3.0 — strict review-only website change proposals, never deployment.
 * Both source plans must refer to the same workspace and a page in the supplied
 * HTML fixture. No live crawling, AI provider, database write or GitHub edit.
 */
const check=(ok,msg)=>{if(!ok)throw Error(msg);};
const acceptedPlan=plan=>plan?.version==='growth-starter.premium-content-plan.v1' &&
 plan?.externalActions?.crawl===false && plan?.externalActions?.persist===false &&
 plan?.externalActions?.edit===false && plan?.externalActions?.publish===false;
const safe=x=>String(x??'').replace(/[\u0000-\u001F\u007F]/g,' ').replace(/\s+/g,' ').trim();
function pageEvidence(seoReport,url){
 return seoReport.siteAudit?.pages?.find(p=>p.url===url)||null;
}
export const PROPOSAL_BOUNDARY=Object.freeze({version:'codeedge.website-proposal.v1',mode:'offline_review_only',
 trustedMembership:false,requestSubmission:false,clientApprovals:false,agencyWork:false,
 websiteChanges:false,publications:false,storage:false});
export function prepareWebsiteImprovementProposals({premiumPlan,seoReport}){
 check(acceptedPlan(premiumPlan) && seoReport?.version==='growth-starter.seo-report.v1' &&
  seoReport.mode==='offline_supplied_html_only' &&
  seoReport.workspaceId===premiumPlan.workspaceId, 'Matching offline plans and workspace required.');
 check(Array.isArray(premiumPlan.seo?.pages) && premiumPlan.seo.pages.length<=18 &&
  Array.isArray(seoReport.siteAudit?.pages) && seoReport.siteAudit.pages.length<=8,
  'Bounded supplied-page evidence required.');
 const origin=new URL(seoReport.business.website).origin;
 check(origin===new URL(premiumPlan.business.website).origin,'Business website scope mismatch.');
 return Object.freeze({
  version:'codeedge.website-proposals.v1',workspaceId:premiumPlan.workspaceId,
  businessWebsite:origin,evidenceType:'supplied_html_offline_not_live_verified',
  sourceReport:seoReport.version,sourceStrategy:premiumPlan.version,
  proposals:premiumPlan.seo.pages.map((item,index)=>{
    let target;try{target=new URL(item.targetPage);}catch{throw Error('Malformed page URL.');}
    check(target.origin===origin && target.protocol==='https:' &&
      !target.username&&!target.password && !target.hash &&
      !target.search,'Proposed URL escaped the business website.');
    const evidence=pageEvidence(seoReport,item.targetPage);
    const type=evidence?'existing_page_content_proposal':'new_page_proposal_only';
    const originalTitle=evidence?.title||null;
    const originalHeading=evidence?.h1?.[0]||null;
    return Object.freeze({
      id:'WEB-'+(index+1),workspaceId:premiumPlan.workspaceId,url:item.targetPage,
      type,priority:item.priority,businessObjective:item.objective,
      before:{source:evidence?'operator_supplied_html':'not_available',
        title:originalTitle,description:evidence?.description||null,heading:originalHeading},
      after:{title:safe(item.titleDraft).slice(0,120),
        description:safe(item.metaDescriptionDraft).slice(0,330),
        heading:safe(item.headings?.[0]).slice(0,180),
        sections:item.contentSections.slice(0,8).map(section=>({
          heading:safe(section.heading).slice(0,180),
          draft:safe(section.draft).slice(0,800),
          verify:section.requiresConfirmation.slice(0,8)}))},
      provenance:{source:evidence?'operator_supplied_html':'service_location_hypothesis',
        reference:evidence?.url||null,measuredKeywordDemand:null,
        importedSearchObservationStatus:item.searchDemandStatus},
      review:{state:'proposal_not_submitted',needsHumanFactCheck:true,
        verifiedActor:null,approval:null,completionEvidence:null,revision:0},
      executable:false
    });
  }),
  limitations:[
    'Before values are taken only from supplied HTML extracts, not live website.',
    'No automatic repository, content-management, hosting, publishing or SEO editing permission.',
    'Human reviewer must verify business facts, professional claims, consent and accessible presentation.'
  ],
  externalActions:{read:false,write:false,publish:false,notify:false}
 });
}
export function reviseWebsiteProposalOffline({proposal,workspaceId,expectedRevision,after,reviewNote=''}){
 check(proposal?.workspaceId===workspaceId &&
  proposal?.review?.state==='proposal_not_submitted' &&
  proposal.executable===false,'Foreign workspace or active proposal denied.');
 check(Number.isSafeInteger(expectedRevision)&&expectedRevision===proposal.review.revision,
  'Optimistic revision conflict.');
 check(after && typeof after==='object' && !Array.isArray(after) &&
  typeof after.title==='string' && typeof after.description==='string' &&
  typeof after.heading==='string' &&
  after.title.length<=120&&after.description.length<=330&&after.heading.length<=180,
  'Bounded change text required.');
 check(typeof reviewNote==='string'&&reviewNote.length<=800,'Review note too long.');
 // This is not a server approval or an audit event; it returns a detached
 // proposal for local review without granting any external actions.
 return Object.freeze({
  ...proposal,
  after:{...proposal.after,title:safe(after.title),description:safe(after.description),
    heading:safe(after.heading)},
  review:{...proposal.review,revision:expectedRevision+1,
    state:'proposal_not_submitted',verifiedActor:null,approval:null,
    localReviewNote:safe(reviewNote)}
 });
}
const disabled=()=>{throw Error('Real tenant session, transactional approvals and website publishing remain disabled.');};
export function createDisabledWebsiteActionAdapter(){
 return Object.freeze({capabilities:PROPOSAL_BOUNDARY,submit:disabled,approve:disabled,
   assign:disabled,publish:disabled,crawl:disabled,deploy:disabled});
}
export const CONTENT_GENERATION_PROVIDER_CONTRACT=Object.freeze({
 version:'codeedge.ai-content-proposal.v1',
 allowedOutput:'bounded_proposal_only',
 requiredClaims:['human_fact_review','workspace_scope','source_provenance','no_publication'],
 remoteLlm:'disabled_pending_hosted_identity_and_approved_provider',
 status:'offline_deterministic_fallback'
});
export function createOfflineContentGenerationPort(){
 return Object.freeze({mode:'deterministic_offline',capabilities:CONTENT_GENERATION_PROVIDER_CONTRACT,
   async propose({premiumPlan,seoReport}){
    const plan=prepareWebsiteImprovementProposals({premiumPlan,seoReport});
    return Object.freeze({...plan,provider:'deterministic_offline_not_llm_verified',
      humanReviewRequired:true});
   },
   connect:disabled,publish:disabled,store:disabled
 });
}
