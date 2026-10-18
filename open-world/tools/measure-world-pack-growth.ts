// 数值来源已迁到 tools/spine；本文件保留历史探针，正式派生请使用 pnpm spine:check 与主干CLI。
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import '../packages/content/open-world/index.ts';
import {regionById,fieldRegionInfo,type Region} from '../packages/content/index.ts';
import {worldTables} from '../packages/content/world-tables.ts';
import type {WorldTables,WorldCamp} from '../packages/contracts/open-world.ts';
import {actualCampCapacity} from './camp-capacity-spec.ts';
import {monsterContent,resolveMonsterContent,type MonsterContent} from '../packages/content/monsters.ts';
import {resolveMonsterSpawn} from '../packages/rules/monster-stats.ts';
import {resolveBuild} from '../packages/rules/index.ts';
import {versions} from '../packages/contracts/index.ts';
import {standard} from './standard-player-model.ts';
import {stageTimings,levelAtMinutes} from './world-stage-schedule.ts';
import {sampleCombatBuild} from './build-variety-benchmark.ts';
type PackGrowthSample=Pick<ReturnType<typeof sampleCombatBuild>,'clearSeconds'|'deathSeconds'|'kills'|'dps'|'damage'|'damageBySkill'|'casts'|'incomingDamage'|'hero'|'remaining'|'build'|'targetParams'>&{phase:'clear'|'end';minutes:number;level:number;count:number;seed:number;completed:boolean;seconds:number;killsPerMinute:number;castFailures:ReturnType<typeof sampleCombatBuild>['failures'];validationFailure:ReturnType<typeof sampleCombatBuild>['failed']|null};
export function measurePackGrowth(stages:readonly number[],seeds:readonly number[],seconds=90,catalogue:MonsterContent=monsterContent,actualCamp?:{region:Region;tables:WorldTables;camp:WorldCamp}){
 if(!stages.length||new Set(stages).size!==stages.length||stages.some(s=>!Number.isInteger(s)||s<1||s>24)||!seeds.length||new Set(seeds).size!==seeds.length||seeds.some(s=>!Number.isSafeInteger(s))||!Number.isFinite(seconds)||seconds<=0)throw Error('Pack growth requires declared stages, distinct seeds and an actual budget');
 const frozenCatalogue=resolveMonsterContent(structuredClone(catalogue)),template=frozenCatalogue.templates.find(t=>t.curve==='starsea'&&t.kind==='melee'&&!t.bossKey);if(!template)throw Error('No authored melee pack template');
 if(actualCamp&&JSON.stringify(frozenCatalogue)!==JSON.stringify(monsterContent))throw Error('Actual camp capacity requires the adopted formal monster snapshot');
 const region:Region={id:'controlled-pack-growth',name:'真实群体战斗探针',subtitle:'受控遭遇',theme:'meadow',width:48,height:48,safe:{x:10,y:10},portal:{x:4,y:4},spawns:[],obstacles:[],landmarks:[],boss:false,auto:true};
 const rows=stages.map(index=>{
  const stage=stageTimings[index-1],samples:PackGrowthSample[]=[];
  for(const phase of ['clear','end'] as const){const minutes=stage[phase],character=standard(Math.floor(levelAtMinutes(minutes)),new Set(),minutes),resolved=resolveBuild(character),build={stats:resolved.stats,skills:resolved.resolvedSkills};
   for(const count of [12,20])for(const seed of seeds){const capacity=actualCamp?actualCampCapacity(actualCamp.region,actualCamp.tables,actualCamp.camp,count):undefined;
    const spawns=capacity?.spawns??Array.from({length:count},(_,i)=>resolveMonsterSpawn({id:'pack:'+i,template:template.id,level:Math.ceil(stage.level),rank:'normal',x:14+(i%4)*1.25,y:8+Math.floor(i/4)*1.25},frozenCatalogue));
    const sample=sampleCombatBuild({requestedSkills:character.skills,skillRanks:character.skillRanks,build,region:capacity?.region??region,spawns,seed,maxTicks:Math.ceil(seconds*30),mode:'auto',stopWhen:'clear',monsterCatalogue:frozenCatalogue});
    samples.push({phase,minutes,level:character.level,count,seed,completed:sample.clearSeconds!==null&&sample.deathSeconds===null,seconds:sample.elapsed,clearSeconds:sample.clearSeconds,deathSeconds:sample.deathSeconds,kills:sample.kills,killsPerMinute:sample.elapsed?sample.kills/sample.elapsed*60:0,dps:sample.dps,damage:sample.damage,damageBySkill:sample.damageBySkill,casts:sample.casts,castFailures:sample.failures,validationFailure:sample.failed&&sample.failed!=='not_cleared'?sample.failed:null,incomingDamage:sample.incomingDamage,hero:sample.hero,remaining:sample.remaining,build:sample.build,targetParams:sample.targetParams});
   }
  }
  const groups=[12,20].map(count=>{const summarize=(phase:'clear'|'end')=>{const group=samples.filter(s=>s.count===count&&s.phase===phase),elapsed=group.reduce((n,s)=>n+s.seconds,0);return {samples:group.length,completed:group.filter(s=>s.completed).length,deaths:group.filter(s=>s.deathSeconds!==null).length,invalid:group.filter(s=>s.validationFailure!==null).length,killsPerMinute:elapsed?group.reduce((n,s)=>n+s.kills,0)/elapsed*60:0};};const clear=summarize('clear'),end=summarize('end'),gain=clear.killsPerMinute>0?end.killsPerMinute/clear.killsPerMinute:null;return {count,clear,end,killingRateGain:gain,targetGain:1.5,passes:gain!==null&&gain>=1.5&&clear.invalid===0&&end.invalid===0&&clear.completed===clear.samples&&end.completed===end.samples};});
  return {stage:index,groups,samples};
 });
 return {generated:new Date().toISOString(),versions:structuredClone(versions),template:actualCamp?null:template.id,role:actualCamp?'authored mixed camp':template.role,actualCamp:actualCamp?{region:actualCamp.region.id,camp:structuredClone(actualCamp.camp),controls:'Requested12/20 capacity; source template/role weights and per-member health budget preserved; actual walkable start and camp geometry.'}:null,seeds,budgetSeconds:seconds,samples:rows.reduce((n,r)=>n+r.samples.length,0),rows,limits:['Explicit selected monster catalogue or actual authored mixed camp,12/20 targets, actual stage-clear and stage-end builds, World movement, body collision, skills, HP, mana and cooldowns.','This is a controlled finite pack test. No invulnerability, attack suppression, refill, synthetic healing or post-measurement player multiplier is applied. Each encounter starts fresh with its own resolved full-health build.','Death, timeout and no-cast/no-damage cases stay in denominators. Both clocks must complete every sample for the1.5 target to pass.','Capacity tests preserve actual per-member camp health when population changes. They do not prove natural sustained route rates, server rewards or one-shot threshold crossing.','The seed distribution represents engine random outcomes, not human player behaviour.']};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),value=(name:string)=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];},stages=value('--stages')?.split(',').map(Number)??stageTimings.map(s=>s.index),seed=Number(value('--seed')??41),count=Number(value('--samples')??3);if(!Number.isInteger(count)||count<1)throw Error('Sample count must be positive');
 const cataloguePath=value('--monsters')??'packages/content/monsters.json',catalogueBytes=await readFile(cataloguePath),catalogue=resolveMonsterContent(JSON.parse(catalogueBytes.toString()));
 const regionId=value('--region'),campId=value('--camp');if(Boolean(regionId)!==Boolean(campId))throw Error('Actual camp retest requires both --region and --camp');
 let actualCamp;if(regionId&&campId){if(cataloguePath!=='packages/content/monsters.json')throw Error('Actual camp retest consumes adopted formal monster content');const info=fieldRegionInfo(regionId),camp=worldTables.camps.find(c=>c.id===campId&&c.region===regionId);if(!info||info.qa||!camp)throw Error('Actual camp retest requires a registered production region and its authored camp');actualCamp={region:regionById(regionId),tables:worldTables,camp};if(!value('--stages')||stages.length!==1)throw Error('One actual camp retest must declare its single numeric stage');}
 const report=measurePackGrowth(stages,Array.from({length:count},(_,i)=>seed+i*32),Number(value('--seconds')??90),catalogue,actualCamp),output=value('--out')??'docs/reviews/open-world-m2-m4/W3/pack-growth-current.json';
 const modelBytes=await readFile('.design/standard-player-20261005/model.json');await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify({...report,cataloguePath,catalogueSha256:createHash('sha256').update(catalogueBytes).digest('hex'),modelSha256:createHash('sha256').update(modelBytes).digest('hex')},null,2)+'\n');console.log(JSON.stringify({output,cataloguePath,stages:report.rows.length,samples:report.samples,failedGroups:report.rows.flatMap(r=>r.groups.filter(g=>!g.passes).map(g=>({stage:r.stage,count:g.count,gain:g.killingRateGain,clear:g.clear,end:g.end})))}));
}
