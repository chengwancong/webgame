import {readFile,readdir,mkdir,copyFile,writeFile} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
export const root=resolve(import.meta.dirname,'../../../..');
export const local=resolve(root,'assets/starsea/vfx');
export const publicRoot=resolve(root,'apps/web/public/art/starsea/vfx');
export const library='G:/webgame/abyss-walker-migration/Q版日式手游SPINE特效300套';
const selected=[33,122,126,128,132,136,138,150,152,153,155,156,157,158,159,164,165,166,179,182,187,188,206,209,220,237,242,257,292,294];
const hash=b=>createHash('sha256').update(b).digest('hex');
const dirs=(await readdir(library,{withFileTypes:true})).filter(x=>x.isDirectory()).map(x=>x.name);
await mkdir(resolve(local,'evidence'),{recursive:true});await mkdir(resolve(publicRoot,'vendor'),{recursive:true});
await copyFile(resolve(root,'tools/vendor/spine36/spine-webgl.js'),resolve(publicRoot,'vendor/spine36.js'));
const inventory=[];let montage=[];
for(const n of selected){
 const name=dirs.find(d=>d.startsWith(String(n).padStart(3,'0')+'-')),dir=resolve(library,name),names=await readdir(dir);
 const json=names.find(f=>f.endsWith('.json')),atlas=names.find(f=>f.endsWith('.atlas'));
 const bytes=await readFile(resolve(dir,json)),data=JSON.parse(bytes),text=await readFile(resolve(dir,atlas),'utf8');
 const pages=text.split(/\r?\n/).filter((line,index,all)=>/\.png$/i.test(line)&&!/^\s/.test(line)&&(index===0||all[index-1]===''));
 const types=[...new Set(Object.values(data.skins).flatMap(s=>Object.values(s).flatMap(a=>Object.values(a).map(a=>a.type??'region'))))];
 const unsupported={attachments:types.filter(x=>x!=='region'),boneFlags:data.bones.filter(b=>b.inheritScale===false||b.inheritRotation===false||b.flipX||b.flipY),constraints:(data.ik??[]).length,flipTimelines:Object.values(data.animations).flatMap(a=>Object.values(a.bones??{})).some(b=>b.flipX||b.flipY)};
 if(unsupported.attachments.length||unsupported.boneFlags.length||unsupported.constraints||unsupported.flipTimelines)throw Error('Unsupported native source '+name);
 const files=[];for(const filename of [json,atlas,...pages]){
  const raw=await readFile(resolve(dir,filename));const retained=resolve(local,'source',name,filename),runtime=resolve(publicRoot,'native',name,filename);
  await mkdir(resolve(retained,'..'),{recursive:true});await mkdir(resolve(runtime,'..'),{recursive:true});await writeFile(retained,raw);await writeFile(runtime,raw);
  files.push({path:relative(root,retained).replaceAll('\\','/'),originalPath:resolve(dir,filename).replaceAll('\\','/'),sha256:hash(raw),bytes:raw.length});
 }
 const item={id:name,libraryIndex:n,originalPath:resolve(dir,json).replaceAll('\\','/'),sha256:hash(bytes),nativeVersion:data.skeleton.spine,animation:Object.keys(data.animations)[0],runtimeJson:'/art/starsea/vfx/native/'+name+'/'+json,runtimeAtlas:'/art/starsea/vfx/native/'+name+'/'+atlas,files,compatibility:{renderer:'bundled official Spine WebGL 3.6',method:'Region-only JSON: original setup transforms, bezier/stepped curves, attachment/colour timelines and draw order; no mesh, flips, inheritance exceptions or constraints.',unsupported},bones:data.bones.length,slots:data.slots.length};
 inventory.push(item);
 const gif=resolve(library,'【GIF预览】',name+'.gif');try{
  const m=await sharp(gif).metadata(),page=Math.floor((m.pages??1)*.35),thumb=await sharp(gif,{page,pages:1}).resize(200,160,{fit:'contain',background:'#f5f1e7'}).flatten({background:'#f5f1e7'}).png().toBuffer();
  const label=Buffer.from('<svg width="220" height="28"><text x="8" y="18" font-family="Arial" font-size="12" fill="#293940">'+name+'</text></svg>');
  montage.push({input:thumb,left:(montage.length/2%5)*220+10,top:Math.floor(montage.length/10)*200+8},{input:label,left:(montage.length/2%5)*220,top:Math.floor(montage.length/10)*200+170});
 }catch(e){item.gifPreviewError=String(e);}
}
await writeFile(resolve(local,'source/inventory.json'),JSON.stringify(inventory,null,2)+'\n');await writeFile(resolve(publicRoot,'native/inventory.json'),JSON.stringify(inventory,null,2)+'\n');
await sharp({create:{width:1100,height:Math.ceil(montage.length/10)*200,channels:4,background:'#fcfaf5'}}).composite(montage).png().toFile(resolve(local,'evidence/library-contact.png'));
console.log(JSON.stringify({nativeSources:inventory.length,contact:relative(root,resolve(local,'evidence/library-contact.png'))}));
