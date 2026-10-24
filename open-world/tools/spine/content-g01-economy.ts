import fs from 'node:fs/promises';
import {starseaKillReward} from '../../apps/api/src/economy.ts';
import {hubTypeBudgets} from './hub-rewards.ts';
import {hubChartContent} from '../../packages/content/hub-chart.ts';
import {craftMaterials,craftRecipes,craftGathering} from '../../packages/content/crafting.ts';
import {tasks} from '../../packages/content/task-tables.ts';
import {progressionConfig} from '../../packages/content/deep-progression.ts';
import {parseHubOutsideNumbers} from '../../packages/content/hub-outside-numbers.ts';
import outsideRaw from '../../packages/content/hub-outside-numbers.json';
const levels={forge:18,frost:24,rift:30,dragon:35};
export function deriveContentEconomy(){
 const rows=Object.entries(levels).map(([region,level])=>{
  const kill=starseaKillReward(level,'normal',level,'ss-map-'+region),baseline={xp:kill.xp*10,gold:kill.gold*10,material:kill.material*10};
  const nodes=hubChartContent.nodes.filter(n=>n.region===region).map(n=>{const t=hubTypeBudgets[n.kind];return {id:n.id,kind:n.kind,minutes:t.minutes,f:t.f,g:t.g,reward:{xp:Math.floor(baseline.xp*t.minutes*t.f),gold:Math.floor(baseline.gold*t.minutes*t.f),material:Math.floor(baseline.material*t.minutes*t.f),shards:n.kind==='gate'?1:0,...(!['story','gate'].includes(n.kind)?{shardChance:.6}:{}),rep:n.kind==='gate'?40:n.kind==='nest'?15:5}};});
  const mats=craftMaterials.filter(m=>m.island==='ss-map-'+region&&m.tier==='T1'&&['ore','plant'].includes(m.kind));
  const onlineMaterialPerHour=3*(craftGathering.min+craftGathering.max)/2/mats.length*60/hubTypeBudgets.nest.minutes;
  // M14 N6: three fleets, 12 hours each, one two-hour quick claim; include M17 maximum exploration bonus.
  const maxExplore=1.5,rate=Math.min(onlineMaterialPerHour*.25/3,onlineMaterialPerHour/38)/maxExplore;
  const dockRate={region,goldPerHour:baseline.gold*60/38/maxExplore,materialsPerHour:Object.fromEntries(mats.map(m=>[m.id,rate]))};
  const commissions=tasks.filter(t=>t.type==='bounty'&&t.id.startsWith('ow-'+region+'-'));
  const extraGold=nodes.reduce((a,n)=>a+n.reward.gold,0)+commissions.map(t=>t.reward_gold??0).sort((a,b)=>b-a).slice(0,8).reduce((a,b)=>a+b,0);
  const dailyGoldShare=extraGold/(baseline.gold*85+extraGold);
  const recipes=craftRecipes.filter(r=>r.island==='ss-map-'+region);
  return {region,level,baseline,nodes,dockRate,materials:craftMaterials.filter(m=>m.island==='ss-map-'+region).map(m=>({id:m.id,name:m.name,tier:m.tier,kind:m.kind})),recipes:recipes.map(r=>r.id),recipeOffers:recipes.filter(r=>!r.output.pattern&&!r.output.repair&&['resist','essence'].includes(r.category)).map(r=>({id:r.id,tier:Math.min(4,Object.keys(levels).indexOf(region)+3),gold:progressionConfig.costs.recipeLearn.gold,material:progressionConfig.costs.recipeLearn.material})),commissionIds:commissions.map(t=>t.id),checks:{nodeRates:nodes.every(n=>['xp','gold','material'].every(k=>n.reward[k as keyof typeof baseline]/n.minutes<=baseline[k as keyof typeof baseline])),dailyGoldShare,dailyGoldWithin40:dailyGoldShare<=.4,dockHourlyShare:rate*3*maxExplore/onlineMaterialPerHour,dockDayOnlineHours:rate*38*maxExplore/onlineMaterialPerHour},basis:'M14 defaults, actual reward formula; authored duration and gathering model, not measured gameplay'};
 });return {version:1,rows,existingCommissionEconomy:parseHubOutsideNumbers(outsideRaw),pending:['N1/2/4: five-seed combat and natural route measurements for four regions','N6: live gather rates to replace authored 3-segment model','N9: chapter income and actual crafting receipts','N10: three-slot residual shard economics and C3 reward valuation']};
}
export async function runContentEconomy(args:string[]){const out=args.find(a=>a.startsWith('--out='))?.slice(6)??'.runtime/content-g01/economy-plan.json';await fs.mkdir('.runtime/content-g01',{recursive:true});
 if(args.includes('--verify')){const p=JSON.parse(await fs.readFile(out,'utf8'));for(const r of p.rows){if(!r.checks.nodeRates||!r.checks.dailyGoldWithin40||r.checks.dockHourlyShare>.25+1e-9||r.checks.dockDayOnlineHours>1+1e-9)throw Error('M14 content economy constraint failed '+r.region);if(r.nodes.length!==10||r.commissionIds.length!==18)throw Error('Incomplete regional content '+r.region);}console.log('C7 one verification: 4 regions / 40 budgets; rate, gold daily and dock constraints passed. Combat and non-gold daily measurement pending.');return;}
 await fs.writeFile(out,JSON.stringify(deriveContentEconomy(),null,2)+'\n');console.log('C7 single derivation written to '+out);
}
