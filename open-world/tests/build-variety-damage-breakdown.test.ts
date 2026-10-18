// numeric-spine S3/S4/S7：只同步已应用计划的精确值；机制与幂等断言保留。
import {it,expect} from 'vitest';
import {damageBreakdown,conditionDescription} from '../apps/web/src/damage-breakdown-model.ts';
import {DamageBreakdown} from '../apps/web/src/components/DamageBreakdown.ts';
import {effectAtoms} from '../packages/content/effect-atoms.ts';
import {newAspectById} from '../packages/content/aspects.ts';
import {skillCatalog,regionById} from '../packages/content/index.ts';
import {World} from '../packages/simulation/index.ts';
import type {Stats} from '../packages/contracts/index.ts';
const base:Stats={hp:1000,attack:20,armor:20,mana:1000,speed:6,regen:0,effects:[]};
it('keeps pools and tag scopes separate instead of showing a hypothetical total as actual damage',()=>{
 const stats:Stats={...base,zones:[{id:'fire',label:'火焰伤害',pool:'type',kind:'add',value:.2,tags:['fire']},{id:'general',label:'等级精通',kind:'add',value:.3},{id:'power',label:'星潮之力',pool:'mult',kind:'mult',value:1.3}],conditional:[{id:'stat-vsBoss',pool:'cond',value:.24,when:{kind:'target_rank',ranks:['boss']}}],vulnerableBonus:.2,critChance:.15,critMultiplier:1.7},before=structuredClone(stats),data=damageBreakdown(stats,[],null);
 expect(data.types.map(r=>r.value)).toEqual([.2,.3]);expect(data.types[0].detail).toBe('火焰');expect(data.independent[0].value).toBe(1.3);expect(data.conditional[0].detail).toBe('目标为首领');expect(data.critical).toEqual({chance:.15,multiplier:1.7});expect(data.vulnerableBonus).toBe(.2);expect(stats).toEqual(before);expect(data.rules).toBeNull();
});
it('projects the actual combat rule count and damage, including previously frozen rule IDs',()=>{
 const rule=structuredClone(effectAtoms.find(r=>r.id==='atom-thunder')!),skill=structuredClone(skillCatalog.find(s=>s.id==='cut')!),stats={...base,rules:[rule]},w=new World({...regionById('meadow'),safe:{x:10,y:10},obstacles:[]},stats,[skill],[{id:'t',name:'靶',kind:'ranged',x:12,y:10,hp:10000,attack:0,boss:false,elite:false,art:'raider'}]);w.setMode('manual');w.upperBound=true;w.enemies[0].cooldown=100000;expect(w.cast('cut',w.enemies[0])).toBe(true);for(let i=0;i<5;i++)w.step();expect(w.effectStats[rule.id].count).toBe(1);expect(w.effectStats[rule.id].damage).toBeGreaterThan(0);
 const data=damageBreakdown(stats,[skill],w.effectStats);expect(data.rules!.find(r=>r.id===rule.id)).toMatchObject(w.effectStats[rule.id]);expect(damageBreakdown(base,[],w.effectStats).rules![0].name).toBe('先前的装备效果');
});
it('distinguishes missing telemetry from a real battle with no trigger yet',()=>{
 expect(DamageBreakdown(base,[],null)).toContain('尚未收到本场统计');expect(DamageBreakdown(base,[],{})).toContain('本场尚未触发效果');expect(DamageBreakdown(base,[],null)).not.toContain('0 次');expect(damageBreakdown(base,[],null).critical.multiplier).toBe(1.5);
});
it('renders source-provided values through public components and escapes content',()=>{
 const stats={...base,zones:[{id:'unsafe',label:'<img onerror=alert(1)>',kind:'add' as const,value:.2}],rules:[{...effectAtoms[0],name:'<script>bad</script>'}]},html=DamageBreakdown(stats,[],{[effectAtoms[0].id]:{count:7,damage:125}});expect(html).toContain('data-ui="stat"');expect(html).toContain('+20%');expect(html).toContain('7 次');expect(html).toContain('125');expect(html).toContain('&lt;script&gt;');expect(html).not.toContain('<script>');expect(html).not.toContain('<img onerror=');
});
it('describes grouped conditions with their real operators and thresholds',()=>{
 expect(conditionDescription({kind:'all',conditions:[{kind:'distance',op:'lte',value:3},{kind:'target_hp',op:'lt',value:.35}]})).toBe('目标距离不高于3 格，且目标生命低于35%');
 expect(conditionDescription({kind:'self_state',state:'still',value:3})).toBe('保持静止达到 3 秒');expect(conditionDescription({kind:'self_state',state:'mana',value:.7})).toBe('剩余能量达到 70%');
});
it('maps technical source identifiers to player names without leaking catalogue IDs into copy',()=>{
 const stats={...base,rules:[{...effectAtoms[0],source:'set-sword-standard'}]},log={[effectAtoms[0].id]:{count:1,damage:0}};expect(damageBreakdown(stats,[],log).rules![0].source).toBe('装备效果');expect(damageBreakdown(stats,[],log,{'set-sword-standard':'割裂'}).rules![0].source).toBe('割裂');
});
it('keeps conditional lifesteal and defense out of conditional damage and shows resolved passive multipliers',()=>{
 const blood=structuredClone(effectAtoms.find(r=>r.id==='atom-bloodthirst')!),bone=structuredClone(effectAtoms.find(r=>r.id==='atom-bone')!);if(blood.action.type!=='amplify'||bone.action.type!=='amplify')throw Error('Wrong fixture');blood.action.ratio=.125;bone.action.ratio=.02;
 const stats:Stats={...base,rules:[blood,bone],conditional:[{id:'low-life-steal',pool:'stat',stat:'lifestealMultiplier',value:2,when:{kind:'self_hp',op:'lt',value:.3}},{id:'stationary-defense',pool:'stat',stat:'damageReduction',value:.05,when:{kind:'self_state',state:'still',value:1}},{id:'stat-vsLow',pool:'cond',value:.2,when:{kind:'target_hp',op:'lt',value:.35}}]},data=damageBreakdown(stats,[],null);
 expect(data.conditional.map(c=>c.id)).toEqual(['stat-vsLow']);expect(data.independent.find(r=>r.id===blood.id)).toMatchObject({value:1.125,unit:'multiple'});expect(data.independent.find(r=>r.id===bone.id)).toMatchObject({value:.02,unit:'percent'});expect(data.independent.find(r=>r.id===bone.id)!.detail).toContain('各层加成一起生效');
 expect(DamageBreakdown(stats,[],null)).not.toContain('×2');expect(DamageBreakdown(stats,[],null)).toContain('1.125 倍');
});
it('uses real element restrictions in condition descriptions rather than an unspecified skill label',()=>{expect(conditionDescription({kind:'skill',damageTypes:['fire','cold']})).toBe('作用于火焰、冰霜技能');});
it('shows the real burn-only scope of an independent aspect multiplier',()=>{
 const rule=newAspectById.get('aspect-st-ember')!.parts.rules[0],data=damageBreakdown({...base,rules:[rule]},[],null),row=data.independent.find(r=>r.id===rule.id)!;
 expect(row.value).toBe(1.3);expect(row.detail).toContain('作用于燃烧伤害');expect(row.detail).not.toContain('全部技能');
});
it('does not mislabel a per-tick zone value as a whole cast or hit poison as additional damage',()=>{
 const skills=['poison_arrow','fire_arrow','miasma'].map(id=>structuredClone(skillCatalog.find(s=>s.id===id)!)),data=damageBreakdown(base,skills,null);
 expect(data.skills.find(s=>s.id==='poison_arrow')!.detail).toContain('命中造成的中毒已计入总伤害');expect(data.skills.find(s=>s.id==='poison_arrow')!.detail).not.toContain('附加中毒');
 expect(data.skills.find(s=>s.id==='fire_arrow')!.detail).toContain('命中附加燃烧伤害 9');
 expect(data.skills.find(s=>s.id==='miasma')).toMatchObject({label:'瘴气 · 每段',value:4});expect(data.skills.find(s=>s.id==='miasma')!.detail).toContain('共5段');expect(data.skills.find(s=>s.id==='miasma')!.detail).toContain('地面附加中毒伤害 6');
});
