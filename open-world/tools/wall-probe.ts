// 数值来源已迁到 tools/spine；本文件保留历史探针，正式派生请使用 pnpm spine:check 与主干CLI。
import '../packages/content/open-world/index.ts';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import type {CharacterState,Spawn} from '../packages/contracts/index.ts';
import {versions} from '../packages/contracts/index.ts';
import {regionById,type Region} from '../packages/content/index.ts';
import {dungeonContent} from '../packages/content/dungeons.ts';
import type {DungeonDefinition} from '../packages/contracts/dungeons.ts';
import {monsterContent} from '../packages/content/monsters.ts';
import {resolveBuild} from '../packages/rules/index.ts';
import {dungeonSpawns,dungeonBuild} from '../packages/rules/dungeon-build.ts';
import {armorMitigation} from '../packages/rules/combat-numerics.ts';
import {World,walkable} from '../packages/simulation/index.ts';
import {sampleCombatBuild} from './build-variety-benchmark.ts';
import {standard} from './standard-player-model.ts';
import {stageTimings} from './world-stage-schedule.ts';
import type {WallBasis} from './apply-dungeon-walls.ts';
import {wallAcceptance} from './wall-acceptance.ts';
import {characterDungeonDefinition} from '../packages/rules/hardmode-dungeon.ts';

export const wallRatios=[.8,.85,1,1.2] as const;
export type WallProbeInput={definition:DungeonDefinition;region:Region;character:CharacterState;stage:number;seed:number;seeds:number[];samplesPerRatio:number;ratios?:readonly number[];maxSeconds:number;worldLine:'campaign'|'starsea';worldDifficulty?:{hp:number;attack:number};measurementSeconds?:number};
function check(input:WallProbeInput){
 if(input.definition.mode!=='realtime'||input.definition.policy.party.min!==1||input.definition.policy.party.max!==1||input.definition.story)throw Error('Wall probe requires a declared realtime solo dungeon without story objectives; multiplayer must use independent actors');
 if(input.definition.stages.at(-1)!==input.region.id||!input.region.spawns.some(s=>s.boss))throw Error('Wall probe requires the declared final boss region');
 if(input.definition.numericStage!==undefined&&input.stage!==input.definition.numericStage)throw Error('Wall stage differs from the declared numeric stage');
 if(!Number.isInteger(input.stage)||input.stage<1||input.stage>24||!Number.isInteger(input.samplesPerRatio)||input.samplesPerRatio<1||input.seeds.length!==input.samplesPerRatio||new Set(input.seeds).size!==input.seeds.length||input.seeds.some(s=>!Number.isSafeInteger(s))||!Number.isFinite(input.maxSeconds)||input.maxSeconds<=0||input.maxSeconds>input.definition.policy.timeLimitSeconds)throw Error('Invalid wall stage, distinct sample seeds or declared time budget');
 if((input.ratios??wallRatios).some(r=>!Number.isFinite(r)||r<=0))throw Error('Wall power ratios must be positive');
}
/** Only the independent stationary damage measurement uses an adjacent target.
 * Win-rate worlds retain the declared landing point, obstacles and all adds. */
function adjacent(region:Region,boss:Spawn){
 for(const radius of [1.25,1.5,2,2.5,3,4,5])for(let n=0;n<16;n++){const p={x:boss.x+Math.cos(n*Math.PI/8)*radius,y:boss.y+Math.sin(n*Math.PI/8)*radius};if(walkable(region,p,1))return p;}
 throw Error('No walkable stationary boss measurement position');
}
export function wallSpawns(input:WallProbeInput,hpFactor=1){
 const policy=structuredClone(input.definition.policy);policy.enemyScale.hp*=hpFactor;
 return dungeonSpawns(input.region.spawns,policy,policy.minTier,input.definition.stages.length-1,[],monsterContent,input.worldLine,input.worldDifficulty??{hp:1,attack:1});
}
export function measureWallBasis(input:WallProbeInput):WallBasis&{bossAttack:number;bossArmor:number;seconds:number;hits:number;position:{x:number;y:number};controls:Record<string,unknown>}{
 check(input);const seconds=input.measurementSeconds??30;if(!Number.isFinite(seconds)||seconds<=0)throw Error('Invalid stationary measurement duration');
 const boss=wallSpawns(input).find(s=>s.boss)!;
 const point=adjacent(input.region,boss),region={...structuredClone(input.region),safe:point};
 const world=new World(region,{hp:1e15,attack:0,armor:0,speed:0,mana:0,regen:0,effects:[]},[],[boss],[],input.seed);world.setMode('manual');
 let damage=0,hits=0;for(let n=0;n<Math.ceil(seconds*30);n++){world.step();for(const e of world.events)if(e.type==='hit_resolved'&&e.id===world.playerId){damage+=e.amount??0;hits++;}}
 if(damage<=0||hits===0||world.hero.hp<=0)throw Error('Boss basis produced no valid actual incoming damage');
 return {dungeon:input.definition.id,stage:input.stage,bossHp:boss.hp,rawDps:damage/(world.tick/30),enemyScale:{hp:input.definition.policy.enemyScale.hp,attack:input.definition.policy.enemyScale.attack},versions:structuredClone(versions),seed:input.seed,samples:1,bossAttack:boss.attack,bossArmor:boss.monster?.armor??0,seconds:world.tick/30,hits,position:point,controls:{stationary:true,zeroArmor:true,measurementTargetHp:1e15,playerSkills:[],bossPhase:'full-health',adds:false}};
}
export function summarizeWallSamples(samples:{success:boolean;seconds:number;death:boolean;timeout:boolean;validationFailure:string|null}[]){
 if(!samples.length)throw Error('No wall samples');
 const wins=samples.filter(s=>s.success).map(s=>s.seconds).sort((a,b)=>a-b);
 return {samples:samples.length,wins:wins.length,winRate:wins.length/samples.length,deaths:samples.filter(s=>s.death).length,timeouts:samples.filter(s=>s.timeout).length,invalid:samples.filter(s=>s.validationFailure!==null).length,meanWinSeconds:wins.length?wins.reduce((n,v)=>n+v,0)/wins.length:null,medianWinSeconds:wins.length?(wins[Math.floor((wins.length-1)/2)]+wins[Math.ceil((wins.length-1)/2)])/2:null,maxWinSeconds:wins.at(-1)??null};
}
/** Rho scenarios change explicit private encounter HP difficulty before World
 * construction. The actual player stays identical; no post-measurement damage
 * multiplier, refill, heal, invulnerability or victory injection is used. */
export function probeWall(input:WallProbeInput){
 check(input);const basis=measureWallBasis(input),resolved=resolveBuild(input.character),build=dungeonBuild(resolved.stats,resolved.resolvedSkills,[]);
 const boss=wallSpawns(input).find(s=>s.boss)!,point=adjacent(input.region,boss),target=structuredClone(boss);target.hp=1e15;target.attack=0;
 if(target.monster){target.monster.armor=0;target.monster.baseStats={...target.monster.baseStats,hp:1e15,attack:0,armor:0};target.monster.ai.skillChance=0;}
 const output=sampleCombatBuild({requestedSkills:input.character.skills,skillRanks:input.character.skillRanks,build,region:{...structuredClone(input.region),safe:point},spawns:[target],seed:input.seed,maxTicks:900,mode:'auto',stopWhen:'window'});
 if(output.failed)throw Error('Wall reference build measurement failed: '+output.failed);
 // Pair actual incoming pressure against the same full-health boss. Spell
 // cadence and registered passive defences must contribute to effective life.
 const incomingPoint=adjacent(input.region,boss),incoming=new World({...structuredClone(input.region),safe:incomingPoint},{...build.stats,attack:0,regen:0},[],[boss],[],input.seed);incoming.hero.hp=1e15;incoming.setMode('manual');let mitigatedDamage=0;const incomingTicks=Math.ceil((input.measurementSeconds??30)*30);for(let tick=0;tick<incomingTicks;tick++){incoming.step();for(const event of incoming.events)if(event.type==='hit_resolved'&&event.id===incoming.playerId)mitigatedDamage+=event.amount??0;}
 const mitigatedDps=mitigatedDamage/(incoming.tick/30);if(mitigatedDps<=0)throw Error('Actual defence measurement produced no incoming damage');
 const ehp=build.stats.hp*basis.rawDps/mitigatedDps,efficiency=.75,power=output.dps*ehp;
 const scenarios=(input.ratios??wallRatios).map(rho=>{
  const hpFactor=power*efficiency/(basis.bossHp*basis.rawDps*rho),spawns=wallSpawns(input,hpFactor),actualBoss=spawns.find(s=>s.boss)!;
  const observedRho=power*efficiency/(actualBoss.hp*basis.rawDps),samples=input.seeds.map(seed=>{
   const sample=sampleCombatBuild({requestedSkills:input.character.skills,skillRanks:input.character.skillRanks,build,region:input.region,spawns,seed,maxTicks:Math.ceil(input.maxSeconds*30),mode:'auto',stopWhen:'clear',goal:'final_boss',approachTargets:true});
   const died=sample.deathSeconds!==null,success=sample.clearSeconds!==null&&(!died||sample.clearSeconds<=sample.deathSeconds!);
   const death=died&&!success;
   // Failure to clear is an ordinary death/timeout sample, never discarded.
   const validationFailure=sample.failed&&sample.failed!=='not_cleared'&&!(sample.failed==='no_damage'&&died)?sample.failed:null;
   return {seed,success,death,timeout:!success&&!death,seconds:sample.elapsed,clearSeconds:sample.clearSeconds,deathSeconds:sample.deathSeconds,validationFailure,casts:sample.casts,castFailures:sample.failures,damage:sample.damage,incomingDamage:sample.incomingDamage,remaining:sample.remaining,hero:sample.hero};
  }),summary=summarizeWallSamples(samples),required=rho===.85?.3:rho===1?.9:rho===1.2?.99:null;
  return {requestedRho:rho,observedRho,hpFactor,enemyScale:{...input.definition.policy.enemyScale,hp:input.definition.policy.enemyScale.hp*hpFactor},targets:spawns,summary,threshold:required,passes:required===null?null:summary.invalid===0&&Math.abs(observedRho/rho-1)<=.05&&(summary.winRate>=required||(required-summary.winRate)/required<=.05),samples};
 });
 const speedComparison=wallAcceptance(scenarios);
 return {versions:structuredClone(versions),generated:new Date().toISOString(),dungeon:input.definition.id,numericStage:input.stage,definition:structuredClone(input.definition),region:structuredClone(input.region),worldLine:input.worldLine,worldDifficulty:input.worldDifficulty??{hp:1,attack:1},basis,reference:{level:input.character.level,requestedSkills:input.character.skills,skillRanks:input.character.skillRanks,build,dps:output.dps,ehp,power,efficiency,measurement:output,incoming:{ticks:incoming.tick,damage:mitigatedDamage,dps:mitigatedDps}},seeds:input.seeds,samplesPerRatio:input.samplesPerRatio,maxSeconds:input.maxSeconds,strategy:'existing World auto policy, identical actual player build at every rho',scenarios,speedComparison,limits:['Controlled enemy HP difficulty calibrated to rho = 0.75 * measured single-target DPS * paired actual incoming EHP / (boss HP * stationary raw boss DPS). Authored player build is never rescaled.','Full-health stationary raw/mitigated boss damage and a zero-armour nonattacking DPS target are separate measurements; later boss phases, active defence skills and player behaviour can differ from the nominal power ratio.','Win samples use the actual declared region, landing, obstacles, adds, boss phases, mana, cooldowns, HP, skill and weapon rules. Dead, timed out and invalid samples remain in the denominator.','Twenty seeds distinguish engine random outcomes, not a measured human skill distribution. Thresholds at 99% cannot establish population confidence with only twenty samples.','This Node engine probe does not award rewards or assert PostgreSQL settlement, natural acquisition, full dungeon routing or six-island production completion.']};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),value=(name:string)=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
 const dungeon=value('--dungeon');if(!dungeon)throw Error('Pass --dungeon with an actual registered solo definition');
 const source=dungeonContent.definitions.find(d=>d.id===dungeon);if(!source)throw Error('Unknown declared dungeon '+dungeon);const requestedStage=Number(value('--stage')??source.numericStage),definition=characterDungeonDefinition(source,requestedStage>18);
 const stage=Number(value('--stage')??definition.numericStage);if(!Number.isInteger(stage)||stage<1||stage>24)throw Error('Pass --stage for a dungeon without numericStage');
 const timing=stageTimings[stage-1],samples=Number(value('--samples')??20),seed=Number(value('--seed')??41),level=Number(value('--level')??Math.ceil(timing.level));
 const report=probeWall({definition,region:regionById(definition.stages.at(-1)!),character:standard(level,new Set(),timing.clear),stage,seed,seeds:Array.from({length:samples},(_,i)=>seed+i*32),samplesPerRatio:samples,maxSeconds:Number(value('--seconds')??Math.min(180,definition.policy.timeLimitSeconds)),worldLine:'starsea'});
 const output=value('--out')??'docs/reviews/open-world-m2-m4/W3/wall-'+stage+'.json';await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');
 const artifactBytes=await readFile(output);console.log(JSON.stringify({output,sha256:createHash('sha256').update(artifactBytes).digest('hex'),stage,scenarios:report.scenarios.map(s=>({rho:s.requestedRho,observedRho:s.observedRho,...s.summary,passes:s.passes}))}));
}
