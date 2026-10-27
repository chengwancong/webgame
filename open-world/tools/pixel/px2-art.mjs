import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {collectInventory} from './inventory.ts';
import {runtimeResources} from '../../packages/asset-manifest/runtime-resources.ts';
import {Pixels,ramps,approve,root,publicRoot,forge,dock} from './px0-art.mjs';
const {wood,ink,navy,copper,water,fire,leaf,arcane,earth}=ramps;
export class Pen{
 constructor(w,h){this.p=new Pixels(w,h);this.w=w;this.h=h;}
 rect(x,y,w,h,c){this.p.rect(x*this.w/100,y*this.h/100,w*this.w/100,h*this.h/100,c);}
 poly(points,c){this.p.poly(points.map(([x,y])=>[x*this.w/100,y*this.h/100]),c);}
 circle(x,y,rx,ry,c){const cx=Math.round(x*this.w/100),cy=Math.round(y*this.h/100),a=Math.max(1,Math.round(rx*this.w/100)),b=Math.max(1,Math.round(ry*this.h/100));for(let py=cy-b;py<=cy+b;py++)for(let px=cx-a;px<=cx+a;px++)if((px-cx)**2/a**2+(py-cy)**2/b**2<=1)this.p.dot(px,py,c);}
 ellipse(x,y,rx,ry,c){this.circle(x,y,rx,ry,c);}
 finish(){
  const copy=Buffer.from(this.p.data),map=new Map(Object.values(ramps).flatMap(r=>r.map((c,i)=>[c.slice(1),[r[0],i===0?r[1]:c]])));
  for(let y=0;y<this.h;y++)for(let x=0;x<this.w;x++){
   const i=(y*this.w+x)*4;if(!copy[i+3])continue;const ramp=map.get(copy.subarray(i,i+3).toString('hex'));if(!ramp)continue;
   const edge=[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>x+dx<0||x+dx>=this.w||y+dy<0||y+dy>=this.h||!copy[((y+dy)*this.w+x+dx)*4+3]);this.p.dot(x,y,ramp[edge?0:1]);
  }return this.p;
 }
}
function barrel(b,x,y,w=16,h=25){b.poly([[x+2,y],[x+w-2,y],[x+w,y+5],[x+w,y+h-5],[x+w-2,y+h],[x+2,y+h],[x,y+h-5],[x,y+5]],wood[0]);b.rect(x+2,y+2,w-4,h-4,wood[2]);b.rect(x+3,y+3,3,h-6,wood[3]);b.rect(x,y+5,w,2,ink[1]);b.rect(x,y+h-7,w,2,ink[1]);}
function crate(b,x,y,w,h){b.rect(x,y,w,h,wood[0]);b.rect(x+1,y+1,w-2,h-2,wood[2]);b.rect(x+2,y+2,w-4,2,wood[4]);b.rect(x+2,y+h-4,w-4,2,wood[1]);b.poly([[x+2,y+3],[x+4,y+2],[x+w-2,y+h-4],[x+w-4,y+h-2]],wood[3]);}
function canopy(b,color=navy){
 b.rect(9,27,4,67,wood[0]);b.rect(87,27,4,67,wood[0]);b.rect(10,30,2,63,wood[3]);b.rect(88,30,2,63,wood[2]);
 b.poly([[5,30],[23,12],[78,12],[95,30],[91,39],[7,39]],color[0]);b.poly([[8,29],[24,14],[77,14],[92,29],[88,36],[11,36]],color[2]);
 for(let x=18;x<88;x+=18)b.poly([[x,17],[x+5,15],[x+9,35],[x+3,36]],color[3]);b.rect(8,35,84,3,color[4]);
 b.rect(10,72,80,20,wood[0]);b.rect(12,73,76,15,wood[2]);b.rect(13,73,73,2,wood[4]);b.rect(48,75,3,12,wood[1]);
}
function boat(b,sail=false){
 b.poly([[4,57],[17,35],[80,29],[97,39],[87,74],[67,91],[21,87]],wood[0]);
 b.poly([[8,57],[20,39],[78,33],[92,41],[82,71],[66,85],[23,82]],wood[3]);
 b.poly([[13,58],[24,44],[76,37],[86,43],[78,65],[64,76],[26,75]],wood[1]);
 for(let y=48;y<=68;y+=10)b.poly([[18,y],[79,y-8],[82,y-4],[16,y+4]],wood[4]);
 b.poly([[6,61],[23,80],[66,84],[83,71],[79,79],[67,92],[23,88]],navy[1]);b.poly([[7,61],[23,80],[65,84],[81,72],[80,76],[66,87],[23,83]],navy[3]);
 b.rect(12,50,3,16,copper[3]);b.rect(82,41,3,17,copper[3]);
 if(sail){b.rect(52,4,3,58,wood[0]);b.rect(52,5,1,55,copper[4]);b.poly([[55,7],[86,14],[79,23],[55,25]],water[0]);b.poly([[56,9],[81,15],[76,21],[56,23]],water[3]);}
}
function table(b){
 b.rect(12,48,8,43,wood[0]);b.rect(79,40,8,46,wood[0]);b.rect(45,56,8,42,wood[0]);
 b.poly([[3,35],[63,19],[98,38],[38,57]],wood[0]);b.poly([[6,35],[63,22],[93,38],[38,53]],wood[3]);
 b.poly([[13,35],[61,25],[84,38],[38,48]],earth[4]);b.poly([[28,35],[37,31],[43,33],[49,29],[58,32],[53,36],[63,38],[54,41],[43,38],[37,42]],navy[2]);
 b.rect(13,52,74,6,wood[1]);b.rect(20,66,55,13,wood[2]);b.rect(47,67,4,6,copper[3]);
}
function mailbox(b){b.rect(43,43,14,50,wood[0]);b.rect(45,43,5,48,wood[3]);b.circle(50,94,27,5,ink[1]);b.rect(23,25,54,42,copper[0]);b.rect(27,27,46,36,copper[2]);b.poly([[23,25],[28,15],[43,10],[60,10],[73,16],[77,25]],water[0]);b.poly([[28,23],[33,17],[44,13],[58,13],[68,18],[72,23]],water[2]);b.rect(33,36,34,3,wood[0]);b.rect(34,48,31,11,earth[4]);b.poly([[35,49],[49,56],[63,49],[49,54]],wood[1]);b.rect(47,6,6,5,copper[4]);}
function bell(b){b.rect(56,7,9,83,wood[0]);b.rect(57,8,4,79,wood[3]);b.rect(18,16,52,5,copper[1]);b.rect(21,16,44,2,copper[4]);b.rect(29,21,3,10,ink[1]);b.poly([[23,29],[36,29],[39,35],[40,58],[49,67],[46,72],[13,72],[10,67],[19,58],[20,35]],copper[0]);b.poly([[25,31],[34,32],[35,57],[42,66],[17,66],[23,57]],copper[2]);b.rect(24,34,4,22,copper[4]);b.rect(14,67,32,3,copper[3]);b.rect(27,73,7,5,copper[1]);b.circle(59,92,21,5,ink[2]);}
function notice(b){b.rect(12,31,6,65,wood[0]);b.rect(82,31,6,65,wood[0]);b.rect(13,34,2,58,wood[3]);b.rect(83,34,2,58,wood[2]);b.rect(16,29,69,54,wood[0]);b.rect(20,32,61,46,wood[2]);for(const [x,y] of [[25,39],[45,37],[64,44]]){b.rect(x,y,13,24,earth[4]);b.rect(x+3,y+6,7,2,wood[2]);b.rect(x+3,y+11,7,1,wood[2]);}b.poly([[6,31],[19,14],[78,14],[94,31],[88,37],[12,37]],wood[0]);b.poly([[10,30],[21,17],[77,17],[90,30]],wood[3]);for(let x=18;x<87;x+=12)b.rect(x,23,2,10,wood[1]);b.rect(11,31,78,3,wood[4]);}
function flag(b){for(const [x,y,h] of [[19,6,88],[58,29,65]]){b.rect(x,y,5,h,wood[0]);b.rect(x+1,y,2,h-2,copper[4]);b.poly([[x+5,y+7],[x+36,y+14],[x+31,y+26],[x+35,y+39],[x+5,y+34]],water[0]);b.poly([[x+6,y+10],[x+32,y+16],[x+28,y+26],[x+31,y+34],[x+6,y+31]],water[2]);b.poly([[x+18,y+16],[x+24,y+23],[x+19,y+29],[x+13,y+22]],earth[4]);}}
function cart(b){
 b.poly([[11,64],[62,50],[85,67],[34,83]],wood[0]);b.poly([[14,63],[62,53],[79,66],[34,78]],wood[3]);b.rect(21,66,5,19,wood[1]);b.rect(69,64,4,18,wood[1]);
 for(const x of [27,70]){b.circle(x,85,11,11,wood[0]);b.circle(x,85,8,8,wood[3]);b.circle(x,85,3,3,wood[0]);b.rect(x-7,84,14,2,wood[0]);b.rect(x-1,78,2,14,wood[0]);}
 crate(b,28,38,22,25);barrel(b,52,31,18,31);b.poly([[18,55],[15,37],[22,26],[34,29],[40,50]],earth[3]);b.poly([[20,54],[19,38],[24,30],[31,32],[35,49]],earth[4]);b.rect(8,61,16,3,wood[3]);
}
function house(b){
 b.poly([[13,51],[55,37],[86,53],[86,88],[51,98],[13,85]],wood[0]);b.poly([[15,53],[54,41],[54,94],[15,83]],earth[3]);b.poly([[56,42],[83,55],[83,87],[56,94]],earth[2]);
 b.poly([[6,49],[39,9],[63,16],[95,50],[87,60],[56,32],[18,57]],navy[0]);b.poly([[10,48],[40,13],[60,19],[88,51],[84,55],[56,27],[17,53]],navy[2]);
 for(let y=26;y<49;y+=7)b.poly([[25,y],[43,y-8],[63,y+5],[81,y+17],[77,y+18],[58,y+7],[42,y-5],[22,y+3]],navy[1]);
 b.rect(21,60,19,27,wood[0]);b.rect(24,61,13,24,wood[2]);b.rect(32,72,2,2,copper[4]);b.rect(58,61,17,14,wood[0]);b.rect(60,63,13,10,fire[4]);b.rect(66,63,2,11,wood[0]);b.rect(60,67,13,2,wood[0]);
 b.rect(65,9,12,22,ink[2]);b.rect(65,9,12,3,ink[4]);b.rect(65,18,12,2,ink[1]);barrel(b,72,79,15,18);crate(b,8,79,14,15);
}
function workshop(b,tier=1){
 b.rect(77,6,11,59,earth[1]);b.rect(78,7,4,52,earth[3]);for(let y=13;y<55;y+=13)b.rect(76,y,13,3,wood[1]);b.circle(82,7,9,4,copper[1]);b.circle(82,6,6,2,wood[0]);
 b.poly([[7,52],[20,26],[49,17],[75,25],[90,50],[84,73],[54,88],[14,78]],copper[0]);b.poly([[10,51],[23,29],[49,20],[73,28],[86,50],[80,55],[18,59]],copper[2]);
 for(let x=24;x<80;x+=12)b.poly([[x,28],[x+4,27],[x+1,52],[x-3,54]],copper[3]);b.circle(49,20,10,4,copper[1]);b.circle(49,19,7,2,water[2]);
 b.poly([[12,56],[53,49],[83,57],[83,82],[52,94],[12,82]],earth[0]);b.poly([[16,58],[52,53],[52,89],[16,79]],earth[3]);b.poly([[55,54],[79,60],[79,81],[55,89]],earth[2]);
 b.poly([[24,80],[24,67],[29,58],[42,58],[48,67],[48,86]],earth[0]);b.poly([[29,79],[29,68],[32,63],[39,63],[43,69],[43,84]],fire[0]);b.poly([[32,81],[31,74],[35,70],[37,76],[40,69],[41,84]],fire[3]);b.rect(34,78,3,7,fire[5]);
 b.circle(66,61,9,11,copper[0]);b.circle(66,61,6,8,water[1]);b.circle(64,58,3,4,water[4]);
 crate(b,4,77,14,14);barrel(b,83,73,12,18);
 if(tier>=2){b.rect(6,46,6,28,copper[1]);b.rect(6,46,4,19,copper[4]);b.rect(5,66,9,4,water[2]);b.circle(54,52,8,5,copper[1]);b.circle(54,52,3,2,wood[0]);}
 if(tier>=3){b.rect(68,12,7,34,earth[1]);b.rect(68,12,7,3,copper[3]);b.rect(50,77,10,10,copper[1]);b.circle(56,68,6,7,water[2]);b.circle(54,66,2,2,water[4]);}
}
function gate(b,frame){
 b.poly([[8,78],[8,37],[28,9],[71,9],[91,37],[91,78],[71,94],[29,94]],earth[0]);
 b.poly([[13,76],[13,38],[31,14],[68,14],[86,38],[86,76],[69,88],[31,88]],earth[3]);
 b.poly([[26,70],[26,41],[38,28],[61,28],[73,42],[73,70],[61,79],[39,79]],null);
 const pulse=frame.includes('glow')?[2,3,4,4,3,2][Number(frame.split('-').at(-1))]:frame.includes('lit')?4:1;
 for(const [x,y] of [[27,25],[69,25],[83,50],[69,77],[27,77],[15,50]]){b.circle(x,y,4,4,copper[1]);b.circle(x-1,y-1,2,2,water[pulse]);}
 b.poly([[10,88],[29,78],[71,78],[91,88],[83,96],[20,96]],earth[1]);b.poly([[13,88],[30,81],[70,81],[87,88],[80,92],[22,92]],earth[4]);
 if(frame==='stargate-ring-lit'){b.poly([[26,70],[26,41],[38,28],[61,28],[73,42],[73,70],[61,79],[39,79]],water[1]);b.poly([[31,67],[31,43],[40,33],[59,33],[68,44],[68,67],[59,74],[41,74]],water[2]);}
}
function airship(b){
 b.poly([[19,35],[12,25],[18,12],[35,5],[66,5],[83,15],[88,29],[75,44],[34,48]],wood[0]);b.poly([[22,34],[16,25],[21,15],[36,8],[65,8],[80,17],[84,28],[73,40],[35,44]],earth[4]);
 for(const x of [30,47,65])b.poly([[x,10],[x+3,10],[x+8,40],[x+5,42]],wood[2]);b.poly([[73,12],[91,5],[90,19],[82,23]],water[1]);b.poly([[79,34],[96,34],[90,45],[76,43]],water[2]);
 for(const x of [29,68]){b.rect(x,39,2,29,wood[1]);b.rect(x+1,42,1,24,copper[3]);}
 b.poly([[18,69],[28,61],[70,60],[86,69],[77,82],[51,92],[28,87]],wood[0]);b.poly([[22,70],[30,64],[68,63],[82,70],[74,79],[50,87],[30,83]],wood[3]);
 b.poly([[23,73],[31,81],[50,85],[73,78],[70,83],[50,91],[29,87]],wood[1]);b.rect(35,56,25,11,wood[1]);b.rect(38,58,19,9,wood[3]);b.rect(44,58,7,4,water[1]);b.circle(27,74,4,4,copper[0]);b.circle(27,74,2,2,copper[4]);
}
function pier(b){b.poly([[5,46],[55,16],[97,42],[47,74]],wood[0]);b.poly([[9,46],[55,20],[92,42],[47,69]],wood[3]);for(let i=0;i<8;i++)b.poly([[12+i*5,44+i*3],[55+i*5,22+i*3],[57+i*5,24+i*3],[14+i*5,46+i*3]],wood[1]);for(const [x,y] of [[9,46],[49,69],[90,42]]){b.rect(x,y,4,22,wood[0]);b.rect(x+1,y,2,19,wood[3]);b.circle(x+1,y,3,2,copper[4]);}b.poly([[22,61],[36,69],[24,86],[10,78]],wood[0]);b.poly([[23,65],[31,70],[23,81],[15,77]],wood[3]);}
function marks(w,h,name){const b=new Pen(w,h);b.poly([[9,18],[27,4],[73,4],[91,18],[91,71],[50,96],[9,71]],wood[0]);b.poly([[15,20],[29,10],[71,10],[85,20],[85,67],[50,87],[15,67]],wood[3]);b.poly([[22,25],[35,16],[66,16],[78,25],[78,63],[51,77],[22,63]],navy[0]);
 if(/forge/.test(name)){b.rect(32,33,36,13,ink[4]);b.rect(45,44,10,22,wood[3]);}
 else if(/post/.test(name)){b.rect(30,31,40,30,earth[4]);b.poly([[30,32],[50,46],[70,32],[50,41]],wood[1]);}
 else if(/pier/.test(name)){b.poly([[29,49],[73,49],[62,64],[38,64]],copper[3]);b.rect(48,25,6,28,earth[4]);b.poly([[56,28],[69,43],[56,43]],water[3]);}
 else if(/wardrobe/.test(name)){b.poly([[39,30],[30,35],[30,48],[38,44],[37,63],[65,63],[64,44],[72,48],[72,35],[61,30],[56,37],[44,37]],earth[4]);}
 else if(/pet/.test(name)){b.circle(50,54,14,10,earth[4]);b.circle(33,35,6,6,earth[4]);b.circle(51,31,6,6,earth[4]);b.circle(68,37,6,6,earth[4]);}
 else{b.poly([[50,27],[56,41],[72,45],[58,51],[51,67],[44,52],[29,45],[44,41]],water[4]);}return b.finish();}
export function paint(id,w,h,frame=''){
 const b=new Pen(w,h);
 if(id==='ow-hub-port-marks')return marks(w,h,frame);
 if(/build-dock-1/.test(id))return dock();
 if(/build-forge-1/.test(id))return forge();
 if(/build-dock-[24]/.test(id))boat(b,id.endsWith('4'));
 else if(/build-dock-3/.test(id))table(b);
 else if(/build-forge-2/.test(id)){crate(b,41,19,40,31);crate(b,17,48,43,36);crate(b,60,57,31,32);barrel(b,3,31,26,47);}
 else if(/build-forge-3/.test(id)){canopy(b,fire);table(b);barrel(b,76,56,17,31);}
 else if(/build-forge-4/.test(id))bell(b);
 else if(/build-post-1/.test(id))mailbox(b);
 else if(/build-post-2/.test(id))notice(b);
 else if(/build-post-3/.test(id))flag(b);
 else if(/build-post-4/.test(id))cart(b);
 else if(/stall/.test(id)){const color=/jinyu/.test(id)?leaf:/mijia/.test(id)?arcane:navy;canopy(b,color);for(let x=20;x<=72;x+=13){if(/jinyu/.test(id)){b.circle(x,65,6,6,leaf[3]);b.circle(x-2,62,2,2,leaf[4]);}else{b.rect(x,53,9,18,/mijia/.test(id)?arcane[2]:earth[4]);b.rect(x,55,9,2,copper[3]);}}}
 else if(/pet-yard/.test(id)){for(let x=7;x<96;x+=12){b.rect(x,58,4,31,wood[0]);b.rect(x+1,60,2,27,wood[3]);}b.rect(5,65,90,4,wood[2]);b.rect(5,80,90,4,wood[3]);b.rect(35,35,40,39,wood[0]);b.rect(38,36,34,33,wood[3]);b.poly([[30,37],[51,15],[80,36],[75,41],[52,24],[36,43]],navy[1]);b.poly([[49,49],[62,49],[66,57],[66,69],[45,69],[45,57]],wood[0]);b.circle(27,82,9,4,ink[2]);b.circle(27,80,8,3,water[3]);}
 else if(/wardrobe/.test(id)){canopy(b,earth);b.poly([[16,36],[39,37],[33,53],[36,78],[16,82]],water[2]);b.poly([[65,37],[85,36],[85,82],[64,78],[69,53]],water[1]);b.circle(51,42,6,6,copper[3]);b.poly([[42,51],[60,51],[63,65],[58,68],[59,81],[42,81],[43,68],[38,65]],arcane[2]);}
 else if(/stargate/.test(id))gate(b,frame);
 else if(/workshop/.test(id))workshop(b,Number(id.match(/tier-(\d)/)?.[1]??1));
 else if(/airship/.test(id))airship(b);
 else if(/pier/.test(id))pier(b);
 else house(b);
 return b.finish();
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
const candidate={schemaVersion:1,stage:[1280,720],canvas:[640,360],palette:'/art-pixel/palette.json',assets:{}};
const rows=collectInventory().filter(r=>r.batch==='PX2'),contact=new Pixels(1024,1024);let contactIndex=0;
for(const row of rows){
 if(['ss-scene-tree','ss-scene-rocks'].includes(row.key))continue;
 const a=runtimeResources.get(row.key),r=a.runtime;if(!r.file)continue;
 const meta=await sharp(path.join(publicRoot,r.file)).metadata(),dw=r.displayWidth??(r.displayHeight??32),dh=r.displayHeight??dw*(r.height??meta.height)/(r.width??meta.width);
 let w=Math.max(8,Math.round(dw/16)*8),h=Math.max(8,Math.round(dh/16)*8);if(row.key==='ss-scene-build-forge-1'){w=32;h=40;}if(row.key==='ss-scene-build-dock-1'){w=24;h=48;}
 const atlas=r.atlas?JSON.parse(fs.readFileSync(path.join(publicRoot,r.atlas),'utf8')):undefined;
 const names=atlas?(row.key==='ow-hub-port-marks'||row.key==='ss-scene-stargate'?Object.keys(atlas.frames):[r.frame].filter(Boolean)):[];
 const cols=names.length>1?Math.min(4,names.length):1,sheet=new Pixels(w*cols,h*Math.max(1,Math.ceil(names.length/cols))),frames={};
 for(let i=0;i<Math.max(1,names.length);i++){
  const tile=paint(row.key,w,h,names[i]);sheet.stamp(tile,i%cols*w,Math.floor(i/cols)*h);if(names[i])frames[names[i]]={x:i%cols*w,y:Math.floor(i/cols)*h,w,h};
 }
 const asset=await approve(row.key,sheet,{file:r.file.replace('/art/','/art-pixel/'),original:[r.file],batch:'PX2',frame:[w,h],anchor:[Math.min(w,Math.round((r.anchor?.[0]??.5)*w)),Math.min(h,Math.round((r.anchor?.[1]??1)*h))]},candidate);
 asset.baseOrigin=r.anchor??[.5,1];if(names.length)asset.frames=frames;
 const tile=paint(row.key,w,h,names[0]);const col=contactIndex%5,rowIndex=Math.floor(contactIndex/5);contact.stamp(tile,col*200,rowIndex*192);contactIndex++;
}
fs.writeFileSync(path.join(root,'.runtime/pixel-redraw/px2-candidates.json'),JSON.stringify(candidate,null,2)+'\n');await contact.save(path.join(root,'.runtime/pixel-redraw/px2-contact.png'));
console.log(JSON.stringify({candidates:Object.keys(candidate.assets).length,review:'.runtime/pixel-redraw/px2-contact.png'}));
}
