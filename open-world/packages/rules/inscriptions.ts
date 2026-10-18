import {randomInt} from 'node:crypto';
import {inscriptionConfig as config} from '../content/inscriptions.ts';
import {inscriptionSchema,inscriptionRubbingSchema,inscriptionSlotSchema,type Inscription,type InscriptionRubbing} from '../contracts/inscriptions.ts';
import type {GearQuality,Slot} from '../contracts/index.ts';
import type {AtomReference} from './atom-parts.ts';
export type InscriptionRandom={float:()=>number;int:(min:number,max:number)=>number};
const random:InscriptionRandom={float:Math.random,int:randomInt};
function roll(rng:InscriptionRandom){const n=rng.float();if(!Number.isFinite(n)||n<0||n>=1)throw Error('Invalid inscription random draw');return n;}
function validateForSlot(slot:Slot,value:Inscription){const parsed=inscriptionSchema.parse(value),part=inscriptionSlotSchema.parse(slot);if(!config.slots[part].includes(parsed.atomId))throw Error('Inscription is not allowed in this slot');return parsed;}
/** Issuance only. No read, reconnect or reroll path should call this function. */
export function rollInscription(gear:{slot:Slot;quality:GearQuality},rng:InscriptionRandom=random,policy=config):Inscription|undefined{
 if(gear.slot==='core')return;const chance=policy.chance[gear.quality];if(chance===0||chance<1&&roll(rng)>=chance)return;const pool=policy.slots[gear.slot],index=rng.int(0,pool.length);if(!Number.isInteger(index)||index<0||index>=pool.length)throw Error('Invalid inscription pool draw');return inscriptionSchema.parse({atomId:pool[index],tier:policy.tier});
}
/** Call only after the application has authorized and deduplicated salvage. */
export function extractInscriptionRubbing(gear:{slot:Slot;inscription?:Inscription},rng:InscriptionRandom=random):InscriptionRubbing|undefined{
 if(!gear.inscription)return;const inscription=validateForSlot(gear.slot,gear.inscription);if(roll(rng)>=config.extractChance)return;return inscriptionRubbingSchema.parse({...inscription,slot:gear.slot});
}
/** The application owns currency debit, rubbing consumption and item mutation. */
export function imprintInscription(slot:Slot,rubbing:InscriptionRubbing):Inscription{
 const parsed=inscriptionRubbingSchema.parse(rubbing);if(parsed.slot!==slot)throw Error('Rubbing requires the same equipment slot');return validateForSlot(slot,{atomId:parsed.atomId,tier:parsed.tier});
}
export function collectInscriptionAtoms(worn:{id:string;name:string;slot:Slot;inscription?:Inscription}[]):AtomReference[]{return worn.flatMap(g=>{if(!g.inscription)return [];const value=validateForSlot(g.slot,g.inscription);return [{id:value.atomId,tier:value.tier,source:'铭纹：'+g.name}];});}
export {inscriptionRubbings} from '../content/inscription-rubbings.ts';
