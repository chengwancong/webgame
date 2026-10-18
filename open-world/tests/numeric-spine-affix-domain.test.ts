import {it,expect} from 'vitest';
import {gearAffixConfig,gearAffixConfigSchema,generateAffixes} from '../packages/rules/affix-generator.ts';
it('主干定价产生的flat非整数下界在配置边界拒绝，避免正式发放返回500',()=>{
 const config=structuredClone(gearAffixConfig),row=config.pool.find(a=>a.stat==='speed'&&a.tier===2)!;row.minValue=.65;
 expect(()=>gearAffixConfigSchema.parse(config)).toThrow('Invalid affix range or unit');
});
it('真实crypto随机入口能够发放归一后的速度词缀，数值保持合法整数域',()=>{
 const config=structuredClone(gearAffixConfig),row=config.pool.find(a=>a.stat==='speed'&&a.tier===2)!;config.pool=[row];config.quality.rare.count=[1,1];
 const [affix]=generateAffixes('rare',2,undefined,config);expect(affix.stat).toBe('speed');expect(Number.isSafeInteger(affix.value)).toBe(true);expect(affix.value).toBeGreaterThanOrEqual(row.minValue);expect(affix.value).toBeLessThanOrEqual(row.maxValue);
});
