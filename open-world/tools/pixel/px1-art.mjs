import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Pixels,ramps,person,frameTimes,authoredPose,poseSockets,approve,root,publicRoot} from './px0-art.mjs';
import {nativeKit} from '../../apps/web/src/native-kit.ts';
import {heroAnimationFrame} from '../../apps/web/src/effect-attachments.ts';
const spec=[['idle',4],['move',6],['attack',6],['skill',6],['projectile',6],['hurt',2],['death',6]];
const weapons=['sword','hammer','axe','bow','staff','hidden','wand'];
const legacyFamily={sword:'sword',hammer:'axe',axe:'axe',bow:'bow',staff:'magic',hidden:'fist',wand:'magic'};
const maxTime=v=>v&&typeof v==='object'?Math.max(0,...Object.entries(v).map(([k,n])=>k==='time'&&typeof n==='number'?n:maxTime(n))):0;
const wardrobe=JSON.parse(fs.readFileSync(path.join(root,'packages/asset-manifest/wardrobe.json'),'utf8'));
const profile=JSON.parse(fs.readFileSync(path.join(publicRoot,'art/mini-hero/navy/profile.json'),'utf8'));
const skeleton=JSON.parse(fs.readFileSync(path.join(publicRoot,profile.runtime.json),'utf8'));
/** Every orientation is an integer polygon drawn on the native 64px frame. */
function held(type,action,pose){
 const p=new Pixels(64,64),{ink,wood,copper,arcane,leaf}=ramps;
 const sockets=poseSockets(action,pose),high=['attack','skill','projectile'].includes(action)&&pose<3;
 const hand=sockets.hand,tip=sockets.weapon;
 if(action==='death'&&pose>=3){p.rect(9,57,22,2,wood[2]);p.rect(10,57,7,1,ink[4]);return{pixels:p,sockets:{...sockets,weapon:[10,57],muzzle:[10,57]}};}
 const shaft=(start,end,color,width=2)=>{
  const [x,y]=start,[a,b]=end,dx=a-x,dy=b-y,n=Math.max(Math.abs(dx),Math.abs(dy));for(let t=0;t<=n;t++)p.rect(Math.round(x+dx*t/n),Math.round(y+dy*t/n),width,width,color);
 };
 if(type==='sword'||type==='hidden'){
  const end=type==='hidden'?[Math.round(hand[0]+(tip[0]-hand[0])*.55),Math.round(hand[1]+(tip[1]-hand[1])*.55)]:tip;
  shaft(hand,end,ink[1],3);shaft([hand[0]+1,hand[1]],end,ink[4],1);p.rect(hand[0]-1,hand[1]-2,5,2,copper[3]);
  if(type==='hidden'){p.poly([[27,34],[24,28],[25,27],[30,34]],ink[1]);p.poly([[26,29],[25,28],[29,33]],ink[4]);}
  return{pixels:p,sockets:{...sockets,weapon:end,muzzle:type==='hidden'?hand:end}};
 }
 if(type==='bow'){
  const x=high?43:50,y=high?22:33,drawn=['attack','skill','projectile'].includes(action)&&pose<3;
  p.poly([[x-3,y-13],[x+1,y-10],[x+4,y-4],[x+4,y+4],[x+1,y+10],[x-3,y+13],[x-1,y+7],[x+1,y+3],[x+1,y-3],[x-1,y-7]],wood[1]);
  p.poly([[x-3,y-12],[x,y-9],[x+2,y-3],[x+2,y+3],[x,y+9],[x-3,y+12],[x-2,y+6],[x,y+2],[x,y-2],[x-2,y-6]],wood[4]);
  shaft([x-3,y-11],[drawn?x-9:x-3,y],ink[3],1);shaft([drawn?x-9:x-3,y],[x-3,y+11],ink[3],1);
  if(drawn){p.rect(x-10,y,21,1,wood[3]);p.poly([[x+8,y-2],[x+12,y],[x+8,y+3]],ink[4]);}
  return{pixels:p,sockets:{...sockets,weapon:[x+3,y],muzzle:[x+4,y]}};
 }
 if(type==='hammer'||type==='axe'){
  const x=high?39:55,y=high?10:29;shaft([hand[0],hand[1]],[x,y],wood[0],3);shaft([hand[0],hand[1]],[x,y],wood[3],1);
  if(type==='hammer'){
   p.poly([[x-7,y-4],[x+5,y-4],[x+8,y-1],[x+8,y+5],[x-5,y+5],[x-7,y+2]],ink[0]);
   p.rect(x-5,y-3,9,6,ink[2]);p.rect(x-5,y-3,9,2,ink[4]);p.rect(x+4,y-1,3,5,ink[1]);p.rect(x-1,y-3,2,7,copper[3]);
  }else{
   p.poly([[x-6,y-5],[x-2,y-3],[x+2,y-4],[x+7,y-7],[x+7,y+6],[x+3,y+8],[x-1,y+4],[x-5,y+3]],ink[0]);
   p.poly([[x-4,y-3],[x-1,y-1],[x+3,y-2],[x+6,y-5],[x+6,y+5],[x+3,y+6],[x,y+2],[x-3,y+2]],ink[3]);
   p.poly([[x+5,y-3],[x+6,y-4],[x+6,y+5],[x+3,y+6],[x+4,y+3]],ink[5]);
  }return{pixels:p,sockets:{...sockets,weapon:[x+6,y],muzzle:[x+6,y]}};
 }
 const x=high?39:51,y=high?9:20,short=type==='wand';shaft(hand,[x,y+4],wood[0],3);shaft(hand,[x,y+4],wood[3],1);
 const gem=type==='staff'?arcane:leaf;
 p.poly([[x,y-5],[x+5,y],[x+3,y+5],[x-3,y+5],[x-5,y]],gem[0]);p.poly([[x,y-3],[x+3,y],[x+1,y+3],[x-2,y+2],[x-3,y]],gem[3]);p.rect(x-1,y-2,2,2,gem[5]);
 if(!short){p.rect(x-5,y+4,11,2,copper[3]);shaft([hand[0],hand[1]],[hand[0]-7,55],wood[2],2);}
 return{pixels:p,sockets:{...sockets,weapon:[x,y],muzzle:[x,y]}};
}
/** Additional head silhouettes remain a separate frame layer. */
function outfitOverlay(set,action,pose){
 const p=new Pixels(64,64),i=wardrobe.shippedSets.indexOf(set),{navy,leaf,arcane,fire,wood,copper}=ramps;
 if(action==='death'&&pose>=3)return p;
 const y=(action==='move'?[0,-1,-2,-1,0,1][pose]:action==='idle'?[0,0,-1,0][pose]:0),x=action==='attack'?[0,-1,-2,2,1,0][pose]:action==='hurt'?-2:0;
 const rect=(a,b,w,h,c)=>p.rect(a+x,b+y,w,h,c),poly=(pts,c)=>p.poly(pts.map(([a,b])=>[a+x,b+y]),c);
 if(['100031','200331'].includes(set)){const c=set==='100031'?leaf:arcane;poly([[21,17],[24,14],[29,12],[33,14],[37,17],[39,19]],c[0]);poly([[24,16],[29,13],[31,15],[36,17]],c[2]);rect(22,18,16,2,c[3]);}
 if(['100102','400106'].includes(set)){poly([[22,17],[23,12],[28,14],[33,11],[38,15],[37,19]],wood[0]);rect(24,15,12,3,fire[2]);rect(27,15,3,2,copper[3]);}
 if(['100041','200291'].includes(set)){const c=set==='100041'?navy:wood;poly([[24,16],[21,17],[19,25],[22,31],[25,29],[24,23]],c[1]);poly([[25,17],[23,20],[22,27],[24,25]],c[4]);rect(20,17,3,2,fire[2]);}
 if(['200311','300601','400104','400108'].includes(set)){const c=set==='400104'?leaf:arcane;poly([[21,29],[17,31],[14,45],[20,47],[23,41],[22,35]],c[0]);poly([[20,31],[18,34],[16,44],[19,44],[21,39]],c[2]);}
 return p;
}
const candidate={schemaVersion:1,stage:[1280,720],canvas:[640,360],palette:'/art-pixel/palette.json',assets:{},appearances:{}};
const contact=new Pixels(7*128,7*64);
const renderTypes=[...weapons,'gun','fist','spear','magic','sword-twohand'];
for(let w=0;w<renderTypes.length;w++){
 const renderType=renderTypes[w],type=({gun:'hidden',fist:'hidden',spear:'staff',magic:'staff','sword-twohand':'sword'})[renderType]??renderType;
 for(const mode of (renderType==='sword-twohand'?['native']:w>=weapons.length?['wardrobe']:['native','wardrobe'])){
  const extra=(type==='staff'||type==='wand')?[['spear:attack',6],['spear:skill',6],['spear:projectile',6]]:[],allSpec=[...spec,...extra],body=new Pixels(384,64*allSpec.length),weapon=new Pixels(384,64*allSpec.length),full=new Pixels(384,64*allSpec.length),actions={};
  const family=wardrobe.motions[renderType]?renderType:legacyFamily[type],source=mode==='wardrobe'?JSON.parse(fs.readFileSync(path.join(publicRoot,wardrobe.motions[family].url),'utf8')):undefined;
  const native=nativeKit({weapon:{type,series:'standard',tier:1},armor:null});
  const spear=extra.length&&mode==='wardrobe'?JSON.parse(fs.readFileSync(path.join(publicRoot,wardrobe.motions.spear.url),'utf8')):undefined;
  const twoHand=nativeKit({weapon:{type:'hammer',series:'standard',tier:1},armor:null});
  for(let row=0;row<allSpec.length;row++){
   const [name,count]=allSpec[row],action=name.split(':').at(-1),isSpear=name.startsWith('spear:'),motion=(isSpear?spear:source)?.actions[action],nativeMotion=isSpear?twoHand.actions[action==='attack'?'attack':'skill']:renderType==='sword-twohand'?profile.weapons['300601'].actions[action]:native.actions[action];
   const duration=motion?.duration??maxTime(skeleton.animations[nativeMotion.name]),impactTime=motion?.impactTime??nativeMotion.impactTime??0,timing=frameTimes(count,duration,impactTime),sockets=[],poses=[];
   for(let i=0;i<count;i++){
    const pose=authoredPose(action,i,timing),b=person('hero',action,pose,{bodyOnly:true}),heldPart=held(type,action,pose);poses.push(pose);
    body.stamp(b,i*64,row*64);weapon.stamp(heldPart.pixels,i*64,row*64);full.stamp(b,i*64,row*64);full.stamp(heldPart.pixels,i*64,row*64);sockets.push(heldPart.sockets);
    if(mode==='native'&&w<7&&row<7&&i===timing.impactFrame){contact.stamp(b,w*128,row*64);contact.stamp(heldPart.pixels,w*128,row*64);}
   }
   actions[name]={row,count,duration,impactTime,...timing,sockets,poses,overlayRow:spec.findIndex(([n])=>n===action)};
  }
  const prefix=`/art-pixel/hero/${mode}/${renderType}`,key=`hero:${renderType}:${mode}`;
  const bodyKey=key+':body',weaponKey=key+':weapon';
  await approve(bodyKey,body,{file:prefix+'-body.png',original:[],batch:'PX1',frame:[64,64],anchor:[32,60]},candidate);
  await approve(weaponKey,weapon,{file:prefix+'-weapon.png',original:[],batch:'PX1',frame:[64,64],anchor:[32,60]},candidate);
  await approve(key,full,{file:prefix+'.png',original:mode==='native'?[profile.runtime.json,`/art/mini-hero/navy/profile.json#weapon:${renderType}`]:[wardrobe.motions[family].url],batch:'PX1',kind:'actor',frame:[64,64],anchor:[32,60],actions},candidate);
  candidate.assets[key].layers=[bodyKey,weaponKey];
 }
}
const cloth=['fire','leaf','navy','ink','leaf','water','arcane','navy','arcane','copper','navy','ink','leaf','fire','fire','arcane'];
// The boot atlas remains loadable for immediate fallback while an outfit decodes.
const boot=JSON.parse(fs.readFileSync(path.join(root,'packages/asset-manifest/catalog.json'),'utf8')).actors.hero;
const bootSheet=new Pixels(384,448),bootActions={};let bootRow=0;
for(const [action,sourceCount] of Object.entries(boot.actions)){
 const name=action==='win'?'idle':action,count=spec.find(([n])=>n===name)?.[1]??4,duration=sourceCount/boot.fps,impactTime=action==='attack'||action==='skill'?heroAnimationFrame(action,1,1,1)/boot.fps:0,timing=frameTimes(count,duration,impactTime),sockets=[];
 for(let i=0;i<count;i++){const pose=authoredPose(name,i,timing),body=person('hero',name,pose,{bodyOnly:true}),weapon=held('sword',name,pose);bootSheet.stamp(body,i*64,bootRow*64);bootSheet.stamp(weapon.pixels,i*64,bootRow*64);sockets.push(weapon.sockets);}
 bootActions[action]={row:bootRow++,count,duration,impactTime,...timing,sockets};
}
await approve('hero',bootSheet,{file:'/art-pixel/hero.png',original:['/art/hero.png'],batch:'PX1',kind:'actor',frame:[64,64],anchor:[32,60],actions:bootActions},candidate);
const hair=['wood','leaf','navy','wood','fire','copper','wood','arcane','water','wood','navy','fire','arcane','navy','wood','wood'];
const overlayContact=new Pixels(16*64,128);
for(let index=0;index<wardrobe.shippedSets.length;index++){
 const set=wardrobe.shippedSets[index],overlay=new Pixels(384,448);
 for(let row=0;row<spec.length;row++){const [action,count]=spec[row];for(let i=0;i<count;i++)overlay.stamp(outfitOverlay(set,action,i),i*64,row*64);}
 const key=`wardrobe:${set}`;
 // Sets without a silhouette addition still get their explicit ramp mapping; use the shared body as the referenced image.
 let overlayKey;
 if(overlay.data.some((v,i)=>i%4===3&&v)){
  overlayKey=key+':overlay';await approve(overlayKey,overlay,{file:`/art-pixel/wardrobe/sets/${set}/overlay.png`,original:[],batch:'PX1',frame:[64,64],anchor:[32,60]},candidate);
 }
 const body=candidate.assets['hero:sword:wardrobe:body'];candidate.assets[key]={...body,original:Object.values(wardrobe.partSlots).flat().map(part=>wardrobe.setUrlTemplate.replace('{setId}',set).replace('{part}',part)),recolor:{cloth:ramps[cloth[index]],hair:ramps[hair[index]]},...(overlayKey?{overlay:overlayKey}:{})};
 candidate.appearances[set]={cloth:ramps[cloth[index]],hair:ramps[hair[index]],...(overlayKey?{overlay:overlayKey}:{})};
 const sample=person('hero','idle',0,{bodyOnly:true});overlayContact.stamp(sample,index*64,0);overlayContact.stamp(outfitOverlay(set,'idle',0),index*64,0);
}
fs.writeFileSync(path.join(root,'.runtime/pixel-redraw/px1-candidates.json'),JSON.stringify(candidate,null,2)+'\n');
await contact.save(path.join(root,'.runtime/pixel-redraw/px1-weapons-contact.png'));await overlayContact.save(path.join(root,'.runtime/pixel-redraw/px1-overlays-contact.png'));
console.log(JSON.stringify({candidates:Object.keys(candidate.assets).length,approved:0,weapons:weapons.length}));
