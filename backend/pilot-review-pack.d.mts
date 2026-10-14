import type {SeoReport} from './seo-growth.mjs';
import type {PremiumPlan} from './premium-content-intelligence.mjs';
import type {WebsiteProposal} from './website-proposals.mjs';
export type OfflinePilotReviewPack={
 version:'codeedge.pilot-review-pack.v1';mode:'offline_review_only';workspaceId:string;
 business:{name:string;city:string;industry:string;website:string;ownershipStatus:string};
 evidence:{origin:string;htmlNotLiveVerified:true;realGoogleMetricsVerified:false;
 measuredSearchVolume:null;measuredTraffic:null;measuredRankings:null;
 generatedFrom:string;websiteProposalSource:string};
 clientWorkflow:Array<{step:string;status:string}>;
 seo:{keywords:Array<{phrase:string;intent:string;targetPage:string;searchVolume:null;ranking:null;verification:string}>;
 tasks:Array<{id:string;url:string;priority:string;recommendation:string;status:string}>};
 aeoDrafts:Array<{question:string;answerDraft:string;status:string}>;
 socialConcepts:Array<{concept:string;channelIdeas:string[];callToAction:string;status:string}>;
 websiteProposals:WebsiteProposal[];
 correctionDrafts:Array<{workspaceId:string;proposalId:string;note:string;status:'local_only_not_submitted'}>;
 review:{verifiedActor:null;clientApproved:false;agencyAssigned:false;published:false;
 requiresProfessionalFactCheck:true;submissionStatus:'not_submitted'};
 externalActions:{read:false;write:false;notify:false;approve:false;publish:false;providerOAuth:false};
 limitations:string[];
};
export const PILOT_REVIEW_BOUNDARY:Record<string,unknown>;
export function prepareOfflinePilotReviewPack(input:{seoReport:SeoReport;premiumPlan:PremiumPlan;correctionDrafts?:Array<{workspaceId:string;proposalId:string;note:string}>}):OfflinePilotReviewPack;

export function restoreOfflinePilotCorrectionDrafts(input:{json:string;seoReport:SeoReport;premiumPlan:PremiumPlan}):Array<{workspaceId:string;proposalId:string;note:string}>;
