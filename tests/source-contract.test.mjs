import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const routes=readFileSync('backend/routes.mjs','utf8');
const entry=readFileSync('backend/index.ts','utf8');
const frontend=[readFileSync('src/App.tsx','utf8'),readFileSync('src/ClinicOverview.tsx','utf8')].join('\n');
test('all private endpoints require SDK auth middleware',()=>{
 const routeMatches=[...routes.matchAll(/'(GET|POST|PUT|DELETE) \/api\/[^']+'\s*:\s*\[\s*(protect|async)/g)];
 assert.ok(routeMatches.length>=9);
 for(const match of routeMatches){
   if(match[0].includes('/api/_healthcheck'))continue;
   assert.equal(match[2],'protect',match[0]);
 }
 assert.match(entry,/requireAuth/);
});
test('workspace lookups and durable keys are server derived',()=>{
 assert.match(routes,/resolveWorkspace\(ctx,db,action,trustedMembership\)/);
 assert.match(routes,/workspace\.ownerUserId/);
 assert.match(routes,/validateImageUpload/);
});
test('demo data visibly distinguished from verified analytics',()=>{
 assert.match(frontend,/DEMO WORKSPACE/);
 assert.match(frontend,/read-only/);
 assert.match(frontend,/illustrative/i);
 assert.match(frontend,/not connected/i);
});
test('critical platform sources and domain tests present',()=>{
 for(const path of ['backend/index.ts','backend/core.mjs','backend/core.d.mts','backend/routes.mjs','backend/routes.d.mts','tests/core.integration.test.mjs','tests/tests.json']){
  assert.ok(existsSync(path),path);
 }
});

test('work progress makes client approvals explicitly unavailable pending atomic storage',()=>{
 const ui=readFileSync('src/WorkProgress.tsx','utf8');
 assert.match(ui,/Approval pending security gate/);
 assert.match(ui,/disabled title='Approval requires independently verified atomic persistence'/);
 assert.match(ui,/separate tracked request/);
});
test('media consent is required in client UI and unsigned media uses locked placeholder',()=>{
 const app=readFileSync('src/App.tsx','utf8');
 assert.match(app,/mediaConfirmed/);
 assert.match(app,/no patient or medical data/);
 assert.match(app,/Awaiting consent and security review/);
});

test('client website page and agency desk maintain honest privilege boundaries',()=>{
 const app=readFileSync('src/App.tsx','utf8');
 const pages=readFileSync('src/ServicePages.tsx','utf8');
 assert.match(app,/data\.role === 'agency_admin'/);
 assert.match(app,/visibleNav\.map\(/);
 assert.match(pages,/only the workspace selected through your verified server membership/i);
 assert.match(pages,/security gate pending/);
 assert.match(pages,/rankings are not connected|search rankings are not connected/i);
});
test('server requires media rights and never automatically marks uploaded images approved',()=>{
 const routes=readFileSync('backend/routes.mjs','utf8');
 assert.match(routes,/rightsDeclared!==true/);
 assert.match(routes,/consentStatus:'not_verified'/);
});

test('private workspace never displays fictional demo records while authentication data loads', () => {
  assert.match(frontend, /const emptyOverview: Overview = \{ profile: null, enquiries: \[\], requests: \[\], assets: \[\] \}/);
  assert.equal((frontend.match(/setData\(emptyOverview\)/g) || []).length, 2, 'Initial and popup sign-in clear demo records');
  assert.match(frontend, /setLoadingWorkspace\(true\)/);
  assert.match(frontend, /role="status" aria-live="polite"/);
});

test('SEO tab provides a real offline report surface rather than static marketing cards',()=>{
 const ui=readFileSync('src/SeoGrowthManager.tsx','utf8');
 assert.match(frontend,/SeoGrowthManager/);
 assert.match(ui,/runOfflineGrowthReport/);
 assert.match(ui,/exportKeywordCsv/);
 assert.match(ui,/Not connected/);
 assert.match(ui,/awaiting security approval/);
 assert.match(ui,/offline/i);
 assert.ok(existsSync('backend/seo-growth.mjs'));
 assert.ok(existsSync('backend/seo-fixtures.mjs'));
});
