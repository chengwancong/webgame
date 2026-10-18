import {it,expect} from 'vitest';
import {newAspects} from '../packages/content/aspects.ts';
import {generateAspectDescription,describeAspectRule,percent,seconds} from '../packages/content/aspect-description.ts';
import {mechanismAspectIds} from '../tools/pacing/mechanisms.ts';
const numericTokens=(s:string)=>s.match(/\d+(?:\.\d+)?/g)??[];
it.each([...mechanismAspectIds])('%s 的词条、每条规则与真实参数一致，数字没有手写分叉',id=>{
 const a=newAspects.find(a=>a.id===id)!;expect(a.description).toBe(generateAspectDescription(a));expect(a.parts.rules.some(r=>r.id.startsWith('pacing-'))).toBe(false);
 for(const r of a.parts.rules){expect(r.description).toBe(describeAspectRule(r));expect(r.name).not.toMatch(/\d/);expect(r.description).not.toMatch(/触发率100%|触发间隔0秒|超过0秒|(?<![\d.])0%/);if(r.chance!==1)expect(r.description).toContain(percent(r.chance));if(r.icd!==0)expect(r.description).toContain(seconds(r.icd));const action=r.action;
  if('ratio' in action&&action.ratio!==0)expect(r.description).toContain(percent(action.ratio));if('strength'in action&&action.strength!==0)expect(r.description).toContain(percent(action.strength));if('duration'in action&&r.trigger!=='passive')expect(r.description).toContain(seconds(action.duration));if('count'in action)expect(r.description).toContain(String(action.count));if('radius'in action&&action.radius!==0)expect(r.description).toContain(String(action.radius));if(action.type==='buff')for(const value of Object.values(action.mods))expect(r.description).toContain(percent(value));
  if(r.every)expect(r.description).toContain(r.trigger==='mana_spent'?String(r.every):seconds(r.every));
  for(const condition of r.when){if('value'in condition&&condition.value!==undefined&&condition.value!==0)expect(r.description).toContain(condition.kind==='target_hp'||condition.kind==='self_hp'?percent(condition.value):String(condition.value));if('radius'in condition&&condition.radius!==undefined)expect(r.description).toContain(String(condition.radius));}
 }
 // 独立参数遍历：文本中每个数字都须来自机制数值或明确的引擎单位换算。
 const allowed=new Set<string>();const walk=(value:unknown)=>{if(typeof value==='number'){allowed.add(String(Number(value.toFixed(4))));allowed.add(String(Number((value*100).toFixed(4))));allowed.add(String(Number((value/30).toFixed(4))));allowed.add(String(Number((value*30).toFixed(4))));}else if(value&&typeof value==='object')for(const v of Object.values(value))walk(v);};walk(a.parts);if(a.parts.flags?.dotCrit)allowed.add('50');
 for(const value of numericTokens(a.description))expect(allowed.has(value),'没有对应参数的文案数字 '+value).toBe(true);
});
it('机制数字改变会改变描述，条件阈值和触发间隔不会被掩盖',()=>{
 const a=structuredClone(newAspects.find(a=>a.id==='aspect-st-ember')!),r=a.parts.rules.find(r=>r.action.type==='shield')!;const before=generateAspectDescription(a);r.icd=150;if(r.action.type==='shield')r.action.ratio=.25;const after=generateAspectDescription(a);expect(after).not.toBe(before);expect(after).toContain('触发间隔5秒');expect(after).toContain('最大生命25%');
});
