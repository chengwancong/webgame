import {it,expect} from 'vitest';
import {freshSkillCharges,consumeSkillCharge,chargeReadiness,reduceSkillChargeCooldown,skillChargeStateSchema} from '../packages/simulation/skill-charges.ts';
it('allows two uses and recharges sequentially without repeatedly restarting progress',()=>{
 const fresh=freshSkillCharges(2),one=consumeSkillCharge(fresh,10,90),two=consumeSkillCharge(one,20,90);expect(fresh.spentUntil).toEqual([]);expect(one.spentUntil).toEqual([100]);expect(two.spentUntil).toEqual([100,190]);expect(chargeReadiness(two,99)).toEqual({available:0,next:1});expect(chargeReadiness(two,100)).toEqual({available:1,next:90});expect(chargeReadiness(two,190)).toEqual({available:2,next:0});expect(()=>consumeSkillCharge(two,99,90)).toThrow('No skill charges');expect(two.spentUntil).toEqual([100,190]);
});
it('a regained charge can be spent while the other recharge continues',()=>{
 const twice=consumeSkillCharge(consumeSkillCharge(freshSkillCharges(2),0,90),5,90),spentAgain=consumeSkillCharge(twice,100,90);expect(spentAgain.spentUntil).toEqual([180,270]);expect(chargeReadiness(spentAgain,179)).toEqual({available:0,next:1});
});
it('snapshot restoration preserves deadlines and changing cooldown affects only the new use',()=>{
 const one=consumeSkillCharge(freshSkillCharges(2),0,90),restored=skillChargeStateSchema.parse(JSON.parse(JSON.stringify(one))),two=consumeSkillCharge(restored,50,45);expect(two.spentUntil).toEqual([90,135]);expect(chargeReadiness(restored,50)).toEqual(chargeReadiness(one,50));
});
it('cooldown reduction preserves queue spacing and reset restores stored charges',()=>{
 const twice=consumeSkillCharge(consumeSkillCharge(freshSkillCharges(2),0,90),5,90),reduced=reduceSkillChargeCooldown(twice,50,30);expect(reduced.spentUntil).toEqual([60,150]);expect(chargeReadiness(reduced,60).available).toBe(1);expect(reduceSkillChargeCooldown(twice,50,100).spentUntil).toEqual([140]);expect(chargeReadiness(reduceSkillChargeCooldown(twice,50,0,true),50).available).toBe(2);expect(twice.spentUntil).toEqual([90,180]);
});
it('repeated readiness reads never spend, refill, mutate or advance the battle clock',()=>{
 const state=consumeSkillCharge(freshSkillCharges(2),10,90),before=structuredClone(state);for(let i=0;i<100;i++)expect(chargeReadiness(state,50)).toEqual({available:1,next:50});expect(state).toEqual(before);
});
it('rejects invalid maxima, queue order, times and durations',()=>{
 expect(()=>freshSkillCharges(0)).toThrow();expect(()=>consumeSkillCharge(freshSkillCharges(2),1,0)).toThrow();expect(()=>chargeReadiness({max:2,spentUntil:[90,80]},1)).toThrow();expect(()=>chargeReadiness({max:1,spentUntil:[90,180]},1)).toThrow();expect(()=>chargeReadiness(freshSkillCharges(2),-1)).toThrow();expect(()=>reduceSkillChargeCooldown(freshSkillCharges(2),1,NaN)).toThrow();
});
