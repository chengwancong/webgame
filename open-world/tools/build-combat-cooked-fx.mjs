// Status + hit layers from the free "Cooked FX" pack (Cozy Chunky theme), https://the-cooked-works.itch.io/cooked-fx.
// License: free personal/commercial use, no credit; the effects themselves must not be resold or redistributed (LICENSE.pdf in the pack).
// Sources stay outside the repo in ../source-assets/cooked-fx (hashes in SOURCE.md / SHA256SUMS-extracted.txt); this repacks the 2x
// horizontal strips (256 px cells) into 4-column grids (strips of 18 frames would exceed a 4096 px texture) and writes the manifest.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const root=resolve(import.meta.dirname,'..'),pack=resolve(root,'../../source-assets/cooked-fx'),theme='Cozy_Chunky',base=`${theme}/Cooked_FX_FREE/${theme}`,out=resolve(root,'apps/web/public/art/effects/combat-cooked'),CELL=256,COLS=4;
const clips={
 'cooked-slash-x':{from:'combat/slash_x',use:'hit-slash'},
 'cooked-hit':{from:'combat/hit_side',use:'hit-blast'},
 'cooked-explosion':{from:'combat/explosion_side',use:'hit-fire-big'},
 'cooked-ice-hit':{from:'magic/ice_hit_side',use:'hit-ice'},
 'cooked-buff':{from:'status/buff',use:'status-buff',loop:true},
 'cooked-debuff':{from:'status/debuff',use:'status-debuff',loop:true},
 'cooked-poison':{from:'status/poison',use:'status-poison',loop:true},
 'cooked-stun':{from:'status/stun',use:'status-stun',loop:true},
 'cooked-burn':{from:'status/burn',use:'status-burn',loop:true}
};
const sums=new Map((await readFile(resolve(pack,'SHA256SUMS-extracted.txt'),'utf8')).split(/\r?\n/).filter(Boolean).map(l=>{const [h,...p]=l.split('  ');return [p.join('  '),h];}));
const anims=JSON.parse(await readFile(resolve(pack,base,'anims.json'),'utf8'));
await mkdir(out,{recursive:true});const manifest={version:'combat-cooked-20261020-v1',clips:{}};
for(const [id,spec] of Object.entries(clips)){
 const rel=`${base}/PNG_2x/${spec.from}.png`,png=await readFile(resolve(pack,rel)),hash=createHash('sha256').update(png).digest('hex');
 if(sums.get(rel)!==hash)throw new Error('hash mismatch '+rel);
 const meta=anims[spec.from],{data,info}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 if(info.height!==CELL||info.width!==meta.frames*CELL)throw new Error('unexpected sheet size '+rel);
 const rows=Math.ceil(meta.frames/COLS),w=COLS*CELL,h=rows*CELL,grid=Buffer.alloc(w*h*4);let x0=CELL,y0=CELL,x1=0,y1=0;const frames={},names=[];
 for(let f=0;f<meta.frames;f++){
  const dx=(f%COLS)*CELL,dy=Math.floor(f/COLS)*CELL;
  for(let y=0;y<CELL;y++)for(let x=0;x<CELL;x++){const s=(y*info.width+f*CELL+x)*4,d=((dy+y)*w+dx+x)*4;data.copy(grid,d,s,s+4);if(data[s+3]>40){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}}
  frames[String(f)]={frame:{x:dx,y:dy,w:CELL,h:CELL},rotated:false,trimmed:false,spriteSourceSize:{x:0,y:0,w:CELL,h:CELL},sourceSize:{w:CELL,h:CELL}};names.push(String(f));
 }
 await sharp(grid,{raw:{width:w,height:h,channels:4}}).png().toFile(resolve(out,id+'.png'));
 await writeFile(resolve(out,id+'.json'),JSON.stringify({frames,meta:{image:id+'.png',size:{w,h},scale:'1'}}));
 manifest.clips[id]={key:'combat-cooked-'+id,image:`/art/effects/combat-cooked/${id}.png`,atlas:`/art/effects/combat-cooked/${id}.json`,frames:names,peak:String(Math.floor(meta.frames*.3)),fps:meta.fps,duration:meta.frames/meta.fps,origin:[.5,.5],cell:CELL,visibleSize:[x1-x0+1,y1-y0+1],kind:'layer',rotationOffset:0,blend:'normal',loop:Boolean(spec.loop),
  source:{pack:'Cooked FX (The Cooked Works)',url:'https://the-cooked-works.itch.io/cooked-fx',theme,file:rel,animation:spec.from,sourceSha256:hash,replaces:spec.use,license:'Free for personal and commercial use, no credit required; effects must not be resold or redistributed (LICENSE.pdf).',downloaded:'2026-10-20',adaptation:'2x strip repacked into a 4-column grid, pixels unchanged; runtime scale/tint only.'}};
}
await writeFile(resolve(root,'packages/asset-manifest/combat-cooked-fx.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(manifest.clips).map(([k,c])=>[k,{frames:c.frames.length,visible:c.visibleSize}]))));
