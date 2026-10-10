import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {inspectAndNormalizeImage} from '../../backend/image-inspector.mjs';
test('real image decoder normalizes a synthetic PNG and removes embedded metadata',async()=>{
 const sample=await sharp({create:{width:48,height:32,channels:3,background:'#2266aa'}})
  .png().withMetadata({exif:{IFD0:{Copyright:'Synthetic Test'}}}).toBuffer();
 const inspected=await inspectAndNormalizeImage({filename:'synthetic-business.png',
   mime:'image/png',content:sample.toString('base64')},sharp);
 assert.equal(inspected.contentType,'image/png');
 assert.equal(inspected.width,48);assert.equal(inspected.height,32);
 assert.equal(inspected.sha256.length,64);
 const metadata=await sharp(inspected.buffer).metadata();
 assert.equal(metadata.exif,undefined);
 assert.equal(metadata.icc,undefined);
});
test('real decoder rejects truncated, header-only and MIME-mismatched images',async()=>{
 const png=await sharp({create:{width:32,height:32,channels:3,background:'white'}}).png().toBuffer();
 const jpg=await sharp(png).jpeg().toBuffer();
 await assert.rejects(inspectAndNormalizeImage({filename:'claimed.png',mime:'image/png',content:jpg.toString('base64')},sharp),e=>e.status===400);
 const header=Buffer.concat([png.subarray(0,24),Buffer.alloc(8)]);
 await assert.rejects(inspectAndNormalizeImage({filename:'broken.png',mime:'image/png',content:header.toString('base64')},sharp),e=>e.status===400);
});
test('decoder is mandatory and cannot be replaced with header-only validation',async()=>{
 const png=await sharp({create:{width:20,height:20,channels:3,background:'white'}}).png().toBuffer();
 await assert.rejects(inspectAndNormalizeImage({filename:'synthetic.png',mime:'image/png',content:png.toString('base64')},null),e=>e.status===503);
});
