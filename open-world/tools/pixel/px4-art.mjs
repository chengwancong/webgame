import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {AtlasAttachmentLoader,FakeTexture,SkeletonJson,TextureAtlas} from '@esotericsoftware/spine-webgl';
import {runtimeResources} from '../../packages/asset-manifest/runtime-resources.ts';
import {actorCatalog} from '../../packages/asset-manifest/actors.ts';
import {nativeProfileFor} from '../../apps/web/src/starsea-actor-preview.ts';
import {Pixels,ramps,person,poseSockets,frameTimes,authoredPose,root,publicRoot,approve} from './px0-art.mjs';
import {actorRole} from './actor-spec.mjs';
const {ink,navy,wood,copper,fire,water,arcane,leaf,earth,skin}=ramps;
class Brush{
 constructor(frame,height){this.frame=frame;this.height=height;this.s=height/48;this.anchor=[frame/2,frame===64?60:frame-12];this.p=new Pixels(frame,frame);this.offset=[0,0];}
 point([x,y]){return [Math.round(this.anchor[0]+(x+this.offset[0]-32)*this.s),Math.round(this.anchor[1]+(y+this.offset[1]-60)*this.s)];}
 rect(x,y,w,h,c){const [a,b]=this.point([x,y]);this.p.rect(a,b,w*this.s,h*this.s,c);}
 poly(points,c){this.p.poly(points.map(p=>this.point(p)),c);}
 ellipse(x,y,rx,ry,c){const [cx,cy]=this.point([x,y]),a=Math.max(1,Math.round(rx*this.s)),b=Math.max(1,Math.round(ry*this.s));for(let py=cy-b;py<=cy+b;py++)for(let px=cx-a;px<=cx+a;px++)if((px-cx)**2/a**2+(py-cy)**2/b**2<=1)this.p.dot(px,py,c);}
 line(a,b,c,width=1){const [ax,ay]=this.point(a),[bx,by]=this.point(b),dx=bx-ax,dy=by-ay,n=Math.max(1,Math.abs(dx),Math.abs(dy)),w=width===1?1:Math.max(1,Math.round(width*this.s));for(let i=0;i<=n;i++)this.p.rect(Math.round(ax+dx*i/n),Math.round(ay+dy*i/n),w,w,c);}
 finish(){
  const copy=Buffer.from(this.p.data),map=new Map(Object.values(ramps).flatMap(r=>r.map((c,i)=>[c.slice(1),[r[0],i===0?r[1]:c]])));
  for(let y=0;y<this.frame;y++)for(let x=0;x<this.frame;x++){const i=(y*this.frame+x)*4;if(!copy[i+3])continue;let connected=false;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if((dx||dy)&&x+dx>=0&&x+dx<this.frame&&y+dy>=0&&y+dy<this.frame&&copy[((y+dy)*this.frame+x+dx)*4+3])connected=true;if(!connected){this.p.data[i+3]=0;continue;}const ramp=map.get(copy.subarray(i,i+3).toString('hex'));if(!ramp)continue;const edge=[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>x+dx<0||x+dx>=this.frame||y+dy<0||y+dy>=this.frame||!copy[((y+dy)*this.frame+x+dx)*4+3]);this.p.dot(x,y,ramp[edge?0:1]);}return this.p;
 }
}
const presets={
 'ss-mon-dusk-blade':{shape:'human',cloth:arcane,hair:ink,weapon:'sword'},'ss-mon-dusk-gunner':{shape:'gunner',cloth:wood,weapon:'gun'},'ss-mon-dusk-weaver':{shape:'human',cloth:navy,hair:navy,weapon:'staff'},
 'ss-mon-wind-hound':{shape:'wolf',cloth:earth,metal:ink,shade:2},'ss-mon-frost-hound':{shape:'wolf',cloth:navy,metal:water,shade:2,ice:true},
 'ss-mon-dock-scavenger':{shape:'human',cloth:fire,hair:copper,weapon:'hook',ponytail:true},'ss-mon-ember-worker':{shape:'human',cloth:wood,hair:ink,weapon:'hook',helmet:true,core:fire},
 'ss-mon-ore-loader':{shape:'human',cloth:leaf,hair:skin,weapon:'sword',shield:'round',bald:true},'ss-mon-frozen-watch':{shape:'human',cloth:navy,hair:ink,weapon:'spear',helmet:true,shield:'square'},
 'ss-mon-moss-warden':{shape:'human',cloth:leaf,hair:ink,weapon:'hook',helmet:true,shield:'round'},'ss-mon-pollen-caller':{shape:'human',cloth:leaf,hair:copper,weapon:'staff',ponytail:true},
 'ss-mon-rift-lurker':{shape:'human',cloth:earth,hair:ink,weapon:'staff'},'ss-mon-rift-caller':{shape:'human',cloth:arcane,hair:navy,weapon:'orb'},
 'ss-mon-bone-sentinel':{shape:'human',cloth:leaf,hair:ink,weapon:'sword',helmet:true,shield:'round'},'ss-mon-oath-acolyte':{shape:'human',cloth:navy,hair:ink,weapon:'greatsword',skinRamp:wood,skinShade:-1},
 'ss-elite-hook-leader':{shape:'human',cloth:wood,hair:copper,weapon:'hook',core:copper},'ss-elite-vine-keeper':{shape:'human',cloth:leaf,hair:fire,weapon:'spear',shield:'leaf'},
 'ss-elite-forge-overseer':{shape:'gunner',cloth:wood,weapon:'gun'},'ss-elite-frost-lock':{shape:'human',cloth:navy,hair:ink,weapon:'spear',helmet:true,shield:'square'},
 'ss-elite-rift-hunter':{shape:'human',cloth:arcane,hair:ink,weapon:'greatsword',skinRamp:wood,skinShade:-1},'ss-elite-oath-keeper':{shape:'human',cloth:water,hair:earth,weapon:'sword',shield:'round',crown:true},
 'ss-boss-port-vanguard':{shape:'human',cloth:earth,metal:copper,weapon:'greatsword',helmet:true,core:water,module:'arm'},'ss-boss-fog-quartermaster':{shape:'human',cloth:arcane,hair:ink,weapon:'orb',old:true,core:arcane},
 'ss-boss-core-extractor':{shape:'human',cloth:copper,metal:copper,weapon:'hammer',helmet:true,core:fire,exhaust:true},'ss-boss-ice-patrol':{shape:'human',cloth:navy,metal:ink,weapon:'spear',helmet:true,core:water},
 'ss-boss-rift-marshal':{shape:'human',cloth:earth,hair:ink,weapon:'orb',skinRamp:ink,core:arcane},'ss-boss-vilo':{shape:'human',cloth:navy,hair:ink,weapon:'greatsword',crown:true,core:fire,module:'head'},
 'meadow-boss':{shape:'cyclops',cloth:navy},'forest-boss':{shape:'hunter',cloth:wood,hair:copper,weapon:'bow'},'rift-boss':{shape:'dragon',cloth:fire},
 beast:{shape:'wolf',cloth:earth,metal:ink},raider:{shape:'gnoll',cloth:wood,weapon:'claws'},archer:{shape:'gunner',cloth:earth,weapon:'gun'},artillery:{shape:'goblin',cloth:wood,green:true,weapon:'gun',hat:true},
 hero:{shape:'human',cloth:navy,hair:copper,weapon:'sword',shield:'round'},
 assassin:{shape:'goblin',cloth:wood,weapon:'gun'},caster:{shape:'hood',cloth:arcane,weapon:'orb'},guard:{shape:'human',cloth:wood,helmet:true,horns:true,weapon:'sword',shield:'round'},summoner:{shape:'shaman',cloth:leaf,weapon:'staff'},
 'chapters/abyss_lord':{shape:'devil',cloth:arcane,weapon:'greatsword'},'chapters/dragon_king':{shape:'dragon',cloth:fire},'chapters/frost_queen':{shape:'queen',cloth:water,hair:ink,weapon:'staff'},
 'hub-mimic':{shape:'chest',cloth:wood},
};
function headgear(b,preset){
 const metal=preset.metal??ink;
 if(preset.helmet){b.poly([[23,17],[25,12],[34,10],[39,15],[41,23],[37,27],[25,25]],metal[0]);b.poly([[25,17],[28,13],[34,13],[38,17],[39,23],[27,23]],metal[2]);b.poly([[27,14],[33,12],[35,14],[28,17]],metal[4]);b.rect(29,20,11,3,preset.core===fire?water[2]:navy[0]);b.rect(29,20,9,1,preset.core===fire?water[4]:ink[3]);b.ellipse(24,23,3,5,metal[1]);}
 if(preset.horns){b.poly([[25,16],[21,12],[21,7],[24,11],[28,15]],ink[3]);b.poly([[36,15],[39,10],[39,6],[42,10],[40,16]],ink[4]);}
 if(preset.crown){b.poly([[23,14],[24,10],[28,13],[31,9],[34,13],[38,10],[39,15]],copper[3]);b.rect(25,14,13,2,copper[4]);}
 if(preset.ponytail)b.poly([[24,15],[20,16],[18,25],[21,31],[24,29],[22,23]],preset.hair?.[2]??wood[2]);
 if(preset.old){b.poly([[26,15],[28,12],[36,13],[39,18],[34,16]],skin[3]);b.poly([[30,24],[36,24],[38,23],[37,27],[32,28]],ink[3]);}
}
function weapon(b,preset,action,pose,s){
 const [hx,hy]=s.hand,high=['attack','skill','projectile'].includes(action)&&pose<3;let tip=[Math.min(63,hx+19),hy-7];
 if(preset.weapon==='gun'){
  b.rect(hx-7,hy-2,14,5,wood[1]);b.rect(hx+3,hy-5,16,7,ink[1]);b.rect(hx+4,hy-4,14,2,ink[3]);b.rect(hx+17,hy-4,2,5,ink[0]);tip=[hx+18,hy-2];
 }else if(preset.weapon==='bow'){
  const x=hx+10,y=hy;b.poly([[x-3,y-14],[x+1,y-9],[x+4,y-2],[x+4,y+3],[x,y+10],[x-3,y+14],[x-1,y+6],[x+1,y],[x-1,y-6]],wood[2]);b.line([x-3,y-14],[high?hx:x-3,y],earth[4]);b.line([high?hx:x-3,y],[x-3,y+14],earth[4]);tip=[x+3,y];
 }else if(preset.weapon==='hook'){
  tip=[Math.min(58,hx+12),hy-5];b.line([hx,hy],tip,wood[2],2);b.ellipse(...tip,6,6,ink[2]);b.ellipse(tip[0]+2,tip[1]-1,3,3,null);b.rect(tip[0]+1,tip[1]-6,5,5,null);
 }else if(preset.weapon==='hammer'){
  tip=high?[39,9]:[58,30];b.line([hx,hy],tip,wood[1],3);b.line([hx,hy],tip,copper[3]);b.poly([[tip[0]-7,tip[1]-4],[tip[0]+4,tip[1]-4],[tip[0]+6,tip[1]],[tip[0]+4,tip[1]+6],[tip[0]-7,tip[1]+6]],copper[1]);b.rect(tip[0]-4,tip[1]-2,6,6,fire[3]);b.rect(tip[0]-3,tip[1]-1,2,4,fire[5]);
 }else if(['staff','orb','spear'].includes(preset.weapon)){
  tip=high?[39,8]:[Math.min(61,hx+10),hy-18];b.line([hx,hy],tip,wood[1],2);b.line([hx,hy],tip,copper[3]);
  const color=preset.core??(preset.weapon==='spear'?water:arcane);b.poly([[tip[0],tip[1]-4],[tip[0]+4,tip[1]],[tip[0]+1,tip[1]+5],[tip[0]-3,tip[1]+2]],color[1]);b.poly([[tip[0],tip[1]-2],[tip[0]+2,tip[1]],[tip[0],tip[1]+2],[tip[0]-1,tip[1]]],color[4]);
 }else{
  tip=s.weapon;b.line([hx,hy],tip,ink[1],3);b.line([hx+1,hy],tip,preset.weapon==='greatsword'?earth[4]:ink[4]);b.rect(hx-2,hy-2,6,2,copper[3]);
 }
 return {...s,weapon:tip,muzzle:preset.weapon==='gun'||preset.weapon==='bow'?tip:preset.weapon==='orb'||preset.weapon==='staff'?tip:tip};
}
function wolf(b,preset,action,i){
 const c=preset.cloth.map((_,n)=>preset.cloth[Math.min(5,n+(preset.shade??0))]),m=preset.metal??ink,bob=action==='move'?[0,-1,-2,-1,0,1][i%6]:action==='idle'?[0,0,-1,0][i%4]:0,stride=action==='move'?[-3,-1,2,3,1,-2][i%6]:0,dx=['attack','skill'].includes(action)?[-2,-1,0,3,2,0][i%6]:0,headBob=bob+(['attack','skill'].includes(action)?[0,-1,0,1,0,0][i%6]:0);
 if(action==='death'&&i>=3){b.ellipse(32,54,23,5,c[1]);b.poly([[43,50],[56,50],[61,55],[56,59],[44,58]],c[3]);return{feet:[32,60],chest:[32,53],hand:[44,57],weapon:[60,55],muzzle:[60,55]};}
 b.poly([[20,37],[9,27+bob],[6,19+bob],[5,33+bob],[13,44]],c[0]);b.poly([[18,36],[9,29+bob],[8,25+bob],[8,33+bob],[15,41]],c[2]);
 b.poly([[16,34+bob],[39,31+bob],[47,40+bob],[39,49],[18,47]],c[1]);b.poly([[18,35+bob],[35,33+bob],[41,39+bob],[34,43],[19,42]],c[2]);
 for(const [x,s] of [[20,stride],[29,-stride],[40,stride],[46,-stride]]){b.poly([[x,44],[x+4,44],[x+4+s,57],[x+7+s,59],[x+s,60]],c[0]);b.rect(x+1+s,53,3,5,c[2]);}
 b.poly([[40+dx,31+headBob],[45+dx,22+headBob],[54+dx,23+headBob],[57+dx,29+headBob],[60+dx,33+headBob],[57+dx,40+headBob],[46+dx,41+headBob]],c[0]);
 b.poly([[43+dx,31+headBob],[47+dx,25+headBob],[53+dx,26+headBob],[55+dx,31+headBob],[59+dx,34+headBob],[54+dx,38+headBob],[47+dx,36+headBob]],c[3]);
 b.poly([[45+dx,25+headBob],[45+dx,17+headBob],[50+dx,24+headBob]],m[2]);b.poly([[53+dx,25+headBob],[57+dx,19+headBob],[57+dx,30+headBob]],m[3]);b.poly([[44+dx,29+headBob],[49+dx,24+headBob],[55+dx,26+headBob],[53+dx,30+headBob]],m[2]);
 b.rect(54+dx,30+headBob,2,2,preset.ice?water[5]:fire[4]);b.rect(56+dx,36+headBob,4,['attack','skill'].includes(action)&&i>=3?3:1,ink[0]);b.rect(57+dx,37+headBob,1,2,earth[4]);
 if(preset.ice){b.poly([[19,34],[20,23],[25,30],[29,19],[34,31],[38,25],[39,35]],water[2]);b.poly([[21,31],[22,26],[25,32],[29,23],[31,31]],water[4]);}
 return{feet:[32,60],chest:[34,38+bob],hand:[46+stride,56],weapon:[60+dx,34+headBob],muzzle:[60+dx,34+headBob]};
}
function dragon(b,preset,action,i){
 const c=preset.cloth,combat=['attack','skill','projectile'].includes(action),wing=action==='move'?[0,-2,-3,-1,1,2][i%6]:action==='idle'?[0,1,0,-1][i%4]:combat?[0,-1,-2,2,1,0][i%6]:0,dx=combat?[-2,-1,0,3,2,0][i%6]:0,dy=combat?[0,-1,-2,1,0,0][i%6]:0;
 if(action==='death'&&i>=3){b.poly([[8,52],[24,46],[49,48],[61,54],[56,59],[17,60]],c[0]);b.poly([[13,53],[25,49],[48,51],[55,56],[20,57]],c[2]);return{feet:[32,60],chest:[32,54],hand:[46,56],weapon:[59,55],muzzle:[59,55]};}
 b.poly([[27,35],[19,8+wing],[6,20+wing],[2,38],[11,33],[18,43],[25,42]],c[0]);b.poly([[24,33],[18,12+wing],[8,21+wing],[6,33],[12,29],[19,39]],c[2]);
 b.line([18,12+wing],[12,29],c[4]);b.line([18,12+wing],[19,39],c[3]);
 b.poly([[27,33],[30,20],[39,24],[44,40],[39,52],[24,52],[15,48],[3,48],[2,43],[13,45],[21,42]],c[0]);b.poly([[29,34],[32,24],[37,27],[40,41],[36,48],[26,48],[22,43]],c[2]);
 for(const x of [25,37]){b.poly([[x,45],[x+5,45],[x+7,57],[x+11,60],[x,60]],c[1]);b.rect(x+6,57,4,2,copper[4]);}
 b.offset=[dx,dy];b.poly([[36,25],[40,17],[50,17],[55,25],[62,27],[61,34],[49,36],[42,31]],c[0]);b.poly([[39,25],[43,20],[49,20],[52,27],[60,29],[58,32],[49,32]],c[3]);
 b.poly([[42,18],[39,10],[45,16]],copper[2]);b.poly([[49,18],[51,11],[53,21]],copper[3]);b.rect(52,24,3,2,fire[5]);b.rect(56,30,5,1,ink[0]);
 b.offset=[0,0];b.poly([[33,35],[42,30],[45,34],[39,40],[47,43],[44,47],[35,43]],c[2]);return{feet:[32,60],chest:[34,37],hand:[44,43],weapon:[61+dx,30+dy],muzzle:[61+dx,30+dy]};
}
function cyclops(b,preset,action,i){
 const c=navy,hit=['attack','skill'].includes(action)&&i>=3;
 if(action==='death'&&i>=3){b.ellipse(32,53,23,6,c[1]);b.ellipse(48,52,10,6,c[3]);return{feet:[32,60],chest:[32,53],hand:[43,55],weapon:[60,55],muzzle:[53,51]};}
 b.poly([[20,34],[40,31],[48,43],[44,52],[20,53],[15,45]],c[0]);b.poly([[23,35],[38,34],[43,44],[39,48],[22,48],[18,43]],c[3]);
 b.ellipse(32,22,13,12,c[1]);b.ellipse(33,23,11,9,c[3]);b.ellipse(35,20,6,4,ink[5]);b.ellipse(37,20,2,3,ink[0]);b.rect(28,29,12,2,c[1]);b.rect(24,13,7,2,c[4]);
 for(const x of [23,36]){b.rect(x,48,7,11,wood[1]);b.rect(x-1,57,10,3,wood[2]);}
 b.poly([[20,34],[14,33],[9,43],[12,49],[18,46],[23,39]],c[1]);b.poly([[39,34],[45,34],[47,42],[52,39],[55,43],[46,49],[39,43]],c[2]);
 const tip=hit?[59,31]:[48,13];b.line([50,42],tip,wood[1],4);b.line([50,42],tip,wood[3],1);b.ellipse(tip[0],tip[1],5,7,ink[2]);b.rect(tip[0]-3,tip[1]-3,2,5,ink[4]);
 b.rect(17,37,5,7,earth[3]);b.rect(18,39,1,2,ink[0]);b.rect(20,39,1,2,ink[0]);return{feet:[32,60],chest:[31,36],hand:[50,42],weapon:tip,muzzle:[42,27]};
}
function humanoid(b,preset,action,i,phase,progress){
 const baseAction=['idle','move','attack','skill','projectile','hurt','death'].includes(action)?action:'skill';i=baseAction==='idle'?i%4:baseAction==='hurt'?i%2:i%6;const base=person('dusk',baseAction,i,{bodyOnly:true,frameSize:b.frame,bodyHeight:b.height,anchor:b.anchor});base.rect=Pixels.prototype.rect.bind(base);base.poly=Pixels.prototype.poly.bind(base);b.p=base;
 for(let y=0;y<b.frame;y++)for(let x=0;x<b.frame;x++){const k=(y*b.frame+x)*4;if(!base.data[k+3])continue;const color='#'+base.data.subarray(k,k+3).toString('hex'),n=arcane.indexOf(color);if(n>=0)Buffer.from(preset.cloth[n].slice(1),'hex').copy(base.data,k);const logicalY=(y-b.anchor[1])/b.s+60;if(logicalY<26&&(color===ink[3]||color===ink[5])&&preset.hair){const target=preset.hair[color===ink[3]?2:4];Buffer.from(target.slice(1),'hex').copy(base.data,k);}if(preset.skinRamp){const n=skin.indexOf(color);if(n>=0)Buffer.from(preset.skinRamp[Math.max(0,Math.min(5,n+(preset.skinShade??0)))].slice(1),'hex').copy(base.data,k);}}
 let sockets=poseSockets(baseAction,i);
 if(baseAction==='death'&&i>=3)return sockets;
 b.offset=[sockets.chest[0]-31,sockets.chest[1]-31];
 const shape=preset.shape;
 if(shape==='gunner'){b.ellipse(31,18,10,9,ink[2]);b.ellipse(31,17,8,7,ink[3]);b.rect(23,20,16,3,ink[0]);b.poly([[27,23],[35,23],[39,28],[35,33],[27,31],[24,27]],wood[3]);b.rect(30,25,5,1,wood[0]);}
 if(shape==='goblin'){const c=preset.green?leaf:fire;b.poly([[25,14],[17,16],[16,22],[25,23]],c[1]);b.poly([[37,18],[42,20],[46,22],[44,25],[38,25]],c[2]);b.poly([[24,13],[23,7],[29,12],[35,8],[40,15]],wood[0]);b.poly([[27,17],[36,17],[39,23],[36,28],[28,26]],c[2]);b.rect(36,20,2,2,ink[0]);if(preset.hat){b.poly([[21,16],[22,7],[29,3],[39,6],[42,16]],wood[0]);b.rect(18,15,26,3,copper[3]);b.rect(24,8,14,3,copper[2]);}}
 if(shape==='hood'||shape==='devil'||shape==='shaman'||shape==='queen'){
  b.poly([[24,28],[35,27],[40,35],[43,56],[33,59],[18,56],[22,36]],preset.cloth[0]);b.poly([[26,30],[33,29],[35,38],[39,54],[32,56],[22,53],[25,37]],preset.cloth[2]);
 }
 if(shape==='hood'){b.poly([[22,23],[22,13],[27,7],[36,9],[41,17],[39,29],[32,26],[25,29]],arcane[0]);b.poly([[25,22],[25,14],[29,11],[35,12],[38,18],[36,24]],navy[0]);b.rect(28,18,3,3,leaf[4]);b.rect(34,18,3,3,leaf[4]);}
 if(shape==='hunter'){b.poly([[23,22],[19,16],[24,8],[36,7],[42,13],[40,28],[35,25],[31,19],[27,27]],copper[1]);b.poly([[23,17],[26,11],[35,10],[38,14],[32,14],[27,21]],copper[3]);b.rect(26,11,4,1,copper[5]);b.rect(25,33,5,6,ink[4]);b.rect(26,35,1,2,ink[0]);b.rect(28,35,1,2,ink[0]);}
 if(shape==='shaman'){b.poly([[25,23],[24,12],[17,8],[14,3],[12,5],[15,11],[12,14],[21,18]],wood[1]);b.poly([[36,18],[44,11],[47,3],[49,5],[46,14],[40,20]],wood[2]);b.poly([[27,23],[37,23],[38,30],[32,38],[26,30]],ink[3]);b.poly([[28,24],[35,25],[34,30],[31,34],[28,28]],ink[5]);}
 if(shape==='queen'){b.poly([[23,21],[20,13],[25,9],[35,9],[40,15],[40,28],[36,32],[35,19],[29,16],[25,26]],ink[3]);b.poly([[23,17],[25,12],[33,11],[36,14],[29,14],[25,20]],ink[5]);b.poly([[23,12],[23,6],[27,10],[31,4],[34,10],[39,6],[38,13]],water[3]);b.poly([[22,33],[12,26],[16,40],[10,44],[21,48]],water[2]);b.poly([[38,31],[48,24],[44,39],[51,42],[42,48]],water[3]);}
 if(shape==='devil'){b.poly([[23,21],[18,16],[17,7],[20,5],[22,13],[27,18]],arcane[2]);b.poly([[35,18],[40,10],[43,4],[44,11],[40,21]],arcane[2]);b.poly([[23,31],[14,18],[4,24],[10,39],[20,43]],arcane[0]);b.poly([[21,33],[13,22],[8,25],[13,37]],arcane[2]);b.rect(30,20,3,2,arcane[4]);}
 if(shape==='gnoll'){b.poly([[22,28],[20,17],[25,12],[32,17],[40,18],[44,27],[53,29],[53,35],[40,39],[28,34]],wood[0]);b.poly([[25,26],[25,18],[30,20],[38,21],[40,29],[50,31],[49,34],[39,35]],wood[3]);b.rect(42,26,3,2,fire[4]);b.poly([[25,36],[20,32],[15,37],[18,46],[24,44]],ink[2]);}
 headgear(b,preset);
 if(preset.shield){const c=preset.cloth;if(preset.shield==='square'){b.poly([[17,30],[27,29],[30,38],[25,47],[15,44],[12,36]],c[0]);b.poly([[18,32],[25,31],[27,38],[24,44],[17,42],[15,36]],c[2]);}else{b.ellipse(20,38,8,10,c[0]);b.ellipse(20,38,6,8,c[2]);b.ellipse(20,38,3,4,c[3]);}}
 if(preset.core){const [cx,cy]=preset.module==='head'?[24,20]:preset.module==='arm'?[22,33]:[31,34],shade=phase==='phase-active'?4:phase==='phase-enter'?Math.min(4,1+Math.floor(progress*4)):phase==='phase-end'?Math.max(1,4-Math.floor(progress*4)):2;b.ellipse(cx,cy,5,6,copper[0]);b.ellipse(cx,cy,3,4,preset.core[shade]);
  const spread=phase==='phase-active'?6:phase==='phase-enter'?progress*6:phase==='phase-end'?(1-progress)*6:0;for(const side of [-1,1]){const x=31+side*(10+spread);b.poly([[x-3,29],[x+3,27],[x+4,39],[x,43],[x-4,39]],preset.cloth[0]);b.poly([[x-2,30],[x+2,29],[x+2,38],[x,40],[x-2,37]],preset.cloth[2]);}
 }
 if(preset.exhaust){b.rect(19,28,4,10,copper[0]);for(const y of [30,33,36])b.rect(20,y,2,1,fire[3]);}
 if(preset.bald)b.ellipse(32,17,8,7,skin[3]);
 b.offset=[0,0];sockets=weapon(b,preset,baseAction,i,sockets);return sockets;
}
function chest(b,action,i){
 const open=action==='wake'?i/5:['attack','skill'].includes(action)?i<3?i/3:1:0;
 b.poly([[10,39],[45,32],[55,38],[55,56],[21,60],[10,54]],wood[0]);b.poly([[13,40],[44,35],[52,39],[52,54],[22,57],[13,52]],wood[3]);b.rect(18,40,4,17,copper[2]);b.rect(43,36,4,19,copper[3]);
 if(open>0){const top=35-open*20;b.poly([[11,39],[12,top],[45,top-6],[54,35],[45,42]],wood[0]);b.poly([[15,36],[16,top+2],[44,top-2],[50,34],[43,38]],wood[3]);b.poly([[20,39],[45,37],[48,44],[24,49]],ink[0]);for(let x=23;x<47;x+=5){b.poly([[x,39],[x+3,39],[x+1,44]],earth[4]);}b.poly([[29,44],[37,43],[42,50],[38,54],[32,51]],fire[2]);}
 else{b.poly([[10,39],[13,28],[22,24],[44,22],[52,29],[55,38],[45,44],[21,47]],wood[1]);b.poly([[13,38],[16,30],[23,27],[43,25],[49,31],[51,37],[44,41],[22,44]],wood[3]);b.poly([[20,27],[25,26],[28,44],[23,45]],copper[3]);b.poly([[43,25],[47,28],[49,40],[44,42]],copper[2]);}
 b.rect(29,43,8,9,copper[1]);b.poly([[32,44],[36,47],[32,51],[29,47]],water[3]);return{feet:[32,60],chest:[32,44],hand:[46,43],weapon:[47,41],muzzle:[47,41]};
}
function render(preset,action,pose,frame,height,phase='default',progress=0,elite=false){
 const b=new Brush(frame,height);let sockets;
 if(preset.shape==='wolf')sockets=wolf(b,preset,action,pose);else if(preset.shape==='dragon')sockets=dragon(b,preset,action,pose);else if(preset.shape==='cyclops')sockets=cyclops(b,preset,action,pose);else if(preset.shape==='chest')sockets=chest(b,action,pose);else sockets=humanoid(b,preset,action,pose,phase,progress);
 if(elite&&action!=='death'){
  if(preset.shape==='wolf'){const dx=sockets.muzzle[0]-60,dy=sockets.muzzle[1]-34;b.poly([[47+dx,23+dy],[48+dx,19+dy],[51+dx,22+dy],[54+dx,18+dy],[56+dx,22+dy],[58+dx,21+dy],[58+dx,25+dy],[47+dx,25+dy]],copper[2]);}
  else if(preset.shape==='dragon')b.poly([[43,18],[44,14],[47,17],[50,14],[53,20],[44,21]],copper[3]);
  else if(preset.shape==='chest'){const y=action==='wake'?24-pose/5*12:24;b.poly([[24,y+4],[25,y],[29,y+3],[32,y-2],[35,y+3],[38,y],[40,y+5]],copper[3]);}
  else{if(preset.shape!=='cyclops')b.offset=[sockets.chest[0]-31,sockets.chest[1]-31];b.poly([[23,15],[24,12],[27,15],[30,11],[33,15],[37,12],[38,17],[24,17]],copper[2]);b.rect(25,15,11,1,copper[4]);b.offset=[0,0];}
 }
  const mapped=Object.fromEntries(Object.entries(sockets).map(([name,p])=>[name,b.point(p)]));
 const spread=phase==='phase-active'?6:phase==='phase-enter'?progress*6:phase==='phase-end'?(1-progress)*6:0;
 if(preset.core&&!(action==='death'&&pose>=3)){const [cx,cy]=sockets.chest,module=preset.module==='head'?[cx-7,cy-11]:preset.module==='arm'?[cx-9,cy+2]:[cx,cy+3];Object.assign(mapped,{ss_module:b.point(module),ss_core:b.point(module),ss_exhaust:b.point([cx-10,cy+1]),ss_panel_left:b.point([cx-10-spread,cy+2]),ss_panel_right:b.point([cx+10+spread,cy+2])});}
 return {pixels:b.finish(),sockets:mapped,anchor:b.anchor};
}
const profileCache=new Map(),rigCache=new Map();
function readPublic(url){if(!url.startsWith('/art/')||url.includes('..'))throw Error('Unsafe source art path');return JSON.parse(fs.readFileSync(path.join(publicRoot,url),'utf8'));}
function profile(url){let result=profileCache.get(url);if(result)return result;const p=readPublic(url),key=p.runtime.json+'|'+p.runtime.atlas;let data=rigCache.get(key);if(!data){const atlas=new TextureAtlas(fs.readFileSync(path.join(publicRoot,p.runtime.atlas),'utf8'));for(const page of atlas.pages)page.setTexture(new FakeTexture({width:page.width,height:page.height}));data=new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(readPublic(p.runtime.json));rigCache.set(key,data);}result={p,data};profileCache.set(url,result);return result;}
export function nativeClips(source,phases=['default','phase-active','phase-enter','phase-end']){
 const keys=[...Object.keys(source.actions).filter(k=>k!=='skills'),...Object.keys(source.actions.skills??{})],out=[],profiles=new Set();
 for(const phase of phases)for(const action of (phase==='phase-enter'||phase==='phase-end'?['idle']:keys.filter(k=>phase==='default'||k!=='death'))){
  const url=nativeProfileFor(source,action,phase);if(!url)continue;profiles.add(url);const {p,data}=profile(url),weapon=p.weapons[source.runtime.renderAppearance?.parts.weapon.setId]??Object.values(p.weapons)[0],mapped=phase==='phase-enter'||phase==='phase-end'?'idle':source.actions.skills?.[action]?'skill':source.runtime.storyAdapter?.[action]??action,motion=weapon.actions[mapped]??weapon.actions.skill,animation=data.findAnimation(motion.name);if(!animation)throw Error(source.id+': missing source animation '+motion.name);
  const sourceName=source.actions.skills?.[action]?.sourceAnimation??source.actions[action]?.sourceAnimation??motion.name,drawAction=phase==='phase-enter'||phase==='phase-end'?'idle':/Die/.test(sourceName)?'death':/Damage/.test(sourceName)?'hurt':/Run|Walk/.test(sourceName)?'move':/Wait|idle/.test(sourceName)?'idle':/Spell|Cast/.test(sourceName)?'skill':mapped;
  const transition=phase==='phase-enter'||phase==='phase-end';out.push({name:phase==='default'?action:phase+':'+action,drawAction,sourceAnimation:motion.name,count:transition?6:drawAction==='idle'?4:drawAction==='hurt'?2:6,duration:transition?source.states[phase].transitionWindow??animation.duration:animation.duration,sourceDuration:animation.duration,impactTime:motion.impactTime??source.actions.skills?.[action]?.impactTime??source.actions[action]?.impactTime??0,loop:motion.loop??['idle','move'].includes(drawAction),phase,cleanup:source.states?.death?.cleanupTime});
 }return {clips:out,profiles:[...profiles]};
}
const socketsRegistry=JSON.parse(fs.readFileSync(path.join(root,'packages/asset-manifest/native-actor-sockets.json'),'utf8'));
function atlasClips(id,source,meta){
 const definitions=source?.runtime.actions??Object.fromEntries(Object.entries(meta.actions).map(([name,count])=>[name,{duration:count/meta.fps,count,fps:meta.fps}]));
 let sourceSockets;if(source?.runtime.sockets&&fs.existsSync(path.join(publicRoot,source.runtime.sockets)))sourceSockets=readPublic(source.runtime.sockets);else sourceSockets=socketsRegistry[meta.texture??id];
 const clips=Object.entries(definitions).map(([name,c])=>{
  const points=sourceSockets?.actions?.[name]??[],fps=c.fps??meta.fps,forward=(source?.runtime.nativeFacing??meta.nativeFacing??1)===-1?-1:1;
  let peak=0,best=-Infinity;for(let i=0;i<points.length;i++){const p=points[i].weapon??points[i].muzzle,feet=points[i].feet;if(p&&feet){const reach=(p[0]-feet[0])*forward;if(reach>best){best=reach;peak=i;}}}
  const duration=c.duration??(c.frames?.length??c.count)/fps,impactTime=c.impactTime??(['attack','skill','projectile'].includes(name)?Math.min(duration-1/fps,peak/fps):0);
  return{name,drawAction:name==='win'?'idle':name,count:name==='idle'||name==='win'?4:name==='move'?6:name==='hurt'?2:name==='wake'?Math.max(6,c.frames?.length??c.count??10):6,duration,impactTime:Math.max(0,impactTime),loop:c.loop??['idle','move'].includes(name),phase:'default'};
 });
 if(['frost_queen','abyss_lord','dragon_king'].includes(id)){
  const vfx=JSON.parse(fs.readFileSync(path.join(root,'packages/asset-manifest/vfx-v2.json'),'utf8')),key=id==='frost_queen'?'frost-queen-cast':id==='abyss_lord'?'abyss-lord-cast':'dragon-king-cast',c=vfx.clips[key];
  for(const physical of [false,true])clips.push({name:physical?'cast-physical':'cast',drawAction:'skill',count:6,duration:c.count/c.fps,impactTime:(physical?16:8)/c.fps,loop:false,phase:'default'});
 }return {clips,profiles:[]};
}
const legacyPreset=id=>({bone_mage:'caster',frost_wolf:'beast',dragon_guard:'assassin',dragon_priest:'forest-boss',ice_elemental:'forest-boss',abomination:'meadow-boss',frost_giant:'meadow-boss',shadow_lord:'summoner',shadow_stalker:'assassin',snow_ranger:'archer',dragon_whelp:'rift-boss'})[id]??id;
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
const baseIds=Object.keys(actorCatalog).filter(id=>id!=='hero'&&runtimeResources.get(id)?.group!=='npc');
const priority=id=>{const a=runtimeResources.get(id),canonical=a?.source?.assetId??(a?.runtime.kind==='native'?path.posix.basename(path.posix.dirname(a.runtime.profile)):actorCatalog[id].texture??id);return path.posix.basename(canonical)===id?0:1;};
const ordered=baseIds.sort((a,b)=>priority(a)-priority(b)||a.localeCompare(b));
const candidate={schemaVersion:1,stage:[1280,720],canvas:[640,360],palette:'/art-pixel/palette.json',assets:{}},cache=new Map(),contact=new Pixels(8*176,Math.ceil(baseIds.length/8)*176);let contactIndex=0;
for(const id of ordered){
 const source=runtimeResources.get(id),meta=actorCatalog[id],role=actorRole(id,source?.group),native=source?.runtime.kind==='native',canonical=source?.source?.assetId??(native?path.posix.basename(path.posix.dirname(source.runtime.profile)):meta.texture??id),presetKey=presets[canonical]?canonical:presets[id]?id:legacyPreset(canonical),preset=presets[presetKey];
 if(!preset)throw Error('An explicit monster blueprint is required: '+id+' / '+presetKey);
 const timing=native?nativeClips({...source,states:source.states??{}}):atlasClips(id,source,meta);
 const original= native?[...timing.profiles,...(source.runtime.atlasPages??[])]:[source?.runtime.image??`/art/${meta.texture??id}.png`],baseHeight=role==='boss'?(id.endsWith('-2')?108:id.endsWith('-3')?96:104):role==='elite'?(id.startsWith('ow-rare')&&canonical.includes('elite')?75:60):48;
 for(const variant of role==='ordinary'?[false,true]:[false]){
  const height=variant?Math.round(baseHeight*1.25):baseHeight,frame=role==='boss'?160:height>=70?112:height>=60||['wolf','dragon'].includes(preset.shape)?96:64,anchor=[frame/2,frame===64?60:frame-12],key=id+(variant?':elite':''),cacheKey=JSON.stringify([presetKey,height,timing.clips]);
  if(cache.has(cacheKey)){const existing=cache.get(cacheKey);candidate.assets[key]={...existing,original:original.map(p=>variant?p+'#elite':p)};continue;}
  const maxCount=Math.max(...timing.clips.map(c=>c.count)),sheet=new Pixels(frame*maxCount,frame*timing.clips.length),actions={};let display=0;
  for(let row=0;row<timing.clips.length;row++){
   const c=timing.clips[row],t=frameTimes(c.count,c.duration,c.impactTime),sockets=[];
   if(c.drawAction==='death'&&c.cleanup>0&&c.cleanup<c.duration&&t.frameTimes[2]<c.cleanup&&t.frameTimes[4]>c.cleanup)t.frameTimes[3]=c.cleanup;
   for(let i=0;i<c.count;i++){
    const pose=c.phase==='phase-enter'||c.phase==='phase-end'?0:c.name==='wake'?Math.min(5,Math.floor(i*6/c.count)):['attack','skill','projectile'].includes(c.drawAction)&&t.impactFrame===0?Math.min(5,3+i):authoredPose(c.drawAction,i,t),result=render(preset,c.drawAction,pose,frame,height,c.phase,i/Math.max(1,c.count-1),variant||role==='elite');
    sheet.stamp(result.pixels,i*frame,row*frame);sockets.push(result.sockets);
    for(let y=0;y<frame;y++){let opaque=false;for(let x=0;x<frame;x++)if(result.pixels.data[(y*frame+x)*4+3]){opaque=true;break;}if(opaque)display=Math.max(display,anchor[1]-y+1);}
   }
   actions[c.name]={row,count:c.count,duration:c.duration,sourceDuration:c.sourceDuration??c.duration,impactTime:c.impactTime,...t,sockets,loop:c.loop};
  }
  const sourceFile=native?source.runtime.profile.replace('profile.json','actor.png'):original[0],stem=sourceFile.replace('/art/','/art-pixel/').replace(/\.webp$/,'.png'),canonicalName=path.posix.basename(canonical),suffix=variant?'-elite':id!==canonicalName&&!id.startsWith('ss-')?'-'+id:'';
  const file=stem.replace(/\.png$/,suffix.replace(/:/g,'-')+'.png');
  const asset=await approve(key,sheet,{file,original:original.map(p=>variant?p+'#elite':p),batch:'PX4',kind:'actor',frame:[frame,frame],anchor,actions},candidate);
  asset.role=variant?'elite':role;asset.bodyHeight=height;asset.displayHeight=display*2;asset.timingSource=native?'published native profile animation and impactTime':'published atlas duration/fps; release from maximum original weapon-socket reach when impactTime is absent';cache.set(cacheKey,asset);
  if(!variant){const tile=render(preset,'idle',0,frame,height);contact.stamp(tile.pixels,contactIndex%8*176,Math.floor(contactIndex/8)*176);contactIndex++;}
 }
 console.log(JSON.stringify({asset:id,role}));
}
fs.writeFileSync(path.join(root,'.runtime/pixel-redraw/px4-candidates.json'),JSON.stringify(candidate,null,2)+'\n');await contact.save(path.join(root,'.runtime/pixel-redraw/px4-contact.png'));
console.log(JSON.stringify({candidates:Object.keys(candidate.assets).length,review:'.runtime/pixel-redraw/px4-contact.png'}));
}
