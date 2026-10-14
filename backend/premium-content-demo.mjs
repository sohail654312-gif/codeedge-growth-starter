import {demoGrowthReport} from './seo-fixtures.mjs';
import {FICTIONAL_GSC} from './search-fixtures.mjs';
import {importSearchConsoleExport,analyzeImportedSearchEvidence} from './seo-search-data.mjs';
import {buildPremiumContentStrategy,exportPremiumStrategyCsv} from './premium-content-intelligence.mjs';
// Fictional-only sample, always an unverified user-import scenario, not actual Google evidence.
const seo=demoGrowthReport('plumbing','2026-10-09T00:00:00.000Z');
const gsc=importSearchConsoleExport({content:FICTIONAL_GSC.csv,format:'csv',
 manifest:FICTIONAL_GSC.manifest,business:FICTIONAL_GSC.business});
const searchAnalysis=analyzeImportedSearchEvidence(seo,gsc);
const plan=buildPremiumContentStrategy({seoReport:seo,searchAnalysis});
const format=process.argv[2]||'json';
if(format==='json')process.stdout.write(JSON.stringify(plan,null,2)+'\n');
else if(format==='csv')process.stdout.write(exportPremiumStrategyCsv(plan)+'\n');
else{process.stderr.write('Use json or csv.\n');process.exitCode=1;}
