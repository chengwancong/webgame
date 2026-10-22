import {z} from 'zod';
export {hubRewardPlanSchema,hubRewardEvidenceSchema} from './hub-reward-schema.ts';
import {challengeContentSchema} from '../../packages/content/progression-challenges.ts';
import {newAspectSchema} from '../../packages/content/aspects.ts';
import {augmentDefinitionSchema} from '../../packages/content/augments.ts';
import {setEffectsSchema} from '../../packages/content/set-effects.ts';
import {gearAffixConfigSchema} from '../../packages/rules/affix-generator.ts';
import {deepProgressionConfigSchema} from '../../packages/content/deep-progression.ts';
import {resolveMonsterContent} from '../../packages/content/monsters.ts';
import {dungeonContentSchema} from '../../packages/content/dungeons.ts';
import {eliteAffixContentSchema} from '../../packages/contracts/monsters.ts';
import {worldTiersSchema} from '../../packages/contracts/open-world.ts';
import {inscriptionAtomSchema} from '../../packages/contracts/inscriptions.ts';
import {inscriptionContentSchema} from '../../packages/content/inscriptions.ts';
import {stageKeyPoolsContentSchema} from '../../apps/api/src/stage-key-pools.ts';
import {fieldLootContentSchema} from '../../apps/api/src/field-loot.ts';
import {hexLootContentSchema} from '../../apps/api/src/hex-loot.ts';
import {hexRuneCatalogSchema} from '../../packages/content/hex-runes.ts';
import {hexPolicyContentSchema} from '../../packages/content/hex-policy.ts';
import {skillCostsSchema} from '../../packages/content/skill-costs.ts';
import type {SpineSchemas} from './apply.ts';
const n=z.number().finite().nonnegative(),i=n.int(),positive=n.positive();
const sequential=(values:number[])=>values.every((v,k)=>!k||v>=values[k-1]);
export const spineSchemas:SpineSchemas={
 'packages/content/progression-challenges.json':challengeContentSchema,
 'packages/content/skill-costs.json':skillCostsSchema,
 'packages/content/hex-runes.json':hexRuneCatalogSchema,
 'packages/content/hex-policy.json':hexPolicyContentSchema,
 'packages/content/aspects.json':z.array(newAspectSchema).length(60),
 'packages/content/augments.json':z.array(augmentDefinitionSchema).length(90),
 'packages/content/set-effects.json':setEffectsSchema,
 'packages/content/gear-affixes.json':gearAffixConfigSchema,
 'packages/content/deep-progression.json':deepProgressionConfigSchema,
 'packages/content/monsters.json':{parse:resolveMonsterContent},
 'packages/content/elite-affixes.json':eliteAffixContentSchema,
 'packages/content/dungeons.json':dungeonContentSchema,
 'packages/content/world-tiers.json':worldTiersSchema,
 'packages/content/inscriptions.json':inscriptionContentSchema,
 'apps/api/src/stage-key-pools.json':stageKeyPoolsContentSchema,
 'apps/api/src/field-loot.json':fieldLootContentSchema,
 'apps/api/src/hex-loot.json':hexLootContentSchema,
 'packages/content/progression-curve.json':z.object({version:i.positive(),source:z.string(),thresholds:z.array(i.positive()).min(49).refine(sequential,'经验需求非单调')}).strict(),
 'packages/content/skill-coefficients.json':z.record(z.string().min(1),positive),
 'packages/content/progression-node-values.json':z.record(z.string().min(1),z.array(n)),
 'packages/content/spine-rate-limits.json':z.object({killsPerSecond:z.number().int().min(15)}).strict(),
};
