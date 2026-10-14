import {randomUUID} from 'node:crypto';
const routeOf=url=>{
 const path=typeof url==='string'?url.split('?')[0]:'';
 if(path==='/health'||path==='/ready')return 'health';
 if(path==='/auth/callback')return 'callback';
 if(path==='/auth/start')return 'login';
 if(path==='/auth/logout')return 'logout';
 if(path.startsWith('/v1/'))return 'private_api';
 return 'asset_or_unknown';
};
// Fixed route/status labels only: never bodies, URLs, cookies, SQL or identities.
// Operator supplies an accepted log sink. A failing sink cannot crash requests.
export function createPrivateObservability({write=line=>process.stdout.write(line+'\n'),now=()=>performance.now()}={}){
 const counts=new Map();
 function observe(req,res){
  const route=routeOf(req.url),requestId=randomUUID(),start=now();
  res.setHeader('x-request-id',requestId);
  res.once('finish',()=>{
   const status=Number.isInteger(res.statusCode)?res.statusCode:503,durationMs=Math.max(0,Math.round(now()-start));
   const bucket=route+':'+Math.floor(status/100)+'xx';counts.set(bucket,(counts.get(bucket)||0)+1);
   try{write(JSON.stringify({event:'private_http_completed',requestId,route,status,durationMs}));}catch{}
  });
 }
 return Object.freeze({observe,snapshot:()=>Object.fromEntries(counts)});
}
