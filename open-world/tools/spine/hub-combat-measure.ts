import type {World} from '../../packages/simulation/index.ts';
import {appendFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {hubChartContent} from '../../packages/content/hub-chart.ts';
import {dungeonContent} from '../../packages/content/dungeons.ts';
import {regionById,type Region} from '../../packages/content/index.ts';
import {generatePlaneStage,isPlaneStage} from '../../packages/content/plane-layouts.ts';
import {prepareHubRegion,newHubRun,pickAutomaticAugment,scaleHubStorySpawns} from '../../apps/api/src/hub-dungeon-runtime.ts';
import {dungeonSpawns} from '../../packages/rules/dungeon-build.ts';
import {standardState,resolvePlayer} from './player.ts';
import {sampleCombatBuild} from '../build-variety-benchmark.ts';
import {resolveRunAugmentPolicy} from '../../packages/content/dungeon-augments.ts';
import {newAugmentRun,offerAugments,chooseAugment} from '../../packages/rules/run-augments.ts';
import {freezeAugmentBasis,frozenAugmentContext} from '../../packages/rules/frozen-augment-build.ts';
import {augments} from '../../packages/content/augments.ts';
import type {Spawn} from '../../packages/contracts/index.ts';
import type {HubRewardEvidence} from './hub-reward-schema.ts';

/** Standalone actual combat measurement, not a full run/pathing/autopilot substitute.
 * Both outgoing and incoming samples use the real World and authored monster skills.
 * Manual incoming sample retains the same build but sends no actions; no synthetic
 * damage, replenishment, health scaling, safety-zone combat or target resets. */
export async function measureHubCombat(output:string,seeds:number[]){
 const rows:HubRewardEvidence['combat']=[];const raw:unknown[]=[];await writeFile(output+'/combat-raw.jsonl','',{flag:'wx'});
 const arena:Region={id:'hub-number-measure',name:'HUB档位测量',subtitle:'',theme:'meadow',width:64,height:64,safe:{x:2,y:2},portal:{x:60,y:60},obstacles:[],spawns:[],landmarks:[],boss:false,auto:true,rest:false};
 for(const node of hubChartContent.nodes){const d=dungeonContent.definitions.find(d=>d.id===node.dungeonId);if(!d?.hub)throw Error('Missing real HUB dungeon '+node.id);
  for(const seed of seeds){const run=newHubRun(d),representatives=new Map<'normal'|'elite'|'boss',Spawn>();
   for(const [stage,id]of d.stages.entries()){
    const region=prepareHubRegion(isPlaneStage(id)?generatePlaneStage(id,seed).region:regionById(id),d,stage,'measure',run),spawns=d.hub.kind==='story'?Object.values(run.storySpawns??{}).flat():region.spawns;
    for(const spawn of (d.hub.kind==='story'?scaleHubStorySpawns(spawns,d,stage,node.combatScale??{hp:1,attack:1}):dungeonSpawns(spawns,d.policy,1,stage,[],undefined,'starsea',node.combatScale??{hp:1,attack:1}))){const rank=spawn.monster?.rank==='rare'?'elite':spawn.boss?'boss':spawn.elite?'elite':'normal';representatives.set(rank,spawn);}
   }
   if(!representatives.size)throw Error('No authored combat target for '+node.id);
   for(const [rank,source]of representatives){const level=source.monster?.level??node.recommendedLevel,state=standardState(level),base=resolvePlayer('hub-'+node.id,state),basis=freezeAugmentBasis(state,base.build);
    for(const shipyardRerolls of [0,1] as const){const policy=resolveRunAugmentPolicy(d,1).policy;policy.rerolls+=shipyardRerolls;let selected=newAugmentRun(seed,policy);
     if(policy.enabled)for(let round=0;round<policy.rounds.length;round++){const context=frozenAugmentContext(basis,selected.chosen,augments);selected=offerAugments(selected,policy,augments,context);selected=chooseAugment(selected,randomUUID(),pickAutomaticAugment(selected.offered,augments,context),selected.offerVersion);}
     // Full-auto explicitly does not reroll. The +1 availability scenario is
     // nevertheless recorded; no invented 1.5% power bonus is inserted.
     const player=resolvePlayer(`hub-${node.id}-${rank}-${seed}-${shipyardRerolls}`,state,selected.chosen),spawn={...structuredClone(source),id:'target',x:27,y:24},common={requestedSkills:player.build.skills.map(s=>s.id),skillRanks:player.skillRanks,build:player.build,region:arena,spawns:[spawn],seed,maxTicks:180*30,instrument:{created(w:World){w.hero.position={x:24,y:24};w.radius=64;}}};
     const outgoing=sampleCombatBuild({...common,mode:'auto',stopWhen:'clear',approachTargets:true}),incoming=sampleCombatBuild({...common,mode:'manual',stopWhen:'death'});
     const failure=outgoing.failed??(incoming.deathSeconds===null?'incoming_censored':undefined);
     rows.push({nodeId:node.id,rank,seed,family:'sword',level,ttkSeconds:outgoing.clearSeconds,ttdSeconds:incoming.deathSeconds,requestedSkills:outgoing.requested,executedSkills:outgoing.executed,skillRanks:player.skillRanks,augments:selected.chosen,shipyardRerolls,...(failure?{failure}:{})});raw.push({node:node.id,rank,seed,shipyardRerolls,rerollsSpent:0,augments:selected.chosen,outgoing,incoming});
    }
   }
  }
  // Persist progressively; an interrupted probe retains failed and successful
  // samples already measured without pretending the remainder ran.
  await appendFile(output+'/combat-raw.jsonl',raw.map(row=>JSON.stringify(row)).join('\n')+'\n');raw.length=0;console.log('HUB combat sampled '+node.id+'; samples='+rows.length);
 }
 return rows;
}



