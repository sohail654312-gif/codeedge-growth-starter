import {demoGrowthReport} from './seo-fixtures.mjs';
import {exportKeywordCsv} from './seo-growth.mjs';
// CLI output contains ONLY deliberately fictional example data.
const kind=process.argv[2]||'plumbing';
const output=process.argv[3]||'json';
if(!['plumbing','clinic'].includes(kind) || !['json','csv'].includes(output)){
  process.stderr.write('Usage: node backend/seo-demo.mjs [plumbing|clinic] [json|csv]\n');
  process.exitCode=2;
}else{
  const report=demoGrowthReport(kind);
  process.stdout.write(output==='csv'?exportKeywordCsv(report)+'\n':JSON.stringify(report,null,2)+'\n');
}
