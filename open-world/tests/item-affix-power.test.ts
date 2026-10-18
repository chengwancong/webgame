import {it,expect} from 'vitest';
import {applyItemPower,scaleItemAffixes,gearStages} from '../packages/rules/item-power.ts';
import {generateAffixes,generateGearAffixes,gearAffixConfig,affixDefinitions,maxAffixTierForItemLevel} from '../packages/rules/affix-generator.ts';
import {makeGearByBase,resolveBuild} from '../packages/rules/index.ts';
import {campaignCharacter} from '../tools/campaign-model.ts';
import type {GearAffix} from '../packages/contracts/index.ts';

const fixed={int:(min:number)=>min,float:()=>0};
const samples:GearAffix[]=['attack','armor','hp','speed','mana','regen','critChance'].map((stat,i)=>({id:'sample-'+i,name:stat,stat,tier:2,value:stat==='critChance'?.08:2,description:stat+' sample'}));
it('same-tier movement and resources retain exactly the same values at T1 and T8',()=>{
 const before=structuredClone(samples),t1=scaleItemAffixes(samples,1),t8=scaleItemAffixes(samples,45);
 for(const stat of ['speed','mana','regen','critChance'])expect(t8.find(a=>a.stat===stat)).toEqual(t1.find(a=>a.stat===stat));
 for(const stat of ['attack','armor','hp'])expect(t8.find(a=>a.stat===stat)?.value).toBe(48);
 expect(samples).toEqual(before);
 const gear=makeGearByBase('standard-sword-t1-weapon','sample');gear.affixes=structuredClone(samples);
 const high=applyItemPower(gear,45);expect(high.affixes).toEqual(t8);expect(high.stage).toBe(8);expect(high.attack).toBeGreaterThan(9);
});
it('drop and reroll generation obey level/quality gates and the same stage ranges',()=>{
 expect([1,9,10,17,22,23,45].map(maxAffixTierForItemLevel)).toEqual([1,1,2,2,2,3,3]);
 for(const stage of gearStages)for(const quality of ['common','magic','rare','legendary'] as const){
  const gear={quality,ilvl:stage.level},affixes=generateGearAffixes(gear,3,fixed);
  expect(generateGearAffixes(gear,3,fixed)).toEqual(affixes);
  const rule=gearAffixConfig.quality[quality];expect(affixes.length).toBeLessThanOrEqual(rule.count[1]);
  for(const a of affixes){expect(a.tier).toBeLessThanOrEqual(maxAffixTierForItemLevel(gear.ilvl));expect(rule.tiers).toContain(a.tier);const entry=affixDefinitions.find(e=>e.stat===a.stat&&e.tier===a.tier)!;const scale=['attack','armor','hp'].includes(a.stat)?stage.scale:1;expect(a.value).toBeGreaterThanOrEqual((scale===1?entry.minValue:Math.round(entry.minValue*scale)));expect(a.value).toBeLessThanOrEqual((scale===1?entry.maxValue:Math.round(entry.maxValue*scale)));}
 }
 expect(generateGearAffixes({quality:'rare',ilvl:45},1,fixed).every(a=>a.tier===1)).toBe(true);
});
it('legacy generation and read-only build resolution do not rewrite saved instance fields',()=>{
 expect(generateGearAffixes({quality:'rare'},3,fixed)).toEqual(generateAffixes('rare',3,fixed));
 const state=campaignCharacter('starter'),gear=state.gear[0];gear.ilvl=45;gear.stage=8;gear.rank=3;gear.locked=true;gear.affixes=structuredClone(samples);gear.affixes.find(a=>a.stat==='speed')!.value=72;
 const before=structuredClone(state.gear);resolveBuild(state);resolveBuild(state);expect(state.gear).toEqual(before);
});
