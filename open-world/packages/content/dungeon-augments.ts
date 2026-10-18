import {z} from 'zod';
import source from './dungeons.json';
import {augmentPolicySchema} from '../contracts/run-augments.ts';
import type {DungeonDefinition} from '../contracts/dungeons.ts';
export const dungeonAugmentPublicSchema=z.object({enabled:z.boolean(),choices:z.literal(3),rerolls:z.number().int().nonnegative().max(100),roundCount:z.number().int().nonnegative().max(100)}).strict();
export const dungeonAugmentExtraSchema=z.object({minimumWorldTier:z.number().int().positive(),bossHpRatio:z.number().positive().max(1),weights:augmentPolicySchema.shape.rounds.element}).strict();
/** Server-only tier probabilities; public policy exposes only switch/counts. */
export const dungeonAugmentPolicy=augmentPolicySchema.parse(source.augments);

export const dungeonAugmentExtra=source.augmentExtra?dungeonAugmentExtraSchema.parse(source.augmentExtra):undefined;
/** Creation-time per-dungeon settings; old runs keep their saved policy. */
export function resolveRunAugmentPolicy(definition:DungeonDefinition,worldTier:number){
 const selected=definition.policy.augments;
 if(!selected?.enabled||!dungeonAugmentPolicy.enabled)return {policy:augmentPolicySchema.parse({...dungeonAugmentPolicy,enabled:false,rounds:[]}),extra:undefined};
 if(selected.roundCount<1||selected.roundCount>dungeonAugmentPolicy.rounds.length)throw Error('Unsupported declared augment round count');
 const policy=augmentPolicySchema.parse({...dungeonAugmentPolicy,rerolls:selected.rerolls,rounds:structuredClone(dungeonAugmentPolicy.rounds.slice(0,selected.roundCount))});
 const extra=worldTier>=(dungeonAugmentExtra?.minimumWorldTier??Infinity)&&selected.roundCount===dungeonAugmentPolicy.rounds.length?structuredClone(dungeonAugmentExtra):undefined;
 if(extra)policy.rounds.push(extra.weights);
 return {policy,extra};
}
