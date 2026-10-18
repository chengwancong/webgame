import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {pacingProfiles,pacingBuild} from './profiles.ts';
import {pacingEncounters} from './measure.ts';
import {freezeAugmentBasis,rebuildFrozenAugmentBuild} from '../../packages/rules/frozen-augment-build.ts';
import {augments} from '../../packages/content/augments.ts';
import {newAspects} from '../../packages/content/aspects.ts';
import {World} from '../../packages/simulation/index.ts';
import {regionById} from '../../packages/content/index.ts';
const out='docs/reviews/pacing-identity-20261013/C0';await mkdir(out,{recursive:true});
const original=JSON.parse(await readFile(out+'/aspects-before.json','utf8'));for(const a of newAspects){const before=original.find((b:any)=>b.id===a.id);if(before){for(const key of Object.keys(a.parts))delete (a.parts as any)[key];Object.assign(a.parts,structuredClone(before.parts));a.description=before.description;}}
const records:any[]=[];
for(const bd of ['bulwark','echo','opening']){
 const profile=pacingProfiles.find(p=>p.id===bd)!,a=pacingBuild(profile),b=rebuildFrozenAugmentBuild(freezeAugmentBasis(a.state,a.build),[profile.preferredAugment!],augments);
 for(const [scene,enc] of Object.entries(pacingEncounters)){
  if(bd!=='bulwark'&&scene!=='elite'&&scene!=='survival')continue;
  const region={...regionById('meadow'),width:48,height:48,safe:{x:20,y:20},obstacles:[],spawns:[]};
  const w=new World(region,b.stats,b.skills,structuredClone(enc.spawns),[],41);w.setMode('auto');
  const shields={gain:0,break:0,expire:0},hits:any[]=[];const observe=(w as any).observeShield.bind(w),hurt=(w as any).hurt.bind(w);
  (w as any).observeShield=()=>{if(w.hero.shield>(w as any).effectObservedShield)shields.gain++;observe();};
  (w as any).hurt=(...args:any[])=>{const prior=w.hero.shield;const result=hurt(...args);if(prior>0&&w.hero.shield<=0)shields.break++;return result;};
  for(let i=0;i<enc.maxTicks!;i++){
   if(enc.route&&i%enc.route.everyTicks===0)w.go(enc.route.points[Math.floor(i/enc.route.everyTicks)%enc.route.points.length]);
   if(enc.pressure&&w.tick>=enc.pressure.startTick)for(const e of w.enemies)e.attack=enc.spawns!.find(s=>s.id===e.id)!.attack*enc.pressure.multiplier**(1+Math.floor((w.tick-enc.pressure.startTick)/enc.pressure.interval));
   if(w.hero.shield>0&&w.hero.shieldUntil<=w.tick)shields.expire++;
   w.step();for(const e of w.events)if(e.type==='hit_resolved'&&e.id!==w.playerId&&hits.length<3)hits.push({tick:e.tick,amount:e.amount,category:e.category,skill:e.skill,target:e.id});
   if(w.hero.hp<=0||enc.stopWhen==='clear'&&w.enemies.every(e=>!e.alive))break;
  }
  records.push({bd,scene,seconds:w.tick/30,shields:{gain:w.effectStats.shield_gain?.count??0,break:w.effectStats.shield_break?.count??0,expire:w.effectStats.shield_expire?.count??0},firstThreeHits:hits,rules:w.effectStats,shieldSources:{skills:b.skills.filter(s=>s.kind==='shield').map(s=>s.id),rules:b.stats.rules?.filter(r=>r.action.type==='shield').map(r=>r.id),effects:b.stats.effects}});
 }
}
await writeFile(out+'/diagnosis.json',JSON.stringify(records,null,2)+'\n');
const aspects=newAspects.filter(a=>pacingProfiles.some(p=>p.aspect===a.id));await writeFile(out+'/aspects-before.json',JSON.stringify(aspects,null,2)+'\n');
await writeFile(out+'/../inventory.md','# C0 身份参数与规则盘点\n\n'+aspects.map(a=>'## '+a.id+'\n\n原描述：'+a.description+'\n\n```json\n'+JSON.stringify({flags:a.parts.flags,statMultipliers:a.parts.statMultipliers,conversions:a.parts.conversions,overrides:a.parts.overrides,patches:a.parts.patches,rules:a.parts.rules},null,2)+'\n```').join('\n\n')+'\n\n## 四项诊断\n\n'+JSON.stringify(records,null,2)+'\n\n- 爆盾：技能/装备护盾存在，但低压场景难以打破，短战斗常先清场；生存会耗尽。格挡补盾让来源绑定身份，保留破裂与过期区分。\n- 节拍：从 conditionClock.start 起满180帧才首次触发；短战斗/技能耗尽前不能消费强化。新增默认false的startReady，仅节拍打开。\n- 被动计数：stepEffects上升沿与effectBuffs每帧上下文计数混用，需要统一激活次数与覆盖帧，并单列consume使用次数。\n- 先手：前3次真实命中见上方记录；只记录实际发生的命中，死亡后不补造。\n\n## 偏差场景与独立旋钮\n\n|构筑|最大偏差场景|独立旋钮/必补|\n|---|---|---|\n|burn|精英|燃烧命中增伤；清怪扩散独立|\n|freeze|安全|寒蚀冰冻时长；碎冰范围控制清怪|\n|mobile|精英|攻击主旋钮；必补位移落点新星以补清怪|\n|quake|精英|旋风倍率；群敌增伤控制清怪|\n|arrows|单体|接触预算主旋钮；流血且周围群敌限定清怪|\n|echo|精英|节拍倍率；冷却恢复及护盾补生存|\n|bulwark|清怪|攻击主旋钮；反击只打攻击者、格挡护盾补安全|\n|opening|精英|高生命增伤；必补击杀返还最长冷却控制清怪|\n');
console.log(JSON.stringify(records));
