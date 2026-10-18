import {it,expect} from 'vitest';
import {worldTiersSchema} from '../packages/contracts/open-world.ts';
import raw from '../packages/content/world-tiers.json';
import {worldTiers,tierReward} from '../packages/rules/world-tier.ts';
import {rollGearDrop,encounterDropProfiles} from '../apps/api/src/economy.ts';

it('keeps every reward step at or below the threat step and numbers tiers from 1',()=>{
 expect(worldTiers.tiers.map(t=>t.tier)).toEqual([1,2,3,4]);
 const greedy=structuredClone(raw);greedy.tiers[1].reward.gear=2.5;expect(()=>worldTiersSchema.parse(greedy)).toThrow(/奖励gear增幅超过威胁增幅/);
 const gap=structuredClone(raw);gap.tiers.splice(1,1);expect(()=>worldTiersSchema.parse(gap)).toThrow(/连续编号/);
 expect(tierReward(2,{xp:10,gold:10,material:3})).toEqual({xp:12,gold:13,material:4});
});

it('scales only the legendary share of a drop by the tier gear factor',()=>{
 const profile=encounterDropProfiles.find(p=>p.elite.quality.legendary>0)!,weights=profile.elite.quality as Record<string,number>;expect(profile).toBeTruthy();
 // Enumerate every quality roll after a guaranteed drop roll.
 const share=(scale:number)=>{let total=0,legendary=0;const counts:Record<string,number>={};
  const span=scale===1?Object.values(weights).reduce((a,b)=>a+b,0):Object.entries(weights).reduce((a,[q,w])=>a+Math.round(w*100*(q==='legendary'?scale:1)),0);
  for(let i=0;i<span;i++){let n=0;const q=rollGearDrop({boss:false,elite:true},profile,false,(a,b)=>n++===0?a:i,scale)!;counts[q]=(counts[q]??0)+1;total++;if(q==='legendary')legendary++;}
  return {legendary:legendary/total,counts};};
 const one=share(1),scaled=share(1.35);
 expect(scaled.legendary/one.legendary).toBeGreaterThan(1.3);
 expect(Object.keys(scaled.counts).sort()).toEqual(Object.keys(one.counts).sort());
});
