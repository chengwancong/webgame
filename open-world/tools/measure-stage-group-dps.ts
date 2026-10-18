// 数值来源已迁到 tools/spine；本文件保留历史探针，正式派生请使用 pnpm spine:check 与主干CLI。
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname} from 'node:path';
import {resolveBuild} from '../packages/rules/index.ts';
import {resolveMonsterSpawn} from '../packages/rules/monster-stats.ts';
import {monsterContent} from '../packages/content/monsters.ts';
import type {Region} from '../packages/content/index.ts';
import {versions} from '../packages/contracts/index.ts';
import {standard} from './standard-player-model.ts';
import {stageTimings,levelAtMinutes} from './world-stage-schedule.ts';
import {sampleCombatBuild} from './build-variety-benchmark.ts';
const args=process.argv.slice(2),get=(name:string)=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];},selected=get('--stages')?.split(',').map(Number)??stageTimings.map(s=>s.index),n=Number(get('--samples')??3),seed=Number(get('--seed')??41);
if(!selected.length||new Set(selected).size!==selected.length||selected.some(i=>!Number.isInteger(i)||i<1||i>24)||!Number.isInteger(n)||n<1||!Number.isSafeInteger(seed))throw Error('Group DPS requires valid distinct stages and explicit sample count/seed');
const region:Region={id:'controlled-group-dps',name:'群体输出窗口',subtitle:'受控参考',theme:'meadow',width:48,height:48,safe:{x:10,y:10},portal:{x:2,y:2},spawns:[],landmarks:[],obstacles:[],boss:false,auto:true},template=monsterContent.templates.find(t=>t.curve==='starsea'&&t.role==='normal'&&t.kind==='melee'&&!t.bossKey);if(!template)throw Error('No actual ordinary melee reference template');
const rows=[];
for(const index of selected){const stage=stageTimings[index-1],phases=[];
 for(const phase of ['clear','end'] as const){const minutes=stage[phase],character=standard(Math.floor(levelAtMinutes(minutes)),new Set(),minutes),resolved=resolveBuild(character),build={stats:resolved.stats,skills:resolved.resolvedSkills},groups=[];
  for(const count of [1,5,10,20]){const samples=[];for(let i=0;i<n;i++){
   const spawns=Array.from({length:count},(_,j)=>{const base=resolveMonsterSpawn({id:'group:'+j,template:template.id,level:Math.ceil(stage.level),rank:'normal',x:14+(j%4)*1.25,y:8+Math.floor(j/4)*1.25});base.hp=1e14;base.attack=0;base.monster!.armor=0;base.monster!.baseStats={hp:1e14,attack:0,armor:0};base.monster!.ai.skillChance=0;base.monster!.skills=[];return base;});
   const sample=sampleCombatBuild({requestedSkills:character.skills,skillRanks:character.skillRanks,build,region,spawns,seed:seed+i*32,maxTicks:900,mode:'auto',stopWhen:'window'});samples.push({seed:sample.seed,dps:sample.dps,failed:sample.failed,seconds:sample.elapsed,incomingDamage:sample.incomingDamage,casts:sample.casts,castFailures:sample.failures,damage:sample.damage,damageBySkill:sample.damageBySkill,hero:sample.hero,requested:sample.requested,executed:sample.executed});
  }const valid=samples.every(s=>s.failed===null&&s.incomingDamage===0),meanDps=samples.reduce((v,s)=>v+s.dps,0)/samples.length;groups.push({count,valid,meanDps,samples});}
  const single=groups[0].meanDps;phases.push({phase,minutes,level:character.level,requestedSkills:character.skills,skillRanks:character.skillRanks,build,groups:groups.map(g=>({...g,ratioToSingle:single>0?g.meanDps/single:null}))});
 }rows.push({stage:index,phases});
}
const modelBytes=await readFile('.design/standard-player-20261005/model.json'),output=get('--out')??'docs/reviews/open-world-m2-m4/W3/stage-group-dps.json';await mkdir(dirname(output),{recursive:true});
const report={versions:structuredClone(versions),generated:new Date().toISOString(),modelSha256:createHash('sha256').update(modelBytes).digest('hex'),template:template.id,samples:rows.reduce((v,r)=>v+r.phases.reduce((v,p)=>v+p.groups.reduce((v,g)=>v+g.samples.length,0),0),0),rows,limits:['Actual expected build and World at exact clear/end clocks;1/5/10/20 targets measure group capacity for the authored budget calculation.','Targets have explicit high HP, zero attack/armour and no hostile skills. Player HP, mana, cooldowns and skill execution receive no overrides. Nonzero incoming damage or invalid build output is reported as invalid, never discarded.','Immortal targets do not trigger kill effects. This reference is separate from finite actual swarm/normal camp kills and natural route rates.','The5/10-target diagnostics cannot replace the fixed12/20-target1.5-times acceptance measurement. No threshold or target count is reduced.']};
await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,stages:rows.length,samples:report.samples,invalidGroups:rows.flatMap(r=>r.phases.flatMap(p=>p.groups.filter(g=>!g.valid).map(g=>({stage:r.stage,phase:p.phase,count:g.count}))))}));
