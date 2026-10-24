import {describe,it,expect} from 'vitest';
import {versions} from '../packages/contracts/index.ts';
import {hubChartContent} from '../packages/content/hub-chart.ts';
import {hubRewardEvidenceSchema} from '../tools/spine/hub-reward-schema.ts';
import {assessHubRewards,buildHubRewardPlan,hubSeeds,simulateHubShards} from '../tools/spine/hub-rewards.ts';

// Synthetic boundary fixtures verify the acceptance rules, not measured gameplay.
// Actual C3 evidence is evaluated by the same assessHubRewards implementation.
describe('B4 M14 acceptance thresholds',()=>{
 it('rejects node budgets above the regional per-minute baseline and daily extras above forty percent',()=>{
  const plan=buildHubRewardPlan({});
  expect(assessHubRewards(plan).find(x=>x.id==='budget')!.status).toBe('passed');
  for(const node of plan.nodes)node.reward.gold*=10;
  const checks=assessHubRewards(plan);
  expect(checks.find(x=>x.id==='budget')!.status).toBe('failed');
  expect(checks.find(x=>x.id==='N7')!.status).toBe('failed');
 });
 it('requires actual TTK and TTD within twenty percent, retaining a single outlier as failure',()=>{
  const combat=hubChartContent.nodes.flatMap(n=>['normal','elite','boss'].flatMap(rank=>hubSeeds.map(seed=>({nodeId:n.id,rank,seed,family:'sword',level:n.recommendedLevel,ttkSeconds:rank==='normal'?2.5:rank==='elite'?10:n.region==='wind'?60:75,ttdSeconds:rank==='normal'?40:rank==='elite'?20:30,requestedSkills:['fixture'],executedSkills:['fixture'],skillRanks:{fixture:1}}))));
  const e=hubRewardEvidenceSchema.parse({schema:'hub-reward-evidence-v1',command:'unit boundary fixture',versions,sourceHashes:{},combat});
  expect(assessHubRewards(buildHubRewardPlan({}),e).find(x=>x.id==='N1')!.status).toBe('passed');
  e.combat[0].ttdSeconds=31.99;
  expect(assessHubRewards(buildHubRewardPlan({}),e).find(x=>x.id==='N1')!.status).toBe('failed');
 });
 it('rejects recovery timing drift beyond ten percent and does not confuse missing evidence with success',()=>{
  const targets={sword:[3,60,115,200],staff:[45,60,160,200],hidden:[3,60,160,200]};
  const autopilot=Object.entries(targets).map(([family,times])=>({family,seed:11,skippedByFreeze:0,events:[...times.map((minutes,i)=>({nodeId:'fixture-'+i,atSeconds:minutes*60,levelBefore:1,levelAfter:1,recoveryOrder:i+1})),{nodeId:'wind-gate',atSeconds:3600,levelBefore:7,levelAfter:7},{nodeId:'mist-gate',atSeconds:12000,levelBefore:14,levelAfter:14}],withoutDailyWalls:[{region:'wind',minutes:240},{region:'mist',minutes:800}]}));
  const e=hubRewardEvidenceSchema.parse({schema:'hub-reward-evidence-v1',command:'unit recovery fixture',versions,sourceHashes:{},autopilot});
  const p=buildHubRewardPlan({});
  expect(assessHubRewards(p,e).find(x=>x.id==='N4')!.status).toBe('passed');
  e.autopilot[0].events[0].atSeconds*=1.101;
  expect(assessHubRewards(p,e).find(x=>x.id==='N4')!.status).toBe('failed');
  expect(assessHubRewards(p).find(x=>x.id==='N4')!.status).toBe('pending');
 });
 it('checks seven-day shard surplus and requested demand, rejecting a real shortage even when inventory never becomes negative',()=>{
  const p=buildHubRewardPlan({});for(const n of p.nodes){n.reward.shards=0;n.reward.shardChance=0;}
  const s=simulateHubShards(p);
  expect(s.demanded).toBeGreaterThan(0);expect(s.supplyToDemand).toBe(0);
  expect(assessHubRewards(p).find(x=>x.id==='N10')!.status).not.toBe('passed');
 });
 it('keeps currency/minute within baseline when integer card bounds round below the measured median',()=>{const e=hubRewardEvidenceSchema.parse({schema:'hub-reward-evidence-v1',command:'unit card rounding',versions,sourceHashes:{},runs:['sword','staff','hidden'].map(family=>({nodeId:'wind-nest-1',seed:11,family,seconds:108,won:true,rewards:{gold:1,xp:1,material:1},gathered:{},gearCount:1,hexCount:0,eligibleHex:{},shardsUsed:0,shardsDropped:0,day:1}))});const p=buildHubRewardPlan({},e);expect(p.nodes.find(n=>n.id==='wind-nest-1')!.estimatedMinutes).toEqual([1,2]);expect(assessHubRewards(p,e).find(x=>x.id==='budget')!.status).toBe('passed');});

});
