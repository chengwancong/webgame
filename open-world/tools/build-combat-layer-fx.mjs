import {readFile,writeFile,mkdir,copyFile,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const root=resolve(import.meta.dirname,'..'),registered=JSON.parse(await readFile(resolve(root,'assets/starsea/vfx/manifest.json'),'utf8')),available=new Map();
for(const a of registered.assets)for(const c of Object.values(a.runtime?.clips??{}))if(c.kind==='atlas'&&!available.has(c.sourceClip))available.set(c.sourceClip,c);
const flights=['void-flight','blade-flight'],selected=['warm-burst','slash','void-charge','void-flight','void-impact','summon','flame-burst','ice-wave','ice-burst','blade-charge','void-burst','void-cloud','fire-rain','blade-flight'],out=resolve(root,'apps/web/public/art/effects/combat-layers');await mkdir(out,{recursive:true});const manifest={version:'combat-layers-20261004-v1',clips:{}};
for(const id of selected){
 const archive=resolve(root,'assets/skill-fx/combat-library-source',id);await mkdir(archive,{recursive:true});const params=resolve(archive,'source.json');let c;
 try{await access(params);c=JSON.parse(await readFile(params,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;c=available.get(id);if(!c)throw Error('Missing approved library layer '+id);await copyFile(resolve(root,'apps/web/public'+c.image),resolve(archive,'clip.png'));await copyFile(resolve(root,'apps/web/public'+c.atlas),resolve(archive,'clip.json'));await writeFile(params,JSON.stringify(c,null,2)+'\n');}
 const input=resolve(archive,'clip.png'),atlas=JSON.parse(await readFile(resolve(archive,'clip.json'),'utf8')),bytes=await readFile(input),frames={},layers=[],size=256,columns=4,width=columns*size,height=Math.ceil(c.frames.length/columns)*size;let left=size,top=size,right=0,bottom=0;const active=[];let peak=0,peakEnergy=0;
 for(let n=0;n<c.frames.length;n++){
  // Trimmed frames go back to their spot on the source canvas before the uniform downsample (2026-10-16):
  // stretching each trim box to the cell distorted every frame and pushed the art against the cell edges.
  const entry=atlas.frames[c.frames[n]],f=entry.frame,trim=entry.spriteSourceSize??{x:0,y:0},canvas=entry.sourceSize??{w:f.w,h:f.h};if(entry.rotated)throw Error('Rotated library frame '+id+'/'+n);
  // Flights point up with the tip on the anchor; the source slides the body inside its canvas, which loops as jitter
  // along the path, so each frame's leading tip is registered on the anchor (2026-10-16).
  const registered=box=>({left:Math.round(c.anchor[0]*canvas.w-box.w/2),top:Math.round(c.anchor[1]*canvas.h)});
  const piece=await sharp(bytes).extract({left:f.x,top:f.y,width:f.w,height:f.h}).png().toBuffer(),placed=await sharp({create:{width:canvas.w,height:canvas.h,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:piece,...flights.includes(id)?registered(trim):{left:trim.x,top:trim.y}}]).png().toBuffer();
  const png=await sharp(placed).resize(size,size).ensureAlpha().png().toBuffer(),{data}=await sharp(png).raw().toBuffer({resolveWithObject:true});let l=size,t=size,r=-1,b=-1,energy=0;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const a=data[(y*size+x)*4+3];energy+=a;if(a>24){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}}
  if(r>=l){active.push(String(n));left=Math.min(left,l);top=Math.min(top,t);right=Math.max(right,r+1);bottom=Math.max(bottom,b+1);}if(energy>peakEnergy){peakEnergy=energy;peak=n;}
  const x=n%columns*size,y=Math.floor(n/columns)*size;layers.push({input:png,left:x,top:y});frames[String(n)]={frame:{x,y,w:size,h:size},rotated:false,trimmed:false,spriteSourceSize:{x:0,y:0,w:size,h:size},sourceSize:{w:size,h:size}};
 }
 if(!active.length)throw Error('Empty library layer '+id);await sharp({create:{width,height,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(layers).png().toFile(resolve(out,id+'.png'));await writeFile(resolve(out,id+'.json'),JSON.stringify({frames,meta:{image:id+'.png',size:{w:width,h:height},scale:'1'}}));
 manifest.clips['library-'+id]={key:'combat-library-'+id,image:'/art/effects/combat-layers/'+id+'.png',atlas:'/art/effects/combat-layers/'+id+'.json',frames:active,peak:String(peak),fps:c.fps,duration:c.sourceDuration,origin:c.anchor,cell:size,visibleSize:[right-left,bottom-top],kind:flights.includes(id)?'flight':'layer',rotationOffset:flights.includes(id)?Math.PI/2:0,blend:c.blend==='lighter'?'add':'normal',source:{...c.source,approvedAtlas:c.image,approvedAtlasHash:createHash('sha256').update(bytes).digest('hex'),adaptation:'Reuse accepted native source-layer frames, each placed back at its trim offset on the source canvas; uniform 512 to 256 raster resampling'+(flights.includes(id)?'; flight frames registered tip-on-anchor so the in-canvas slide does not loop as jitter':'')+'. Empty frames omitted from stage playback, logical anchor and original source provenance retained; presentation is retimed to live combat events, not a claim of complete original Spine playback.'}};
}
await writeFile(resolve(root,'packages/asset-manifest/combat-layer-fx.json'),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({clips:Object.keys(manifest.clips),frames:Object.values(manifest.clips).reduce((n,c)=>n+c.frames.length,0)}));
