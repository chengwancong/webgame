import {it,expect} from 'vitest';
import {freezeStageKeyRewardRules,grantStageKeyOutputs,stageKeyOutputSchema} from '../apps/api/src/stage-key-rewards.ts';
import {standardState} from '../tools/spine/player.ts';
import {gearAffixConfig,generateGearAffixes,maxAffixTierForItemLevel} from '../packages/rules/affix-generator.ts';
import {generateGuaranteedAffix} from '../packages/rules/guaranteed-affix.ts';
const random=(seed:number)=>{let x=seed;const next=()=>((x=(x*1664525+1013904223)>>>0)/2**32);return {float:next,int:(a:number,b:number)=>a+Math.floor(next()*(b-a))};};
const base={kind:'gear' as const,slot:'weapon' as const,quality:'rare' as const,count:1,series:'standard' as const};
it.each(['sword','staff','hidden'] as const)('declares item-level and repair-tendency on %s without mutating frozen sources',family=>{
 const s=standardState(30,family),frozen=freezeStageKeyRewardRules(),before=structuredClone(frozen),old=structuredClone(s.gear);
 const result=grantStageKeyOutputs(s,[{...base,itemLevel:1,guaranteedOutput:'repair-tendency',starterAttack:true}],30,frozen,random(42),()=> '00000000-0000-4000-8000-000000009999').gear[0];
 expect(result.ilvl).toBe(1);expect(result.quality).toBe('rare');
 expect(result.affixes.filter(a=>a.stat===frozen.repairTendencyStats[family==='staff'?'spell':'martial'])).toHaveLength(1);
 expect(result.affixes.filter(a=>a.stat==='attack')).toHaveLength(1);expect(result.affixes.find(a=>a.stat==='attack')!.value).toBe(frozen.starterAttackAffix);
 expect(s.gear.slice(0,old.length)).toEqual(old);expect(frozen).toEqual(before);
});
it('old outputs and snapshots do not acquire a new policy or consume additional RNG',()=>{
 const fresh=freezeStageKeyRewardRules(),old=structuredClone(fresh);delete (old as any).repairTendencyStats;delete (old as any).starterAttackAffix;
 const a=standardState(30,'sword'),b=structuredClone(a),id=()=> '00000000-0000-4000-8000-000000009998';
 expect(grantStageKeyOutputs(a,[base],3,fresh,random(41),id)).toEqual(grantStageKeyOutputs(b,[base],3,old,random(41),id));
});
it('rejects malformed policies and unsupported body/set guarantees',()=>{
 for(const input of [{...base,itemLevel:0},{...base,itemLevel:1.5},{...base,guaranteedOutput:'unknown'},{...base,slot:'armor',guaranteedOutput:'repair-tendency'},{...base,count:2,guaranteedOutput:'repair-tendency'}])expect(()=>stageKeyOutputSchema.parse(input)).toThrow();
});
it('shared guaranteed generator preserves the former crafting RNG/value algorithm',()=>{
 for(const stat of ['physicalDamage','spellDamage'])for(const level of [1,4,10,23])for(const seed of [1,41,42]){
  const candidates=gearAffixConfig.pool.filter(r=>r.stat===stat),allowed=candidates.filter(r=>r.tier<=maxAffixTierForItemLevel(level)),minimum=[...candidates].sort((a,b)=>a.tier-b.tier)[0],scaled=allowed.length>0;
  const forced={...gearAffixConfig,pool:scaled?allowed:[{...minimum,maxValue:minimum.minValue}],quality:{...gearAffixConfig.quality,magic:{count:[1,1] as [number,number],tiers:gearAffixConfig.quality.rare.tiers}}};
  const expected=generateGearAffixes({quality:'magic',slot:'weapon',...(scaled?{ilvl:level}:{})},3,random(seed),forced)[0];
  expect(generateGuaranteedAffix({slot:'weapon',ilvl:level},stat,random(seed))).toEqual(expected);
 }
});
