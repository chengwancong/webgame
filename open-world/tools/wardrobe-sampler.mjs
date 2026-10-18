// Samples only the audited RegionAttachment/normal-bone subset present in the source.
// Unsupported features fail instead of silently producing an approximate animation.
export const partSlots={head:['face'],body:['body'],hands:['front_arm','back_arm','front_hand','back_hand'],legs:['waist','front_leg','back_leg'],feet:['front_foot','back_foot'],back:['back_parts'],weapon:['weapon','back_sield']};
export const actionSources={idle:'unit_wait',move:'unit_run',walk:'unit_walk',attack:'unit_attack',hurt:'unit_damage',death:'unit_dead',skill:'unit_skill',projectile:'unit_p_skill',impact:'unit_skill_hit',win:'unit_win'};
const round=n=>Math.round(n*1e6)/1e6;
const angle=n=>((n+180)%360+360)%360-180;
export function multiply(p,q){return [p[0]*q[0]+p[2]*q[1],p[1]*q[0]+p[3]*q[1],p[0]*q[2]+p[2]*q[3],p[1]*q[2]+p[3]*q[3],p[0]*q[4]+p[2]*q[5]+p[4],p[1]*q[4]+p[3]*q[5]+p[5]];}
function transform(x,y,r,sx=1,sy=1){const a=r*Math.PI/180;return [Math.cos(a)*sx,Math.sin(a)*sx,-Math.sin(a)*sy,Math.cos(a)*sy,x,y];}
export function sampleTimeline(keys,time,defaults,rot=false){
 if(!keys?.length||time<(keys[0].time??0))return defaults;
 let index=0;while(index+1<keys.length&&(keys[index+1].time??0)<=time)index++;
 const a=keys[index],b=keys[index+1],ratio=!b||a.curve==='stepped'?0:(time-(a.time??0))/((b.time??0)-(a.time??0));
 if(a.curve!==undefined&&a.curve!=='stepped')throw Error('Unsupported timeline curve '+JSON.stringify(a.curve));
 return Object.fromEntries(Object.entries(defaults).map(([key,def])=>{const av=a[key]??def,bv=b?.[key]??def;return [key,av+(rot?angle(bv-av):bv-av)*ratio];}));
}
function parseColor(hex='ffffffff'){return [0,2,4,6].map(i=>parseInt(hex.slice(i,i+2),16)/255);}
function sampleColor(keys,time,base){if(!keys?.length||time<(keys[0].time??0))return base;let i=0;while(i+1<keys.length&&(keys[i+1].time??0)<=time)i++;const a=keys[i],b=keys[i+1],t=!b||a.curve==='stepped'?0:(time-(a.time??0))/((b.time??0)-(a.time??0)),ac=parseColor(a.color),bc=parseColor(b?.color??a.color);return ac.map((c,j)=>c+(bc[j]-c)*t);}
export function duration(animation){let max=0;function walk(x){if(!x||typeof x!=='object')return;if(typeof x.time==='number')max=Math.max(max,x.time);for(const y of Object.values(x))walk(y);}walk(animation);return max;}
export function auditSkeleton(s){
 for(const key of ['ik','transform','path'])if(s[key]?.length)throw Error('Unsupported constraint '+key);
 for(const b of s.bones)if(b.transform&&b.transform!=='normal'||b.shearX||b.shearY)throw Error('Unsupported bone transform '+b.name);
 for(const skin of s.skins)for(const [slot,values]of Object.entries(skin.attachments))for(const [name,a]of Object.entries(values))if(a.type&&a.type!=='region')throw Error('Unsupported attachment '+slot+'/'+name);
 for(const a of Object.values(s.animations)){for(const k of Object.keys(a))if(!['bones','slots','events','drawOrder','draworder'].includes(k))throw Error('Unsupported animation key '+k);for(const b of Object.values(a.bones??{}))for(const k of Object.keys(b))if(!['translate','rotate','scale'].includes(k))throw Error('Unsupported bone timeline '+k);for(const b of Object.values(a.slots??{}))for(const k of Object.keys(b))if(!['color','attachment'].includes(k))throw Error('Unsupported slot timeline '+k);}
}
export function pose(s,animation,time){
 const bones=new Map();for(const b of s.bones){const keys=animation.bones?.[b.name]??{},pos=sampleTimeline(keys.translate,time,{x:0,y:0}),rot=sampleTimeline(keys.rotate,time,{angle:0},true),scale=sampleTimeline(keys.scale,time,{x:1,y:1});const local=transform((b.x??0)+pos.x,(b.y??0)+pos.y,(b.rotation??0)+rot.angle,(b.scaleX??1)*scale.x,(b.scaleY??1)*scale.y);bones.set(b.name,b.parent?multiply(bones.get(b.parent),local):local);}
 const attachments=s.skins.find(x=>x.name==='default').attachments;
 let order=s.slots.map(x=>x.name);const draws=animation.drawOrder??animation.draworder;if(draws){const d=[...draws].reverse().find(x=>(x.time??0)<=time);if(d){const result=Array(order.length),unchanged=[];let orig=0;for(const change of d.offsets??[]){const slotIndex=order.indexOf(change.slot);while(orig!==slotIndex)unchanged.push(orig++);result[orig+change.offset]=orig++;}while(orig<order.length)unchanged.push(orig++);for(let i=result.length-1;i>=0;i--)if(result[i]===undefined)result[i]=unchanged.pop();order=result.map(i=>order[i]);}}
 const parts=[];for(const name of order){const slot=s.slots.find(x=>x.name===name);let attach=slot.attachment;const tl=animation.slots?.[name]?.attachment;if(tl){const key=[...tl].reverse().find(x=>(x.time??0)<=time);if(key)attach=key.name;}const a=attachments[name]?.[attach];if(!a||attach==='effect-shadow')continue;const local=transform(a.x??0,a.y??0,a.rotation??0,a.scaleX??1,-(a.scaleY??1));parts.push({name:attach,slot:name,matrix:multiply(bones.get(slot.bone),local).map(round),width:a.width,height:a.height,color:sampleColor(animation.slots?.[name]?.color,time,parseColor(slot.color)).map(round)});}
 const get=n=>bones.get(n).slice(4).map(round),weapon=bones.get('weapon');
 return {parts,drawOrder:parts.map(p=>p.name),sockets:{feet:[0,0],chest:get('body'),hand:get('front_hand'),muzzle:get('weapon'),weapon:get('weapon'),weaponTip:[weapon[4]+weapon[0]*40,weapon[5]+weapon[1]*40].map(round)},events:(animation.events??[]).filter(e=>Math.abs((e.time??0)-time)<1/60).map(e=>({...e}))};
}
export function exportMotion(s,family,fps=30,timing={}){auditSkeleton(s);const actions={};for(const [action,source]of Object.entries(actionSources)){const animation=s.animations[source];if(!animation)throw Error('Missing '+source);const seconds=duration(animation),count=Math.max(1,Math.ceil(seconds*fps)+1),event=(animation.events??[]).find(e=>e.name==='effect');actions[action]={source,duration:seconds,count,fps,loop:['idle','move','walk'].includes(action),sourceEffectTime:event?(event.time??0):null,impactTime:timing[action]??event?.time??(action==='attack'?Math.min(seconds,.2667):action==='skill'?Math.min(seconds,.3):0),frames:Array.from({length:count},(_,i)=>pose(s,animation,Math.min(i/fps,seconds)))};}
 return {schemaVersion:1,family,sourceVersion:s.skeleton.spine,fps,coordinateSystem:'spine-y-up; matrices map center-origin PNG x-right/y-down into world; mirror all world x at root',ground:[0,0],displayHeight:94,referenceHeight:106.43,sourceSetupBoundsHeight:145.45,actions};}
