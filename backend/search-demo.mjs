import {demoGrowthReport} from './seo-fixtures.mjs';
import {FICTIONAL_GSC} from './search-fixtures.mjs';
import {importSearchConsoleExport,analyzeImportedSearchEvidence,exportSearchAnalysisCsv} from './seo-search-data.mjs';
const evidence=importSearchConsoleExport({content:FICTIONAL_GSC.csv,format:'csv',
 manifest:FICTIONAL_GSC.manifest,business:FICTIONAL_GSC.business});
const report=analyzeImportedSearchEvidence(demoGrowthReport('plumbing'),evidence);
const format=process.argv[2]||'json';
if(format==='json')process.stdout.write(JSON.stringify(report,null,2)+'\n');
else if(format==='csv')process.stdout.write(exportSearchAnalysisCsv(report)+'\n');
else {process.stderr.write('Choose json or csv.\n');process.exitCode=1;}
