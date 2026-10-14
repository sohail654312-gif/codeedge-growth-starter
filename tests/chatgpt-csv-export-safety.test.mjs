import test from 'node:test';
import assert from 'node:assert/strict';
import {exportKeywordCsv} from '../backend/seo-growth.mjs';

const reportWith=(keyword={})=>({
 version:'growth-starter.seo-report.v1',
 keywords:[{
  phrase:'normal keyword',geography:'Peshawar',intent:'local',
  cluster:'clinic services',targetPage:'https://clinic.example.invalid/',
  mapping:'existing-page',confidence:'hypothesis',provenance:{source:'operator supplied'},
  metrics:{searchVolume:null,keywordDifficulty:null,cpc:null,ranking:null},
  status:'review_only',...keyword
 }]
});

test('SEO CSV export neutralizes formula triggers behind leading whitespace in EVERY text field',()=>{
 const result=exportKeywordCsv(reportWith({
  phrase:'  =HYPERLINK("https://attacker.invalid/","Click")',
  geography:'\t+2+3',
  intent:'\r-1+2',
  cluster:'\uFEFF@SUM(A1:A2)',
  targetPage:'\n=1+1',
  mapping:' \t=42',
  status:'\u00a0=SUM(1,2)'
 }));
 for(const dangerous of [
  '  =HYPERLINK','\t+2+3','\r-1+2',
  '\uFEFF@SUM','\n=1+1',' \t=42','\u00a0=SUM'
 ]){
  assert.ok(result.includes('"\''+dangerous),'Missing formula neutralization for '+JSON.stringify(dangerous));
 }
 assert.ok(result.includes('""Click""'),'Internal quote must be doubled');
});

test('SEO CSV preserves benign values, row structure and unavailable metrics',()=>{
 const csv=exportKeywordCsv(reportWith());
 const [heading,row]=csv.split('\r\n');
 assert.equal(heading.split(',').length,13);
 assert.ok(row.startsWith('"normal keyword","Peshawar"'));
 assert.ok(row.includes('"Not available"'));
 assert.ok(!row.includes('"\'normal keyword"'));
});

test('SEO CSV treats newline-prefixed and whitespace-prefixed formula-like data as literal text',()=>{
 const csv=exportKeywordCsv(reportWith({
  phrase:'   \n=1+2',
  geography:' \u2000+3',
  cluster:'\t-4'
 }));
 assert.ok(csv.includes('"\'   \n=1+2"'));
 assert.ok(csv.includes('"\' \u2000+3"'));
 assert.ok(csv.includes('"\'\t-4"'));
});
