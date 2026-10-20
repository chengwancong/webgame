import {expect,it} from 'vitest';
import raw from '../packages/content/hex-runes.json';
import {hexRuneCatalogSchema,hexRunes,publicHexRunes} from '../packages/content/hex-runes.ts';
import {describeAspectRule} from '../packages/content/aspect-description.ts';
import {effectRuleSchema} from '../packages/contracts/effects.ts';
import {hexCategories,publicHexRuneSchema} from '../packages/contracts/hex-runes.ts';

it('shares the six authored categories and validates the released sample identities',()=>{
 expect(hexCategories).toEqual(['attack','defense','control','mobility','resource','synergy']);
 for(const category of hexCategories){
  expect(hexRuneCatalogSchema.parse([{...raw[0],category}])[0].category).toBe(category);
  expect(publicHexRuneSchema.parse({...publicHexRunes[0],category}).category).toBe(category);
 }
 expect(publicHexRuneSchema.safeParse({...publicHexRunes[0],category:'unregistered'}).success).toBe(false);
 expect(hexRunes.map(r=>({id:r.id,category:r.category}))).toEqual([{id:'hex-chain-lightning',category:'attack'},{id:'hex-aftershock',category:'attack'},{id:'hex-detonation-sigil',category:'synergy'},{id:'hex-footfall-heal',category:'mobility'},{id:'hex-control-to-shield',category:'defense'},{id:'hex-cast-hit-relay',category:'synergy'},{id:'hex-void-rift',category:'attack'},{id:'hex-mark-relay',category:'synergy'},{id:'hex-bee-volley',category:'attack'}]);
});

it('accepts the staged sample with the existing four gear qualities',()=>{
 expect(Object.keys(hexRunes[0].tiers)).toEqual(['common','magic','rare','legendary']);
 expect(Object.values(hexRunes[0].tiers).map(t=>t.rules[0].action)).toMatchObject([
  {type:'arc',count:3},{type:'arc',count:4},{type:'arc',count:5},{type:'arc',count:6}
 ]);
});
it('rejects missing qualities and undeclared epic instead of exposing incomplete catalogue data',()=>{
 const bad:any=structuredClone(raw);
 bad[0].tiers.epic=bad[0].tiers.rare;delete bad[0].tiers.rare;
 expect(hexRuneCatalogSchema.safeParse(bad).success).toBe(false);
});
it('rejects duplicate rune and effect identities and incorrect source binding',()=>{
 expect(hexRuneCatalogSchema.safeParse([...raw,...raw]).success).toBe(false);
 const duplicate=structuredClone(raw);duplicate[0].tiers.magic.rules[0].id=duplicate[0].tiers.common.rules[0].id;
 expect(hexRuneCatalogSchema.safeParse(duplicate).success).toBe(false);
 const wrong=structuredClone(raw);wrong[0].tiers.common.rules[0].source='hex-unknown';
 expect(hexRuneCatalogSchema.safeParse(wrong).success).toBe(false);
});
it('rejects unsupported fromEffect filters present in the draft follow-up rules',()=>{
 const bad:any=structuredClone(raw);bad[0].tiers.rare.rules[0].filter.fromEffect='hex-chain-lightning-r';
 expect(hexRuneCatalogSchema.safeParse(bad).success).toBe(false);
});
it('publishes actual arc parameters and status meaning without leaking executable rules',()=>{
 const tiers=publicHexRunes[0].tiers;
 expect(tiers.common.description).toContain('最多3个目标');expect(tiers.common.description).toContain('射程4格');
 expect(tiers.common.description).toContain('伤害50%');expect(tiers.common.description).toContain('保留70%');
 expect(tiers.common.description).toContain('触发率30%');expect(tiers.common.description).toContain('触发间隔2秒');
 expect(tiers.rare!.description).toContain('移动速度降低20%');expect(tiers.rare!.description).toContain('持续2秒');
 expect(tiers.legendary!.description).toContain('受到伤害提高25%');expect(tiers.legendary!.description).toContain('持续3秒');
 expect(tiers.magic.description).not.toContain('施加');
 for(const quality of ['common','magic','rare','legendary'] as const){
  expect(tiers[quality]!.description).toBe(hexRunes[0].tiers[quality]!.rules[0].description);
  expect(tiers[quality]).not.toHaveProperty('rules');
 }
});
it('changes the wording when rule parameters change without a second numeric table',()=>{
 const rule=effectRuleSchema.parse({...hexRunes[0].tiers.common.rules[0],chance:.25,icd:90,action:{type:'arc',ratio:.8,count:2,range:6,damageType:'lightning',decay:.5}});
 const text=describeAspectRule(rule);
 for(const expected of ['最多2个目标','射程6格','伤害80%','保留50%','触发率25%','触发间隔3秒'])expect(text).toContain(expected);
});
it('describes the real aftershock slow field instead of presenting it as zero damage',()=>{
 const rune=publicHexRunes.find(r=>r.id==='hex-aftershock')!;
 for(const quality of ['rare','legendary'] as const){
  expect(rune.tiers[quality]!.description).toContain('减速（移动速度降低30%）');
  expect(rune.tiers[quality]!.description).toContain('持续2秒');
  expect(rune.tiers[quality]!.description).not.toContain('造成0%');
 }
});
