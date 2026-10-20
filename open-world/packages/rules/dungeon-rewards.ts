import type {DungeonDefinition} from '../contracts/dungeons.ts';

/** Only the success bonus, not accumulated kills, chests, quests or random loot.
 * Uses the run's frozen definition at settlement; no balance parameters change.
 */
export function dungeonCompletionReward(definition:DungeonDefinition,tier:number){
 const multiplier=1+(tier-definition.policy.minTier)*definition.policy.tierRules.rewardPerTier;
 return {gold:Math.round(definition.reward.gold*multiplier),xp:Math.round(definition.reward.xp*multiplier),material:Math.round(definition.reward.material*multiplier)};
}
