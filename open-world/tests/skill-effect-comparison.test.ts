import {describe,it,expect} from 'vitest';
import {highlightEffectNumbers,renderSkillEffectComparison} from '../apps/web/src/ui/skill-effects.ts';
import {resourceCostHtml} from '../apps/web/src/ui-components.ts';
import type {Skill} from '../packages/contracts/index.ts';
const skill:Skill={id:'example',name:'效果对比',kind:'single',damage:28,range:2,cost:10,cooldown:30,windup:3,duration:0,radius:0,description:'普通攻击。'};
const changed=(html:string)=>[...html.matchAll(/class="effect-number num is-changed"[^>]*>(.*?)<\/span>/g)].map(m=>m[1]);
describe('complete skill effect comparison',()=>{
 it('highlights every changed number in a compound formula and a changed trigger, preserving the whole condition',()=>{
  const before='每普攻6次，造成52.8%+110伤害。目标兵力低于自身时，伤害翻倍。',after='每普攻5次，造成52.93%+154伤害。目标兵力低于自身时，伤害翻倍。';
  const result=highlightEffectNumbers(before,after);expect(changed(result.before)).toEqual(['6','52.8%','+110']);expect(changed(result.after)).toEqual(['5','52.93%','+154']);expect(result.before).toContain('目标兵力低于自身时，伤害翻倍。');expect(result.after).toContain('目标兵力低于自身时，伤害翻倍。');
 });
 it('aligns repeated numbers and added clauses without shifting unchanged parameters',()=>{
  const result=highlightEffectNumbers('攻击6次，造成6伤害，持续2秒。','攻击5次，造成6伤害，减速15%，持续2秒。');expect(changed(result.before)).toEqual(['6']);expect(changed(result.after)).toEqual(['5','15%']);
 });
 it('keeps removed effects readable and escapes effect text instead of executing markup',()=>{
  const result=highlightEffectNumbers('获得20护盾。持续2秒。<img src=x>','持续2秒。');expect(changed(result.before)).toEqual(['20']);expect(changed(result.after)).toEqual([]);expect(result.before).toContain('&lt;img src=x&gt;');expect(result.before).not.toContain('<img');
 });
 it('marks all resolved parameter changes on both ranks, including zero costs and optional parameters',()=>{
  const next={...skill,damage:31,cost:0,cooldown:24,range:4,radius:2,duration:60,windup:1,pull:2,projectiles:3,projectileSpread:.2};
  const html=renderSkillEffectComparison(skill,next,1);for(const key of ['damage','cost','cooldown','range','radius','duration','windup','pull','projectiles','projectileSpread'])expect(html.match(new RegExp(`is-changed" data-effect-value="${key}"`,'g'))).toHaveLength(2);expect(html).toContain('data-effect-value="cost">0</span>');
 });
 it('preserves prose changes even if numeric parameters are identical',()=>{
  const html=renderSkillEffectComparison(skill,{...skill,description:'命中后解除减益效果。'},1);expect(html).toContain('普通攻击。');expect(html).toContain('命中后解除减益效果。');expect(html).not.toContain('数值不变');
 });
 it('renders only required costs, with per-resource availability and accessible states',()=>{
  const html=resourceCostHtml([{id:'gold',label:'金币',amount:60,owned:80,availability:'enough'},{id:'material',label:'强化石',amount:3,owned:0,availability:'short'}],'升级消耗',{display:'requirements'});
  expect(html).not.toContain('持有');expect(html).not.toContain('ui-cost__owned');expect(html).not.toContain('ui-cost__state');expect(html).toContain('金币，需要 60，数量足够');expect(html).toContain('强化石，需要 3，数量不足');
  const largeWallet=resourceCostHtml([{id:'gold',label:'金币',amount:60,owned:1e12,availability:'enough'}],'升级消耗',{display:'requirements'});expect(largeWallet).toContain('data-long-values="false"');expect(largeWallet).not.toContain('1,000,000,000,000');
 });
});
