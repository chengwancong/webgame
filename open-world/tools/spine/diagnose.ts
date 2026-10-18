/** S0 单种子定向诊断；不是 S2 基线，不产生锚点、不修改内容。 */
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {pacingProfiles,pacingBuild} from '../pacing/profiles.ts';
import {pacingEncounters} from '../pacing/measure.ts';
import {freezeAugmentBasis,rebuildFrozenAugmentBuild} from '../../packages/rules/frozen-augment-build.ts';
import {resolveBuild} from '../../packages/rules/index.ts';
import {augments} from '../../packages/content/augments.ts';
import {setEffects} from '../../packages/content/set-effects.ts';
import {regionById,type Region} from '../../packages/content/index.ts';
import {World} from '../../packages/simulation/index.ts';
import {versions,type Stats,type Skill,type Spawn} from '../../packages/contracts/index.ts';
type Build={stats:Stats;skills:Skill[]};
const out=resolve('docs/reviews/numeric-spine-20261013/S0'),region:Region={...regionById('meadow'),id:'spine-diagnosis',width:48,height:48,safe:{x:20,y:20},portal:{x:2,y:2},obstacles:[],spawns:[],landmarks:[],boss:false};
function trace(build:Build,ranks:Record<string,number>,spawns:Spawn[],ticks:number,pressure?:typeof pacingEncounters.survival.pressure){
 assert(build.skills.length>0);assert(build.skills.every(s=>ranks[s.id]>=1));
 const w=new World(structuredClone(region),structuredClone(build.stats),structuredClone(build.skills),structuredClone(spawns),[],41);w.setMode('auto');
 const hits:any[]=[],casts:Record<string,number>={},failures:Record<string,number>={},damage:Record<string,number>={};let total=0,incoming=0;
 const start=performance.now();
 for(let i=0;i<ticks;i++){
  if(pressure&&w.tick>=pressure.startTick)for(const e of w.enemies)e.attack=spawns.find(s=>s.id===e.id)!.attack*pressure.multiplier**(1+Math.floor((w.tick-pressure.startTick)/pressure.interval));
  w.step();for(const event of w.events){
   if(event.type==='cast_started'&&event.id===w.playerId)casts[event.skill!]=(casts[event.skill!]??0)+1;
   if(event.type==='cast_failed'&&event.id===w.playerId)failures[event.reason!]=(failures[event.reason!]??0)+1;
   if(event.type==='hit_resolved'&&event.id!==w.playerId){total+=event.amount??0;damage[event.skill??'basic']=(damage[event.skill??'basic']??0)+(event.amount??0);if(hits.length<6)hits.push(event);}
   else if(event.type==='hit_resolved'&&event.id===w.playerId)incoming+=event.amount??0;
  }
  if(w.hero.hp<=0||w.enemies.every(e=>!e.alive))break;
 }
 return {requested:build.skills.map(s=>s.id),executed:w.skills.map(s=>s.id),ranks,seed:41,seconds:w.tick/30,clear:w.enemies.every(e=>!e.alive),alive:w.hero.hp>0,totalDamage:total,damageBySkill:damage,firstHits:hits,casts,failures,incoming,hp:w.hero.hp,mana:w.hero.mana,rules:w.effectStats,
  resolved:{attack:build.stats.attack,hp:build.stats.hp,armor:build.stats.armor,weapon:build.stats.weapon,critChance:build.stats.critChance,critMultiplier:build.stats.critMultiplier,vsHealthy:build.stats.vsHealthy,skills:build.skills.map(s=>({id:s.id,damage:s.damage,cooldown:s.cooldown,cost:s.cost,mechanics:s.mechanics}))},runtimeMs:performance.now()-start};
}
export async function diagnose(){
 await mkdir(out,{recursive:true});const records:any[]=[];
 for(const id of ['opening','echo','bulwark']){
  const profile=pacingProfiles.find(p=>p.id===id)!;const assembled=pacingBuild(profile);
  const assemble=(variant:string)=>{
   const state=structuredClone(assembled.state);
   if(variant==='技能等级1')for(const skill of state.skills)state.skillRanks[skill]=1;
   // 条件属性在resolveBuild时编译成conditional，必须从装备来源移除后重新解析。
   if(variant==='装备满血词缀置0')for(const gear of state.gear){for(const affix of gear.affixes)if(affix.stat==='vsHealthy')affix.value=0;if(gear.mainStat?.stat==='vsHealthy')gear.mainStat.value=0;}
   const selected=variant==='去词条'?{withoutAspects:[profile.aspect]}:variant==='去四件套'?{withoutFourSets:[profile.four]}:{};
   const part=setEffects.find(s=>s.id===profile.two)!;const original=part.two;
   try{
    if(variant==='去两件套')part.two={...original,stats:[],atoms:[],rules:[],conditional:[],zones:[]};
    const resolved=resolveBuild(state,selected),build={stats:resolved.stats,skills:resolved.resolvedSkills};
    const active=rebuildFrozenAugmentBuild(freezeAugmentBasis(state,build),variant==='去潮印'?[]:[profile.preferredAugment!],augments);
    // 一律保留同一潮印原本的技能槽数。去潮印不应授予额外技能。
    const base=rebuildFrozenAugmentBuild(freezeAugmentBasis(assembled.state,assembled.build),[profile.preferredAugment!],augments);
    active.skills=active.skills.slice(0,base.skills.length);
    if(variant==='基础暴击率置0')active.stats.critChance=0;
    if(variant==='去格挡补盾')active.stats.rules=active.stats.rules?.filter(r=>!r.id.endsWith('block-shield'));
    return {build:active,ranks:state.skillRanks};
   }finally{part.two=original;}
  };
  const variants=id==='opening'?['完整','去词条','去四件套','去两件套','去潮印','技能等级1','基础暴击率置0','装备满血词缀置0']:id==='bulwark'?['完整','去格挡补盾','去四件套']:['完整','去词条','去潮印'];
  for(const variant of variants){const a=assemble(variant);const scene=id==='opening'?'elite':id==='echo'?'clear':'survival',enc=pacingEncounters[scene];
   const original=trace(a.build,a.ranks,enc.spawns!,id==='bulwark'?900:900,enc.pressure);
   const dummySpawns=structuredClone(enc.spawns!);for(const spawn of dummySpawns){spawn.hp=1e9;spawn.attack=0;}
   const dummy=id==='bulwark'?null:trace(a.build,a.ranks,dummySpawns,id==='opening'?90:900);
   records.push({build:id,variant,scene,original,dummy});
  }
 }
 await writeFile(resolve(out,'diagnosis.json'),JSON.stringify({versions,scope:'单种子41、小型定向留一；不代表完整M5来源留一或官方S2',records},null,2)+'\n');
 const baseline=records.find(r=>r.build==='opening'&&r.variant==='完整');
 const order=records.filter(r=>r.build==='opening').map(r=>({variant:r.variant,seconds:r.original.seconds,first:r.original.firstHits[0]?.amount??null,b3:r.dummy.totalDamage/3,change:r.dummy.totalDamage/baseline.dummy.totalDamage-1})).sort((a,b)=>a.change-b.change);
 const echo=records.find(r=>r.build==='echo'&&r.variant==='完整'),wall=records.find(r=>r.build==='bulwark'&&r.variant==='完整'),noshield=records.find(r=>r.build==='bulwark'&&r.variant==='去格挡补盾');
 const lines=['# S0 定向诊断','',`工作树规则 ${versions.rules}；单种子41，只读内存消融；真实World伤害、技能、能量、失败和护盾计数见 diagnosis.json。不是正式测量台，不用于弹性求解。`,'','## 先手','',`旧精英场景实际用时 ${baseline.original.seconds.toFixed(3)} 秒；首击 ${baseline.original.firstHits[0]?.amount??'未命中'}；大生命同护甲精英3秒B3 ${Math.round(baseline.dummy.totalDamage/3)}。`,'','| 留一项 | 旧场景秒 | 首击 | 大生命靶B3 | 相对变化 |','|---|---:|---:|---:|---:|',...order.map(r=>`| ${r.variant} | ${r.seconds.toFixed(3)} | ${r.first} | ${Math.round(r.b3)} | ${(r.change*100).toFixed(1)}% |`),'',`最大B3下降来源：${order[0].variant}（${(order[0].change*100).toFixed(1)}%）。此为该次受控留一结果；M5还需逐技能/词缀/主属性/亲和完整留一，不能把截断到怪物生命的首击直接当技能真伤害。`,'','## 回响','',`旧清怪场景 ${echo.original.seconds.toFixed(3)} 秒，完成=${echo.original.clear}；30秒不死群靶总伤害 ${Math.round(echo.dummy.totalDamage)}。旧场景技能施放 ${JSON.stringify(echo.original.casts)}，失败 ${JSON.stringify(echo.original.failures)}，剩余能量 ${echo.original.mana.toFixed(2)}。`,'',`真实执行技能：${echo.original.executed.join('、')}。潮印技能槽数已固定，不因消融多给技能；不能把旧0.057直接解释为法术系数弹性。`,'','## 坚壁','',`旧指数压力诊断完整存活 ${wall.original.seconds.toFixed(3)} 秒，去格挡补盾 ${noshield.original.seconds.toFixed(3)} 秒。此旧场景只用于找链路，不进入主干求解。`,'',`完整盾链：${JSON.stringify(Object.fromEntries(['shield_gain','shield_break','shield_expire'].map(k=>[k,wall.original.rules[k]??null])))}。`,'',`执行器顺序：免疫/致盲/闪避 → 条件减伤 → 格挡（触发block补盾）→ 护甲 → 抗性 → 护盾吸收 → 破盾事件 → 低血/受伤效果。旧安全指标按incomingHits计数，不反映护盾吸收；M2必须记录实际承伤及潜在原始输入。`];
 await writeFile(resolve(out,'diagnosis.md'),lines.join('\n')+'\n');
 console.log(JSON.stringify({samples:records.length,opening:order,echo:{seconds:echo.original.seconds,casts:echo.original.casts,damage:echo.original.damageBySkill,failures:echo.original.failures},bulwark:{seconds:wall.original.seconds,rules:wall.original.rules}}));
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename))await diagnose();
