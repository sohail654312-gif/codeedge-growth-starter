/**
 * Source-only client pilot review package.
 * No network, database, OAuth, approval, or publishing functionality.
 */
import {prepareWebsiteImprovementProposals} from './website-proposals.mjs';
const check=(ok,msg)=>{if(!ok)throw Error(msg);};
export const PILOT_REVIEW_BOUNDARY=Object.freeze({
 version:'codeedge.pilot-review-pack.v1',mode:'offline_review_only',
 liveIdentity:false,liveGoogleMetrics:false,hostedPersistence:false,
 clientApproval:false,agencySubmission:false,publication:false
});
export function prepareOfflinePilotReviewPack({seoReport,premiumPlan,correctionDrafts=[]}){
 const proposals=prepareWebsiteImprovementProposals({seoReport,premiumPlan});
 check(seoReport.publication?.enabled===false &&
   seoReport.publication?.requiresHumanApproval===true,
   'SEO report publication gate not accepted.');
 check(Array.isArray(seoReport.tasks)&&seoReport.tasks.length<=80 &&
   Array.isArray(seoReport.keywords)&&seoReport.keywords.length<=64 &&
   Array.isArray(seoReport.aeo)&&seoReport.aeo.length<=40,
   'Bounded offline research evidence required.');
 check(Array.isArray(premiumPlan.social?.proposals) &&
   premiumPlan.social.proposals.length<=30 &&
   premiumPlan.externalActions?.publish===false &&
   premiumPlan.externalActions?.approve===false,
   'Social or provider actions not accepted.');
 check(premiumPlan.social.proposals.every(p=>p.publishEnabled===false),
   'Social publishing must remain disabled.');
 // Feedback is a detached, local-only handoff. Never accept caller-supplied
 // approval, actor, recipient, or publication metadata.
 check(Array.isArray(correctionDrafts) && correctionDrafts.length<=18 &&
   correctionDrafts.length<=proposals.proposals.length,
   'Bounded local correction drafts required.');
 const proposalIds=new Set(proposals.proposals.map(p=>p.id));
 const seenIds=new Set();
 const localCorrections=correctionDrafts.map(draft=>{
   check(draft && typeof draft==='object' && !Array.isArray(draft) &&
     Object.keys(draft).sort().join(',')==='note,proposalId,workspaceId' &&
     draft.workspaceId===proposals.workspaceId &&
     typeof draft.proposalId==='string' && proposalIds.has(draft.proposalId) &&
     !seenIds.has(draft.proposalId) &&
     typeof draft.note==='string' && draft.note.length<=600,
     'Invalid, foreign or duplicate local correction draft.');
   const note=draft.note.replace(/[\u0000-\u001F\u007F]/g,' ').replace(/\s+/g,' ').trim();
   check(note.length>=4,'Correction note must contain at least four characters.');
   seenIds.add(draft.proposalId);
   return Object.freeze({
     workspaceId:proposals.workspaceId,proposalId:draft.proposalId,
     note,status:'local_only_not_submitted'
   });
 });
 return Object.freeze({
  version:PILOT_REVIEW_BOUNDARY.version,mode:PILOT_REVIEW_BOUNDARY.mode,
  workspaceId:proposals.workspaceId,
  business:{
   name:seoReport.business.name,city:seoReport.business.city,
   industry:seoReport.business.industry,website:seoReport.business.website,
   ownershipStatus:seoReport.business.ownershipStatus
  },
  evidence:{
   origin:'operator_supplied_html_or_fictional_fixture',
   htmlNotLiveVerified:true,realGoogleMetricsVerified:false,
   measuredSearchVolume:null,measuredTraffic:null,measuredRankings:null,
   generatedFrom:seoReport.version,websiteProposalSource:proposals.sourceStrategy
  },
  clientWorkflow:[
   {step:'review_website',status:'draft_only'},
   {step:'review_seo_tasks',status:'draft_only'},
   {step:'review_content',status:'draft_only'},
   {step:'request_corrections',status:'local_only_not_submitted'},
   {step:'agency_approval',status:'blocked_by_hosted_security_gate'}
  ],
  seo:{
   keywords:seoReport.keywords.slice(0,24).map(k=>({
    phrase:k.phrase,intent:k.intent,targetPage:k.targetPage,
    searchVolume:null,ranking:null,verification:'hypothesis_only'
   })),
   tasks:seoReport.tasks.slice(0,30).map(t=>({
    id:t.id,url:t.url,priority:t.priority,recommendation:t.recommendation,
    status:'requires_human_review'
   }))
  },
  aeoDrafts:seoReport.aeo.slice(0,12).map(a=>({
   question:a.question,answerDraft:a.answerDraft,status:'fact_check_required'
  })),
  socialConcepts:premiumPlan.social.proposals.slice(0,10).map(p=>({
   concept:p.concept,channelIdeas:p.channelIdeas,callToAction:p.callToAction,
   status:'draft_not_published'
  })),
  websiteProposals:proposals.proposals,
  correctionDrafts:localCorrections,
  review:{verifiedActor:null,clientApproved:false,agencyAssigned:false,
   published:false,requiresProfessionalFactCheck:true,submissionStatus:'not_submitted'},
  externalActions:{read:false,write:false,notify:false,approve:false,publish:false,providerOAuth:false},
  limitations:[
   'Operator-supplied or fictional HTML evidence, never live authenticated client analytics.',
   'SEO, social and clinical statements require human and professional fact checks.',
   'This file is a local draft: correction notes are not submitted, stored, approved or published.'
  ]
 });
}
