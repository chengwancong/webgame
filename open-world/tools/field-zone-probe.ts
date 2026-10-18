import type {CharacterState,Spawn,Vec} from '../packages/contracts/index.ts';
import {versions} from '../packages/contracts/index.ts';
import type {WorldTables} from '../packages/contracts/open-world.ts';
import type {Region} from '../packages/content/index.ts';
import {resolveBuild} from '../packages/rules/index.ts';
import {campSpawns,campsNear} from '../packages/rules/world-camps.ts';
import {World,distance,walkable} from '../packages/simulation/index.ts';
import {sampleCombatBuild} from './build-variety-benchmark.ts';

export type FieldZoneProbeInput={region:Region;tables:WorldTables;zone:string;character:CharacterState;seeds:number[];seconds:number;chunkCells:number;chunkReach?:number;start?:Vec;difficulty?:{hp:number;attack:number;armor:number};affixRange?:readonly [number,number];restoreAtSeconds?:number};
export function probeFieldZone(input:FieldZoneProbeInput){
 const zone=input.tables.zones.find(z=>z.id===input.zone&&z.region===input.region.id),allCamps=input.tables.camps.filter(c=>c.region===input.region.id),targetCamps=allCamps.filter(c=>c.zone===input.zone),start=input.start??input.region.safe;
 if(!zone||!targetCamps.length)throw Error('Field probe requires an authored region zone with camps');
 if(!Number.isFinite(input.seconds)||input.seconds<=0||!Number.isInteger(input.chunkCells)||input.chunkCells<1||!input.seeds.length||input.seeds.some(s=>!Number.isSafeInteger(s))||new Set(input.seeds).size!==input.seeds.length||!walkable(input.region,start,1))throw Error('Invalid field probe seeds, clock, chunks or starting position');
 if(input.restoreAtSeconds!==undefined&&(!Number.isFinite(input.restoreAtSeconds)||input.restoreAtSeconds<=0||input.restoreAtSeconds>=input.seconds))throw Error('Restore point must be inside the actual probe budget');
 const resolved=resolveBuild(input.character),build={stats:resolved.stats,skills:resolved.resolvedSkills},difficulty=input.difficulty??{hp:1,attack:1,armor:1};
 // Reuse the benchmark's activation/weapon/build audit before starting the path.
 const auditTarget=campSpawns(input.region,input.tables,targetCamps[0],1,difficulty)[0],audit=sampleCombatBuild({requestedSkills:input.character.skills,skillRanks:input.character.skillRanks,build,region:{...structuredClone(input.region),safe:start},spawns:[auditTarget],seed:input.seeds[0],maxTicks:1,mode:'auto',stopWhen:'window'});
 const samples=input.seeds.map(seed=>{
  let world=new World({...structuredClone(input.region),safe:start},build.stats,build.skills,[],[],seed);world.setMode('auto');
  const loaded=new Set<string>(),sources=new Map<string,{camp:string;zone:string;spawn:Spawn}>(),firstHit=new Map<string,number>(),deaths=new Map<string,number>(),campStart=new Map<string,number>(),campClear=new Map<string,number>();
  const normalTtk:number[]=[],eliteTtk:number[]=[],rareTtk:number[]=[],casts:Record<string,number>={},castFailures:Record<string,number>={};let damage=0,incoming=0,engaged=0,travel=0,allKills=0,zoneKills=0,restored=false;let destination:string|undefined;
  const restoreTick=input.restoreAtSeconds===undefined?null:Math.ceil(input.restoreAtSeconds*30);
  for(let i=0;i<Math.ceil(input.seconds*30)&&world.hero.hp>0;i++){
   const nearby=campsNear(allCamps,input.region.id,world.hero.position,input.chunkCells,input.chunkReach??2);
   for(const camp of nearby)if(!loaded.has(camp.id)){
    const spawns=campSpawns(input.region,input.tables,camp,1,difficulty,input.affixRange?{range:input.affixRange,seed}:undefined);world.addSpawns(spawns);world.bindCamp(camp,spawns.map(s=>s.id));loaded.add(camp.id);for(const spawn of spawns)sources.set(spawn.id,{camp:camp.id,zone:camp.zone,spawn});
   }
   const remaining=targetCamps.filter(c=>!campClear.has(c.id));if(!remaining.length)break;
   if(!destination||campClear.has(destination)){destination=remaining.sort((a,b)=>distance(world.hero.position,a)-distance(world.hero.position,b)||a.id.localeCompare(b.id))[0].id;world.go(allCamps.find(c=>c.id===destination)!);}
   const camp=allCamps.find(c=>c.id===destination)!;
   if(distance(world.hero.position,camp)<=camp.radius+3&&world.mode!=='auto')world.setMode('auto');
   const from={...world.hero.position};world.step();if(distance(from,world.hero.position)>.001)travel++;
   let combat=false;
   for(const event of world.events){
    if(event.type==='cast_started'&&event.id===world.playerId&&event.skill)casts[event.skill]=(casts[event.skill]??0)+1;
    if(event.type==='cast_failed'&&event.id===world.playerId&&event.reason)castFailures[event.reason]=(castFailures[event.reason]??0)+1;
    if(event.type==='hit_resolved'){
     if(event.id===world.playerId){incoming+=event.amount??0;combat=true;}
     const source=sources.get(event.id);if(source){combat=true;if(!firstHit.has(event.id))firstHit.set(event.id,world.tick);if(source.zone===zone.id){damage+=event.amount??0;if(!campStart.has(source.camp))campStart.set(source.camp,world.tick);}}
    }
    if(event.type==='entity_died'&&sources.has(event.id)&&!deaths.has(event.id)){
     deaths.set(event.id,world.tick);allKills++;const source=sources.get(event.id)!;if(source.zone===zone.id){zoneKills++;const first=firstHit.get(event.id);if(first!==undefined){const elapsed=(world.tick-first+1)/30,rank=source.spawn.monster?.rank,role=source.spawn.monster?.role??'normal';if(rank==='normal'&&role!=='swarm')normalTtk.push(elapsed);if(rank==='elite')eliteTtk.push(elapsed);if(rank==='rare')rareTtk.push(elapsed);}}
    }
   }
   if(combat||world.enemies.some(e=>e.alive&&firstHit.has(e.id)&&distance(e.position,world.hero.position)<world.rules.aiRules.activeRadius))engaged++;
   for(const camp of targetCamps)if(loaded.has(camp.id)&&!campClear.has(camp.id)){
    const ids=[...sources].filter(([,s])=>s.camp===camp.id).map(([id])=>id);if(ids.length&&ids.every(id=>deaths.has(id)))campClear.set(camp.id,world.tick);
   }
   if(restoreTick!==null&&!restored&&world.tick>=restoreTick){world=World.restore(world.exportCheckpoint());restored=true;}
  }
  const actualSeconds=world.tick/30,mean=(values:number[])=>values.length?values.reduce((n,v)=>n+v,0)/values.length:null;
  return {seed,seconds:actualSeconds,survived:world.hero.hp>0,completed:campClear.size===targetCamps.length,loadedCamps:[...loaded],zoneKills,otherZoneKills:allKills-zoneKills,killsPerMinute:actualSeconds>0?zoneKills/actualSeconds*60:0,engagedShare:world.tick?engaged/world.tick:0,movingShare:world.tick?travel/world.tick:0,normalTtk:{samples:normalTtk.length,meanSeconds:mean(normalTtk),values:normalTtk},eliteTtk:{samples:eliteTtk.length,meanSeconds:mean(eliteTtk),values:eliteTtk},rareTtk:{samples:rareTtk.length,meanSeconds:mean(rareTtk),values:rareTtk},camps:targetCamps.map(c=>({id:c.id,loaded:loaded.has(c.id),firstHitTick:campStart.get(c.id)??null,clearTick:campClear.get(c.id)??null,clearSeconds:campStart.has(c.id)&&campClear.has(c.id)?(campClear.get(c.id)!-campStart.get(c.id)!+1)/30:null})),damage,incoming,casts,castFailures,hpLeft:world.hero.hp,manaLeft:world.hero.mana,position:{...world.hero.position},checkpointRestored:restored};
 });
 const ticks=samples.reduce((n,s)=>n+s.seconds*30,0),kills=samples.reduce((n,s)=>n+s.zoneKills,0),normal=samples.flatMap(s=>s.normalTtk.values),clear=samples.flatMap(s=>s.camps.flatMap(c=>c.clearSeconds===null?[]:[c.clearSeconds]));
 return {generated:new Date().toISOString(),versions:structuredClone(versions),region:input.region.id,zone:structuredClone(zone),start,seeds:input.seeds,budgetSeconds:input.seconds,chunkCells:input.chunkCells,chunkReach:input.chunkReach??2,difficulty,affixRange:input.affixRange??null,requestedSkills:audit.requested,executedSkills:audit.executed,skillRanks:input.character.skillRanks,build,summary:{samples:samples.length,completed:samples.filter(s=>s.completed).length,deaths:samples.filter(s=>!s.survived).length,kills,killsPerMinute:ticks?kills/ticks*30*60:0,engagedShare:ticks?samples.reduce((n,s)=>n+s.engagedShare*s.seconds*30,0)/ticks:0,normalTtkSamples:normal.length,normalTtkSeconds:normal.length?normal.reduce((n,v)=>n+v,0)/normal.length:null,clearedCamps:clear.length,meanCampClearSeconds:clear.length?clear.reduce((n,v)=>n+v,0)/clear.length:null},samples,limits:['Actual authored geometry, camp templates/levels/budgets, streamed chunks and World movement/combat. The player receives no extra HP, mana, healing or damage multipliers.','The route visits each target-zone camp once, starting at the declared landing or explicit controlled start. All nearby camps, including other zones, remain present and can engage.','This measures initial-cycle route efficiency. No respawn, rewards, server settlement or natural sustainable drop-frequency claim is made; those require persistent camp/source probes.','Mean TTK is conditional on kills. Unfinished camps, deaths, failed casts and zero-kill runs remain visible in the sample and aggregate rate.']};
}
