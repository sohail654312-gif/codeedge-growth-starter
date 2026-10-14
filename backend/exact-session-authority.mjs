// Provider-neutral contract. A supported least-privilege lookup must be supplied
// by the independently accepted server adapter. No managed Auth grants here.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function createExactSessionAuthority({lookup,now=()=>Date.now(),timeoutMs=2000}={}){
 if(typeof lookup!=='function'||typeof now!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<50||timeoutMs>3000)
  throw Error('Exact-session authority configuration required.');
 return Object.freeze({
  async checkProviderSession({userId,sessionId,signal}={}){
   const denied=()=>({active:false,userId,sessionId});
   if(!UUID.test(userId||'')||!UUID.test(sessionId||'')||signal?.aborted)return denied();
   const controller=new AbortController();let timer;
   const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
   try{
    const row=await Promise.race([Promise.resolve().then(()=>lookup({userId,sessionId,signal:controller.signal})),
     new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error()),timeoutMs);controller.signal.addEventListener('abort',()=>reject(Error()),{once:true});})]);
    const t=Math.floor(now()/1000);
    if(!row||row.userId!==userId||row.sessionId!==sessionId||row.exists!==true||
       row.revoked!==false||row.deleted!==false||row.banned!==false||
       !Number.isSafeInteger(row.expiresAt)||row.expiresAt<=t||
       row.policyValid!==true)return denied();
    return {active:true,userId,sessionId,expiresAt:row.expiresAt};
   }catch{return denied();}
   finally{clearTimeout(timer);controller.abort();signal?.removeEventListener('abort',abort);}
  },
  capabilities:Object.freeze({exactPair:true,failClosed:true,hostedVerified:false})
 });
}
