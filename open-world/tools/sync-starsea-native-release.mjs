import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import sharp from 'sharp';
const release=JSON.parse(await readFile('assets/mini-hero/navy/release.json','utf8')),known=new Map(),changes=[];
// The accepted release is the authority. Never adopt an arbitrary changed PNG.
for(const [name,expected]of Object.entries(release.files)){
 const path=release.source.replaceAll('\\','/')+'/'+name,bytes=await readFile(path),sha256=createHash('sha256').update(bytes).digest('hex');
 if(sha256!==expected.sha256||bytes.length!==expected.bytes)throw Error('Accepted native release differs '+name);
 const image=name.endsWith('.png')?await sharp(bytes).metadata():undefined;
 known.set(resolve(path),{sha256,bytes:bytes.length,...(image?{width:image.width,height:image.height}:{} )});
}
for(const group of ['npc','monsters','bosses','vfx','scenes','props']){
 const path='assets/starsea/'+group+'/manifest.json',manifest=JSON.parse(await readFile(path,'utf8'));let changed=false;
 function visit(value,at){
  if(!value||typeof value!=='object')return;
  const expected=typeof value.path==='string'?known.get(resolve(value.path)):undefined;
  if(expected&&value.sha256!==expected.sha256){
   if(value.width!==undefined&&value.width!==expected.width||value.height!==undefined&&value.height!==expected.height)throw Error('Registered actor dimensions changed '+at);
   changes.push({group,record:at,path:value.path,before:value.sha256,after:expected.sha256,authority:'assets/mini-hero/navy/release.json'});value.sha256=expected.sha256;if(value.bytes!==undefined)value.bytes=expected.bytes;changed=true;
  }
  for(const [key,item]of Object.entries(value))visit(item,at+'.'+key);
 }
 visit(manifest,group);if(changed)await writeFile(path,JSON.stringify(manifest,null,2)+'\n');
}
await writeFile('docs/reviews/open-world-m2-m4/W3/native-release-dependency-sync.json',JSON.stringify({passed:true,changes,releaseVersion:release.version,validation:'Every source byte hash/size matches the accepted native release; all declared dimensions retained. Full resource validator remains required.'},null,2)+'\n');console.log(JSON.stringify({changedReferences:changes.length}));
