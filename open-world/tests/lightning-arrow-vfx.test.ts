import {it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import source from '../packages/asset-manifest/skill-fx.json';
import {vfxProfiles} from '../apps/web/src/vfx-profiles.ts';
import {sourceFrame} from '../apps/web/src/skill-fx-layout.ts';
import {lightningDischarge} from '../apps/web/src/lightning-arrow-vfx.ts';

it('uses the registered directional flight loop and keeps the charge artwork separate',()=>{
 const profile=vfxProfiles['player/lightning_bolt'],clip={...source.clips['lightning-arrow-flight'],blend:'add' as const,nativeFacing:'right' as const};expect(profile.flight).toBe('lightning-arrow-flight');expect(profile.anchor).toBe('muzzle');expect(clip.frames).toHaveLength(5);expect(clip.source.spine).toBe('2.1.27');expect(sourceFrame(clip,0,false,true)).toBe(clip.frames[0]);expect(sourceFrame(clip,1/24,false,true)).toBe(clip.frames[1]);expect(sourceFrame(clip,5/24,false,true)).toBe(clip.frames[0]);expect(sourceFrame(clip,0,true,true)).toBe(sourceFrame(clip,30,true,true));
 expect(source.clips['lightning-charge'].frames).toHaveLength(1);expect(clip.source.registration.artisticEdits).toBe(false);
});

it('preserves original raster hashes and places the visible electricity behind its forward tip',async()=>{
 const clip=source.clips['lightning-arrow-flight'];
 for(const file of clip.source.files){const bytes=await readFile(new URL('../'+file.file,import.meta.url));expect(createHash('sha256').update(bytes).digest('hex')).toBe(file.sha256);const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});let weight=0,cx=0,cy=0,tip=0;const x0=clip.origin[0]*info.width,y0=clip.origin[1]*info.height;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){const alpha=data[(y*info.width+x)*4+3];weight+=alpha;cx+=x*alpha;cy+=y*alpha;if(Math.hypot(x-x0,y-y0)<8)tip+=alpha;}
  const dx=cx/weight-x0,dy=cy/weight-y0,forward=dx*Math.cos(clip.rotationOffset)-dy*Math.sin(clip.rotationOffset);expect(tip,file.file).toBeGreaterThan(0);expect(forward,file.file).toBeLessThan(-15);
 }
});

it('keeps a hit discharge local, deterministic under pause, and smaller in reduced motion',()=>{
 const center={x:100,y:200},full=lightningDischarge(center,.5,71,false);expect(lightningDischarge(center,.5,71,false)).toEqual(full);expect(lightningDischarge(center,.5,71,true).length).toBeLessThan(full.length);
 for(const progress of [-1,0,.5,1,2])for(const path of lightningDischarge(center,progress,71,false))for(const point of path)expect(Math.hypot(point.x-center.x,point.y-center.y)).toBeLessThanOrEqual(40);
 expect(lightningDischarge(center,.5,71,false)).not.toEqual(lightningDischarge(center,1,71,false));
});
