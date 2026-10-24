import {it,expect} from 'vitest';
import {effectAtoms} from '../packages/content/effect-atoms.ts';
import {resolveAtomParts,overrideEffectRules,ruleOverrideSchema} from '../packages/rules/atom-parts.ts';
it('deduplicates atom identities by maximum tier and scales declared numbers exactly once',()=>{
 const raw=effectAtoms.find(r=>r.id==='atom-quake')!,before=structuredClone(raw),out=resolveAtomParts([{id:raw.id,tier:.5,source:'inscription'},{id:raw.id,tier:1.25,source:'set'},{id:raw.id,tier:1,source:'aspect'}]);
 expect(out).toHaveLength(1);expect(out[0].tier).toBe(1.25);expect(out[0].source).toBe('set');expect((out[0].action as any).ratio).toBeCloseTo((raw.action as any).ratio*1.25);expect(out[0].icd).toBe(raw.icd);expect(raw).toEqual(before);
});
it('resolves all 50 atom references with no silent missing definition',()=>{
 expect(resolveAtomParts(effectAtoms.map(r=>({id:r.id,tier:.5,source:'test'})))).toHaveLength(50);expect(()=>resolveAtomParts([{id:'unknown',tier:1,source:'test'}])).toThrow('Unknown atom');
});
it('applies atom-specific overrides after tier scaling and retains independent references',()=>{
 const inputs=[{id:'atom-quake',tier:1.5,source:'hammer'},{id:'atom-thunder',tier:1,source:'wand'}],raw=resolveAtomParts(inputs),out=resolveAtomParts(inputs,[{target:'atom-quake',set:{icd:0},add:{'action.radius':1},mul:{'action.ratio':2}}]);
 expect(out[0].icd).toBe(0);expect((out[0].action as any).radius).toBe((raw[0].action as any).radius+1);expect((out[0].action as any).ratio).toBeCloseTo((raw[0].action as any).ratio*2);expect(out[1]).toEqual(raw[1]);
});
it('supports explicit legacy/set groups and caps only amplified probability',()=>{
 const raw=resolveAtomParts([{id:'atom-quake',tier:1,source:'set-hammer-standard'}]),out=overrideEffectRules(raw,[{target:'legacy-combos',set:{icd:0},mul:{chance:10}}],{'legacy-combos':['atom-quake']});expect(out[0].icd).toBe(0);expect(out[0].chance).toBe(1);expect(raw[0].icd).not.toBe(0);
});
it('supports nested condition array paths and validates the resulting condition',()=>{
 const raw=resolveAtomParts([{id:'atom-overflow',tier:1,source:'test'}]),out=overrideEffectRules(raw,[{target:'atom-overflow',set:{'when.0.value':.3}}]);expect((out[0].when[0] as any).value).toBe(.3);expect((raw[0].when[0] as any).value).not.toBe(.3);
});
it('rejects unknown fields, nonnumeric multiply operations and prototype paths',()=>{
 const raw=resolveAtomParts([{id:'atom-quake',tier:1,source:'test'}]);expect(()=>overrideEffectRules(raw,[{target:'*',set:{'action.unknown':true}}])).toThrow();expect(()=>overrideEffectRules(raw,[{target:'*',mul:{name:2}}])).toThrow('numeric');expect(ruleOverrideSchema.safeParse({target:'*',set:{'__proto__.polluted':true}}).success).toBe(false);expect(({} as any).polluted).toBeUndefined();
});
