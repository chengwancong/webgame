import type {Gear} from '../../../packages/contracts/index.ts';
import legacyBases from '../../../packages/rules/gear-bases.json';
import {collectionGearTemplates} from '../../../packages/content/equipment-runtime.ts';
import {progressionGearTemplates} from '../../../packages/content/deep-progression.ts';
const gearBases=[...legacyBases,...collectionGearTemplates,...progressionGearTemplates.map(g=>({base:g.base,reinforcement_per_rank:2}))];
import {mainStatValues} from '../../../packages/rules/main-stat-values.ts';
import {primaryReinforcement} from '../../../packages/rules/combat-numerics.ts';
import {gearMaxRank} from '../../../packages/rules/item-power.ts';

/** Snapshot-projected legacy mainStat is a base value, not a migration to v2 mechanics. */
export function displayMainStat(g:Gear){
 if(!g.mainStat)return undefined;
 if(g.attributeVersion===2)return mainStatValues(g);
 const definition=gearBases.find(d=>d.base===g.base);
 if(!definition)return undefined;
 const base=g.mainStat.value;
 const enhancement=primaryReinforcement(base,definition.reinforcement_per_rank,g.rank,gearMaxRank(g,5));
 return {stat:g.mainStat.stat,base,enhancement,effective:base+enhancement};
}
