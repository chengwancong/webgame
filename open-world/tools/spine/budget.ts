import {statRegistry} from '../../packages/contracts/stats.ts';
import {eliteAffixes} from '../../packages/content/elite-affixes.ts';
import {applyEliteAffixes} from '../../packages/rules/elite-affixes.ts';
import {resolveMonsterSpawn} from '../../packages/rules/monster-stats.ts';
import {sampleCombatBuild} from '../build-variety-benchmark.ts';
import {benchArena} from './bench.ts';
import {median,ttdReduction} from './math.ts';
import {save,readJson,review,data,stamp,evidence} from './io.ts';
import {writeAudit} from './audit.ts';
import {resolvePlayer,standardState} from './player.ts';
export async function priceAttributes(output:string,baseline=false){
 const affix=await readJson(baseline?review+'/S0/source-before/packages/content/gear-affixes.json':'packages/content/gear-affixes.json'),weights=(await readJson(data+'/stat-weights.json')).rows,rows=[];
 for(const kind of ['pool','mainStats'])for(const [i,row]of affix[kind].entries()){
  const level=kind==='pool'&&row.tier<3?20:50,weight=weights.find((w:any)=>w.level===level&&w.stat===row.stat)?.powerWeight;
  if(weight===undefined)throw Error('缺少已用属性实测权重 '+row.stat);const value=kind==='pool'?(row.minValue+row.maxValue)/2:row.t8,observed=weight*value;
  rows.push({id:kind+'-'+i+'-'+row.stat,category:kind==='pool'?'词缀':'主属性',group:kind==='pool'?'tier-'+row.tier:'T8',band:.1,primary:'属性权重×数值',host:'标准人L'+level,observed,functional:Math.abs(observed)<Math.log(1.01),elasticity:1,elasticityBasis:'定价定义对数值严格线性，不以此冒充World伤害弹性',value,file:'packages/content/gear-affixes.json',path:[kind,i,kind==='pool'?'maxValue':'t8'],step:statRegistry.find(s=>s.id===row.stat)?.unit==='flat'?1:.05,offset:0});
 }await save(output+'/affix-prices-summary.json',{...stamp(),rows});return rows;
}
export async function measureEliteBudget(output=review+'/S2',baseline=true){
 const frozen=baseline?await readJson(review+'/S2/arms/standard-50.json'):null,player=baseline?frozen.inputs.player:resolvePlayer('elite-budget-current',standardState(50)),base=resolveMonsterSpawn({id:'elite-budget',template:'raider',level:50,rank:'elite',x:27,y:24});base.hp=1e15;const rows:{id:string;ttd:number;censored:boolean;source:Awaited<ReturnType<typeof evidence>>}[]=[];
 for(const key of ['none',...Object.keys(eliteAffixes)]){const path=output+'/arms/elite-budget-'+key+'.json';let sample;try{sample=await readJson(path);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;const spawn=key==='none'?base:applyEliteAffixes(base,[key as keyof typeof eliteAffixes]);sample=sampleCombatBuild({requestedSkills:player.build.skills.map((s:any)=>s.id),skillRanks:player.skillRanks,build:player.build,region:benchArena,spawns:[spawn],seed:41,maxTicks:120*30,mode:'auto',stopWhen:'death'});await save(path,sample);}rows.push({id:key,ttd:sample.deathSeconds??sample.elapsed,censored:sample.deathSeconds===null,source:await evidence(path)});}
 const priced=rows.slice(1).map(r=>({id:r.id,category:'精英词缀',group:'危险度',band:.15,primary:'TTD降低比例',host:baseline?'冻结的S2标准人50':'当前标准人50',...ttdReduction(rows[0],r),elasticity:null,value:null,file:'packages/content/elite-affixes.json',path:[r.id],step:.05,offset:0,censored:r.censored,baselineCensored:rows[0].censored,ttd:r.ttd,basis:'有符号TTD降低比例；任一侧删失时只报告界限，不标为功能型或零影响'}));await save(output+'/elite-budget-summary.json',{...stamp(),seeds:[41],rows,priced});return priced;
}
export async function finishBudgetAudit(output=review+'/S2',baseline=true){const contents=(await readJson(output+'/content-measurements.json')).rows,affixes=await priceAttributes(output,baseline),elite=await measureEliteBudget(output,baseline);return writeAudit([...contents,...affixes,...elite],output);}
