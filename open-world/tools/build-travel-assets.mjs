import {readFileSync,mkdirSync,copyFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url)),source=join(root,'assets/ui-source/travel'),output=join(root,'apps/web/public/art/travel');
const input=JSON.parse(readFileSync(join(source,'source.json'),'utf8'));
const validated=input.assets.map(asset=>{
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(asset.id)||asset.file!==asset.id+'.png')throw Error('Invalid travel illustration ID or source path');
 const buffer=readFileSync(join(source,asset.file));if(buffer.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Travel illustration is not PNG: '+asset.id);
 const size=[buffer.readUInt32BE(16),buffer.readUInt32BE(20)];if(size[0]<1000||size[1]<600)throw Error('Travel illustration is too small: '+asset.id);
 return {id:asset.id,file:asset.file,size,sha256:createHash('sha256').update(buffer).digest('hex')};
});
const ids=new Set(validated.map(a=>a.id));if(ids.size!==validated.length||['meadow','forest','rift'].some(id=>!ids.has(id)))throw Error('Duplicate or missing required travel illustrations');
mkdirSync(output,{recursive:true});for(const asset of validated)copyFileSync(join(source,asset.file),join(output,asset.file));
writeFileSync(join(output,'manifest.json'),JSON.stringify({version:input.version,assets:validated},null,2)+'\n');
writeFileSync(join(root,'packages/asset-manifest/travel.json'),JSON.stringify({version:input.version,assets:Object.fromEntries(validated.map(({id,file,...metadata})=>[id,{path:'/art/travel/'+file,...metadata}]))},null,2)+'\n');
console.log('Travel illustrations:',validated.map(a=>({id:a.id,size:a.size})));
