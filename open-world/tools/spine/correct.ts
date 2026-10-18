import {readJson,save,review,stamp,decision} from './io.ts';
import {solveBuilds} from './solve.ts';
import {deriveProgression} from './progression.ts';
import {applySpinePlan,type SpineChange} from './apply.ts';
import {spineSchemas} from './schemas.ts';
import {regionById} from '../../packages/content/index.ts';
import {median} from './math.ts';
import {relaxRateLimits} from './rate-limits.ts';
import {remeasureStandard} from './monsters.ts';
import {deriveWorld} from './world.ts';
import {monsterContent,resolveMonsterContent} from '../../packages/content/monsters.ts';
export async function correctSpine(index:number,from:string){
 if(![1,2].includes(index))throw Error('只允许两次修正');const v=await readJson(from+'/validation.json'),output=review+'/S7/correction-'+index,changes:SpineChange[]=[],notes:string[]=[];
 const mapping=Object.fromEntries((v.builds?.mappingError??[]).map((r:any)=>[r.build,r.ratios]));await save(output+'/mapping.json',mapping);
 if(v.builds)await solveBuilds(output+'/builds',2,mapping);
 const file='packages/content/monsters.json',raw=await readJson(file),target=(key:string,level:number)=>(v.targets??[]).find((t:any)=>t.key===key&&Number(t.levels.split(/[–-]/)[0])<=level&&Number(t.levels.split(/[–-]/).at(-1))>=level)?.value;
 const add=(path:(string|number)[],before:number,after:number,basis:string)=>{if(after!==before)changes.push({file,path,before,after,basis});};
 for(const rank of ['normal','elite','boss']){
  const damage=(v.field?.rows??[]).filter((r:any)=>r.rank===rank&&r.pressure&&!r.censored&&r.actual>0&&r.target>0),kill=(v.field?.rows??[]).filter((r:any)=>r.rank===rank&&!r.pressure&&r.actual>0&&r.target>0);
  if(damage.length){const factor=median(damage.map((r:any)=>r.actual/r.target)),before=raw.ranks[rank].attack,after=Number((Math.max(.05,Math.round(before*factor/.05)*.05)).toFixed(2));add(['ranks',rank,'attack'],before,after,'V'+index+'真实TTD反推攻击：旧×实测TTD/目标TTD，0.05档；增加TTD须降低攻击，不把交接倒置比值用于相反方向');}
  else notes.push(rank+'危险度只有删失或缺失值，保留攻击，不伪造有限TTD修正。');
  if(kill.length&&rank!=='normal'){const factor=median(kill.map((r:any)=>r.target/r.actual)),before=raw.ranks[rank].hp,after=Number((Math.max(.05,Math.round(before*factor/.05)*.05)).toFixed(2));add(['ranks',rank,'hp'],before,after,'V'+index+'生命×目标TTK/实测TTK，0.05档');}
  if(rank==='normal'&&(v.field?.oneHitRate??0)<.9){const ratios=(v.field?.oneHitRows??[]).flatMap((r:any)=>r.targets.filter((t:any)=>t.hit!==null&&t.hp>0).map((t:any)=>t.hit/t.hp)).sort((a:number,b:number)=>a-b);if(ratios.length){const cap=ratios[Math.floor((ratios.length-1)*.1)],ttkFactor=kill.length?median(kill.map((r:any)=>r.target/r.actual)):1,before=raw.ranks.normal.hp,after=Number((Math.max(.05,Math.floor((before*Math.min(cap,ttkFactor)+1e-9)/.05)*.05)).toFixed(2));add(['ranks','normal','hp'],before,after,'V'+index+'一刀线优先：普通生命×min(目标TTK/实测TTK, 非暴击命中/原HP的10%分位)，向下投影0.05档，至少覆盖90%已观测目标；未命中仍在验收分母');}else notes.push('一刀线缺可观测非暴击命中，未估计伤害去调整生命。');}
  if(rank==='normal'&&kill.some((r:any)=>r.actual<r.target*.8)&&(v.field?.oneHitRate??0)>=.9)notes.push('普通怪已满足一刀线；不抬生命去延长单次施法的固定前摇，TTK差按第6节一刀线优先保留。');
 }
 for(const wall of v.walls??[]){const spawn=regionById(wall.id).spawns.find(s=>s.boss)!,i=raw.templates.findIndex((t:any)=>t.id===spawn.monster?.template);if(i<0)continue;
  if(wall.actual!==null&&wall.actual>0){const before=raw.templates[i].base.hp,after=Math.max(1,Math.round(before*wall.target/wall.actual));add(['templates',i,'base','hp'],before,after,'V'+index+'地图首领五种子中位击杀秒数：生命×锁定目标/实测');}
  const deaths=wall.samples.filter((s:any)=>s.death!==null).map((s:any)=>s.death);if(wall.winRate<.8&&deaths.length){const targets=(await readJson('config/json/spine-targets.json')).targets,goal=targets.find((t:any)=>t.key==='danger.ttd.boss'&&Number(t.levels.split(/[–-]/)[0])<=wall.level&&Number(t.levels.split(/[–-]/).at(-1))>=wall.level)?.value??120,before=raw.templates[i].base.attack,after=Math.max(1,Math.round(before*median(deaths)/goal));add(['templates',i,'base','attack'],before,after,'V'+index+'首领失败样本的实际TTD/主干危险度目标反推攻击；胜负样本全部保留');}
 }
 await save(output+'/monster-plan.json',{...stamp(),changes,notes});await applySpinePlan('.',changes,spineSchemas,{apply:true,output:output+'/monsters'});
 if(v.calendar)await deriveProgression(output+'/experience',true,from+'/calendar-summary.json');
 if(v.guard?.maximumKillsPerSecond)await relaxRateLimits(output+'/rate',v.guard.maximumKillsPerSecond);
 if(index===2){Object.assign(monsterContent,resolveMonsterContent(await readJson('packages/content/monsters.json')));await remeasureStandard(output+'/final-player');await deriveWorld('all',true,output+'/world');await decision('最终修正改变参考词条并带动标准人、世界派生输入','第二次修正内重建当前13点及10平价配置，并将地城/层级依赖闭合后才进入V3；这是最终当前输入，不增加候选或第四次验证。世界档位先用未叠加地城难度的终局首领反推，地城按实际进入档位再校准，避免重复乘两次','S7/correction-2/final-player、world');}
 await decision('S7攻击修正公式的方向','交接文字targetTTD/actualTTD会在死亡过快时进一步提高攻击，违背锁定危险度目标。按符合用户目标优先使用攻击×actualTTD/targetTTD；生命仍×targetTTK/actualTTK，删失不修正','tools/spine/correct.ts');
 await save(output+'/correction-summary.json',{...stamp(),index,from,monsterChanges:changes.length,notes,newtonSteps:2,experience:'仅按对应V的里程碑区间独立缩放，不抵消战斗偏差'});
}
if(process.argv[1]?.endsWith('correct.ts'))await correctSpine(Number(process.argv[2]),process.argv[3]);
