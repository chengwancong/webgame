/** 地城和层级只消费主干标准人。旧CLI委托此处，不再自行读取过期模型。 */
import {World,walkable} from '../../packages/simulation/index.ts';
import {regionById} from '../../packages/content/index.ts';
import {dungeonContent} from '../../packages/content/dungeons.ts';
import {monsterContent} from '../../packages/content/monsters.ts';
import {dungeonSpawns} from '../../packages/rules/dungeon-build.ts';
import {characterDungeonDefinition} from '../../packages/rules/hardmode-dungeon.ts';
import {worldTiersSchema} from '../../packages/contracts/open-world.ts';
import {interpolate} from './monsters.ts';
import {readJson,save,review,data,stamp,sha,decision} from './io.ts';
import {applySpinePlan,type SpineChange} from './apply.ts';
import {spineSchemas} from './schemas.ts';
import {median} from './math.ts';
export function pressure(region:ReturnType<typeof regionById>,spawns:ReturnType<typeof dungeonSpawns>){
 const boss=spawns.find(s=>s.boss)??spawns[0];if(!boss)throw Error('完整房间没有敌人');
 let position;for(const radius of [1.25,2,3,4,5])for(let n=0;n<16&&!position;n++){const q={x:boss.x+Math.cos(n*Math.PI/8)*radius,y:boss.y+Math.sin(n*Math.PI/8)*radius};if(walkable(region,q,1))position=q;}if(!position)throw Error('首领附近没有合法测量位置');
 const w=new World({...region,safe:position},{hp:1e15,attack:0,armor:0,speed:0,mana:0,regen:0,effects:[]},[],spawns,[],41);w.setMode('manual');let damage=0,hits=0;for(let tick=0;tick<900;tick++){w.step();for(const e of w.events)if(e.type==='hit_resolved'&&e.id===w.playerId){damage+=e.amount??0;hits++;}}if(!hits||!damage)throw Error('完整房间压力测量没有有效命中');return {rawDps:damage/30,hits,seconds:30,actors:spawns.length,scope:'终局房间全部敌人；包含首领及随从'};
}
export async function spineFlow(output=review+'/S5'){
 const player=await readJson(data+'/spine-player.json'),targets=(await readJson('config/json/spine-targets.json')).targets,efficiency=await readJson(review+'/S5/efficiency-summary.json'),eta=median(efficiency.boss.map((r:any)=>r.eta)),stages=[];
 for(let index=1;index<=24;index++){const push=targets.find((t:any)=>t.key==='stage.'+index+'.push'),farm=targets.find((t:any)=>t.key==='stage.'+index+'.farm');if(!push||!farm)throw Error('缺少阶段主干目标 '+index);const level=Number(push.levels),dps=interpolate(player.points,level,'D1'),ehp=interpolate(player.points,level,'EHP');stages.push({index,level,push:push.value,farm:farm.value,lam:Math.log(2)/push.value,bossHp:Math.round(dps*1.25*eta*70),bossDps:Math.round(ehp*1.1/30),dps1:dps,ehp,eta});}
 const result={...stamp(),source:data+'/spine-player.json',playerSha256:sha(JSON.stringify(player)),stages,basis:'主干13点按等级对数插值；锁定/文档阶段时间直接读取M1。地城70秒、潮印DPS1.25/EHP1.1、TTD30秒来自open-world-numeric-flow.md；η用六故事首领实测中位数；λ=ln2/开荒目标，无扫参。'};await save(data+'/spine-flow.json',result);await save(output+'/flow-summary.json',result);return result;
}
export async function deriveWorld(kind='all',apply=false,output=review+'/S5/world'){
 const flow=await spineFlow(output),player=await readJson(data+'/spine-player.json'),raw=await readJson('packages/content/dungeons.json'),next=structuredClone(raw),tiers=await readJson('packages/content/world-tiers.json'),proposedTiers=structuredClone(tiers),changes:SpineChange[]=[],measurements:any[]=[],residuals:any[]=[],calibration=await readJson('packages/content/legacy-dungeon-calibration.json');
 const snap=(v:number)=>Number((Math.max(.05,Math.round(v/.05)*.05)).toFixed(2));
 // 层级因子先从未叠加地城难度的真实终局首领反推；地城随后按实际进入档位校准，避免把两层倍率重复相乘。
 const terminal=dungeonContent.definitions.find(d=>d.hardmode?.numericStage===24);let tierBasis:any=null;
 if(terminal&&kind!=='legacy'){
  const def=characterDungeonDefinition(terminal,true,4),region=regionById(def.stages.at(-1)!),policy=structuredClone(def.policy);policy.enemyScale={hp:1,attack:1,hpPerStage:0,attackPerStage:0};delete policy.stageEnemyScale;
  const terminalSpawns=dungeonSpawns(region.spawns,policy,policy.minTier,def.stages.length-1,[],monsterContent,'starsea',{hp:1,attack:1}),boss=terminalSpawns.find(s=>s.boss)!;
  try{const basis=pressure(region,terminalSpawns),target=flow.stages[23],third=tiers.tiers[2].monster,desired={hp:target.bossHp/boss.hp,attack:target.bossDps/basis.rawDps};proposedTiers.tiers[3].monster={hp:Math.max(snap(desired.hp),Number((Math.ceil((third.hp-1e-9)/.05)*.05).toFixed(2))),attack:Math.max(snap(desired.attack),Number((Math.ceil((third.attack-1e-9)/.05)*.05).toFixed(2)))};worldTiersSchema.parse(proposedTiers);tierBasis={dungeon:terminal.id,level:boss.monster?.level,bossHp:boss.hp,basis,desired,constrained:proposedTiers.tiers[3].monster,policy:'全局档位单调约束；多出的全局倍率由该地城enemyScale闭式补偿，不放宽阶段目标'};}
  catch(e){residuals.push({scope:'world-tier-4',reason:String(e)});}
 }
 for(const d of dungeonContent.definitions){
  const index=raw.definitions.findIndex((r:any)=>r.id===d.id),entry=next.definitions[index];
  for(const hard of [false,true]){
   if(hard&&!d.hardmode||kind==='hardmode'&&!hard||kind==='legacy'&&(hard||d.feature==='field-dungeon')||kind==='tiers'&&!(hard&&d.hardmode?.worldTierScalingFrom))continue;
   const enteringTier=hard&&d.hardmode?.worldTierScalingFrom?d.hardmode.worldTierScalingFrom:1,def=characterDungeonDefinition(d,hard,enteringTier),region=regionById(def.stages.at(-1)!),world=def.worldTierScaling?proposedTiers.tiers.find((t:any)=>t.tier===enteringTier)!.monster:{hp:1,attack:1},spawns=dungeonSpawns(region.spawns,def.policy,def.policy.minTier,def.stages.length-1,[],monsterContent,'starsea',world),boss=spawns.find(s=>s.boss);
   if(!boss?.monster){residuals.push({dungeon:d.id,hard,reason:'当前副本没有可执行首领；保留定义，不删除内容'});continue;}
   const level=Math.min(60,Math.max(def.level,boss.monster.level)),target=flow.stages.find((s:any)=>s.index===def.numericStage),party=def.kind==='raid'?Object.entries(def.policy.party.roles).reduce((n,[role,count])=>n+count*(role==='damage'?1:calibration.raidSupportWeight),0):1,desiredHp=target?.bossHp??interpolate(player.points,level,'D1')*calibration.bossEfficiency*calibration.targetSeconds[def.kind]*party;
   let basis;try{basis=pressure(region,spawns);}catch(e){residuals.push({dungeon:d.id,hard,reason:String(e)});continue;}
   const desiredDps=target?.bossDps??interpolate(player.points,level,'EHP')/30,scale={hp:snap(def.policy.enemyScale.hp*desiredHp/boss.hp),attack:snap(def.policy.enemyScale.attack*desiredDps/basis.rawDps)};
   if(hard)entry.hardmode.enemyScale={...entry.hardmode.enemyScale,...scale};else{entry.policy??={};entry.policy.enemyScale={...entry.policy.enemyScale,...scale};}
   const projection={hp:boss.hp*scale.hp/def.policy.enemyScale.hp,rawDps:basis.rawDps*scale.attack/def.policy.enemyScale.attack};measurements.push({dungeon:d.id,hard,level,stage:def.numericStage??null,enteringTier,worldDifficulty:world,before:def.policy.enemyScale,after:scale,bossHp:boss.hp,desiredHp,desiredDps,basis,party,projection,quantizationError:{hp:projection.hp/desiredHp-1,rawDps:projection.rawDps/desiredDps-1},limits:'投影不冒称再测后的胜率；完整终局房间真实压力与定档误差保留'});
  }
 }
 for(let i=0;i<raw.definitions.length;i++)if(JSON.stringify(raw.definitions[i])!==JSON.stringify(next.definitions[i]))changes.push({file:'packages/content/dungeons.json',path:['definitions',i],before:raw.definitions[i],after:next.definitions[i],basis:'M8当前主干及真实30秒完整终局房间输入，在实际进入档位下闭式反推enemyScale；0.05档；与世界档位只组合一次，原身份/策略结构保留'});
 if(JSON.stringify(tiers.tiers[3].monster)!==JSON.stringify(proposedTiers.tiers[3].monster))changes.push({file:'packages/content/world-tiers.json',path:['tiers',3,'monster'],before:tiers.tiers[3].monster,after:proposedTiers.tiers[3].monster,basis:'M8以未叠加地城倍率的真实阶段24首领反推T4，保持单调并由该地城难度补偿到目标，不重复校准'});
 await save(output+'/world-plan.json',{...stamp(),changes,measurements,tierBasis,residuals});await applySpinePlan('.',changes,spineSchemas,{apply,output});await save(output+'/world-summary.json',{...stamp(),playerSha256:flow.playerSha256,monsterSha256:sha(JSON.stringify(await readJson('packages/content/monsters.json'))),contentSha256:sha(JSON.stringify(await readJson('packages/content/dungeons.json'))),measurements,tierBasis,residuals,changes:changes.length,applied:apply});if(apply)await save(data+'/spine-world-source.json',{...stamp(),summary:output+'/world-summary.json',plan:output+'/world-plan.json'});return {changes,measurements,residuals};
}
