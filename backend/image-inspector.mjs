import {createHash} from 'node:crypto';
import {DomainError,validateImageUpload} from './core.mjs';

// Decoder is dependency-injected. This module is NOT bound to the AppDeploy
// upload route until sharp and a durable scan/consent workflow exist at runtime.
export async function inspectAndNormalizeImage({filename,mime,content},sharpFactory) {
  if(typeof sharpFactory!=='function')throw new DomainError('A trusted image decoder is required.',503);
  const checked=validateImageUpload({filename,mime,content});
  const data=Buffer.from(checked.base64,'base64');
  const format={'image/jpeg':'jpeg','image/png':'png','image/webp':'webp'}[mime];
  try{
    const decoder=sharpFactory(data,{failOn:'error',limitInputPixels:12_000_000});
    const meta=await decoder.metadata();
    if(meta.format!==format || !Number.isSafeInteger(meta.width) ||
      !Number.isSafeInteger(meta.height) ||meta.width<1||meta.height<1||
      meta.width*meta.height>12_000_000 || (meta.pages??1)!==1)
      throw new DomainError('Invalid image dimensions or animation.',400);
    const options=format==='png'?{compressionLevel:9}:{quality:85};
    const normalized=await sharpFactory(data,{failOn:'error',limitInputPixels:12_000_000})
      .rotate().resize({width:2400,height:2400,fit:'inside',withoutEnlargement:true})
      .toFormat(format,options).toBuffer();
    if(normalized.length===0||normalized.length>3*1024*1024)
      throw new DomainError('Normalized image exceeds size limit.',400);
    const final=await sharpFactory(normalized,{failOn:'error'}).metadata();
    if(final.format!==format || !final.width || !final.height || (final.pages??1)!==1)
      throw new DomainError('Normalized image failed validation.',400);
    return Object.freeze({contentType:mime,filename:checked.filename,
      buffer:normalized,width:final.width,height:final.height,
      sha256:createHash('sha256').update(normalized).digest('hex')});
  }catch(e){
    if(e instanceof DomainError)throw e;
    throw new DomainError('Image could not be safely decoded.',400);
  }
}
