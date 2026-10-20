import type {Spawn} from '../contracts/index.ts';
/** Authored encounter values override only newly resolved spawns. Saved waves never pass through here. */
export function applyEncounterOverrides(spawn:Spawn,overrides:{encounter_hp?:number;encounter_attack?:number}):Spawn{
 const hp=overrides.encounter_hp,attack=overrides.encounter_attack;
 if(hp===undefined&&attack===undefined)return spawn;
 if(hp!==undefined&&(!Number.isSafeInteger(hp)||hp<1)||attack!==undefined&&(!Number.isSafeInteger(attack)||attack<0))throw Error('Invalid encounter override');
 if(!spawn.monster)throw Error('Encounter overrides require a resolved monster');
 const result=structuredClone(spawn);
 if(hp!==undefined){result.hp=hp;result.monster!.baseStats.hp=hp/result.monster!.difficulty.hp;}
 if(attack!==undefined){result.attack=attack;result.monster!.baseStats.attack=attack/result.monster!.difficulty.attack;}
 return result;
}
