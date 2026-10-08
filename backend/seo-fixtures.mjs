import {runOfflineGrowthReport} from './seo-growth.mjs';

const mk=(workspaceId,name,industry,country,city,services,serviceAreas,htmlPages)=>({
 business:{
  workspaceId,name,industry,country,city,services,serviceAreas,
  website:country==='UK'?'https://atlas-plumbing.example':'https://northstar-clinic.example',
  ownershipStatus:'fixture_only',audience:'Local residents seeking practical service information',
  languages:country==='UK'?['English']:['English','Urdu'],goals:['Improve website clarity','Prepare reviewed local content']
 },
 pages:htmlPages.map(([path,html,status=200])=>({
  workspaceId,url:(country==='UK'?'https://atlas-plumbing.example':'https://northstar-clinic.example')+path,html,status
 }))
});
export const FICTIONAL_SEO_FIXTURES=Object.freeze({
 plumbing:mk('ws_offline_plumbing_demo_A','Atlas Plumbing (fictional)','Plumbing and heating','UK','Manchester',
  ['boiler repair','leak repair'],['Manchester','Salford'],[
   ['/',\`<!doctype html><html><head><title>Atlas Plumbing | Manchester</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="canonical" href="https://atlas-plumbing.example/"></head><body>
<h1>Plumbing help in Manchester</h1><p>Illustrative example with no verified trading information.</p>
<a href="/boiler-repair">Boiler repairs</a><a href="/contact">Contact</a>
<img src="/van.png"></body></html>\`],
   ['/boiler-repair',\`<html><head><title>Boiler repair | Atlas Plumbing</title>
<meta name="description" content="Illustrative Manchester boiler repair page."></head><body>
<h1>Boiler repair in Manchester</h1><h2>What we would explain</h2>
<p>Describe the repair process and how clients can request advice. The actual availability must be confirmed.</p>
<a href="/contact">Request information</a></body></html>\`],
   ['/contact',\`<html><head><title>Contact Atlas Plumbing</title><meta name="robots" content="noindex"></head>
<body><h1>Contact</h1><a href="/missing">Extra information</a><p>Fictional content</p></body></html>\`],
   ['/missing','<html><title>Missing fixture page</title></html>',404]
  ]),
 clinic:mk('ws_offline_clinic_demo_ABC','Northstar Skin Clinic (fictional)','Skin and wellness clinic','Pakistan','Peshawar',
  ['skin consultation','skin care information'],['Peshawar'],[
   ['/',\`<html><head><title>Northstar Skin Clinic</title><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body><h1>Skin information in Peshawar</h1>
<p>Fictional clinic demonstration. No treatment or practitioner claims are verified.</p>
<a href="/skin-consultation">Consultation information</a></body></html>\`],
   ['/skin-consultation',\`<html><head><title>Northstar Skin Clinic</title><meta name="description" content="Fictional skin information">
</head><body><h1>Skin consultations</h1><h2>Before an appointment</h2><p>Please confirm clinical information with a qualified practitioner.</p></body></html>\`]
  ])
});
export function demoGrowthReport(kind='plumbing',asOf='2026-10-08T00:00:00.000Z'){
 const seed=FICTIONAL_SEO_FIXTURES[kind];
 if(!seed)throw Error('Unknown offline fixture.');
 return runOfflineGrowthReport({workspaceId:seed.business.workspaceId,business:seed.business,pages:seed.pages,
  instruction:'Improve SEO for '+seed.business.name+' in '+seed.business.city+'.',asOf});
}
