import {FICTIONAL_SEO_FIXTURES} from './seo-fixtures.mjs';
export const FICTIONAL_GSC=Object.freeze({
 business:FICTIONAL_SEO_FIXTURES.plumbing.business,
 manifest:{
  workspaceId:FICTIONAL_SEO_FIXTURES.plumbing.business.workspaceId,
  property:'sc-domain:atlas-plumbing.example',searchType:'web',dimensions:['query'],
  startDate:'2026-09-01',endDate:'2026-09-30',observedAt:'2026-10-08T10:00:00.000Z'
 },
 csv:[
  'Top queries,Clicks,Impressions,CTR,Position',
  '"boiler repair manchester",12,600,2%,7.0',
  '"leak repair salford",24,300,8%,3.0',
  '"how to choose boiler repair in manchester",3,150,2%,9.0'
 ].join('\r\n'),
 earlier:{
  workspaceId:FICTIONAL_SEO_FIXTURES.plumbing.business.workspaceId,
  property:'sc-domain:atlas-plumbing.example',searchType:'web',dimensions:['query'],
  startDate:'2026-08-02',endDate:'2026-08-31',observedAt:'2026-09-04T08:00:00.000Z'
 },
 earlierCsv:['Top queries,Clicks,Impressions,CTR,Position',
  '"boiler repair manchester",15,500,3%,6.0',
  '"leak repair salford",20,250,8%,4.0'].join('\r\n')
});
