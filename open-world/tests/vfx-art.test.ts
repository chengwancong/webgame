import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import sharp from 'sharp';
import manifest from '../packages/asset-manifest/vfx-v2.json';
it.each(Object.entries(manifest.clips))('packs complete, correctly sized frames for %s',async(id,clip)=>{
 const path='apps/web/public'+clip.image,atlas=JSON.parse(readFileSync('apps/web/public'+clip.atlas,'utf8'));
 const {data,info}=await sharp(path).ensureAlpha().raw().toBuffer({resolveWithObject:true});const heights=[];
 for(let n=0;n<clip.count;n++){
  const frame=atlas.frames[n].frame;expect(frame.w).toBe(clip.cell);expect(frame.h).toBe(clip.cell);expect(frame.x+frame.w).toBeLessThanOrEqual(info.width);expect(frame.y+frame.h).toBeLessThanOrEqual(info.height);
  let top=clip.cell,bottom=-1,count=0;
  for(let y=0;y<frame.h;y++)for(let x=0;x<frame.w;x++)if(data[((y+frame.y)*info.width+x+frame.x)*4+3]>32){top=Math.min(top,y);bottom=Math.max(bottom,y);count++;}
  expect(count,id+'/'+n).toBeGreaterThan(100);heights.push(bottom-top+1);
 }
 if(clip.kind==='boss'){expect(Math.min(...heights),id+' contains a truncated body frame').toBeGreaterThan(Math.max(...heights)*.3);expect(Math.max(...heights)).toBe(clip.visibleHeight);}
});
