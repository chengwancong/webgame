import fs from 'node:fs';
import path from 'node:path';
import {runtimeResources} from '../../packages/asset-manifest/runtime-resources.ts';
import {Pixels,ramps,person,frameTimes,poseSockets,root,publicRoot,approve} from './px0-art.mjs';
import {nativeClips} from './px4-art.mjs';
const {navy,wood,ink,earth,copper,water,leaf,arcane,fire,skin}=ramps;
const styles={cheng:{cloth:navy,hair:navy,role:'captain'},milo:{cloth:earth,hair:wood,role:'navigator'},tongling:{cloth:earth,hair:fire,role:'smith'},qingmang:{cloth:leaf,hair:wood,role:'courier'},xuemi:{cloth:navy,hair:ink,role:'recorder'},mijia:{cloth:arcane,hair:ink,role:'translator'},jinyu:{cloth:copper,hair:wood,role:'dragon'},keeper:{cloth:earth,hair:ink,role:'keeper'},scout:{cloth:leaf,hair:wood,role:'scout'},smith:{cloth:copper,hair:fire,role:'smith'},herbalist:{cloth:leaf,hair:wood,role:'herbalist'},warden:{cloth:ink,hair:wood,role:'warden'},scholar:{cloth:arcane,hair:navy,role:'scholar'},dragonkin:{cloth:copper,hair:fire,role:'dragon'}};
/** Independent profession silhouettes; only color ramps and a common human anatomy are shared. */
export function npcFrame(style,action,index,gesture){
 const base=action==='move'?'move':action==='hurt'?'hurt':action==='death'?'death':'idle',frame=base==='idle'?index%4:base==='hurt'?index%2:index%6;
 const p=person('hero',gesture==='wave'?'skill':base,gesture==='wave'?0:frame,{bodyOnly:true}),bob=base==='move'?[0,-1,-2,-1,0,1][frame]:base==='idle'?[0,0,-1,0][frame]:0;
 for(let y=0;y<64;y++)for(let x=0;x<64;x++){
  const i=(y*64+x)*4;if(!p.data[i+3])continue;const hex='#'+p.data.subarray(i,i+3).toString('hex'),n=navy.indexOf(hex);if(n>=0){const color=y<24?style.hair[Math.min(5,n+1)]:style.cloth[n],rgb=Buffer.from(color.slice(1),'hex');rgb.copy(p.data,i);}
  if(style.role==='translator'){const n=skin.indexOf(hex);if(n>=0&&y<29)Buffer.from(arcane[Math.min(5,n+1)].slice(1),'hex').copy(p.data,i);}
 }
 if(base==='death'&&frame>=3)return p;
 const dx=base==='hurt'?-2:0,r=(x,y,w,h,c)=>p.rect(x+dx,y+bob,w,h,c),poly=(points,c)=>p.poly(points.map(([x,y])=>[x+dx,y+bob]),c);
 poly([[24,13],[28,12],[35,12],[38,15],[36,18],[32,16],[29,20],[26,18],[25,23],[23,20]],style.hair===ink?ink[2]:style.hair[0]);
 poly([[25,14],[29,13],[34,13],[36,15],[32,15],[29,18],[26,17]],style.hair===ink?ink[4]:style.hair[3]);r(27,14,3,1,style.hair[5]);
 const book=(color=earth)=>{r(37,34,10,11,wood[0]);r(38,35,8,9,color[3]);r(39,36,5,1,color[5]);r(38,42,8,1,earth[4]);};
 if(style.role==='captain'){
  poly([[22,16],[24,12],[34,12],[38,15],[40,18],[23,18]],navy[0]);r(24,15,14,2,earth[4]);r(25,27,11,3,water[2]);r(27,30,5,5,earth[5]);r(33,40,2,3,copper[4]);book(wood);
 }
 if(['navigator','smith'].includes(style.role)){
  r(23,14,16,2,wood[1]);r(25,13,5,5,copper[1]);r(31,13,5,5,copper[1]);r(26,14,3,3,water[3]);r(32,14,3,3,water[3]);r(26,14,1,1,water[5]);
  if(style.role==='smith'){r(25,29,12,15,wood[1]);r(26,30,8,12,wood[2]);r(28,33,4,4,earth[3]);r(40,34,2,11,wood[2]);r(38,32,8,4,ink[2]);r(38,32,7,1,ink[4]);}
  else{poly([[22,28],[28,27],[36,30],[34,34],[23,32]],copper[2]);r(32,40,5,5,copper[3]);r(33,41,3,3,navy[1]);if(!gesture)book(earth);}
 }
 if(['courier','herbalist','scout'].includes(style.role)){
  poly([[24,17],[21,19],[18,29],[21,36],[24,33],[23,24]],wood[1]);r(25,28,13,3,leaf[2]);r(22,31,2,13,wood[3]);r(18,39,9,9,wood[0]);r(19,40,7,5,wood[2]);
  if(style.role==='courier'){r(39,34,7,6,earth[4]);poly([[39,35],[43,38],[46,35]],wood[2]);poly([[29,15],[29,12],[35,13],[33,16]],leaf[3]);}
  if(style.role==='herbalist'){r(39,35,5,9,leaf[1]);r(40,33,3,3,leaf[4]);poly([[22,38],[17,33],[16,37],[20,40]],leaf[3]);}
  if(style.role==='scout'){poly([[47,29],[51,33],[53,39],[51,45],[47,49],[49,42],[49,35]],wood[2]);r(47,31,1,16,earth[4]);}
 }
 if(['recorder','translator','keeper','scholar'].includes(style.role)){
  if(style.role==='recorder'){poly([[25,17],[22,20],[21,29],[24,34],[27,30],[25,24]],ink[3]);poly([[24,20],[23,25],[24,30],[25,27]],ink[5]);}
  r(26,28,12,3,style.role==='translator'?arcane[1]:earth[4]);book(style.role==='translator'?arcane:navy);
  if(style.role==='scholar'){poly([[23,18],[26,14],[30,12],[36,17],[38,20]],arcane[0]);r(24,18,13,2,arcane[2]);}
  if(style.role==='keeper')r(34,37,4,5,copper[3]);
 }
 if(style.role==='dragon'){
  poly([[25,16],[22,14],[22,12],[24,13],[27,15]],ink[3]);poly([[35,16],[39,13],[40,12],[40,16],[37,18]],ink[4]);r(26,27,12,3,copper[4]);r(39,29,2,17,copper[2]);r(38,27,5,4,water[3]);r(39,27,2,1,water[5]);
 }
 if(style.role==='warden'){r(24,29,7,5,ink[2]);r(25,29,5,1,ink[4]);r(34,29,7,5,ink[1]);r(42,33,2,13,wood[2]);poly([[43,35],[47,28],[49,28],[46,37]],ink[4]);}
 if(gesture==='wave'){const wave=[0,1,0,-1,0,1][index%6];poly([[38,27],[39,22],[41+wave,15],[44+wave,15],[43,25],[41,29]],skin[3]);r(41+wave,14,3,4,skin[4]);}
 if(gesture==='point'){poly([[39,34],[46,29],[52,29],[53,31],[46,33],[42,37]],skin[3]);r(50,29,5,1,skin[4]);}
 if(gesture==='crouch'||gesture==='sit'){
  const folded=new Pixels(64,64);for(let y=48;y<64;y++)for(let x=0;x<64;x++){const i=(y*64+x)*4;if(p.data[i+3])p.data.copy(folded.data,i,i,i+4);}
  for(let y=0;y<48;y++)for(let x=0;x<64;x++){const i=(y*64+x)*4;if(p.data[i+3])p.data.copy(folded.data,((y+4)*64+x)*4,i,i+4);}
  if(gesture==='sit'){folded.poly([[26,50],[36,50],[41,54],[51,56],[51,59],[33,59],[26,56]],wood[1]);folded.rect(41,56,10,2,wood[3]);}return folded;
 }return p;
}
const candidate={schemaVersion:1,stage:[1280,720],canvas:[640,360],palette:'/art-pixel/palette.json',assets:{}};
const sources=[...runtimeResources.values()].filter(a=>a.group==='npc'||a.runtime.kind==='native'&&(a.id.startsWith('ow-npc-')||a.type==='motion')).map(a=>({id:a.id,profile:a.runtime.profile,actions:a.actions,asset:a,kit:a.source?.kit??a.source?.assetId??a.runtime.accessorySockets?.[0]?.region.split('/')[1]?.split('-')[0]??a.id.replace('ss-npc-','')}));
const story=JSON.parse(fs.readFileSync(path.join(root,'packages/asset-manifest/story-npcs.json'),'utf8'));
const maxTime=v=>v&&typeof v==='object'?Math.max(0,...Object.entries(v).map(([k,n])=>k==='time'&&typeof n==='number'?n:maxTime(n))):0;
for(const [id,npc] of Object.entries(story.npcs)){
 const profile=JSON.parse(fs.readFileSync(path.join(publicRoot,npc.profile),'utf8')),skeleton=JSON.parse(fs.readFileSync(path.join(publicRoot,profile.runtime.json),'utf8'));
 sources.push({id:'story-npc:'+id,profile:npc.profile,kit:id,actions:Object.fromEntries(Object.entries(npc.actions).map(([name,clip])=>[name,{duration:maxTime(skeleton.animations[clip]),loop:true}]))});
}
const contact=new Pixels(12*80,Math.ceil(sources.length/12)*72);let n=0;
for(const source of sources){
 const profile=JSON.parse(fs.readFileSync(path.join(publicRoot,source.profile),'utf8'));
 const kit=source.kit.replace('ss-npc-',''),style=styles[kit];if(!style)throw Error('NPC profession requires an explicit pixel blueprint: '+source.id+' / '+kit);
 const native=source.asset?nativeClips({...source.asset,states:source.asset.states??{}},['default']).clips:undefined;
 const entries=native??Object.entries(source.actions).filter(([,a])=>Number.isFinite(a.duration)).map(([name,a])=>({name,...a,count:name==='move'?6:name==='hurt'?2:name==='death'?6:4})),sheet=new Pixels(384,entries.length*64),actions={};
 for(let row=0;row<entries.length;row++){
  const a=entries[row],name=a.name,count=name==='idle'?4:name==='move'?6:a.count,duration=a.duration,impactTime=0,sockets=[],gesture=a.sourceAnimation?.startsWith('OW_')?a.sourceAnimation.slice(3):undefined;
  for(let i=0;i<count;i++){sheet.stamp(npcFrame(style,name,i,gesture),i*64,row*64);const mapped=name==='move'?'move':name==='hurt'?'hurt':name==='death'?'death':'idle',points=poseSockets(mapped,i%(mapped==='idle'?4:count));if(gesture==='wave')points.hand=points.weapon=points.muzzle=[43+[0,1,0,-1,0,1][i%6],16];if(gesture==='point')points.hand=points.weapon=points.muzzle=[53,30];if(gesture==='crouch'||gesture==='sit')for(const key of ['chest','hand','weapon','muzzle'])points[key]=[points[key][0],points[key][1]+4];sockets.push(points);}
  actions[name]={row,count,duration,impactTime,...frameTimes(count,duration,impactTime),sockets,loop:a.loop??['idle','move','talk','read','repair'].includes(name)};
 }
 const file=source.profile.replace('/art/','/art-pixel/').replace(/\/profile\.json$/,'/actor.png').replace(/\.json$/,'-actor.png');
 await approve(source.id,sheet,{file,original:[source.profile],batch:'PX3',kind:'actor',frame:[64,64],anchor:[32,60],actions},candidate);
 contact.stamp(npcFrame(style,'idle',0),n%12*80,Math.floor(n/12)*72);n++;
}
fs.writeFileSync(path.join(root,'.runtime/pixel-redraw/px3-candidates.json'),JSON.stringify(candidate,null,2)+'\n');await contact.save(path.join(root,'.runtime/pixel-redraw/px3-contact.png'));
console.log(JSON.stringify({candidates:Object.keys(candidate.assets).length,review:'.runtime/pixel-redraw/px3-contact.png'}));
