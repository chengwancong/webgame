import {writeFile,mkdir} from 'node:fs/promises';
import {regions} from '../packages/content/index.ts';
import {rewardFor,dropProfileFor,chanceExpectation,gearTemplatesForRegion,worldGearTemplates,equipmentDropRules} from '../apps/api/src/economy.ts';
import {collectionEquipment} from '../packages/content/equipment-runtime.ts';
import {gearBases,upgradeCost,skillUpgradeCost} from '../packages/rules/index.ts';
import {versions} from '../packages/contracts/index.ts';
import {challengeContent} from '../packages/content/progression-challenges.ts';
import {progressionConfig,progressionGearTemplates} from '../packages/content/deep-progression.ts';
const templates=worldGearTemplates(gearBases);
const slots=['weapon','armor','helmet','boots','accessory','ring','core'] as const;
const rows=regions.filter(r=>r.id!=='town'&&!r.boss).map(area=>{
 const p=dropProfileFor(area.id),normalCount=area.spawns.filter(m=>!m.elite).length,eliteCount=area.spawns.filter(m=>m.elite).length;
 const pool=gearTemplatesForRegion(templates,area.id),weight=(template:typeof pool[number])=>{const item=collectionEquipment(template.base);return item?equipmentDropRules.seriesWeights[item.series]:1;},totalWeight=pool.reduce((sum,template)=>sum+weight(template),0);
 const expected=(kind:'normal'|'elite'|'boss',quality?:'magic'|'rare'|'legendary')=>p[kind].gearPercent/100*(quality?p[kind].quality[quality]/100:1);
 const expectedGear=normalCount*expected('normal')+eliteCount*expected('elite');
 const fieldReward={gold:0,xp:0,material:0};for(const m of area.spawns){const gain=rewardFor(area.id,m.elite?'elite':'normal');for(const key of ['gold','xp','material'] as const)fieldReward[key]+=gain[key];}
 const bossReward=rewardFor(area.id,'boss');
 return {area:area.id,name:area.name,normalCount,eliteCount,normalChance:p.normal.gearPercent,normalQuality:p.normal.quality,eliteQuality:p.elite.quality,repeatBossQuality:p.boss.quality,firstBossQuality:p.firstBoss,maxAffixTier:p.maxAffixTier,normalReward:rewardFor(area.id,'normal'),eliteReward:rewardFor(area.id,'elite'),bossReward,fullFieldReward:fieldReward,
  fullFieldExpectedGear:expectedGear,fullFieldExpectedRare:normalCount*expected('normal','rare')+eliteCount*expected('elite','rare'),fullFieldExpectedLegendary:normalCount*expected('normal','legendary')+eliteCount*expected('elite','legendary'),
  normalGear:chanceExpectation(expected('normal')),repeatLegendary:chanceExpectation(expected('boss','legendary')),
  slotForecast:Object.fromEntries(slots.map(slot=>{const fraction=pool.filter(g=>g.slot===slot).reduce((sum,template)=>sum+weight(template),0)/totalWeight;return [slot,{fraction,repeatRare:chanceExpectation(expected('boss','rare')*fraction),repeatLegendary:chanceExpectation(expected('boss','legendary')*fraction)}];})),
  firstClearGuaranteedGear:eliteCount+1,firstClearExpectedGear:expectedGear+1,firstClearExpectedRareOrLegendary:normalCount*(expected('normal','rare')+expected('normal','legendary'))+eliteCount*(expected('elite','rare')+expected('elite','legendary'))+1,
  firstClearReward:{gold:fieldReward.gold+bossReward.gold,xp:fieldReward.xp+bossReward.xp,material:fieldReward.material+bossReward.material}};
});
const report={versions,basis:'Exact expectation from current server weights, uniform current world-template choice and resolved per-kill resources; no RNG samples or unrevealed candidates.',limits:'Full field assumes one complete authored wave, followed by one boss. Means and 95% counts are statistical expectations, not pity/guarantees. Actual clear time varies; no kills/hour assumption. A guaranteed rarity does not guarantee a particular slot or affix. Legendary essence is awarded by raid/recipes, not automatically by every legendary gear drop.',worldTemplates:templates.map(g=>({base:g.base,slot:g.slot})),rows,
 progression:{gearReinforcementPrices:Array.from({length:5},(_,rank)=>({rankFrom:rank,...upgradeCost(rank)})),skillUpgradePrices:Array.from({length:4},(_,i)=>({rankFrom:i+1,...skillUpgradeCost(i+1)})),highDailyShared:challengeContent.limits.highDaily,raidWeeklyShared:challengeContent.limits.raidWeekly,highVictoryLoot:'One deterministic omega weapon: forest/tundra = omega-bow; other high trials = omega-blade. When inventory is full, convert to configured fragments instead of issuing an item.',omegaEightGridVictoryMinimum:8,omegaEightGridDayMinimum:Math.ceil(8/challengeContent.limits.highDaily),highMaterials:progressionConfig.rewards.high,raidMaterials:progressionConfig.rewards.raid,uncapDuplicates:progressionConfig.uncapDuplicates,uncapFragments:progressionConfig.uncapFragments}};
await mkdir(new URL('../../docs/reviews/open-world/campaign-balance-20261001/',import.meta.url),{recursive:true});await writeFile(new URL('../../docs/reviews/open-world/campaign-balance-20261001/drop-expectations.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(rows.map(r=>({area:r.area,normal:r.normalChance,legendary:r.repeatBossQuality.legendary,meanLegendary:r.repeatLegendary.meanKills,legendary95:r.repeatLegendary.killsFor95Percent,firstClearExpectedGear:r.firstClearExpectedGear,reward:r.firstClearReward})),null,2));
