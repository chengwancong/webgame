import {it,expect} from 'vitest';
import {augmentRunSchema,publicAugmentRunSchema,type AugmentPolicy,type AugmentOption} from '../packages/contracts/run-augments.ts';
import {newAugmentRun,offerAugments,chooseAugment,rerollAugments,publicAugmentRun} from '../packages/rules/run-augments.ts';
const policy:AugmentPolicy={enabled:true,choices:3,rerolls:1,rounds:[[{tier:'silver',weight:.7},{tier:'gold',weight:.3}],[{tier:'gold',weight:1}]]};
const catalog:AugmentOption[]=['silver','gold','prismatic'].flatMap(tier=>Array.from({length:10},(_,i)=>({id:`${tier}-${i}`,tier:tier as AugmentOption['tier'],tags:i===0?['fire']:['all'],...(i===9?{requires:{setId:'sword',pieces:4}}:{})})));
const ctx={tags:['fire'],sets:{}},chooseId='00000000-0000-4000-8000-000000000001',rerollId='00000000-0000-4000-8000-000000000002';
it('100 deterministic seeds yield unique same-tier options with a build match and respect set requirements',()=>{
 for(let seed=1;seed<=100;seed++){
  const initial=newAugmentRun(seed,policy),before=structuredClone(initial),run=offerAugments(initial,policy,catalog,ctx);
  expect(run).toEqual(offerAugments(initial,policy,catalog,ctx));expect(initial).toEqual(before);expect(new Set(run.offered).size).toBe(3);
  const options=run.offered.map(id=>catalog.find(a=>a.id===id)!);expect(new Set(options.map(a=>a.tier)).size).toBe(1);expect(options.some(a=>a.tags.includes('fire'))).toBe(true);expect(options.some(a=>a.requires)).toBe(false);
  expect(augmentRunSchema.safeParse(run).success).toBe(true);
 }
});
it('rerolls retain the tier, avoid the old group, consume once and survive serialize/reconnect',()=>{
 const offered=offerAugments(newAugmentRun(41,policy),policy,catalog,ctx),version=offered.offerVersion,rerolled=rerollAugments(offered,rerollId,version,policy,catalog,ctx),restored=augmentRunSchema.parse(JSON.parse(JSON.stringify(rerolled)));
 const tier=catalog.find(a=>a.id===offered.offered[0])!.tier;expect(restored.offered.every(id=>catalog.find(a=>a.id===id)!.tier===tier)).toBe(true);expect(restored.offered.some(id=>offered.offered.includes(id))).toBe(false);expect(restored.rerollsLeft).toBe(0);
 expect(rerollAugments(restored,rerollId,version,policy,catalog,ctx)).toEqual(restored);expect(()=>rerollAugments(restored,chooseId,restored.offerVersion,policy,catalog,ctx)).toThrow('No rerolls');
});
it('chooses only the current offer, rejects stale versions and deduplicates matching commands',()=>{
 const offered=offerAugments(newAugmentRun(73,policy),policy,catalog,ctx),choice=offered.offered[0];
 expect(()=>chooseAugment(offered,chooseId,choice,offered.offerVersion-1)).toThrow('Offer has changed');expect(()=>chooseAugment(offered,chooseId,'not-offered',offered.offerVersion)).toThrow('not offered');
 const chosen=chooseAugment(offered,chooseId,choice,offered.offerVersion);expect(chosen.chosen).toEqual([choice]);expect(chosen.offered).toEqual([]);expect(chooseAugment(chosen,chooseId,choice,offered.offerVersion)).toEqual(chosen);
 expect(()=>chooseAugment(chosen,chooseId,'other',offered.offerVersion)).toThrow('different payload');expect(()=>rerollAugments(chosen,chooseId,offered.offerVersion,policy,catalog,ctx)).toThrow('different payload');
 const next=offerAugments(chosen,policy,catalog,ctx);expect(next.offered).not.toContain(choice);expect(next.round).toBe(2);
});
it('public views have no private RNG or command ledger and own their arrays',()=>{
 const run=offerAugments(newAugmentRun(107,policy),policy,catalog,ctx),view=publicAugmentRun(run);expect(Object.keys(view).sort()).toEqual(['chosen','offerVersion','offered','rerollsLeft','round']);expect(publicAugmentRunSchema.safeParse(view).success).toBe(true);view.offered.length=0;expect(run.offered.length).toBe(3);
});
it('disabled, exhausted, pending and malformed tables fail explicitly',()=>{
 const run=newAugmentRun(41,policy),offered=offerAugments(run,policy,catalog,ctx);
 expect(()=>offerAugments(run,{...policy,enabled:false},catalog,ctx)).toThrow('disabled');expect(()=>offerAugments(offered,policy,catalog,ctx)).toThrow('pending');expect(()=>offerAugments({...run,round:2},policy,catalog,ctx)).toThrow('rounds');
 expect(()=>offerAugments(run,policy,[catalog[0],catalog[0]],ctx)).toThrow('Duplicate');expect(()=>newAugmentRun(41,{...policy,rounds:[[{tier:'silver',weight:0}]]})).toThrow();expect(()=>chooseAugment(offered,'__proto__',offered.offered[0],offered.offerVersion)).toThrow();
});
it('requires enough candidates and one applicable option without inventing a hidden fallback',()=>{
 const run=newAugmentRun(41,policy),silver={...policy,rounds:[[{tier:'silver' as const,weight:1}]]};
 expect(()=>offerAugments(run,silver,catalog.slice(0,2),ctx)).toThrow('Not enough');expect(()=>offerAugments(run,silver,catalog.map(a=>({...a,tags:['cold']})),ctx)).toThrow('match');
 const offered=offerAugments(run,silver,catalog,{tags:[],sets:{}});expect(offered.offered.some(id=>catalog.find(a=>a.id===id)!.tags.includes('all'))).toBe(true);
});
it('reroll keeps the only applicable option when replacing it would leave three incompatible choices',()=>{
 const silver={...policy,rounds:[[{tier:'silver' as const,weight:1}]]},onlyMatch:AugmentOption[]=Array.from({length:8},(_,i)=>({id:'limited-'+i,tier:'silver',tags:i===0?['fire']:['cold']}));
 const offered=offerAugments(newAugmentRun(41,silver),silver,onlyMatch,ctx);expect(offered.offered).toContain('limited-0');
 const next=rerollAugments(offered,rerollId,offered.offerVersion,silver,onlyMatch,ctx);
 expect(next.offered).toContain('limited-0');expect(next.offered.filter(id=>id!=='limited-0').every(id=>!offered.offered.includes(id))).toBe(true);expect(next.rerollsLeft).toBe(0);expect(new Set(next.offered).size).toBe(3);
});
