import {readFile,writeFile} from 'node:fs/promises';
import {sampleCombatBuild} from '../build-variety-benchmark.ts';
import {monsterContent} from '../../packages/content/monsters.ts';
import {monsterLevelValues,resolveMonsterSpawn} from '../../packages/rules/monster-stats.ts';
import {regionById,regions} from '../../packages/content/index.ts';
import {World} from '../../packages/simulation/index.ts';
import {worldTables} from '../../packages/content/world-tables.ts';
import {campSpawns} from '../../packages/rules/world-camps.ts';
import {dungeonContent} from '../../packages/content/dungeons.ts';
import {pacingTargets} from '../../packages/content/pacing-targets.ts';
import {standardLevels,standardState,resolvePlayer} from './player.ts';
import {measured} from './measure.ts';
import {benchArena,measurementVersion} from './bench.ts';
import {median} from './math.ts';
import {save,readJson,review,data,stamp,evidence,decision,sha} from './io.ts';
import {targets as benchTargets} from './bench.ts';
import {applySpinePlan,type SpineChange} from './apply.ts';
import {spineSchemas} from './schemas.ts';
export function interpolate(points:any[],level:number,key:string){const b=points.find(p=>p.level>=level)??points.at(-1),a=points[Math.max(0,points.indexOf(b)-1)],f=Math.max(0,Math.min(1,(level-a.level)/(b.level-a.level||1)));return a[key]>0&&b[key]>0?Math.exp(Math.log(a[key])*(1-f)+Math.log(b[key])*f):a[key]*(1-f)+b[key]*f;}
export async function remeasureStandard(output=review+'/S5',requestedLevels=standardLevels){
 const levels=[...new Set(requestedLevels)].sort((a,b)=>a-b);if(!levels.length||levels.some(L=>!standardLevels.includes(L)))throw Error('等级测量只接受已声明的标准点。');
 const points=[];for(const level of levels){const p=resolvePlayer('standard-final-'+level,standardState(level)),r=await measured(output,p.id,p,p.build.stats.hp);points.push({level,...r.metrics,hp:p.build.stats.hp,armor:p.build.stats.armor,localSource:await evidence(output+'/arms/'+p.id+'.json')});}
 const parity=[];for(const level of [10,20,30,40,50].filter(L=>levels.includes(L)))for(const family of ['staff','hidden'] as const){const p=resolvePlayer('standard-final-'+family+'-'+level,standardState(level,family)),r=await measured(output,p.id,p,points.find(p=>p.level===level)!.hp);parity.push({level,family,...r.metrics,localSource:await evidence(output+'/arms/'+p.id+'.json')});}
 const result={...stamp(),measurementVersion,scope:levels.length===standardLevels.length?'完整标准人十三点':'指定等级段定向测量，不替代完整标准人曲线',engineSha256:sha(await readFile('packages/simulation/index.ts')),benchSha256:sha(await readFile('tools/spine/bench.ts')),targetArmors:Object.fromEntries(levels.map(level=>[level,benchTargets(level,1)[0].monster!.armor])),points,parity};await save(output+'/player-summary.json',result);if(levels.length===standardLevels.length)await save(data+'/spine-player.json',result);return result;
}
export async function measureEfficiencies(output=review+'/S5'){
 const curve=await readJson(data+'/spine-player.json'),field=[],boss=[];
 for(const level of [10,20,30,40,50]){
  const zone=[...worldTables.zones].filter(z=>worldTables.camps.some(c=>c.zone===z.id)).sort((a,b)=>Math.abs((a.levelBand[0]+a.levelBand[1])/2-level)-Math.abs((b.levelBand[0]+b.levelBand[1])/2-level))[0],camp=worldTables.camps.find(c=>c.zone===zone.id)!,region=regionById(camp.region),spawns=campSpawns(region,worldTables,camp,1),p=resolvePlayer('efficiency-'+level,standardState(level));
  let primaryHit:number|null=null;const primary=new Set(p.build.skills.filter(s=>['area','zone','dash'].includes(s.kind)).map(s=>s.id));
  const sample=sampleCombatBuild({requestedSkills:p.build.skills.map(s=>s.id),skillRanks:p.skillRanks,build:p.build,region:{...region,safe:{x:camp.x,y:camp.y}},spawns,seed:41,maxTicks:120*30,mode:'auto',stopWhen:'clear',approachTargets:true,instrument:{afterStep(w){for(const e of w.events)if(e.type==='hit_resolved'&&e.category==='direct'&&e.id!==w.playerId&&e.skill&&primary.has(e.skill)&&!e.crit&&e.amount)primaryHit??=e.amount;}}});
  const raw=output+'/arms/efficiency-'+level+'.json';await save(raw,sample);const work=spawns.reduce((n,s)=>n+s.hp,0),eta=sample.clearSeconds?work/(interpolate(curve.points,level,'DN')*sample.clearSeconds):null;
  field.push({level,camp:camp.id,seconds:sample.clearSeconds,failed:sample.failed,eta,eliteKills:spawns.filter(s=>s.elite&&sample.remaining.every(e=>e.id!==s.id)).length,primaryHit,source:await evidence(raw)});
 }
 for(const target of pacingTargets.milestones.filter(t=>t.kind==='boss')){const region=regionById(target.id),spawn=structuredClone(region.spawns.find(s=>s.boss)!),p=resolvePlayer('boss-efficiency-'+target.id,standardState(target.level));spawn.hp=1e15;spawn.attack=0;
  const sample=sampleCombatBuild({requestedSkills:p.build.skills.map(s=>s.id),skillRanks:p.skillRanks,build:p.build,region,spawns:[spawn],seed:41,maxTicks:30*30,mode:'auto',stopWhen:'window',approachTargets:true}),raw=output+'/arms/efficiency-'+target.id+'.json';await save(raw,sample);boss.push({id:target.id,level:target.level,eta:sample.dps/interpolate(curve.points,target.level,'D1'),source:await evidence(raw)});
 }
 await save(output+'/efficiency-summary.json',{...stamp(),field,boss});return {field,boss};
}
export async function deriveMonsters(output=review+'/S5',apply=false){
 const player=await readJson(data+'/spine-player.json'),targets=(await readJson('config/json/spine-targets.json')).targets,efficiency=await readJson(output+'/efficiency-summary.json'),raw=await readJson('packages/content/monsters.json'),next=structuredClone(raw),changes:SpineChange[]=[],lines:any[]=[];
 const target=(key:string,L:number,fallback:number)=>targets.find((t:any)=>t.key===key&&String(t.levels).split(/[–-]/).map(Number)[0]<=L&&Number(String(t.levels).split(/[–-]/).at(-1))>=L)?.value??fallback;
 const etaRows=efficiency.field.filter((r:any)=>r.eta!==null&&r.eta>0);if(etaRows.length!==5)await decision('部分野外效率场景失败','失败场景保留，不伪造η；仅用同等级最近有效实测η推导，V报告对应不足','S5/efficiency-summary.json');if(!etaRows.length)throw Error('缺少任何有效野外效率实测');
 const normal=(L:number)=>{const d1=interpolate(player.points,L,'D1'),dn=interpolate(player.points,L,'DN'),ehp=interpolate(player.points,L,'EHP'),nearest=[...etaRows].sort((a,b)=>Math.abs(a.level-L)-Math.abs(b.level-L))[0],eta=nearest.eta,ttk=target('field.ttk.normal',L,.5),ttd=target('danger.ttd.normal',L,120),basis=monsterLevelValues('starsea',L,raw),ratios=raw.templates.filter((t:any)=>!t.bossKey).map((t:any)=>t.base.hp/monsterLevelValues(t.curve,t.referenceLevel,raw).hp*monsterLevelValues(t.curve,L,raw).hp/basis.hp*raw.ranks.normal.hp),oneHit=nearest.primaryHit?nearest.primaryHit/Math.max(...ratios):Infinity;return {d1,dn,ehp,eta,ttk,ttd,hp:Math.min(ttk*dn/12*eta,oneHit),attack:ehp/ttd/(3)};};
 const baseCurve=raw.curves.starsea??Object.values(raw.curves)[0];
 for(const [family,points]of Object.entries(raw.curves) as [string,any[]][]){let prevAttack=0;next.curves[family]=points.map(point=>{const level=Math.min(60,point.level),n=normal(level),oldBase=monsterLevelValues('starsea',level,raw),relative=point.hp/oldBase.hp,rawHp=n.hp*relative,rawAttack=n.attack*point.attack/oldBase.attack,hp=Math.max(1,Math.round(rawHp)),attack=Math.max(1,Math.round(rawAttack),prevAttack);prevAttack=attack;lines.push({family,level:point.level,beforeHp:point.hp,hp,beforeAttack:point.attack,attack,eta:n.eta,ttk:n.ttk,ttd:n.ttd,smoothed:attack!==Math.round(rawAttack)});return {...point,hp,attack};});let limit=Infinity;for(let i=next.curves[family].length-1;i>=0;i--){limit=Math.min(limit,next.curves[family][i].hp);next.curves[family][i].hp=limit;const line=lines.find(r=>r.family===family&&r.level===next.curves[family][i].level)!;if(line.hp!==limit){line.hp=limit;line.smoothed=true;}}}
 for(const template of next.templates){const old=monsterLevelValues(template.curve,template.referenceLevel,raw),now=monsterLevelValues(template.curve,template.referenceLevel,next);template.base.hp=Math.max(1,Math.round(template.base.hp*now.hp/old.hp));template.base.attack=Math.max(1,Math.round(template.base.attack*now.attack/old.attack));}
 for(const rank of ['elite','rare','boss']){const ratios=standardLevels.map(level=>{const n=normal(level),ttk=target('field.ttk.'+rank,level,rank==='elite'?5:rank==='rare'?10:30);return ttk/n.ttk*(n.dn/12)/n.d1;});next.ranks[rank].hp=Number((Math.max(.05,Math.round(median(ratios)/.05)*.05)).toFixed(2));}
 // 故事墙单独使用到达等级的标准人和该首领的真实输出效率。
 for(const targetRow of pacingTargets.milestones.filter(t=>t.kind==='boss')){const region=regionById(targetRow.id),spawn=region.spawns.find(s=>s.boss)!,template=next.templates.find((t:any)=>t.id===spawn.monster?.template),eta=efficiency.boss.find((r:any)=>r.id===targetRow.id)?.eta;if(!template||!eta||!targetRow.bossKillSeconds)throw Error('缺少地图首领模型/效率 '+targetRow.id);const L=spawn.monster!.level,at=monsterLevelValues(template.curve,L,next),ref=monsterLevelValues(template.curve,template.referenceLevel,next),hp=interpolate(player.points,targetRow.level,'D1')*targetRow.bossKillSeconds*eta;template.base.hp=Math.max(1,Math.round(hp/(at.hp/ref.hp*next.ranks.boss.hp)));}
 const add=(file:string,path:(string|number)[],before:any,after:any,basis:string)=>{if(JSON.stringify(before)!==JSON.stringify(after))changes.push({file,path,before,after,basis});};
 for(const family of Object.keys(raw.curves))add('packages/content/monsters.json',['curves',family],raw.curves[family],next.curves[family],'M8：HP=目标TTK×DN标准人/12×实测η，攻击=EHP/目标TTD/实测3次每秒；保留护甲及族相对形状，单调整数投影');
 for(let i=0;i<raw.templates.length;i++)add('packages/content/monsters.json',['templates',i,'base'],raw.templates[i].base,next.templates[i].base,'M8曲线参考点同步；模板相对形状保留；地图首领独立用到达等级D1×锁定秒数×实测ηboss');
 for(const rank of ['elite','rare','boss'])add('packages/content/monsters.json',['ranks',rank,'hp'],raw.ranks[rank].hp,next.ranks[rank].hp,'M8档位TTK比×群体每目标DPS/单体DPS的等级中位数，0.05档');
 await save(output+'/monster-plan.json',{...stamp(),changes,lines});await save(output+'/monster-summary.json',{...stamp(),lines,changes:changes.length});await applySpinePlan('.',changes,spineSchemas,{apply,output:output+'/monsters'});return {changes,lines};
}
