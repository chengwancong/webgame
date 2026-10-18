import {randomInt} from 'node:crypto';
import type {Gear} from '../contracts/index.ts';
import {gearAffixConfig,generateGearAffixes,type AffixRandom} from './affix-generator.ts';
import {inscriptionConfig} from '../content/inscriptions.ts';
import {legacyAspectDefinitions,aspectDefinitions} from '../content/deep-progression.ts';
import {assignMainStat} from './main-stats.ts';
import {assignGearAspect,type AspectIssueDefinition} from './deep-progression.ts';
import {rollInscription} from './inscriptions.ts';
export function freezeItemRules(){return structuredClone({version:1 as const,affixes:gearAffixConfig,inscriptions:inscriptionConfig,aspects:aspectDefinitions.filter(a=>a.dropEnabled).map(a=>({id:a.id,slots:a.slots,requiredLevel:a.requiredLevel,weapons:a.weapons})) as AspectIssueDefinition[]});}
export type FrozenItemRules=ReturnType<typeof freezeItemRules>;
const random:AffixRandom={int:randomInt,float:Math.random};
/** Old permissions without this snapshot retain the old aspect catalogue and
 * never gain the newly introduced inscription roll. Existing items are not read here. */
export function issueCombatGear(g:Gear,ilvl:number,maxTier:number,level:number,mythic:boolean,snapshot:FrozenItemRules|undefined,rng:AffixRandom=random){const config=snapshot?.affixes??gearAffixConfig;assignMainStat(g,ilvl,rng,config);g.affixes=generateGearAffixes(g,maxTier,rng,config);assignGearAspect(g,rng.int(0,2147483647),level,mythic,snapshot?.aspects??legacyAspectDefinitions);if(snapshot){const inscription=rollInscription(g,rng,snapshot.inscriptions);if(inscription)g.inscription=inscription;}return g;}
