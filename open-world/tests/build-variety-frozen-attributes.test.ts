import {it,expect} from 'vitest';
import {resolveBuild,makeGearByBase} from '../packages/rules/index.ts';
import {freezeAugmentBasis,rebuildFrozenAugmentBuild,frozenAugmentContext} from '../packages/rules/frozen-augment-build.ts';
import {augmentDescription} from '../packages/rules/augment-descriptions.ts';
import {assembleBuildVariety,buildVarietyProfiles} from '../tools/build-variety-builds.ts';
import {freezeAttributeEffects,resolveAttributeEffects} from '../packages/rules/attribute-effects.ts';
import {augments} from '../packages/content/augments.ts';
import {statRegistry} from '../packages/contracts/stats.ts';
import {regionById,skillCatalog} from '../packages/content/index.ts';
import {effectRuleSchema} from '../packages/contracts/effects.ts';
import {World} from '../packages/simulation/index.ts';
import type {CharacterState} from '../packages/contracts/index.ts';
import {randomUUID} from 'node:crypto';
const player=()=>{const g=makeGearByBase('standard-sword-t1-weapon',randomUUID()),s:CharacterState={id:randomUUID(),name:'属性潮印复核',revision:1,build:1,level:50,xp:0,gold:0,material:0,gear:[g],equipment:{weapon:g.id},skills:['cut'],skillRanks:{cut:1},progress:{kills:0,regions:['town'],bosses:[],tasks:[],safe:'town'}};return s;};
const basis=()=>{const s=player(),b=resolveBuild(s);return freezeAugmentBasis(s,{stats:b.stats,skills:b.resolvedSkills});};
it('a status-chance augment creates all five executable hit rules and actually applies them',()=>{
 const initial=basis(),b=rebuildFrozenAugmentBuild(initial,['aug-s-status'],structuredClone(augments));expect(initial.stats.igniteChance).toBeUndefined();
 for(const stat of ['igniteChance','chillChance','shockChance','poisonChance','bleedChance'])expect(b.stats.rules!.find(r=>r.id==='stat-'+stat)?.chance).toBe(.2);
 const w=new World({...regionById('meadow'),safe:{x:10,y:10},obstacles:[]},b.stats,b.skills,[{id:'status-target',name:'状态靶',kind:'ranged',x:12,y:10,hp:1000000,attack:0,boss:false,elite:false,art:'raider'}],[],41);w.setMode('manual');w.upperBound=true;w.enemies[0].cooldown=100000;expect(w.cast('cut',w.enemies[0])).toBe(true);for(let i=0;i<10;i++)w.step();
 for(const kind of ['burn','slow','shock','poison','bleed'])expect(w.statuses.some(s=>s.targetId==='status-target'&&s.effect.kind===kind)).toBe(true);
});
it('rebuilds from the frozen base once without duplicating chances, rules or changing the source',()=>{
 const initial=basis(),before=structuredClone(initial),catalog=structuredClone(augments),a=rebuildFrozenAugmentBuild(initial,['aug-s-status'],catalog),b=rebuildFrozenAugmentBuild(initial,['aug-s-status'],catalog);
 expect(b).toEqual(a);expect(initial).toEqual(before);expect(new Set(a.stats.rules!.map(r=>r.id)).size).toBe(a.stats.rules!.length);
});
it('uses creation-time stat caps and defaults even if current global content has changed',()=>{
 const initial=basis(),catalog=structuredClone(augments),expected=rebuildFrozenAugmentBuild(initial,['aug-s-status'],catalog),definition=statRegistry.find(s=>s.id==='igniteChance')!,saved=structuredClone(definition);
 try{definition.cap=.01;definition.default=.33;expect(rebuildFrozenAugmentBuild(initial,['aug-s-status'],catalog)).toEqual(expected);}finally{Object.assign(definition,saved);}
});
it('the same frozen attribute executor owns kill recovery units and conditional damage',()=>{
 const config=freezeAttributeEffects(),resolved=resolveAttributeEffects({hp:100,attack:20,armor:0,mana:50,speed:6,regen:0,effects:[],manaOnKill:6,lifeOnKill:.02,cooldownOnKill:.2,vsLow:.2},config);
 expect(resolved.rules.find(r=>r.id==='stat-manaOnKill')!.action).toMatchObject({type:'mana',flat:6});expect(resolved.rules.find(r=>r.id==='stat-lifeOnKill')!.action).toMatchObject({type:'heal',ratio:.02});expect(resolved.rules.find(r=>r.id==='stat-cooldownOnKill')!.action).toMatchObject({type:'cooldown',ticks:6});expect(resolved.conditional).toContainEqual({id:'stat-vsLow',pool:'cond',value:.2,when:{kind:'target_hp',op:'lt',value:.35}});
});
it('rebuild and runtime filters use frozen skill classifications instead of current catalogue categories',()=>{
 const initial=basis(),catalog=structuredClone(augments),expected=rebuildFrozenAugmentBuild(initial,['aug-s-crit'],catalog),definition=skillCatalog.find(s=>s.id==='cut')!,saved=definition.category;
 try{definition.category='spell';const actual=rebuildFrozenAugmentBuild(initial,['aug-s-crit'],catalog);expect(actual).toEqual(expected);
  const probe=effectRuleSchema.parse({id:'frozen-melee-probe',name:'冻结近战标签',description:'命中近战目标回复能量',source:'测试',tier:1,trigger:'hit',chance:1,icd:0,filter:{tags:['melee']},when:[],action:{type:'mana',ratio:0,flat:5},scale:[],vfxKey:'player/cut'});
  const w=new World({...regionById('meadow'),safe:{x:10,y:10},obstacles:[]},{...actual.stats,regen:0,rules:[probe]},actual.skills,[{id:'category-target',name:'标签靶',kind:'ranged',x:12,y:10,hp:1000000,attack:0,boss:false,elite:false,art:'raider'}],[],41);w.setMode('manual');w.hero.mana=0;w.enemies[0].cooldown=100000;expect(w.cast('cut',w.enemies[0])).toBe(true);for(let i=0;i<10;i++)w.step();expect(w.effectStats[probe.id].count).toBe(1);expect(w.hero.mana).toBe(5);
 }finally{definition.category=saved;}
});
it('single-skill gambling multiplies both direct and attached periodic budgets once',()=>{
 const s=player(),g=makeGearByBase('standard-staff-t1-weapon',randomUUID());s.gear=[g];s.equipment={weapon:g.id};s.skills=['fireball','meteor'];s.skillRanks={fireball:1,meteor:1};const original=resolveBuild(s),initial=freezeAugmentBasis(s,{stats:original.stats,skills:original.resolvedSkills}),result=rebuildFrozenAugmentBuild(initial,['aug-p-solo'],structuredClone(augments));
 // 主干S3/plan.json：aug-p-solo由3倍归一为2.95倍；仍验证直接及持续预算恰好各缩放一次。
 expect(result.skills).toHaveLength(1);expect(result.skills[0].damage).toBe(Math.round(original.resolvedSkills[0].damage*2.95));
 expect(result.skills[0].mechanics!.statuses.find(s=>s.kind==='burn')!.total).toBe(Math.round(original.resolvedSkills[0].mechanics!.statuses.find(s=>s.kind==='burn')!.total!*2.95));
});
it('offer context keeps resolved melee and main-stat tags and raises only active two-piece sets for full resonance',()=>{
 const sword=basis();expect(frozenAugmentContext(sword,[],augments).tags).toContain('melee');expect(frozenAugmentContext(sword,[],augments).tags).not.toContain('spell');expect(frozenAugmentContext(sword,['aug-p-fullset'],augments).sets['set-sword-standard']).toBe(1);
 const formed=assembleBuildVariety(buildVarietyProfiles.find(p=>p.id==='burn')!),frozen=freezeAugmentBasis(formed.state,formed.build),before=structuredClone(frozen),context=frozenAugmentContext(frozen,['aug-p-fullset'],augments);
 expect(context.tags).toContain('fire');expect(context.sets['set-staff-primal']).toBe(4);expect(frozen.setCounts['set-staff-primal']).toBe(2);expect(frozen).toEqual(before);
});
it('gold atom cards describe their executed tier while special resonance keeps its own explicit description',()=>{
 const frozen=basis(),bone=augments.find(a=>a.id==='aug-g-bone')!,spin=augments.find(a=>a.id==='aug-g-whirl-edge')!,special=augments.find(a=>a.id==='aug-g-set-rend')!;
 expect(augmentDescription(bone,frozen.atoms)).toContain('+6.4%');expect(augmentDescription(bone,frozen.atoms)).not.toContain('+4%');expect(augmentDescription(spin,frozen.atoms)).toContain('+24%');expect(augmentDescription(special,frozen.atoms)).toBe(special.description);
});

it('a source multiplier on an omitted base stat keeps the frozen default after global defaults change',()=>{
 const initial=basis();delete initial.stats.critMultiplier;const catalog=structuredClone(augments),definition=catalog.find(a=>a.id==='aug-s-critdmg')!;definition.parts.stats=[];definition.parts.statMultipliers={critMultiplier:2};const expected=rebuildFrozenAugmentBuild(initial,[definition.id],catalog),live=statRegistry.find(d=>d.id==='critMultiplier')!,before=live.default;
 try{live.default=4;expect(rebuildFrozenAugmentBuild(initial,[definition.id],catalog)).toEqual(expected);expect(expected.stats.critMultiplier).toBe(3);}finally{live.default=before;}
});
