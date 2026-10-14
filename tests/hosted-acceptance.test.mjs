import test from 'node:test';
import assert from 'node:assert/strict';
import {readAcceptanceConfig,runHostedAcceptance,runHostedSessionRevocation,runHostedMemberRevocation} from '../staging/hosted-acceptance.mjs';
const enc=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
function token(uid,sid){
 return enc({alg:'ES256',kid:'fixture'})+'.'+enc({sub:uid,session_id:sid,exp:Math.floor(Date.now()/1000)+3600})+'.'+Buffer.alloc(64,3).toString('base64url');
}
const uidA='329d2e94-f1f0-4cd9-8bfa-0983be1434ab',uidB='429d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const sidA='539d2e94-f1f0-4cd9-8bfa-0983be1434ab',sidB='639d2e94-f1f0-4cd9-8bfa-0983be1434ab';
const wa='ws_'+uidA,wb='ws_'+uidB;
const env=()=>({
 GS_ACCEPT_GATEWAY_URL:'https://gateway.synthetic.invalid/',
 GS_ACCEPT_TOKEN_A:token(uidA,sidA),GS_ACCEPT_TOKEN_B:token(uidB,sidB),
 GS_ACCEPT_WORKSPACE_A:wa,GS_ACCEPT_WORKSPACE_B:wb,
 GS_ACCEPT_REQUEST_A:'syntheticAlpha',GS_ACCEPT_REQUEST_B:'syntheticBeta',
 GS_ACCEPT_ALLOWED_ORIGIN:'https://frontend.synthetic.invalid/'
});
test('hosted test runner refuses non-HTTPS, duplicate sessions, missing synthetic records',()=>{
 assert.throws(()=>readAcceptanceConfig({...env(),GS_ACCEPT_GATEWAY_URL:'http://gateway.synthetic.invalid/'}));
 assert.throws(()=>readAcceptanceConfig({...env(),GS_ACCEPT_TOKEN_B:env().GS_ACCEPT_TOKEN_A}));
 assert.throws(()=>readAcceptanceConfig({...env(),GS_ACCEPT_REQUEST_A:''}));
 assert.throws(()=>readAcceptanceConfig({...env(),GS_ACCEPT_WORKSPACE_B:wa}));
});
test('mocked fetch exercises BOTH isolation directions, writes and signature denial',async()=>{
 const config=readAcceptanceConfig(env());
 const calls=[];
 const mock=async(url,{method='GET',headers={}})=>{
  const path=new URL(url).pathname,query=new URL(url).searchParams;
  const which=headers.authorization===('Bearer '+config.tokens[0])?0:headers.authorization===('Bearer '+config.tokens[1])?1:null;
  let status=200,body={};
  if(headers.origin==='https://forbidden.synthetic.invalid')status=403;
  else if(method!=='GET')status=405;
  else if(path==='/healthz')body={mode:'staging-read-only',security:'review-only'};
  else if(which===null)status=401;
  else if(path==='/v1/workspaces')body={workspaces:[{workspace_id:config.workspaces[which],role:'owner'}]};
  else if(path==='/v1/requests'){
    const requested=query.get('workspaceId');
    if(query.has('actorId') || query.has('role') || query.get('page')==='20')status=400;
    else if(requested!==config.workspaces[which])status=403;
    else body={items:[{id:config.requests[which],workspace_id:requested}]};
  }else status=404;
  calls.push({path,status});
  return {status,json:async()=>body};
 };
 const result=await runHostedAcceptance(config,{fetchImpl:mock});
 assert.equal(result.passed,16);
 assert.ok(result.requiresSeparateEvidence.some(x=>x.includes('revoked')));
 assert.equal(calls.filter(x=>x.status===403).length,3);
});
test('a 200 cross-tenant answer causes hard failure even if the gateway claims healthy',async()=>{
 const config=readAcceptanceConfig(env());
 const fetchImpl=async (url,{headers={}})=>{
  const path=new URL(url).pathname,query=new URL(url).searchParams;
  if(path==='/healthz')return {status:200,json:async()=>({mode:'staging-read-only',security:'review-only'})};
  if(!headers.authorization)return {status:401,json:async()=>({})};
  const a=headers.authorization==='Bearer '+config.tokens[0];
  const own=a?wa:wb;
  if(path==='/v1/workspaces')return {status:200,json:async()=>({workspaces:[{workspace_id:own,role:'owner'}]})};
  if(path==='/v1/requests')return {status:200,json:async()=>({items:[{id:a?'syntheticAlpha':'syntheticBeta',workspace_id:query.get('workspaceId')}]})};
  return {status:404,json:async()=>({})};
 };
 await assert.rejects(runHostedAcceptance(config,{fetchImpl}),/a_to_b_denied HTTP status/);
});

test('baseline runner rejects known legacy HTTP gateway despite 200 health',async()=>{
 const config=readAcceptanceConfig(env());
 await assert.rejects(runHostedAcceptance(config,{fetchImpl:async()=>({
  status:200,json:async()=>({mode:'staging-read-only'})
 })}),/legacy gateway process/);
});
test('real-HTTP revocation stage requires unexpired original A token and healthy B',async()=>{
 const config=readAcceptanceConfig(env());
 const visited=[];
 const fetchImpl=async(url,{headers})=>{
  const who=headers.authorization==='Bearer '+config.tokens[0]?'a':'b';
  visited.push(who);
  return who==='a'?{status:401}:{status:200,json:async()=>({
    workspaces:[{workspace_id:wb,role:'owner'}]
  })};
 };
 const result=await runHostedSessionRevocation(config,{fetchImpl});
 assert.equal(result.passed,2);assert.deepEqual(visited,['a','b']);
 await assert.rejects(runHostedSessionRevocation(config,{fetchImpl:async()=>({status:401})}),
  /independent active User B must still function/);
 // A token lacking provably non-expired JWT claims cannot establish immediate revocation.
 await assert.rejects(runHostedSessionRevocation({...config,tokens:[enc({})+'.'+enc({sub:uidA,session_id:sidA})+'.xx',config.tokens[1]]}),
  /expired or too close/);
});
test('member C revocation stage requires separate identity and denies both workspace and requests',async()=>{
 const config=readAcceptanceConfig(env());
 const C='529d2e94-f1f0-4cd9-8bfa-0983be1434ab';
 const tokenC=token(C,'739d2e94-f1f0-4cd9-8bfa-0983be1434ab');
 const good=await runHostedMemberRevocation(config,{memberToken:tokenC,fetchImpl:async(url)=>({
  status:new URL(url).pathname==='/v1/workspaces'?200:403,
  json:async()=>({workspaces:[]})
 })});
 assert.equal(good.passed,2);
 await assert.rejects(runHostedMemberRevocation(config,{memberToken:config.tokens[0]}),
  /Independent member C/);
});
