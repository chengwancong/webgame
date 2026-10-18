import type {CharacterState,Gear} from '../contracts/index.ts';
import {isProgressionGearReferenced} from './deep-progression.ts';

// Bulk cleanup is deliberately conservative; individual salvage keeps its explicit confirmation.
export function batchSalvageProtected(s:CharacterState,g:Gear){
 return g.locked||g.rank>0||g.quality==='legendary'||Boolean(g.aspectId)||Object.values(s.equipment).includes(g.id)||isProgressionGearReferenced(s,g.id);
}
export function batchSalvageCandidates(s:CharacterState){return s.gear.filter(g=>!batchSalvageProtected(s,g));}
