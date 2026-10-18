import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import sharp from 'sharp';
const root=resolve(import.meta.dirname,'..'),source=JSON.parse(await readFile(resolve(root,'packages/asset-manifest/skill-fx.json'),'utf8')),extra=JSON.parse(await readFile(resolve(root,'packages/asset-manifest/vfx-v2.json'),'utf8')),atlas=JSON.parse(await readFile(resolve(root,'apps/web/public/art/effects/skill-source.json'),'utf8')),metrics={};
for(const [id,c]of Object.entries(source.clips)){const rects=c.frames.map(f=>atlas.frames[f].spriteSourceSize),left=Math.min(...rects.map(r=>r.x)),top=Math.min(...rects.map(r=>r.y)),right=Math.max(...rects.map(r=>r.x+r.w)),bottom=Math.max(...rects.map(r=>r.y+r.h));metrics[id]={visibleSize:[right-left,bottom-top],duration:c.duration};}
const library=JSON.parse(await readFile(resolve(root,'packages/asset-manifest/combat-layer-fx.json'),'utf8'));
for(const [id,c]of Object.entries({...extra.clips,...Object.fromEntries(Object.entries(library.clips).filter(([,c])=>c.kind==='flight'))})){const a=JSON.parse(await readFile(resolve(root,'apps/web/public'+c.atlas),'utf8')),{data,info}=await sharp(resolve(root,'apps/web/public'+c.image)).ensureAlpha().raw().toBuffer({resolveWithObject:true});let left=c.cell,top=c.cell,right=0,bottom=0;const energies=[];
 for(const f of Object.values(a.frames))for(let y=0;y<f.frame.h;y++)for(let x=0;x<f.frame.w;x++)if(data[((f.frame.y+y)*info.width+f.frame.x+x)*4+3]>24){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);}
 for(const [name,f]of Object.entries(a.frames)){let energy=0;for(let y=0;y<f.frame.h;y++)for(let x=0;x<f.frame.w;x++)energy+=data[((f.frame.y+y)*info.width+f.frame.x+x)*4+3];energies.push({name,energy});}
 const peak=Math.max(...energies.map(e=>e.energy)),sustainFrames=energies.filter(e=>e.energy>=peak*.35).map(e=>e.name);metrics[id]={visibleSize:[right-left,bottom-top],duration:c.duration??c.count/c.fps,...((c.kind==='flight')?{sustainFrames}:{} )};
}
await writeFile(resolve(root,'packages/asset-manifest/combat-fx-metrics.json'),JSON.stringify(metrics,null,2)+'\n');console.log(JSON.stringify(metrics));
