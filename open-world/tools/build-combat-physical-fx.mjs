// Deterministic packaging of visible-browser exports. Never renders new artwork.
import {readFile,writeFile,mkdir,copyFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const root=resolve(import.meta.dirname,'..'),source=resolve(root,'assets/skill-fx/combat-library-source'),incoming=resolve(source,'_physical-incoming'),out=resolve(root,'apps/web/public/art/effects/combat-physical'),library='G:/webgame/abyss-walker-migration/Q版日式手游SPINE特效300套';
const ids='blade-crescent blade-streak blade-crescent-heavy claw-triple knife-flight arrow-flight arrow-launch impact-heavy ground-crater ground-dust ground-ring ground-crack ground-rock'.split(' '),hash=b=>createHash('sha256').update(b).digest('hex'),manifest={version:'combat-physical-20261011-v1',clips:{}};await mkdir(out,{recursive:true});const contact=[];
for(const [index,id]of ids.entries()){
 const dir=resolve(source,id);await mkdir(dir,{recursive:true});let table,png;
 try{table=JSON.parse(await readFile(resolve(incoming,id+'.json'),'utf8'));png=await readFile(resolve(incoming,id+'.png'));}
 catch{table=JSON.parse(await readFile(resolve(dir,'clip.json'),'utf8'));png=await readFile(resolve(dir,'clip.png'));}
 const info=table.info;if(!info.active?.length)throw Error('D2 replacement required: empty '+id);
 const canonical={frames:table.frames,meta:{...table.meta,image:'clip.png'},info},frameBytes=Buffer.from(JSON.stringify(canonical)+'\n');await writeFile(resolve(dir,'clip.json'),frameBytes);await writeFile(resolve(dir,'clip.png'),png);await copyFile(resolve(dir,'clip.png'),resolve(out,id+'.png'));
 const atlas={frames:table.frames,meta:{...table.meta,image:id+'.png'}};await writeFile(resolve(out,id+'.json'),JSON.stringify(atlas)+'\n');
 const original=await readFile(resolve(library,info.library,info.json)),atlasName=(await readdir(resolve(library,info.library))).find(f=>f.endsWith('.atlas')),originalAtlas=await readFile(resolve(library,info.library,atlasName));
 manifest.clips[id]={key:'combat-physical-'+id,image:'/art/effects/combat-physical/'+id+'.png',atlas:'/art/effects/combat-physical/'+id+'.json',frames:info.active,peak:info.peak,fps:info.fps,duration:info.duration,origin:[.5,.5],cell:info.cell,visibleSize:info.visibleSize,kind:'layer',rotationOffset:0,blend:'normal',source:{library:info.library,animation:info.animation,originalPath:library+'/'+info.library+'/'+info.json,originalSha256:hash(original),originalAtlasSha256:hash(originalAtlas),sheetSha256:hash(png),frameTableSha256:hash(frameBytes),mode:info.mode??'spine-runtime-export',conversion:info.conversion??[],fallbackReason:info.fallbackReason??null,slotFilter:info.slotFilter,adaptation:'Visible browser, original 30 FPS timeline; selected source slots only. Runtime tint/scale/rotation/mirroring/cropping; no repaint.'}};
 const frame=table.frames[info.peak]?.frame??table.frames[info.active[0]].frame,tile=await sharp(png).extract({left:frame.x,top:frame.y,width:frame.w,height:frame.h}).png().toBuffer();contact.push({input:tile,left:index%4*256,top:Math.floor(index/4)*282});
 contact.push({input:Buffer.from(`<svg width="256" height="26"><text x="6" y="18" fill="#ffffff" font-size="13">${id} · ${info.library.slice(0,3)}</text></svg>`),left:index%4*256,top:Math.floor(index/4)*282+256});
}
await writeFile(resolve(root,'packages/asset-manifest/combat-physical-fx.json'),JSON.stringify(manifest,null,2)+'\n');const review=resolve(root,'docs/reviews/physical-vfx-20261011');await mkdir(review,{recursive:true});await sharp({create:{width:1024,height:Math.ceil(ids.length/4)*282,channels:4,background:'#38404a'}}).composite(contact).png().toFile(resolve(review,'library-contact-sheet.png'));console.log(JSON.stringify({clips:ids.length,manifestSha256:hash(Buffer.from(JSON.stringify(manifest))),modes:Object.fromEntries(Object.entries(manifest.clips).map(([id,c])=>[id,c.source.mode]))}));
