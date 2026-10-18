import {gearWeaponAffinity} from '../../../packages/rules/weapon-skills.ts';
import {createHash,randomUUID} from 'node:crypto';
import type {AffixRandom} from '../../../packages/rules/affix-generator.ts';
/** Only a selected, publicly previewable recipe uses this stream. Random drops keep their private RNG. */
export function stageKeyRecipeRandom(character:string,scope:string,key:string):AffixRandom{
 let serial=0;const float=()=>createHash('sha256').update([character,scope,key,serial++].join(':')).digest().readUInt32BE(0)/2**32;
 return {float,int:(min:number,max?:number)=>{if(max===undefined){max=min;min=0;}return min+Math.floor(float()*(max-min));}};
}

/** Stable selected-recipe identities preserve staff affinity as well as the previewed rolls. */
export function stageKeyRecipeIds(character:string,scope:string,key:string,affinity:import('../../../packages/rules/weapon-skills.ts').WeaponAffinity|null){
 let serial=0;return (base:string,slot?:string)=>{const ordinal=serial++;for(let attempt=0;attempt<64;attempt++){const bytes=createHash('sha256').update([character,scope,key,ordinal,attempt].join(':')).digest();bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;const h=bytes.subarray(0,16).toString('hex'),id=h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);if(slot!=='weapon'||!affinity||gearWeaponAffinity({id,base,slot:'weapon'})===affinity)return id;}throw Error('Cannot preserve selected recipe weapon affinity');};
}

/** A randomly acquired stage key also guarantees the current staff affinity.
 * This changes only key identity selection; ordinary random gear and affix rolls are untouched. */
export function stageKeyRandomIds(affinity:import('../../../packages/rules/weapon-skills.ts').WeaponAffinity|null){
 return (base:string,slot:string)=>{for(let attempt=0;attempt<64;attempt++){const id=randomUUID();if(slot!=='weapon'||!affinity||gearWeaponAffinity({id,base,slot:'weapon'})===affinity)return id;}throw Error('Cannot preserve acquired stage key weapon affinity');};
}
