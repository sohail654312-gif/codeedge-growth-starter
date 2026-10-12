#!/usr/bin/env node
// Fictional only. Example: node backend/pilot-review-demo.mjs clinic
import {demoGrowthReport} from './seo-fixtures.mjs';
import {buildPremiumContentStrategy} from './premium-content-intelligence.mjs';
import {prepareOfflinePilotReviewPack} from './pilot-review-pack.mjs';
const kind=process.argv[2]||'clinic';
if(!['clinic','plumbing'].includes(kind)||process.argv.length>3){
 process.stderr.write('Usage: node backend/pilot-review-demo.mjs clinic|plumbing\n');
 process.exitCode=1;
}else{
 const seoReport=demoGrowthReport(kind,'2026-10-12T00:00:00.000Z');
 const premiumPlan=buildPremiumContentStrategy({seoReport});
 process.stdout.write(JSON.stringify(prepareOfflinePilotReviewPack({seoReport,premiumPlan}),null,2)+'\n');
}
