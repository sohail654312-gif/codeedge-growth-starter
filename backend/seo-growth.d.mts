export type SeoBusiness={
 workspaceId:string;name:string;industry:string;country:'UK'|'Pakistan';city:string;
 website:string;ownershipStatus:'fixture_only'|'verified'|'unverified';services:string[];serviceAreas:string[];
 audience:string;goals:string[];languages:string[];
};
export type HtmlFixture={workspaceId:string;url:string;html:string;status:number};
export type KeywordSuggestion={
 phrase:string;geography:string;intent:string;cluster:string;targetPage:string;mapping:string;
 confidence:string;uncertainty:string;provenance:{source:string;kind:string;observedAt:string};
 metrics:{searchVolume:number|null;keywordDifficulty:number|null;cpc:number|null;ranking:number|null;traffic:number|null;metricsStatus:string};
};
export type SeoTask={
 id:string;code:string;url:string;finding:string;recommendation:string;priority:string;
 objective:string;owner:string;status:string;completionEvidence:null;
};
export type SeoReport={
 version:string;workspaceId:string;business:SeoBusiness;instruction:string;generatedAt:string;mode:string;
 siteAudit:{pages:Array<{url:string;status:number;title:string;h1:string[];missingAlt:number;source:string}>;
 findings:SeoTask[]};keywords:KeywordSuggestion[];aeo:Array<{id:string;question:string;answerDraft:string;
 status:string;assumptions:string[];evidence:string;targetPage:string|null}>;
 tasks:SeoTask[];cannibalisationWarnings:string[];
 analytics:{providers:Array<{provider:string;status:string;metrics:{impressions:null;clicks:null;ctr:null;averagePosition:null}}>} ;
 publication:{enabled:false;requiresHumanApproval:true};warnings:string[];
};
export function runOfflineGrowthReport(input:{business:SeoBusiness;pages:HtmlFixture[];workspaceId:string;instruction:string;asOf?:string}):SeoReport;
export function exportKeywordCsv(report:SeoReport):string;
export function requestNetworkCrawl():never;
export const INTEGRATION_CONTRACT:{version:string;direction:string;enabled:false};
