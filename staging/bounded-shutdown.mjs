// Idempotent shutdown for the isolated gateway; opens no listener itself.
export function createBoundedShutdown({server,pools,graceMs=3000,poolTimeoutMs=5000}){
 if(typeof server?.close!=='function'||!Array.isArray(pools)||!pools.every(p=>typeof p?.end==='function')||
  !Number.isInteger(graceMs)||graceMs<50||graceMs>10000||!Number.isInteger(poolTimeoutMs)||poolTimeoutMs<50||poolTimeoutMs>10000)
  throw Error('Bounded shutdown configuration required.');
 let closing;
 return function close(){
  if(closing)return closing;
  closing=(async()=>{
   let forceTimer,deadlineTimer,poolTimer,serverError=false;
   try{
    if(server.listening){
     try{
      await Promise.race([new Promise((resolve,reject)=>{
       server.close(error=>error?reject(error):resolve());
       server.closeIdleConnections?.();
       forceTimer=setTimeout(()=>server.closeAllConnections?.(),graceMs);
      }),new Promise((_,reject)=>{deadlineTimer=setTimeout(()=>reject(Error('shutdown deadline')),graceMs+250);})]);
     }catch{serverError=true;}
    }
   }finally{clearTimeout(forceTimer);clearTimeout(deadlineTimer);}
   try{
    await Promise.race([Promise.all(pools.map(p=>Promise.resolve().then(()=>p.end()))),new Promise((_,reject)=>{
     poolTimer=setTimeout(()=>reject(Error('shutdown deadline')),poolTimeoutMs);
    })]);
    if(serverError)throw Error();
   }catch{throw Error('Private staging shutdown did not finish.');}
   finally{clearTimeout(poolTimer);}
  })();
  return closing;
 };
}
