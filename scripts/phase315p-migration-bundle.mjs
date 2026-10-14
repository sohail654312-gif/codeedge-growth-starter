import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
export function buildReviewBundle(root=process.cwd()){
 const manifest=JSON.parse(readFileSync(resolve(root,'db/phase315p-manifest.json'),'utf8'));
 const required=['db/drafts/phase315o_operations_REVIEW_ONLY.sql','db/drafts/phase315k_private_sessions_REVIEW_ONLY.sql',
 'db/drafts/phase315m_private_issuer_REVIEW_ONLY.sql','db/drafts/phase315p_operations_REVIEW_ONLY.sql'];
 if(manifest.status!=='REVIEW_ONLY'||manifest.projectRef!=='dbppeymhsemvghbvuvof'||manifest.databaseMajor!==17||
 JSON.stringify(manifest.orderedDrafts)!==JSON.stringify(required))throw Error('Migration dependency manifest denied.');
 const inventory=[];
 const observed=JSON.parse(readFileSync(resolve(root,'artifacts/staging-catalog-2026-10-14.json'),'utf8'));
 if(observed.projectRef!==manifest.projectRef||observed.metadataOnly!==true)throw Error('Baseline metadata provenance missing.');
 const expected={columns:observed.columns,constraints:observed.constraints};
 const baselineAssertion=`DO $pbaseline$ DECLARE got jsonb; BEGIN
 SELECT jsonb_build_object('columns',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'column',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull) ORDER BY c.relname,a.attnum)
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped WHERE n.nspname='growth_starter' AND c.relkind='r'),
 'constraints',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',k.conname,'definition',pg_get_constraintdef(k.oid)) ORDER BY c.relname,k.conname)
 FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='growth_starter')) INTO got;
 IF got IS DISTINCT FROM '${JSON.stringify(expected).replaceAll("'","''")}'::jsonb THEN RAISE EXCEPTION 'Growth Starter baseline catalog drift'; END IF;
 END $pbaseline$;\n`;
 const pieces=required.map(path=>{
  const source=readFileSync(resolve(root,path),'utf8').replaceAll('\r\n','\n');
  if(!/REVIEW.?ONLY/i.test(source)||!/^BEGIN;$/m.test(source)||!/^COMMIT;$/m.test(source))throw Error('Review transaction boundary missing.');
  inventory.push({path,sha256:createHash('sha256').update(source).digest('hex')});
  return '-- Dependency: '+path+'\n'+source.replace(/^BEGIN;\r?\n/m,'').replace(/^COMMIT;\s*$/m,'');
 });
 const sql='-- REVIEW_ONLY: generated atomic review bundle; NEVER auto-apply to hosted Supabase.\n'+
 '-- Baseline is reconciled existing 0001 schema; seven hosted migration IDs alone do not prove equality.\nBEGIN;\n'+baselineAssertion+pieces.join('\n')+'\n'+
 readFileSync(resolve(root,'db/drafts/phase315p_postflight_REVIEW_ONLY.sql'),'utf8').replaceAll('\r\n','\n')+'\nCOMMIT;\n';
 return {sql,inventory,manifest};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const result=buildReviewBundle(),output=resolve(process.argv[2]||'work/phase315p-consolidated_REVIEW_ONLY.sql');
 mkdirSync(dirname(output),{recursive:true});writeFileSync(output,result.sql);
 writeFileSync(output+'.inventory.json',JSON.stringify(result.inventory,null,2)+'\n');
 process.stdout.write('Review-only bundle generated. Hosted execution remains blocked.\n');
}
