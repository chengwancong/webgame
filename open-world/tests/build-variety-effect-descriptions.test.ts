import {it,expect} from 'vitest';
import {effectAtomById} from '../packages/content/effect-atoms.ts';
import {resolveAtomParts} from '../packages/rules/atom-parts.ts';
import {scaledDescription,describeUnifiedBonuses} from '../packages/rules/set-bonus-descriptions.ts';
import {effectRuleSchema} from '../packages/contracts/effects.ts';
const inscription=(id:string)=>scaledDescription(effectAtomById.get(id)!,resolveAtomParts([{id,tier:.5,source:'铭纹'}])[0]);
it('half-tier shield uses its actual armor coefficient while retaining its unscaled damage bonus',()=>{
 expect(inscription('atom-bulwark')).toContain('护甲 100% 的护盾');expect(inscription('atom-bulwark')).toContain('伤害提高 20%');expect(inscription('atom-bulwark')).not.toContain('护甲 +20%');
 expect(inscription('atom-ice-armor')).toContain('护甲 100%');expect(inscription('atom-ice-armor')).not.toContain('护甲 ×2');
});
it('a single bone, bleed or suppression inscription does not claim a full set of passive bonuses',()=>{
 expect(inscription('atom-bone')).toContain('+2%');expect(inscription('atom-bone')).not.toMatch(/攻击|吸血/);
 expect(inscription('atom-bleed')).toContain('20%');expect(inscription('atom-bleed')).not.toMatch(/暴击率|×1.25/);
 expect(inscription('atom-suppress')).toContain('提高 12.5%');expect(inscription('atom-suppress')).not.toMatch(/状态持续|传递/);
});
it('half-tier healing, movement charges and crit display executed values without scaling unrelated numbers',()=>{
 expect(inscription('atom-focus')).toContain('7.5%');
 expect(inscription('atom-drinking')).toContain('回复1.5%');expect(inscription('atom-drinking')).toContain('溢出治疗的20%');
 expect(inscription('atom-whirl-edge')).toContain('+7.5%');expect(inscription('atom-whirl-edge')).toContain('最多5层');expect(inscription('atom-whirl-edge')).not.toContain('移速 +10%');
 expect(inscription('atom-evasion')).not.toContain('闪避率 +6%');expect(inscription('atom-time-sand')).not.toContain('冷却缩减 +8%');
});
it('set bonuses keep their separate two-piece stats and four-piece atoms accurately described',()=>{
 const sword=describeUnifiedBonuses('set-sword-standard',1),bone=describeUnifiedBonuses('set-axe-standard',1);
 expect(sword['2']).toContain('8%');expect(sword['4']).toContain('40%');expect(sword['4']).toContain('提高 25%');expect(sword['4']).not.toContain('暴击率 +8%');
 // 主干S3/plan.json：set-axe-standard两件攻击加成10%→5%，四件机制保持原声明。
 expect(bone['2']).toContain('5%');expect(bone['4']).toContain('+4%');expect(bone['4']).toContain('吸血提高 100%');expect(bone['4']).not.toContain('攻击 +10%');
});
it('replaces original complete numeric tokens once rather than cascading or rewriting a suffix',()=>{
 const base=effectRuleSchema.parse({...effectAtomById.get('atom-focus'),description:'暴击率 +10%，暴击伤害 +20%，未缩放条件24%',scale:['action.mods.critChance','action.mods.critMultiplier'],action:{type:'buff',duration:90,maxStacks:1,mods:{critChance:.1,critMultiplier:.2}}});
 const actual=structuredClone(base);if(actual.action.type!=='buff')throw Error('Wrong test action');actual.action.mods={critChance:.2,critMultiplier:.4};
 expect(scaledDescription(base,actual)).toBe('暴击率 +20%，暴击伤害 +40%，未缩放条件24%');
});
