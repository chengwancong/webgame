import {readFile,mkdir,copyFile,writeFile} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';
const root=resolve(import.meta.dirname,'..'),check=process.argv.includes('--check'),hash=b=>createHash('sha256').update(b).digest('hex');
const sources=[{folder:'assets/mini-hero/thumbs',target:'apps/web/public/art/mini-hero/thumbs',key:'id'},{folder:'assets/mini-hero/icons-v2',target:'apps/web/public/art/mini-hero/icons-v2',key:'id'}];
const report={ok:false,checkOnly:check,groups:[]};
for(const group of sources){
 const base=resolve(root,group.folder),target=resolve(root,group.target),manifest=JSON.parse(await readFile(join(base,'manifest.json'),'utf8')),seen=new Set();let bytes=0;
 assert.equal(manifest.schemaVersion,1);if(group.folder.endsWith('icons-v2'))assert.equal(manifest.items.length,162);
 for(const item of manifest.items){
  assert(!seen.has(item.id),'Duplicate art ID '+item.id);seen.add(item.id);
  const file=resolve(base,item.file);assert(file.startsWith(base+sep),'Source outside art folder');const data=await readFile(file);assert.equal(hash(data),item.sha256,item.id);
  const image=sharp(data),meta=await image.metadata(),stats=await image.stats();assert.equal(meta.width,256,item.id);assert.equal(meta.height,256,item.id);assert(meta.hasAlpha,item.id);assert.equal(stats.channels[3].min,0,'Opaque background '+item.id);assert(stats.channels[3].max>0,'Empty image '+item.id);bytes+=data.length;
  if(!check){const relative=item.file.replace(/^png\//,'');const published=resolve(target,relative);assert(published.startsWith(target+sep),'Publish outside art folder');await mkdir(resolve(published,'..'),{recursive:true});await copyFile(file,published);item.path='/art/mini-hero/'+(group.folder.endsWith('thumbs')?'thumbs/':'icons-v2/')+relative;}
 }
 if(!check){await mkdir(target,{recursive:true});await writeFile(join(target,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');}
 report.groups.push({kind:group.folder,items:manifest.items.length,bytes});
}
report.ok=true;console.log(JSON.stringify(report));
