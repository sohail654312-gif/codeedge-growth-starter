import {promises as fs} from 'node:fs';
import {resolve,join,isAbsolute} from 'node:path';
import {randomUUID} from 'node:crypto';
import {DomainError} from './core.mjs';

// Isolated local development persistence only. No hosted/database authority.
// Interprocess exclusive lock + fsync/rename prevents lost concurrent writes.
// A crash leaving the lock requires operator recovery; never steal a live lock.
export async function createPersistentSandboxStore({directory}={}){
 if(typeof directory!=='string'||!isAbsolute(directory))throw new DomainError('Absolute isolated sandbox directory required.');
 const root=resolve(directory);await fs.mkdir(root,{recursive:true,mode:0o700});
 if((await fs.lstat(root)).isSymbolicLink())throw new DomainError('Sandbox directory must not be a symbolic link.');
 const file=join(root,'sandbox-state.json'),lock=join(root,'sandbox-state.lock');
 return Object.freeze({capabilities:Object.freeze({persistentSandbox:true,hostedAuthority:false}),
  async transaction(fn){
   let handle;const started=Date.now();
   while(!handle){try{handle=await fs.open(lock,'wx',0o600);}catch(e){
    if(e.code!=='EEXIST')throw new DomainError('Sandbox persistence unavailable.',503);
    if(Date.now()-started>=1000)throw new DomainError('Sandbox store busy; retry.',503);
    await new Promise(r=>setTimeout(r,20));
   }}
   let temporary;
   try{
    let state={version:1,runs:{},approvals:{}};
    try{
     const stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>1048576)throw Error('unsafe state');
     state=JSON.parse(await fs.readFile(file,'utf8'));
     if(state.version!==1||!state.runs||typeof state.runs!=='object'||Array.isArray(state.runs)||!state.approvals||typeof state.approvals!=='object'||Array.isArray(state.approvals)||Object.keys(state.runs).length>1000||Object.keys(state.approvals).length>1000)throw Error('invalid state');
    }catch(e){if(e.code!=='ENOENT')throw new DomainError('Sandbox state is unavailable or invalid.',503);}
    const value=await fn(state),body=JSON.stringify(state);
    if(Buffer.byteLength(body)>1048576||Object.keys(state.runs).length>1000||Object.keys(state.approvals).length>1000)throw new DomainError('Sandbox retention capacity reached.',429);
    temporary=join(root,'state-'+randomUUID()+'.tmp');const output=await fs.open(temporary,'wx',0o600);
    try{await output.writeFile(body);await output.sync();}finally{await output.close();}
    await fs.rename(temporary,file);temporary=null;
    return structuredClone(value);
   }finally{
    if(temporary)await fs.unlink(temporary).catch(()=>{});
    await handle.close();await fs.unlink(lock);
   }
  }
 });
}
