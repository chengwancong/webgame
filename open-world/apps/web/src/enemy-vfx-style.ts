import type {Entity} from '../../../packages/simulation/index.ts';
import {vfxProfiles,type SkillVfxProfile} from './vfx-profiles.ts';
export type EnemyFlightStyle={body:'source'|'ice'|'bone'|'void';length:number;width:number;trail:number;tipAnchor?:[number,number]};
export const castVfxGroup=(e:{id:string|number;sourceId?:string;castId?:number;skill?:string;vfxKey?:string})=>`${e.sourceId??e.id}:${e.vfxKey??e.skill??''}:${e.castId??''}`;
export const enemyFlightStyles:Record<string,EnemyFlightStyle>={
 'monster/basic-ranged':{body:'source',length:76,width:4,trail:4,tipAnchor:[1,.5]},
 'boss/basic-ranged':{body:'source',length:94,width:5,trail:5,tipAnchor:[1,.5]},
 'monster/ice_arrow':{body:'ice',length:42,width:15,trail:7},
 'boss/ice_lance':{body:'ice',length:64,width:21,trail:9},
 'monster/bone_spear':{body:'bone',length:62,width:12,trail:5},
 'boss/void_bolt':{body:'void',length:32,width:24,trail:9},
};
// These names select artwork only; they never assign elemental damage or change stats.
for(const namespace of ['monster','boss'])for(const [kind,element,motif]of [['shaman','shadow','ritual'],['artillery','fire','crater'],['charger','earth','fissure']] as const){
 const key=namespace+'/basic-area-'+kind;
 vfxProfiles[key]={...vfxProfiles[namespace+'/basic-area'],key,element,motif};
}
export function enemyPresentation(profile:SkillVfxProfile,owner:Pick<Entity,'kind'>|undefined){
 if(owner&&profile.key.endsWith('/basic-area'))return vfxProfiles[profile.key+'-'+owner.kind]??profile;
 return profile;
}
/** Always derive impact time from remaining simulation ticks, including the creation tick. */
export function warningPhase(clock:number,started:number,ends:number){
 const progress=Math.max(0,Math.min(1,(clock-started)/Math.max(1,ends-started)));
 return {progress,remaining:Math.max(0,ends-clock),urgent:ends-clock<=8,opening:Math.min(1,Math.max(0,(clock-started)/6))};
}
