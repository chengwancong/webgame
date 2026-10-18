// Hit/impact layers from the user's Spine library (Q版日式手游SPINE特效300套), exported in the visible browser by tools/spine-hit-export.
// Source sheets live in assets/skill-fx/hit-library-source/<id>/clip.{png,json}; this copies them to the web bundle and writes the manifest.
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const FEATHER=20,root=resolve(import.meta.dirname,'..'),source=resolve(root,'assets/skill-fx/hit-library-source'),out=resolve(root,'apps/web/public/art/effects/combat-hits'),library='G:/webgame/abyss-walker-migration/Q版日式手游SPINE特效300套';
await mkdir(out,{recursive:true});const manifest={version:'combat-hits-20261011-v1',clips:{}};
for(const id of (await readdir(source)).filter(d=>d.startsWith('hit-')).sort()){
 const sheet=JSON.parse(await readFile(resolve(source,id,'clip.json'),'utf8')),info=sheet.info,png=await readFile(resolve(source,id,'clip.png'));
 // The export crop (alpha > 40) cuts soft glows flat at the cell border, which reads as a square at release size:
 // feather alpha to zero over the outer FEATHER px of every cell (2026-10-16). Colour and inner pixels are untouched.
 {const {data,info:raw}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true}),cell=info.cell;
  for(let y=0;y<raw.height;y++)for(let x=0;x<raw.width;x++){const edge=Math.min(x%cell,cell-1-x%cell,y%cell,cell-1-y%cell);if(edge<FEATHER){const i=(y*raw.width+x)*4+3;data[i]=Math.round(data[i]*edge/FEATHER);}}
  await sharp(data,{raw:{width:raw.width,height:raw.height,channels:4}}).png().toFile(resolve(out,id+'.png'));}await writeFile(resolve(out,id+'.json'),JSON.stringify({frames:sheet.frames,meta:{...sheet.meta,image:id+'.png'}}));
 const original=await readFile(resolve(library,info.library,info.json)).catch(()=>undefined);
 manifest.clips[id]={key:'combat-hit-'+id,image:'/art/effects/combat-hits/'+id+'.png',atlas:'/art/effects/combat-hits/'+id+'.json',frames:info.active,peak:info.peak,fps:info.fps,duration:info.duration,origin:[.5,.5],cell:info.cell,visibleSize:info.visibleSize,kind:'layer',rotationOffset:0,blend:'normal',
  source:{library:info.library,animation:info.animation,start:info.start??0,originalPath:library+'/'+info.library+'/'+info.json,originalSha256:original&&createHash('sha256').update(original).digest('hex'),sheetSha256:createHash('sha256').update(png).digest('hex'),mode:'spine-runtime-export',adaptation:'Rendered with the Spine runtime at 30 FPS in the visible browser, cropped to visible pixels (alpha > 40) and resampled into 256 px cells. No repaint; cell borders alpha-feathered over '+FEATHER+' px so clipped glows do not end in a square edge; runtime scale/tint only.'}};
}
await writeFile(resolve(root,'packages/asset-manifest/combat-hit-fx.json'),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({clips:Object.keys(manifest.clips),frames:Object.values(manifest.clips).reduce((n,c)=>n+c.frames.length,0)}));
