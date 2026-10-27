/** Native pixel recipes, authored against PX0 concept. Never reads the original artwork. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {checkAsset} from './check-pixel-art.mjs';
export const root=path.resolve(fileURLToPath(new URL('../..',import.meta.url))),publicRoot=path.join(root,'apps/web/public');
export const candidateRoot=path.join(root,'.runtime/pixel-redraw/candidates');
const palette=JSON.parse(fs.readFileSync(path.join(root,'packages/asset-manifest/pixel-palette.json'),'utf8'));
export const ramps=palette.ramps;
export class Pixels{
 constructor(w,h){this.width=w;this.height=h;this.data=Buffer.alloc(w*h*4);}
 dot(x,y,color){x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=this.width||y>=this.height)return;const i=(y*this.width+x)*4;if(color===null){this.data[i+3]=0;return;}const rgb=Buffer.from(color.slice(1),'hex');rgb.copy(this.data,i);this.data[i+3]=255;}
 rect(x,y,w,h,c){for(let py=Math.round(y);py<Math.round(y+h);py++)for(let px=Math.round(x);px<Math.round(x+w);px++)this.dot(px,py,c);}
 poly(points,c){
  const lo=Math.max(0,Math.floor(Math.min(...points.map(p=>p[1])))),hi=Math.min(this.height-1,Math.ceil(Math.max(...points.map(p=>p[1]))));
  for(let y=lo;y<=hi;y++){const cuts=[];for(let i=0,j=points.length-1;i<points.length;j=i++){
   const a=points[i],b=points[j];if((a[1]>y+.5)!==(b[1]>y+.5))cuts.push(a[0]+(y+.5-a[1])*(b[0]-a[0])/(b[1]-a[1]));
  }cuts.sort((a,b)=>a-b);for(let i=0;i<cuts.length;i+=2)for(let x=Math.ceil(cuts[i]-.5);x<cuts[i+1]-.5;x++)this.dot(x,y,c);}
 }
 stamp(src,ox,oy){for(let y=0;y<src.height;y++)for(let x=0;x<src.width;x++){const i=(y*src.width+x)*4;if(src.data[i+3]){const dx=x+ox,dy=y+oy;if(dx>=0&&dy>=0&&dx<this.width&&dy<this.height)src.data.copy(this.data,(dy*this.width+dx)*4,i,i+4);}}}
 async save(file){fs.mkdirSync(path.dirname(file),{recursive:true});await sharp(this.data,{raw:{width:this.width,height:this.height,channels:4}}).png().toFile(file);}
}
/** Explicit pose silhouettes: no rotated/scaled source pieces or procedural image filters. */
export function person(kind,action,frame,{bodyOnly=false,frameSize=64,bodyHeight=48,anchor=[32,60]}={}){
 const p=new Pixels(frameSize,frameSize),{ink,skin,navy,wood,copper,leaf}=ramps;
 if(frameSize!==64||bodyHeight!==48||anchor[0]!==32||anchor[1]!==60){const rect=p.rect.bind(p),poly=p.poly.bind(p),s=bodyHeight/48,point=([x,y])=>[anchor[0]+(x-32)*s,anchor[1]+(y-60)*s];p.rect=(x,y,w,h,c)=>{const [a,b]=point([x,y]);rect(a,b,w*s,h*s,c);};p.poly=(points,c)=>poly(points.map(point),c);}
 const bob=action==='move'?[0,-1,-2,-1,0,1][frame]:action==='idle'?[0,0,-1,0][frame]:0;
 const x=action==='attack'?[0,-1,-2,2,1,0][frame]:action==='hurt'?-2:0,y=bob;
 const r=(a,b,w,h,c)=>p.rect(a+x,b+y,w,h,c),q=(points,c)=>p.poly(points.map(([a,b])=>[a+x,b+y]),c);
 const cloth=kind==='goblin'?leaf:kind==='dusk'?ramps.arcane:navy;
 const dying=action==='death'&&frame>=3;
 if(dying){
  const drop=frame===3?4:frame===4?8:12;
  p.poly([[13,48+drop/2],[20,40+drop],[36,42+drop],[48,55],[46,59],[17,59]],ink[0]);
  p.poly([[17,50+drop/2],[24,45+drop],[35,46+drop],[43,56],[18,56]],cloth[2]);
  p.rect(39,50,9,8,skin[2]);p.rect(40,50,6,4,skin[4]);p.rect(44,49,6,3,ink[1]);
  p.rect(15,56,8,4,wood[1]);p.rect(8,54,11,3,wood[2]);return p;
 }
 // Boots and six distinct walking leg positions.
 const stride=action==='move'?[-3,-1,2,4,2,-1][frame]:action==='attack'&&frame>=3?3:0;
 p.poly([[22-stride,42+y],[29-stride,42+y],[29-stride,57],[32-stride,58],[32-stride,60],[21-stride,60]],ink[0]);
 p.rect(23-stride,44+y,5,11,wood[1]);p.rect(23-stride,56,8,3,wood[2]);
 p.poly([[31+stride,42+y],[37+stride,42+y],[38+stride,55],[42+stride,58],[42+stride,60],[31+stride,60]],ink[0]);
 p.rect(32+stride,44+y,4,10,wood[2]);p.rect(33+stride,55,6,3,wood[3]);
 // Cape, tunic, belt and collar, with one light cluster on the left shoulder.
 q([[22,26],[34,26],[37,34],[35,47],[19,47],[15,43],[19,32]],ink[0]);
 q([[21,28],[27,29],[23,42],[18,44],[19,35]],cloth[1]);
 q([[26,25],[35,26],[39,32],[37,45],[24,45],[22,34]],cloth[1]);
 q([[26,27],[32,27],[34,36],[27,40],[24,34]],cloth[2]);r(25,28,4,2,cloth[4]);
 r(24,41,14,3,wood[1]);r(31,41,3,3,copper[3]);r(32,41,2,1,copper[5]);
 // Head: 15 pixels high, top at 12, feet at 59 => 48 pixel silhouette.
 q([[25,12],[34,12],[38,16],[39,20],[42,21],[41,24],[38,24],[37,28],[29,28],[25,24]],ink[0]);
 q([[28,16],[36,16],[37,20],[40,21],[38,22],[37,26],[30,26],[27,23]],kind==='goblin'?leaf[3]:skin[3]);
 r(28,17,5,5,kind==='goblin'?leaf[4]:skin[4]);r(36,20,2,2,ink[0]);r(36,22,2,1,skin[2]);
 q([[24,13],[28,12],[35,12],[38,15],[36,18],[32,16],[29,20],[26,18],[25,23],[23,20]],kind==='dusk'?ink[3]:ink[0]);
 q([[25,14],[29,12],[34,13],[32,15],[27,17]],kind==='dusk'?ink[5]:navy[2]);
 if(kind==='captain'){
  q([[22,15],[24,12],[34,12],[38,14],[39,17],[23,17]],navy[0]);r(24,14,16,2,copper[3]);
  q([[28,23],[34,24],[39,23],[38,31],[33,34],[28,29]],ink[2]);q([[29,24],[34,25],[38,24],[35,30],[32,29]],ink[5]);
  r(26,31,2,3,copper[3]);r(26,36,2,3,copper[3]);r(32,33,9,10,wood[1]);r(33,34,7,7,wood[3]);
 }else if(kind==='goblin'){
  q([[25,17],[16,12],[20,21],[26,23]],leaf[0]);q([[23,18],[19,15],[22,20]],leaf[3]);r(36,20,2,1,fireColor());
 }
 // Guard arm is redrawn in each gesture. Weapon silhouettes are pixel polygons.
 const high=['attack','skill','projectile'].includes(action)&&frame<3;
 q(high?[[29,29],[32,26],[36,29],[38,22],[41,24],[39,34],[35,36]]:[[29,30],[33,29],[36,35],[41,34],[43,37],[37,40],[32,38]],ink[0]);
 q(high?[[31,29],[33,28],[37,31],[39,24],[40,25],[38,33],[35,34]]:[[31,31],[33,31],[36,37],[41,36],[41,38],[36,38],[33,36]],wood[2]);
 if(kind!=='captain'&&!bodyOnly){
  const poses=high?[[[37,26],[36,22],[42,7],[44,7],[43,24]],[[38,26],[37,22],[33,5],[35,4],[40,21]],[[39,28],[38,23],[26,8],[28,6],[41,22]]]:[[[40,37],[44,32],[59,27],[60,29],[46,36]],[[40,37],[44,31],[58,22],[60,23],[46,35]],[[40,37],[44,33],[60,32],[61,34],[46,37]]];
  const poly=poses[['idle','move','hurt'].includes(action)?0:frame%3];p.poly(poly.map(([a,b])=>[a+x,b+y]),copper[0]);
  const core=poly.slice(0,4).map(([a,b],i)=>[a+x+(i<2?1:0),b+y+1]);p.poly(core,copper[3]);
  p.rect(40+x,35+y,3,3,skin[4]);
 }
 return p;
}
const fireColor=()=>ramps.fire[4];
export function forge(){const p=new Pixels(32,40),{wood,ink,copper}=ramps;
 p.rect(3,4,4,33,wood[0]);p.rect(25,4,4,33,wood[0]);p.rect(4,5,2,30,wood[3]);p.rect(26,5,2,30,wood[2]);
 p.rect(2,5,28,5,wood[0]);p.rect(3,6,26,2,wood[3]);p.rect(4,6,5,1,wood[4]);
 p.rect(1,36,9,3,wood[2]);p.rect(23,36,8,3,wood[1]);p.rect(7,32,19,4,wood[0]);p.rect(8,32,17,2,wood[3]);
 p.rect(8,8,2,6,ink[1]);p.rect(7,14,4,5,ink[0]);p.rect(8,14,2,4,ink[3]);p.rect(8,19,1,12,wood[2]);
 p.rect(15,9,1,7,ink[2]);p.poly([[13,16],[14,22],[16,24],[18,22],[19,16],[17,17],[17,21],[15,21],[15,17]],ink[2]);
 p.rect(22,9,1,9,ink[2]);p.rect(21,18,3,7,ink[3]);p.rect(22,25,1,5,wood[2]);p.rect(5,9,2,2,copper[3]);return p;}
export function dock(){const p=new Pixels(24,48),{wood,ink,copper,fire}=ramps;
 p.rect(9,3,5,42,wood[0]);p.rect(10,4,2,38,wood[3]);p.rect(8,44,8,3,ink[1]);p.rect(8,44,4,2,ink[3]);
 p.rect(5,8,14,3,wood[0]);p.rect(6,8,12,1,wood[4]);p.rect(18,9,2,8,ink[0]);p.rect(17,16,4,3,copper[2]);
 p.poly([[15,20],[22,20],[23,24],[23,33],[21,36],[16,36],[14,33],[14,24]],ink[0]);
 p.rect(16,23,5,10,copper[3]);p.rect(17,24,3,8,fire[4]);p.rect(18,24,1,7,fire[5]);p.rect(15,26,7,1,wood[0]);p.rect(15,32,7,2,wood[0]);
 for(let y=35;y<43;y+=3){p.rect(8,y,7,2,copper[2]);p.rect(8,y,4,1,copper[4]);}return p;}
export function post(){const p=new Pixels(24,40),{wood,navy,copper}=ramps;
 p.rect(3,12,3,26,wood[0]);p.rect(19,12,3,26,wood[0]);p.rect(4,13,1,24,wood[3]);p.rect(20,13,1,24,wood[2]);
 p.poly([[1,13],[6,6],[19,6],[23,13],[22,16],[2,16]],navy[0]);p.poly([[3,12],[7,7],[18,7],[21,12]],navy[2]);p.rect(5,10,14,1,navy[3]);
 p.rect(6,19,13,14,wood[0]);p.rect(7,20,11,11,wood[3]);p.rect(8,21,9,1,wood[4]);
 p.poly([[9,28],[15,23],[15,28]],navy[0]);p.rect(8,28,9,1,navy[0]);p.rect(7,33,12,2,copper[2]);return p;}
export function tree(){const p=new Pixels(88,88),{leaf,wood}=ramps;
 p.poly([[37,58],[49,58],[51,80],[63,85],[59,87],[27,87],[26,85],[36,81]],wood[0]);p.poly([[40,62],[45,61],[44,81],[37,85],[32,85],[40,80]],wood[3]);
 for(const [x,y,w] of [[44,2,12],[43,15,21],[45,31,31],[43,48,39]]){
  p.poly([[x,y],[x-w,y+20],[x-w+5,y+22],[x-w-3,y+25],[x-5,y+21],[x+5,y+25],[x+w,y+20],[x+w-8,y+18]],leaf[0]);
  p.poly([[x,y+2],[x-w+4,y+19],[x-7,y+17],[x+3,y+22],[x+w-4,y+20],[x+7,y+13]],leaf[1]);
  p.poly([[x-1,y+3],[x-w+7,y+17],[x-7,y+14],[x+2,y+19],[x+5,y+14]],leaf[2]);
  p.poly([[x-1,y+5],[x-10,y+14],[x-4,y+12],[x-2,y+15],[x+1,y+12]],leaf[3]);
 }p.data[(39*88+20)*4+3]=0;return p;}
export function rock(small=false){const p=new Pixels(small?40:64,small?32:56),{earth,ink}=ramps;const w=p.width,h=p.height;
 p.poly([[2,h-5],[8,h-18],[w*.3,8],[w*.55,4],[w*.8,14],[w-3,h-14],[w-1,h-5],[w*.65,h-1],[w*.2,h-1]],ink[0]);
 p.poly([[4,h-6],[10,h-18],[w*.31,10],[w*.55,6],[w*.8,16],[w-5,h-13],[w-3,h-6],[w*.6,h-3]],earth[2]);
 p.poly([[10,h-18],[w*.31,10],[w*.55,6],[w*.67,12],[w*.5,16],[w*.33,17],[w*.29,h-20]],earth[4]);
 p.poly([[w*.55,17],[w*.68,13],[w*.8,17],[w-5,h-12],[w*.7,h-9]],earth[1]);p.poly([[w*.32,11],[w*.52,8],[w*.56,10],[w*.39,13]],earth[5]);return p;}
export function tile(kind,mask=15){const p=new Pixels(16,16),{earth,wood,water}=ramps;
 p.rect(0,0,16,16,kind==='water'?water[1]:kind==='plank'?wood[1]:earth[1]);
 if(kind==='cobble')for(let y=0;y<16;y+=4)for(let x=(y%8?-4:0);x<16;x+=8){p.rect(x+1,y+1,6,3,earth[3]);p.rect(x+1,y+1,5,1,earth[4]);p.rect(x+5,y+2,2,2,earth[2]);}
 if(kind==='plank')for(let y=0;y<16;y+=4){p.rect(0,y+1,16,3,wood[2]);p.rect(0,y+1,16,1,wood[3]);p.rect(y%8?3:11,y+2,2,1,wood[0]);}
 if(kind==='water'){p.rect(0,3,7,1,water[2]);p.rect(8,11,8,1,water[2]);p.rect(4,4,4,1,water[3]);p.rect(9,10,3,1,water[3]);}
 // Wang edges use one shared four-bit convention N/E/S/W for every terrain.
 if(!(mask&1))p.rect(0,0,16,1,earth[0]);if(!(mask&2))p.rect(15,0,1,16,earth[0]);if(!(mask&4))p.rect(0,15,16,1,earth[0]);if(!(mask&8))p.rect(0,0,1,16,earth[0]);return p;}
export function frameTimes(count,duration,impactTime){
 const hit=impactTime===0?0:Math.max(1,Math.min(count-1,Math.round(impactTime/duration*count)));
 const times=Array.from({length:count},(_,i)=>impactTime===0?duration*i/count:i<=hit?impactTime*i/hit:impactTime+(duration-impactTime)*(i-hit)/(count-hit));return {impactFrame:hit,frameTimes:times};
}
export function authoredPose(action,index,timing){
 if(!['attack','skill','projectile'].includes(action)||!timing.impactFrame)return index;
 const hit=timing.impactFrame;return index<hit?Math.min(2,Math.floor(index*3/hit)):Math.min(5,3+index-hit);
}
export function poseSockets(action,index){
 const bob=action==='move'?[0,-1,-2,-1,0,1][index]:action==='idle'?[0,0,-1,0][index]:0;
 const dx=action==='attack'?[0,-1,-2,2,1,0][index]:action==='hurt'?-2:0;
 const high=['attack','skill','projectile'].includes(action)&&index<3;
 const tip=high?[[44,7],[35,4],[28,6]][index%3]:[[60,29],[60,23],[61,34]][['idle','move','hurt'].includes(action)?0:index%3];
 if(action==='death'&&index>=3)return{feet:[32,60],chest:[31,55],hand:[43,54],weapon:[15,55],muzzle:[15,55]};
 return{feet:[32,60],chest:[31+dx,31+bob],hand:[(high?40:41)+dx,(high?26:36)+bob],weapon:[tip[0]+dx,tip[1]+bob],muzzle:[tip[0]+dx,tip[1]+bob]};
}
export async function approve(key,pixels,{file,original,batch='PX0',kind='image',frame=[pixels.width,pixels.height],anchor=[Math.floor(frame[0]/2),frame[1]-1],actions,recipe,shadow,upstream}={},manifest){
 if(typeof file!=='string'||!/^\/art-pixel\/[a-zA-Z0-9_./-]+\.(png|webp)$/.test(file)||file.includes('..'))throw Error('Unsafe pixel output path');
 const target=path.join(candidateRoot,file);await pixels.save(target);
 const asset={file,original,batch,kind,frame,anchor,scale:2,...(actions?{actions}:{}),...(shadow?{shadow:true}:{}),provenance:{method:upstream?'adapted-pixels':'authored-pixels',...(upstream?{upstream}:{}),recipe:recipe??`tools/pixel/px0-art.mjs#${key}`,reviewed:false},sha256:createHash('sha256').update(fs.readFileSync(target)).digest('hex')};
 // Candidate assets remain outside manifest until individual visual review.
 const result=await checkAsset({...asset,provenance:{...asset.provenance,reviewed:true}},{publicRoot:candidateRoot});if(result.length)throw Error(key+': '+JSON.stringify(result));
 manifest.assets[key]=asset;return asset;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const manifest={schemaVersion:1,stage:[1280,720],canvas:[640,360],palette:'/art-pixel/palette.json',assets:{}};
 const spec=[['idle',4],['move',6],['attack',6],['skill',6],['projectile',6],['hurt',2],['death',6]];
 const source=JSON.parse(fs.readFileSync(path.join(publicRoot,'art/wardrobe/poses/sword.json'),'utf8'));
 for(const [key,paint,original,file] of [
  ['ss-scene-build-forge-1',forge,'/art/hub-port/build-forge-1.png','/art-pixel/hub-port/build-forge-1.png'],
  ['ss-scene-build-dock-1',dock,'/art/hub-port/build-dock-1.png','/art-pixel/hub-port/build-dock-1.png'],
  ['ss-scene-build-post-1',post,'/art/hub-port/build-post-1.png','/art-pixel/hub-port/build-post-1.png'],
  ['ss-scene-tree',tree,'/art/starsea/scenes/sprites/oak.png','/art-pixel/starsea/scenes/sprites/oak.png'],
  ['ss-scene-rocks',rock,'/art/starsea/scenes/sprites/rocks.png','/art-pixel/starsea/scenes/sprites/rocks.png'],
  ['ss-scene-rocks:small',()=>rock(true),'/art/starsea/scenes/sprites/rocks.png#small','/art-pixel/starsea/scenes/sprites/rocks-small.png'],
 ])await approve(key,paint(),{file,original:[original]},manifest);
 const sheet=new Pixels(64*6,64*7),actions={};
 for(let row=0;row<spec.length;row++){
  const [action,count]=spec[row],s=source.actions[action],timing=frameTimes(count,s.duration,s.impactTime);
  const sockets=[];for(let i=0;i<count;i++){const pose=authoredPose(action,i,timing);sheet.stamp(person('hero',action,pose),i*64,row*64);sockets.push(poseSockets(action,pose));}
  actions[action]={row,count,duration:s.duration,impactTime:s.impactTime,...frameTimes(count,s.duration,s.impactTime),sockets};
 }
 await approve('hero:sword:wardrobe',sheet,{file:'/art-pixel/wardrobe/poses/sword.png',original:['/art/wardrobe/poses/sword.json'],kind:'actor',frame:[64,64],anchor:[32,60],actions},manifest);
 const starsea=JSON.parse(fs.readFileSync(path.join(root,'packages/asset-manifest/starsea.v1.json'),'utf8'));
 const maxTime=value=>value&&typeof value==='object'?Math.max(0,...Object.entries(value).map(([k,v])=>k==='time'&&typeof v==='number'?v:maxTime(v))):0;
 const profile=JSON.parse(fs.readFileSync(path.join(publicRoot,'art/mini-hero/navy/profile.json'),'utf8'));
 const skeleton=JSON.parse(fs.readFileSync(path.join(publicRoot,profile.runtime.json),'utf8'));
 const nativeMap={idle:['Wait1',0],move:['Run1',0],attack:['Attack_OneHand1',.35],skill:['Attack_OneHand2',.4],projectile:['Attack_OneHand1',.35],hurt:['Damage1',0],death:['Die',0]};
 const nativeActions=Object.fromEntries(Object.entries(actions).map(([name,a])=>{const [clip,impactTime]=nativeMap[name],duration=maxTime(skeleton.animations[clip]);return[name,{...a,duration,impactTime,...frameTimes(a.count,duration,impactTime)}];}));
 const nativeSheet=new Pixels(64*6,64*7);for(const [name,a] of Object.entries(nativeActions))for(let i=0;i<a.count;i++){const pose=authoredPose(name,i,a);nativeSheet.stamp(person('hero',name,pose),i*64,a.row*64);a.sockets[i]=poseSockets(name,pose);}
 await approve('hero:sword:native',nativeSheet,{file:'/art-pixel/mini-hero/navy/sword.png',original:['/art/mini-hero/navy/profile.json'],kind:'actor',frame:[64,64],anchor:[32,60],actions:nativeActions},manifest);
 for(const [id,kind] of [['ss-npc-cheng','captain'],['ss-mon-dusk-blade','dusk']]){
  const source=starsea.assets.find(a=>a.id===id),entries=id==='ss-npc-cheng'?[['idle',4],['move',6]]:spec;
  const sheet=new Pixels(64*6,64*entries.length),clips={};
  for(let row=0;row<entries.length;row++){
   const [name,count]=entries[row],motion=source.runtime.actions?.[name]??source.actions[name];if(!motion)continue;
   const duration=motion.duration,impactTime=motion.impactTime??0,sockets=[];
   for(let i=0;i<count;i++){const pose=authoredPose(name,i,frameTimes(count,duration,impactTime));sheet.stamp(person(kind,name,pose),i*64,row*64);sockets.push(poseSockets(name,pose));}
   clips[name]={row,count,duration,impactTime,...frameTimes(count,duration,impactTime),sockets};
  }
  await approve(id,sheet,{file:`/art-pixel/starsea/${id==='ss-npc-cheng'?'npc':'monsters'}/${id}/actor.png`,original:[source.runtime.image??source.runtime.profile],kind:'actor',frame:[64,64],anchor:[32,60],actions:clips},manifest);
 }
 const tiles=new Pixels(16*16,16*3);for(let row=0;row<3;row++)for(let mask=0;mask<16;mask++)tiles.stamp(tile(['cobble','plank','water'][row],mask),mask*16,row*16);
 await approve('px0:harbor-wang',tiles,{file:'/art-pixel/starsea/scenes/textures/port-wang.png',original:['/art/starsea/scenes/textures/road.png'],kind:'tiles',frame:[16,16],anchor:[0,0]},manifest);
 manifest.assets['ss-scene-rocks'].variants=[{maxWidth:90,key:'ss-scene-rocks:small'}];
 const paletteImage=new Pixels(10*8,6*8);Object.values(ramps).flat().forEach((c,i)=>paletteImage.rect(i%10*8,Math.floor(i/10)*8,8,8,c));await paletteImage.save(path.join(publicRoot,'art-pixel/palette.png'));
 fs.writeFileSync(path.join(publicRoot,'art-pixel/palette.json'),JSON.stringify(palette,null,2)+'\n');
 fs.mkdirSync(path.join(root,'.runtime/pixel-redraw'),{recursive:true});fs.writeFileSync(path.join(root,'.runtime/pixel-redraw/px0-candidates.json'),JSON.stringify(manifest,null,2)+'\n');
 const contact=new Pixels(640,240);let x=0;for(const fn of [forge,dock,post,tree,rock,()=>rock(true)]){const image=fn();contact.stamp(image,x,0);x+=image.width+12;}
 spec.forEach(([action],i)=>contact.stamp(person('hero',action,action==='attack'?3:0),i*80,100));await contact.save(path.join(root,'.runtime/pixel-redraw/px0-contact.png'));
 console.log(JSON.stringify({candidates:Object.keys(manifest.assets).length,approved:0,review:'.runtime/pixel-redraw/px0-contact.png'}));
}
