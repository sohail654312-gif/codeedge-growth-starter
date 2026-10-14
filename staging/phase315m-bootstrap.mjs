// Portable operator entrypoint; missing signed-off infrastructure/authority
// produces an exit before a listener or database connection is opened.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {startPhase315mStaging} from './phase315m-server.mjs';
import {readPhase315mConfig} from './phase315m-config.mjs';
let runtime;
try{
 const evidence=JSON.parse(readFileSync(process.env.GS315M_EVIDENCE_PATH,'utf8'));
 readPhase315mConfig(process.env,evidence);
 const path=resolve(process.env.GS315M_AUTHORITY_MODULE);
 const digest=createHash('sha256').update(readFileSync(path)).digest('hex');
 if(!/^[a-f0-9]{64}$/.test(evidence.authorityModuleSha256||'')||digest!==evidence.authorityModuleSha256)
  throw Error('Authority review mismatch');
 // This module must be the independently reviewed, provider-supported exact
 // session lookup. No built-in always-active/getUser-only module is provided.
 const authority=await import(pathToFileURL(path).href);
 if(typeof authority.checkProviderSession!=='function')throw Error('Missing authority');
 runtime=await startPhase315mStaging({evidence,checkProviderSession:authority.checkProviderSession});
 process.stdout.write('Private staging listener active; live acceptance still required.\n');
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{
  runtime.close().then(()=>process.exit(0)).catch(()=>process.exit(1));
 });
}catch{
 await runtime?.close().catch(()=>{});
 process.stderr.write('Private staging startup blocked: approved prerequisites unavailable.\n');
 process.exitCode=1;
}
