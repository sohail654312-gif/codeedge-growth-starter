/**
 * Phase 3.4 — deterministic, offline project-local agent skill acceptance.
 * No network, credentials, subprocesses, package installs or production changes.
 *
 * Run: node --test tests/skill-acceptance.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync, readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve, join} from 'node:path';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const BASE=join(ROOT,'.agents','skills');
const PIN_SUPABASE='c9be0e931b7930f7d02126d04774d904c381e7d7';
const PIN_HAINES='1efedbc5148b54b2f0f6c6c9fe0be62e151c7fff';
const REQUIRED=Object.freeze({
  supabase:{
    pin:PIN_SUPABASE,version:'0.1.2',
    refs:['references/skill-feedback.md'],
    guard:'Codeedge Growth Starter — mandatory local guardrails'
  },
  'supabase-postgres-best-practices':{
    pin:PIN_SUPABASE,version:'1.1.1',
    refs:['references/security-privileges.md','references/security-rls-basics.md',
      'references/security-rls-performance.md','references/_sections.md'],
    guard:'Codeedge Growth Starter — mandatory local guardrails'
  },
  'ai-seo':{
    pin:PIN_HAINES,version:'2.7.6',
    refs:['references/agent-readiness.md','references/citations-vs-recommendations.md',
      'references/content-patterns.md','references/content-types.md',
      'references/format-volatility.md','references/linkedin-ai-citations.md',
      'references/okf.md','references/platform-ranking-factors.md',
      'references/positioning-and-consensus.md','references/youtube-ai-citations.md'],
    guard:'Codeedge Growth Starter — local operating safeguards'
  }
});
const readDefault=p=>readFileSync(p,'utf8');
function frontmatter(md){
  const match=/^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(md);
  if(!match) return null;
  const name=/^name:\s*["']?([a-z0-9-]+)["']?\s*$/m.exec(match[1])?.[1];
  const desc=/^description:\s*(\S.*)$/m.exec(match[1])?.[1];
  return name&&desc?{name,body:match[1]}:null;
}
function verify({read=readDefault,exists=existsSync,list=()=>readdirSync(BASE,{withFileTypes:true})
  .filter(x=>x.isDirectory()).map(x=>x.name)}={}){
  const errors=[],names=new Map();
  for(const dir of list().sort()){
    const p=join(BASE,dir,'SKILL.md');
    if(!exists(p)) continue;
    let md;try{md=read(p)}catch{errors.push(dir+': unreadable SKILL.md');continue}
    const f=frontmatter(md);
    if(!f){errors.push(dir+': invalid frontmatter, name or description');continue}
    if(names.has(f.name)) errors.push('duplicate skill identifier: '+f.name);
    else names.set(f.name,dir);
    if(f.name!==dir) errors.push(dir+': name must match directory');
    const e=REQUIRED[dir];
    if(!e) continue; // Other vetted skills may be installed in later phases.
    if(!new RegExp('^\\s*version:\\s*["\\x27]?'+e.version.replace(/\./g,'\\.')+
      '["\\x27]?\\s*$','m').test(f.body)) errors.push(dir+': wrong skill version');
    if(!md.includes(e.guard))
      errors.push(dir+': Codeedge security preface absent');
    const refs=new Set([...md.matchAll(/\breferences\/[A-Za-z0-9_./-]+\.md\b/g)].map(m=>m[0]));
    for(const ref of [...new Set([...e.refs,...refs])]){
      if(ref.includes('..')||ref.startsWith('/')||!ref.startsWith('references/'))
        errors.push(dir+': unsafe reference path');
      else if(!exists(join(BASE,dir,...ref.split('/'))))
        errors.push(dir+': missing reference '+ref);
    }
    const meta=join(BASE,dir,'CODEEDGE-SOURCE.md');
    if(!exists(meta)||!read(meta).includes(e.pin))
      errors.push(dir+': provenance or pinned SHA missing');
    const lic=join(BASE,dir,'LICENSE');
    if(!exists(lic)||!read(lic).includes('MIT License'))
      errors.push(dir+': retained MIT licence missing');
    const cfg=join(BASE,dir,'agents','openai.yaml');
    if(!exists(cfg)||!/^\s*allow_implicit_invocation:\s*false\s*$/m.test(read(cfg)))
      errors.push(dir+': explicit-only Codex policy missing');
  }
  for(const name of Object.keys(REQUIRED))
    if(!names.has(name)) errors.push(name+': required skill missing');
  const basics=join(BASE,'supabase-postgres-best-practices','references','security-rls-basics.md');
  const perf=join(BASE,'supabase-postgres-best-practices','references','security-rls-performance.md');
  if(!exists(basics)||!read(basics).includes('CODEEDGE SECURITY OVERRIDE'))
    errors.push('PostgreSQL RLS-bypass example warning missing');
  if(!exists(perf)||!read(perf).includes('CODEEDGE SECURITY OVERRIDE'))
    errors.push('PostgreSQL privileged-function warning missing');
  return errors.sort();
}
test('three pinned project-local skills: frontmatter, unique IDs, references, licences and safeguards',()=>{
  assert.deepEqual(verify(),[]);
});
test('reject duplicate skill identifier or directory mismatch',()=>{
  const p=join(BASE,'supabase-postgres-best-practices','SKILL.md');
  const problems=verify({read:path=>path===p?readDefault(path).replace(
    /^name: supabase-postgres-best-practices$/m,'name: supabase'):readDefault(path)});
  assert.ok(problems.some(x=>x.includes('duplicate skill identifier')));
  assert.ok(problems.some(x=>x.includes('name must match directory')));
});
test('reject missing referenced document',()=>{
  const missing=join(BASE,'ai-seo','references','agent-readiness.md');
  assert.ok(verify({exists:path=>path===missing?false:existsSync(path)})
    .some(x=>x.includes('missing reference references/agent-readiness.md')));
});
test('reject absent safety preface',()=>{
  const p=join(BASE,'supabase','SKILL.md');
  assert.ok(verify({read:path=>path===p?readDefault(path).replace(
    'Codeedge Growth Starter — mandatory local guardrails','SECURITY PREFACE MISSING'):readDefault(path)})
    .some(x=>x.includes('Codeedge security preface absent')));
});
test('reject implicit auto-activation',()=>{
  const p=join(BASE,'ai-seo','agents','openai.yaml');
  assert.ok(verify({read:path=>path===p?readDefault(path).replace(
    'allow_implicit_invocation: false','allow_implicit_invocation: true'):readDefault(path)})
    .some(x=>x.includes('explicit-only Codex policy missing')));
});
test('reject modified upstream pin',()=>{
  const p=join(BASE,'supabase','CODEEDGE-SOURCE.md');
  assert.ok(verify({read:path=>path===p?readDefault(path).replace(
    PIN_SUPABASE,'0000000000000000000000000000000000000000'):readDefault(path)})
    .some(x=>x.includes('provenance or pinned SHA missing')));
});
