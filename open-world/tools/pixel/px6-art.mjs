/** Native FX clusters. Source JSON supplies names and clocks only; no source bitmap is sampled. */
import {fileURLToPath} from 'node:url';
import fs from 'node:fs';import path from 'node:path';
import {collectInventory,reachableClientFiles} from './inventory.ts';import {runtimeResources} from '../../packages/asset-manifest/runtime-resources.ts';
import {Pixels,ramps,root,publicRoot,approve} from './px0-art.mjs';
const specs=new Map();
function walk(v,parent){if(!v||typeof v!=='object')return;if(v.image&&v.atlas){let s=specs.get(v.image);if(!s){s={...v,clips:{}};specs.set(v.image,s);}if(v.frames||v.count)s.clips[parent??'default']={frames:v.frames??Array.from({length:v.count},(_,i)=>String(i)),fps:v.fps??30,duration:v.duration??v.sourceDuration??(v.frames?.length??v.count)/(v.fps??30),peak:v.peak,origin:v.origin??v.anchor};}if(v.texture?.image&&v.clips){specs.set(v.texture.image,{...v.texture,clips:v.clips});}for(const [key,value]of Object.entries(v))if(!['source','evidence','review'].includes(key))walk(value,key);}
for(const file of reachableClientFiles())if(file.endsWith('.json'))walk(JSON.parse(fs.readFileSync(file,'utf8')));
for(const [,r]of runtimeResources)walk(r.runtime);
const existing=JSON.parse(fs.readFileSync(path.join(publicRoot,'art-pixel/manifest.json'),'utf8'));
const candidate={schemaVersion:1,canvas:[640,360],stage:[1280,720],palette:'/art-pixel/palette.json',assets:{}},done=new Set(),contact=new Pixels(768,1024);let preview=0;
export function fxFrame(id,t,size=64){
 const p=new Pixels(size,size),r=/poison|nature|heal|buff/.test(id)?ramps.leaf:/ice|frost|water|flood/.test(id)?ramps.water:/void|arcane|shadow|abyss|rift/.test(id)?ramps.arcane:/fire|flame|burn|explosion|dragon/.test(id)?ramps.fire:/earth|rock|dust|blood/.test(id)?ramps.earth:ramps.copper;
 const unit=size/64,poly=(v,c)=>p.poly(v.map(([x,y])=>[x*unit,y*unit]),c),rect=(x,y,w,h,c)=>p.rect(x*unit,y*unit,Math.max(1,w*unit),Math.max(1,h*unit),c),pulse=Math.sin(Math.PI*Math.min(.99,t)),radius=5+23*pulse;
 if(/slash|blade|claw|crescent|streak/.test(id)){
  const a=-2.8+t*3.7,outer=[],inner=[];for(let n=0;n<=16;n++){const angle=a+n/16*1.9;outer.push([32+Math.cos(angle)*radius,32+Math.sin(angle)*radius]);inner.unshift([32+Math.cos(angle)*(radius-5),32+Math.sin(angle)*(radius-5)]);}poly([...outer,...inner],r[1]);poly(outer.concat(inner.map(([x,y])=>[32+(x-32)*1.08,32+(y-32)*1.08])),r[3]);
 }else if(/flight|bolt|arrow|knife|missile/.test(id)){
  poly([[5,29],[41,26],[44,19],[59,32],[44,45],[41,38],[5,35],[19,32]],r[0]);poly([[16,30],[43,29],[46,24],[55,32],[45,38],[42,34],[18,34],[26,32]],r[3]);rect(42,29,8,2,r[5]);
 }else if(/ice|crystal|frost/.test(id)){
  for(const [x,y,h]of [[19,46,22],[32,52,35],[45,45,23]]){poly([[x-6,y-h/2],[x,y-h],[x+6,y-h/2],[x+3,y],[x-3,y]],r[0]);poly([[x-4,y-h/2],[x,y-h+3],[x,y-3],[x-2,y-2]],r[4]);poly([[x+1,y-h+4],[x+4,y-h/2],[x+2,y-3]],r[2]);}
 }else if(/fire|flame|burn|explosion|burst|dragon/.test(id)){
  const f=Math.round(3*Math.sin(t*12));poly([[10,49],[17,35],[23,38],[19,21],[30,8+f],[33,26],[43,15-f],[42,34],[52,28],[55,44],[47,54],[22,56]],r[0]);poly([[15,47],[23,40],[25,28],[30,16+f],[31,34],[41,23-f],[39,40],[48,36],[50,44],[43,50],[24,52]],r[2]);poly([[25,48],[30,34],[32,41],[36,31],[42,45],[38,51],[29,51]],r[4]);rect(29,46,4,3,r[5]);
 }else if(/lightning|storm|thunder|spark/.test(id)){
  poly([[39,5],[22,30],[30,32],[21,57],[46,27],[36,26],[48,7]],r[0]);poly([[39,9],[26,29],[34,30],[27,48],[41,29],[32,28],[44,10]],r[4]);rect(34,17,3,4,r[5]);
 }else if(/smoke|steam|cloud|fog|poison/.test(id)){
  for(const [x,y,w]of [[20,39,12],[34,31-t*7,15],[43,43,12],[28,46,16]]){const points=[];for(let i=0;i<10;i++)points.push([x+Math.cos(i*Math.PI/5)*w,y+Math.sin(i*Math.PI/5)*w*.7]);poly(points,r[1]);poly(points.map(([a,b])=>[x+(a-x)*.8-1,y+(b-y)*.8-2]),r[3]);}
 }else{
  const outer=[],inner=[];for(let n=0;n<32;n++){const a=n*Math.PI/16;outer.push([32+Math.cos(a)*radius,36+Math.sin(a)*radius*.55]);inner.unshift([32+Math.cos(a)*(radius-3),36+Math.sin(a)*(radius-3)*.55]);}poly([...outer,...inner],r[2]);for(let n=0;n<4;n++){const a=n*Math.PI/2+t*2,x=32+Math.cos(a)*(radius-3),y=36+Math.sin(a)*(radius-3)*.55;poly([[x-3,y],[x,y-4],[x+3,y],[x,y+4]],r[4]);}
 }
 // Singletons are removed in the authored grid; disconnected 2px sparks are intentional clusters.
 const src=Buffer.from(p.data);for(let y=0;y<size;y++)for(let x=0;x<size;x++){if(!src[(y*size+x)*4+3])continue;let neighbors=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if((dx||dy)&&x+dx>=0&&x+dx<size&&y+dy>=0&&y+dy<size&&src[((y+dy)*size+x+dx)*4+3])neighbors++;if(!neighbors)p.dot(x,y,null);}
 return p;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
for(const row of collectInventory().filter(r=>r.batch==='PX6'))for(const file of row.paths){if(done.has(file))continue;done.add(file);const spec=specs.get(file),atlas=spec?.atlas&&fs.existsSync(path.join(publicRoot,spec.atlas))?JSON.parse(fs.readFileSync(path.join(publicRoot,spec.atlas),'utf8')):undefined;
 const names=atlas?Array.isArray(atlas.frames)?atlas.frames.map(f=>f.filename):Object.keys(atlas.frames):['__BASE'],size=/ambient|glow|tip|fragment/.test(file)?32:64,cols=Math.min(16,names.length),sheet=new Pixels(cols*size,Math.ceil(names.length/cols)*size),frames={};
 for(let n=0;n<names.length;n++){const name=names[n],clip=Object.values(spec?.clips??{}).find(c=>c.frames?.includes(name)),index=clip?.frames.indexOf(name)??n,count=clip?.frames.length??names.length,t=count>1?index/(count-1):.45;sheet.stamp(fxFrame(file+' '+name,t,size),n%cols*size,Math.floor(n/cols)*size);frames[name]={x:n%cols*size,y:Math.floor(n/cols)*size,w:size,h:size};}
 let target=file.replace('/art/','/art-pixel/').replace(/\.(webp|svg)$/i,'.png');if(Object.values(existing.assets).some(a=>a.file===target&&!a.batch.startsWith('PX6')))target=target.replace('.png','-fx.png');
 const key='fx:'+file.replace('/art/',''),origin=spec?.origin??spec?.anchor??[.5,.5],a=await approve(key,sheet,{file:target,original:[file],batch:'PX6',frame:[size,size],anchor:origin.map(v=>Math.round(v*size)),recipe:'tools/pixel/px6-art.mjs#fxFrame'},candidate);a.frames=frames;a.defaultFrame=names[0];a.baseOrigin=origin;a.effectClips=spec?.clips??{};
 if(preview<192){contact.stamp(fxFrame(file,.45,48),preview%16*48,Math.floor(preview/16)*80);preview++;}
}
fs.writeFileSync(path.join(root,'.runtime/pixel-redraw/px6-candidates.json'),JSON.stringify(candidate,null,2)+'\n');await contact.save(path.join(root,'.runtime/pixel-redraw/px6-contact.png'));console.log(JSON.stringify({candidates:Object.keys(candidate.assets).length,frames:Object.values(candidate.assets).reduce((n,a)=>n+Object.keys(a.frames).length,0)}));

}
