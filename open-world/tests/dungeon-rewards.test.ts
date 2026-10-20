import {it,expect} from 'vitest';
import {dungeonContent} from '../packages/content/dungeons.ts';
import {dungeonCompletionReward} from '../packages/rules/dungeon-rewards.ts';
import {dungeonRewardPreviewQuerySchema} from '../packages/contracts/dungeon-rewards.ts';
import {validateResponse} from '../packages/contracts/index.ts';

it('preserves current nightmare completion bonuses and rounding across all authored tiers',()=>{
 const d=dungeonContent.definitions.find(d=>d.id==='nightmare')!;
 expect(dungeonCompletionReward(d,1)).toEqual({gold:500,xp:350,material:40});
 expect(dungeonCompletionReward(d,10)).toEqual({gold:680,xp:476,material:54});
 expect(dungeonCompletionReward(d,100)).toEqual({gold:2480,xp:1736,material:198});
 for(const definition of dungeonContent.definitions)for(let tier=definition.policy.minTier;tier<=definition.maxTier;tier++){
  const result=dungeonCompletionReward(definition,tier),mult=1+(tier-definition.policy.minTier)*definition.policy.tierRules.rewardPerTier;
  for(const key of ['gold','xp','material'] as const)expect(result[key]).toBe(Math.round(definition.reward[key]*mult));
 }
});
it('validates the query and the actual client response route, not a generic ok response',()=>{
 expect(dungeonRewardPreviewQuerySchema.parse({dungeon_id:'nightmare',tier:'10'}).tier).toBe(10);
 for(const tier of ['',0,-1,1.5,'NaN','Infinity'])expect(dungeonRewardPreviewQuerySchema.safeParse({dungeon_id:'nightmare',tier}).success).toBe(false);
 const preview={dungeon_id:'nightmare',tier:10,scope:'completion_bonus',reward:{gold:680,xp:476,material:54}};
 expect(validateResponse('dungeons/reward-preview?dungeon_id=nightmare&tier=10',preview)).toEqual(preview);
 expect(()=>validateResponse('dungeons/reward-preview',{ok:true})).toThrow();
 expect(()=>validateResponse('dungeons/reward-preview',{...preview,reward:{...preview.reward,gear:[]}})).toThrow();
});
