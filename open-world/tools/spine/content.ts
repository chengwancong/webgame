/** 宿主对照与唯一主数值。配对均经正式装备、属性和技能解析器；不在磁盘上扰动内容。 */
import assert from 'node:assert/strict';
import {skillCatalog} from '../../packages/content/index.ts';
import {skillWeapons} from '../../packages/content/skill-weapons.ts';
import {newAspects} from '../../packages/content/aspects.ts';
import {augments} from '../../packages/content/augments.ts';
import {setEffects} from '../../packages/content/set-effects.ts';
import {talentDefinitions,paragonDefinitions} from '../../packages/content/deep-progression.ts';
import {inscriptionConfig} from '../../packages/content/inscriptions.ts';
import {buildSourcePartsSchema} from '../../packages/contracts/build-sources.ts';
import {buildVarietyProfiles,assembleBuildVariety,type BuildVarietyProfile} from '../build-variety-builds.ts';
import {pacingProfiles} from '../pacing/profiles.ts';
import {skillWeaponAllowed} from '../../packages/rules/skill-weapon-access.ts';
import {standardState,resolvePlayer} from './player.ts';
import {resolveBuild} from '../../packages/rules/index.ts';
import {freezeAugmentBasis,rebuildFrozenAugmentBuild} from '../../packages/rules/frozen-augment-build.ts';
import {readJson} from './io.ts';
import type {CharacterState} from '../../packages/contracts/index.ts';
import type {ResolvedPlayer} from './bench.ts';
export type ContentItem={id:string;category:string;group:string;band:number;primary:'D1'|'DN'|'P';object:any;path:(string|number)[]|null;file:string;sourcePath:(string|number)[];step:number;offset:number;host:string;make:(factor?:number)=>{full:ResolvedPlayer;base:ResolvedPlayer};};
export function get(v:any,path:readonly (string|number)[]){return path.reduce((o,k)=>o[k],v);}
export function put(v:any,path:readonly (string|number)[],value:any){get(v,path.slice(0,-1))[path.at(-1)!]=value;}
export const scaledPrimary=(value:number,path:readonly (string|number)[],factor:number)=>path.at(-1)==='projectiles'?Math.ceil(value*factor):value*factor;
/** 优先已声明的数值通道。持续时间、命中数、条件阈值不是默认价格旋钮。 */
export function principal(parts:any):(string|number)[]|null{
 for(const [i,s]of (parts.stats??[]).entries())if(s.value>0)return ['stats',i,'value'];
 for(const [i,s]of (parts.zones??[]).entries())if(s.value>0)return ['zones',i,'value'];
 for(const key of ['conversions','conditional'])for(const [i,s]of (parts[key]??[]).entries())if((s.ratio??s.value)>0)return [key,i,'ratio'in s?'ratio':'value'];
 for(const key of ['patches','slotPatches'])for(const [i,p]of (parts[key]??[]).entries())for(const [j,op]of p.ops.entries())if(typeof op.value==='number'&&op.value>0&&/damage|ratio|attack/i.test(op.path))return [key,i,'ops',j,'value'];
 for(const [i,r]of (parts.rules??[]).entries())for(const key of ['ratio','flat'])if(typeof r.action[key]==='number'&&r.action[key]>0)return ['rules',i,'action',key];
 for(const [i,r]of (parts.rules??[]).entries())for(const [key,value]of Object.entries(r.action.mods??{}))if(typeof value==='number'&&value>0)return ['rules',i,'action','mods',key];
 for(const [i,a]of (parts.atoms??[]).entries())if(a.tier>0)return ['atoms',i,'tier'];
 for(const key of ['statMultipliers','statusMultipliers'])for(const [stat,value]of Object.entries(parts[key]??{}))if(typeof value==='number'&&value>0)return [key,stat];
 return null;
}
export function inject(state:CharacterState,player:ResolvedPlayer,parts:any):ResolvedPlayer{
 const catalog=[{id:'spine-host-addition',name:'宿主配对来源',description:'测量输入',tier:'gold' as const,tags:['all'],parts:buildSourcePartsSchema.parse(parts)}];
 return {...player,build:rebuildFrozenAugmentBuild(freezeAugmentBasis(state,player.build),[catalog[0].id],catalog)};
}
const clean=(s:CharacterState)=>{for(const g of s.gear){delete g.aspectId;delete g.inscription;delete g.setId;}return s;};
function hostProfile(id:string,weapons:readonly string[]=[]){const explicit=buildVarietyProfiles.find(p=>p.id===id);return explicit&&(!weapons.length||weapons.includes(explicit.weapon))?explicit:buildVarietyProfiles.find(p=>!weapons.length||weapons.includes(p.weapon));}
export function hostState(id:string,weapons:readonly string[]=[]){if(id.startsWith('标准人:')){const family=id.slice('标准人:'.length);assert(['sword','staff','hidden'].includes(family),'缺少该武器标准人装配 '+family);return clean(standardState(50,family as 'sword'|'staff'|'hidden'));}const profile=hostProfile(id,weapons);if(profile){const state=clean(assembleBuildVariety(profile).state);if(state.skills.every(s=>skillWeaponAllowed(state,s)))return state;const native=skillCatalog.find(s=>s.damage>0&&skillWeaponAllowed(state,s.id));assert(native,'宿主武器没有原生技能');state.skills=[native.id,'ward'];state.skillRanks=Object.fromEntries(state.skills.map(s=>[s,5]));return state;}return clean(standardState(50,weapons.includes('hidden')?'hidden':weapons.includes('staff')?'staff':'sword'));}
function partsPair(id:string,host:string,parts:any,factor:number,path:ContentItem['path'],weapons:readonly string[]=[]){const state=hostState(host,weapons),base=resolvePlayer(id+'-without',state),copy=structuredClone(parts);if(path)put(copy,path,scaledPrimary(get(copy,path),path,factor));return {base,full:inject(state,{...base,id},copy)};}
export async function contentItems():Promise<ContentItem[]>{
 const census=await readJson('docs/reviews/numeric-spine-20261013/S0/census.json'),items:ContentItem[]=[];
 const host=(id:string)=>census.hosts.find((h:any)=>h.id===id)?.host??'标准人:sword';
 for(const [i,skill]of skillCatalog.entries()){
  const info=census.skills.find((s:any)=>s.id===skill.id),path:ContentItem['path']=skill.damage>0?['damage']:null;
  items.push({id:skill.id,category:'技能',group:[info.category,info.role,info.shape].join('/'),band:.1,primary:info.shape==='范围'?'DN':info.shape==='功能'?'P':'D1',object:skill,path,file:'packages/content/skill-coefficients.json',sourcePath:[skill.id],step:.01,offset:0,host:host(skill.id),make:(factor=1)=>{
   const state=hostState(host(skill.id),skillWeapons[skill.id]);
   if(info.shape==='功能'){const baseState=structuredClone(state);baseState.skills=baseState.skills.filter(s=>s!==skill.id);assert(baseState.skills.length,'功能技能需要保留宿主实际输出技能');const base=resolvePlayer(skill.id+'-without',baseState);state.skills=[...baseState.skills.slice(0,3),skill.id];state.skillRanks[skill.id]=5;const old=skill.damage;skill.damage=old*factor;let full;try{full=resolvePlayer(skill.id,state);}finally{skill.damage=old;}return {full,base};}
   state.skills=[skill.id];state.skillRanks={[skill.id]:5};const old=skill.damage;skill.damage=old*factor;let full;try{full=resolvePlayer(skill.id,state);}finally{skill.damage=old;}
   const base=structuredClone(full);base.id=skill.id+'-without';for(const s of base.build.skills)s.damage=0;
   return {full,base};
  }});
 }
 const addParts=(id:string,category:string,group:string,parts:any,file:string,sourcePath:(string|number)[],weapons:readonly string[]=[])=>{const path=principal(parts),value=path?get(parts,path):0;items.push({id,category,group,band:.15,primary:'P',object:parts,path,file,sourcePath:[...sourcePath,...(path??[])],step:value>=10||path?.at(-1)==='projectiles'?1:.05,offset:path?.[0]==='zones'&&get(parts,path.slice(0,-1)).kind==='mult'?1:0,host:host(id.split(':')[0]),make:(factor=1)=>partsPair(id,host(id.split(':')[0]),parts,factor,path,weapons)});};
 for(const [i,a]of newAspects.entries())if(!pacingProfiles.some(p=>p.aspect===a.id)){
  const path=principal(a.parts),value=path?get(a.parts,path):0;
  items.push({id:a.id,category:'词条',group:a.slots.join('/'),band:.15,primary:'P',object:a.parts,path,file:'packages/content/aspects.json',sourcePath:[i,'parts',...(path??[])],step:value>=10?1:.05,offset:0,host:host(a.id),make:(factor=1)=>{
   const state=hostState(host(a.id),a.weapons),base=resolvePlayer(a.id+'-without',state),g=state.gear.find(g=>a.slots.includes(g.slot));assert(g,'宿主没有合法威能槽');g.aspectId=a.id;g.quality='legendary';if(path)put(a.parts,path,value*factor);let full;try{full=resolvePlayer(a.id,state);}finally{if(path)put(a.parts,path,value);}return {base,full};
  }});
 }
 for(const [i,s]of setEffects.entries())for(const part of ['two','four'] as const)addParts(s.id+':'+part,'套装',part,s[part],'packages/content/set-effects.json',[i,part],[s.family]);
 for(const [i,a]of augments.entries())addParts(a.id,'潮印',a.tier+'/'+(a.tags.includes('all')?'通用':a.tags.join('/')),a.parts,'packages/content/augments.json',[i,'parts']);
 for(const [category,nodes]of [['天赋',talentDefinitions],['巅峰',paragonDefinitions]] as const)for(const node of nodes){
  const path=node.modifiers.length?['modifiers',0,'value']:null,value=path?get(node,path):0;
  items.push({id:node.id,category,group:category==='天赋'?(node as any).branch+'/'+(node as any).tier:String((node as any).board),band:.15,primary:'P',object:node,path,file:'packages/content/progression-node-values.json',sourcePath:[node.id,0],step:value>=1?1:.05,offset:0,host:'标准人50',make:(factor=1)=>{
   const state=standardState(50),p=state.progression!;if(category==='天赋')p.talents={};else p.paragon=[];const base=resolvePlayer(node.id+'-without',structuredClone(state));if(category==='天赋')p.talents[node.id]=1;else p.paragon=[node.id];if(path)put(node,path,value*factor);let full;try{full=resolvePlayer(node.id,state);}finally{if(path)put(node,path,value);}return {full,base};
  }});
 }
 for(const [slot,atoms]of Object.entries(inscriptionConfig.slots))for(const atom of atoms){
  const id=slot+':'+atom,state=hostState(host(atom)),base=resolvePlayer(id+'-without',state),g=state.gear.find(g=>g.slot===slot)!;g.inscription={atomId:atom,tier:.5};
  items.push({id,category:'铭文',group:'0.5',band:.15,primary:'P',object:inscriptionConfig,path:null,file:'packages/content/inscriptions.json',sourcePath:[],step:.05,offset:0,host:'标准人:sword',make:()=>({base,full:resolvePlayer(id,state)})});
 }
 return items;
}
