import {readFileSync,readdirSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
export function loadPrivateUi(root=resolve('dist/private')){
 const files=new Map(),read=(path,type)=>{
  const size=statSync(path).size;if(size<1||size>2097152)throw Error('Private UI asset bounds failed.');
  return {body:readFileSync(path),type};
 };
 const html=read(resolve(root,'private.html'),'text/html; charset=utf-8');
 for(const path of ['/login','/dashboard','/'])files.set(path,html);
 for(const name of readdirSync(resolve(root,'assets'))){
  if(!/^[A-Za-z0-9_-]+\.(js|css)$/.test(name))throw Error('Unexpected private UI asset.');
  files.set('/assets/'+name,read(resolve(root,'assets',name),name.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8'));
 }
 return files;
}
export function servePrivateUi(req,res,{files,secureIngress,appOrigin}){
 if(req.method!=='GET'||typeof req.url!=='string'||req.url.length>1800)return false;
 let url;try{url=new URL(req.url,appOrigin);}catch{return false;}
 if(url.origin!==appOrigin||url.pathname!==req.url.split('?')[0]||!files.has(url.pathname))return false;
 if(secureIngress(req)!==true||req.headers.host!==new URL(appOrigin).host){res.writeHead(421);res.end();return true;}
 const asset=files.get(url.pathname);
 res.writeHead(200,{'content-type':asset.type,'content-length':asset.body.length,'cache-control':'private, no-store',
  'content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  'x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'no-referrer','strict-transport-security':'max-age=31536000'});
 res.end(asset.body);return true;
}
