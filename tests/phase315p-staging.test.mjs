import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readPhase315pConfig} from '../staging/phase315p-config.mjs';
import {loadPrivateUi,servePrivateUi} from '../staging/private-ui-assets.mjs';
const sha='1'.repeat(40),origin='https://fictional.example.invalid';
const env={GS315M_ACTIVATE:'dbppeymhsemvghbvuvof',GS315M_COMMIT_SHA:sha,GS315M_APP_ORIGIN:origin,
 GS315M_ISSUER_DATABASE_URL:'postgres://gs315m_issuer:'+('x'.repeat(40))+'@db.dbppeymhsemvghbvuvof.supabase.co/postgres',
 GS315M_GATEWAY_DATABASE_URL:'postgres://gs315k_gateway:'+('y'.repeat(40))+'@db.dbppeymhsemvghbvuvof.supabase.co/postgres',
 GS315M_DATABASE_CA_PEM:'-----BEGIN CERTIFICATE-----\nfictional\n-----END CERTIFICATE-----',GS315M_TLS_CERT_PATH:'/fixture/cert',GS315M_TLS_KEY_PATH:'/fixture/key',
 GS315M_CSRF_KEY_PATH:'/fixture/csrf',GS315M_PUBLISHABLE_KEY:'sb_publishable_'+'x'.repeat(32),GS315P_ACTIVATE:'dbppeymhsemvghbvuvof',
 GS315P_WRITER_DATABASE_URL:'postgres://gs315p_writer:'+('z'.repeat(40))+'@db.dbppeymhsemvghbvuvof.supabase.co/postgres',GS315P_CURSOR_KEY_PATH:'/fixture/cursor'};
const evidence={projectRef:'dbppeymhsemvghbvuvof',privateSchemaExcluded:true,directApiClosed:true,exactProviderRevocationAccepted:true,
 independentReviewer:'fictional-test-only',ownerApprovalId:'fictional-test-only',commitSha:sha,appOrigin:origin,operationsCommitSha:sha,operationsMigrationReviewId:'fictional-test-only'};
test('P configuration retains M gates and requires distinct writer identity, session pooling and commit binding',()=>{
 assert.equal(new URL(readPhase315pConfig(env,evidence).writerUrl).username,'gs315p_writer');
 for(const bad of [{GS315P_ACTIVATE:''},{GS315P_WRITER_DATABASE_URL:env.GS315M_GATEWAY_DATABASE_URL},
 {GS315P_WRITER_DATABASE_URL:env.GS315P_WRITER_DATABASE_URL.replace('/postgres',':6543/postgres')},{GS315P_CURSOR_KEY_PATH:''}])assert.throws(()=>readPhase315pConfig({...env,...bad},evidence));
 for(const bad of [{operationsCommitSha:'2'.repeat(40)},{operationsMigrationReviewId:''},{exactProviderRevocationAccepted:false},{directApiClosed:false}])assert.throws(()=>readPhase315pConfig(env,{...evidence,...bad}));
});
test('private assets are exact-file, HTTPS/Host gated, no-store and deny script injection/traversal',()=>{
 const dir=mkdtempSync(join(tmpdir(),'gs-private-assets-'));
 try{
  mkdirSync(join(dir,'assets'));writeFileSync(join(dir,'private.html'),'<html>fictional</html>');writeFileSync(join(dir,'assets','private-123.js'),'export{}');
  const files=loadPrivateUi(dir),out={},res={writeHead(status,headers){out.status=status;out.headers=headers;},end(body){out.body=body;}};
  const req={method:'GET',url:'/dashboard',headers:{host:new URL(origin).host},socket:{encrypted:true}};
  const config={files,appOrigin:origin,secureIngress:r=>r.socket.encrypted};
  assert.equal(servePrivateUi(req,res,config),true);assert.equal(out.status,200);assert.equal(out.headers['cache-control'],'private, no-store');
  assert.doesNotMatch(out.headers['content-security-policy'],/unsafe-inline|unsafe-eval/);
  assert.equal(servePrivateUi({...req,url:'/assets/../../private.html'},res,config),false);
  servePrivateUi({...req,headers:{host:'attacker.invalid'}},res,config);assert.equal(out.status,421);
  writeFileSync(join(dir,'assets','unexpected.html'),'<script>bad</script>');assert.throws(()=>loadPrivateUi(dir));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
