import type {World} from '../../packages/simulation/index.ts';
import {appendFile,writeFile,readFile} from 'node:fs/promises';
import {hubChartContent} from '../../packages/content/hub-chart.ts';
import {dungeonContent} from '../../packages/content/dungeons.ts';
import {regionById,type Region} from '../../packages/content/index.ts';
import {generatePlaneStage,isPlaneStage} from '../../packages/content/plane-layouts.ts';
import {prepareHubRegion,newHubRun,scaleHubStorySpawns} from '../../apps/api/src/hub-dungeon-runtime.ts';
import {dungeonSpawns} from '../../packages/rules/dungeon-build.ts';
import {standardState,resolvePlayer} from './player.ts';
import {sampleCombatBuild} from '../build-variety-benchmark.ts';
import type {Spawn} from '../../packages/contracts/index.ts';
import type {HubRewardEvidence} from './hub-reward-schema.ts';

/** Standalone actual combat measurement, not a full run/pathing/autopilot substitute.
 * Both outgoing and incoming samples use the real World and authored monster skills.
 * Manual incoming sample retains the same build but sends no actions; no synthetic
 * damage, replenishment, health scaling, safety-zone combat or target resets. */
export async function measureHubCombat(output:string,seeds:number[],resume?:string){
 const rows:HubRewardEvidence['combat']=[];const raw:unknown[]=[];await writeFile(output+'/combat-raw.jsonl','',{flag:'wx'});
 const resumed=new Set<string>();if(resume){const seedFixed=await readFile(resume+'/resumed-from.json','utf8').then(()=>true).catch(()=>false);const prior=(await readFile(resume+'/combat-raw.jsonl','utf8')).trim().split('\n').filter(Boolean).map(line=>JSON.parse(line)).filter(r=>seedFixed||!r.node.endsWith('-hunt'));if(prior.some(r=>r.augments!==undefined||r.shipyardRerolls!==undefined))throw Error('Legacy in-run bonus evidence cannot be resumed after removal');for(const r of prior){resumed.add(r.node);if(!r.outgoing)continue;const o=r.outgoing,i=r.incoming,failure=o.failed??(i.deathSeconds===null?'incoming_censored':undefined);rows.push({nodeId:r.node,rank:r.rank,seed:r.seed,family:'sword',level:o.targetParams[0].monster?.level??hubChartContent.nodes.find(n=>n.id===r.node)!.recommendedLevel,ttkSeconds:o.clearSeconds,ttdSeconds:i.deathSeconds,requestedSkills:o.requested,executedSkills:o.executed,skillRanks:o.skillRanks,...(failure?{failure}:{})});resumed.add(r.node);}await appendFile(output+'/combat-raw.jsonl',prior.map(r=>JSON.stringify(r)).join('\n')+'\n');}
 const arena:Region={id:'hub-number-measure',name:'HUB档位测量',subtitle:'',theme:'meadow',width:64,height:64,safe:{x:2,y:2},portal:{x:60,y:60},obstacles:[],spawns:[],landmarks:[],boss:false,auto:true,rest:false};
 for(const node of hubChartContent.nodes){if(resumed.has(node.id)){console.log('HUB combat reused completed raw samples '+node.id);continue;}const d=dungeonContent.definitions.find(d=>d.id===node.dungeonId);if(!d?.hub)throw Error('Missing real HUB dungeon '+node.id);
  for(const seed of seeds){const run=newHubRun(d);run.seed=seed;const representatives=new Map<'normal'|'elite'|'boss',Spawn>();
   try{for(const [stage,id]of d.stages.entries()){
    const region=prepareHubRegion(isPlaneStage(id)?generatePlaneStage(id,seed).region:regionById(id),d,stage,'measure',run),spawns=d.hub.kind==='story'?Object.values(run.storySpawns??{}).flat():region.spawns;
    for(const spawn of (d.hub.kind==='story'?scaleHubStorySpawns(spawns,d,stage,node.combatScale??{hp:1,attack:1}):dungeonSpawns(spawns,d.policy,1,stage,[],undefined,'starsea',node.combatScale??{hp:1,attack:1}))){const rank=spawn.monster?.rank==='rare'?'elite':spawn.boss?'boss':spawn.elite?'elite':'normal';representatives.set(rank,spawn);}
   }
   }catch(error){const failure={node:node.id,seed,failure:String(error),status:'unmeasured'};raw.push(failure);console.log(JSON.stringify(failure));continue;}
   if(!representatives.size){raw.push({node:node.id,seed,failure:'No authored combat target',status:'unmeasured'});continue;}
   for(const [rank,source]of representatives){
    const level=source.monster?.level??node.recommendedLevel,state=standardState(level);
    const player=resolvePlayer(`hub-${node.id}-${rank}-${seed}`,state),spawn={...structuredClone(source),id:'target',x:27,y:24},common={requestedSkills:player.build.skills.map(s=>s.id),skillRanks:player.skillRanks,build:player.build,region:arena,spawns:[spawn],seed,maxTicks:180*30,instrument:{created(w:World){w.hero.position={x:24,y:24};w.radius=64;}}};
    const outgoing=sampleCombatBuild({...common,mode:'auto',stopWhen:'clear',approachTargets:true}),incoming=sampleCombatBuild({...common,mode:'manual',stopWhen:'death'});
    const failure=outgoing.failed??(incoming.deathSeconds===null?'incoming_censored':undefined);
    rows.push({nodeId:node.id,rank,seed,family:'sword',level,ttkSeconds:outgoing.clearSeconds,ttdSeconds:incoming.deathSeconds,requestedSkills:outgoing.requested,executedSkills:outgoing.executed,skillRanks:player.skillRanks,...(failure?{failure}:{})});raw.push({node:node.id,rank,seed,buildBasis:'fixed-out-of-run',outgoing,incoming});
   }
  }
  // Persist progressively; an interrupted probe retains failed and successful
  // samples already measured without pretending the remainder ran.
  await appendFile(output+'/combat-raw.jsonl',raw.map(row=>JSON.stringify(row)).join('\n')+'\n');raw.length=0;console.log('HUB combat sampled '+node.id+'; samples='+rows.length);
 }
 return rows;
}



