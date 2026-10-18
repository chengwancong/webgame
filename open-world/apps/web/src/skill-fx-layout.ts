import {vfxProfile} from './vfx-profiles.ts';
import type {Skill,Vec} from '../../../packages/contracts/index.ts';

export type FxPoint={x:number;y:number};
export type FxClip={frames:string[];fps:number;duration:number;blend:'normal'|'add';origin:number[];nativeFacing:'left'|'right';rotationOffset?:number;timeline?:{time:number;frame:number|null}[];times?:{time:number;frame:number|null}[]};
export const projectFx=(p:Vec):FxPoint=>({x:(p.x-p.y)*32,y:(p.x+p.y)*18});
// 选材只消费特效档案；旧技能的历史选材在档案行内保留。
export function skillSourceClip(skill:Pick<Skill,'id'|'kind'>):string{
 return vfxProfile('player/'+skill.id)?.sourceClip??(skill.kind==='heal'?'nature-aura-05':skill.kind==='shield'?'shield':'arcane-projectile');
}
export function skillProjectileClip(skill:Pick<Skill,'id'|'kind'>):string{
 return vfxProfile('player/'+skill.id)?.projectileClip??'arcane-projectile';
}
export function sourceFrame(clip:FxClip,ageSeconds:number,reduced:boolean,loop=false){
 if(!clip.frames.length)return undefined;
 const timeline=clip.timeline??clip.times;
 if(timeline?.length&&!reduced){const time=loop&&clip.duration>0?Math.max(0,ageSeconds)%clip.duration:Math.max(0,ageSeconds);let frame:number|null=null;for(const key of timeline){if(key.time>time)break;frame=key.frame;}return frame===null?undefined:clip.frames[frame];}
 const index=reduced?Math.min(clip.frames.length-1,Math.floor(clip.frames.length*.45)):Math.max(0,Math.floor(ageSeconds*clip.fps));
 return clip.frames[loop&&!reduced?index%clip.frames.length:Math.min(index,clip.frames.length-1)];
}
export function projectileLayout(previous:Vec,current:Vec,fraction:number,origin:Vec|undefined,target:Vec|undefined,from:FxPoint,to:FxPoint){
 const interpolated={x:previous.x+(current.x-previous.x)*fraction,y:previous.y+(current.y-previous.y)*fraction},ground=projectFx(interpolated);
 const total=origin&&target?Math.hypot(target.x-origin.x,target.y-origin.y):10,travel=origin?Math.hypot(interpolated.x-origin.x,interpolated.y-origin.y):0,t=Math.min(1,travel/Math.max(.01,total));
 const position={x:ground.x+from.x*(1-t)+to.x*t,y:ground.y+from.y*(1-t)+to.y*t};
 return {ground,position,depth:ground.y+3};
}
