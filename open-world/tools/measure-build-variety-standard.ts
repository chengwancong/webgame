import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {standard} from './standard-player-model.ts';
import {resolveBuild} from '../packages/rules/index.ts';
import {sampleCombatBuild} from './build-variety-benchmark.ts';
import {resolveMonsterSpawn} from '../packages/rules/monster-stats.ts';
import {versions} from '../packages/contracts/index.ts';
import type {Region} from '../packages/content/index.ts';
import {measureAoeHit} from './world-aoe-hit-probe.ts';

// Measures the real current executor from the out-of-run build only.
// Acquisition schedules remain explicit design assumptions, not player measurements.
const path='.design/standard-player-20261005/model.json',model=JSON.parse(await readFile(path,'utf8'));
const seeds=[41,73,107],region:Region={id:'standard-probe',name:'标准人探针',subtitle:'受控场景',theme:'meadow',width:40,height:40,safe:{x:10,y:10},portal:{x:2,y:2},obstacles:[],spawns:[],landmarks:[],boss:false,auto:true};
const samples=[],hitSamples=[];
for(const row of model.rows){
 const state=standard(row.level),resolved=resolveBuild(state),build={stats:resolved.stats,skills:resolved.resolvedSkills};
 const aoe=resolved.resolvedSkills.find(skill=>skill.kind==='area');if(!aoe)throw Error('Standard schedule has no active primary AOE at L'+row.level);
 const firstHit=measureAoeHit(state,aoe.id);row.full.hitAoe=firstHit.hitAoe;row.full.hitAoeSkill=aoe.id;
 const mean=(values:number[])=>values.reduce((n,v)=>n+v,0)/values.length;
 for(const count of [1,4]){
  const measurements=seeds.map(seed=>sampleCombatBuild({requestedSkills:state.skills,skillRanks:state.skillRanks,build,region,spawns:Array.from({length:count},(_,i)=>({...resolveMonsterSpawn({id:'probe-'+i,template:'raider',level:row.level,rank:'normal',x:12+i%2,y:9+Math.floor(i/2)},undefined,{hp:1,attack:1,armor:1}),hp:1e14,attack:0})),seed,maxTicks:900,mode:'auto',stopWhen:'window'}));
  if(measurements.some(r=>r.failed))throw Error('Invalid standard measurement L'+row.level);
  const dps=mean(measurements.map(r=>r.dps));
  row.full[count===1?'dps1':'dpsN']=dps;
  samples.push({level:row.level,count,seeds,measuredDps:dps,measurements});
 }
 hitSamples.push(firstHit);
 console.log('standard L'+row.level+' measured');
}
const limits=['装备、技能及养成时间轴仍是标准人设计假设，不能代表自然掉落或真实玩家。','30秒自动策略、静止高生命零攻击靶，真实技能、资源和规则执行；不是首领胜率或自然地城TTK。','潮印已撤销；标准人源数据保留局外构筑原始实测，不再添加局内强化倍率。','未把种子差异当作人类操作水平分布；额外BD与操作分布、材料及钥匙掉落仍须后续真实样本校准。'];
model.meta={...model.meta,generated:new Date().toISOString(),versions,baselineSource:'current World 30Hz, 30s; seeds '+seeds.join('/'),measurement:{samples:samples.length*seeds.length,hitAoeSamples:hitSamples.length,seeds,limits:[...limits,'hitAoe is the first direct zero-armour hit with only direct critical permission disabled in a separate controlled World.']}};
await writeFile(path,JSON.stringify(model,null,1)+'\n');
const folder=process.argv[2]??'.qa/build-variety/standard';await mkdir(folder,{recursive:true});
await writeFile(folder+'/standard-probes.json',JSON.stringify({versions,seeds,samples:samples.length*seeds.length,hitAoeSamples:hitSamples.length,modelSha256:createHash('sha256').update(await readFile(path)).digest('hex'),limits,rows:samples,hits:hitSamples},null,1)+'\n');
