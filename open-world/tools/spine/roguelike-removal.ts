/** One derivation and one verification for removal of in-run choices.
 * Only raw dungeon HP/attack multipliers are writable. This is a scoped check,
 * never a replacement for checkSpine's historical whole-game gates. */
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve,relative,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {resolveDungeonContent,dungeonContent} from '../../packages/content/dungeons.ts';
import {regionById,type Region} from '../../packages/content/index.ts';
import {monsterContent} from '../../packages/content/monsters.ts';
import {hubNodeById} from '../../packages/content/hub-chart.ts';
import {generatePlaneStage,isPlaneStage} from '../../packages/content/plane-layouts.ts';
import {newHubRun,prepareHubRegion,scaleHubStorySpawns} from '../../apps/api/src/hub-dungeon-runtime.ts';
import {characterDungeonDefinition} from '../../packages/rules/hardmode-dungeon.ts';
import {dungeonSpawns} from '../../packages/rules/dungeon-build.ts';
import type {DungeonDefinition} from '../../packages/contracts/dungeons.ts';
import type {Spawn} from '../../packages/contracts/index.ts';
import {sampleCombatBuild} from '../build-variety-benchmark.ts';
import {walkable} from '../../packages/simulation/index.ts';
import {standardState,resolvePlayer,standardLevels} from './player.ts';
import {benchSample,measurementVersion} from './bench.ts';
import {pressure} from './world.ts';
import {interpolate} from './monsters.ts';
import {median} from './math.ts';
import {readJson,save,sha,stamp} from './io.ts';
import type {SpineChange} from './apply.ts';

const dungeonFile='packages/content/dungeons.json';
const seeds=[41,42,43];
type Point={level:number;D1:number;EHP:number;hp:number;failures:string[]};
type Scale={hp:number;attack:number};
type RemovalPlan={kind:'roguelike-removal-v1';protectedHashes:Record<string,string>;beforeHash:string;afterHash:string;changes:SpineChange[];points:Point[];rows:any[];failures:any[];[key:string]:unknown};
const stageTargetSource='config/json/spine-targets.json',efficiencySource='docs/reviews/numeric-spine-20261013/S5/efficiency-summary.json',efficiencyBasisFile='tools/spine/roguelike-removal-basis.json';
export type RemovalModelBasis={stageLevels:Record<string,number>;eta:number;sources:Record<string,string>;efficiencyOrigin?:{path:string;sha256:string};efficiencyStatus:'retained historical S5 efficiency; not freshly measured'};
type Calibration={targetSeconds:Record<string,number>;raidSupportWeight:number;bossEfficiency:number};
export function removalModelBasis(targets:{key:string;levels:string}[],bossEfficiencies:number[],sources:Record<string,string>):RemovalModelBasis{
 assert.equal(bossEfficiencies.length,6,'The existing S5 model requires six boss efficiencies');assert(bossEfficiencies.every(n=>Number.isFinite(n)&&n>0));
 const stageLevels:Record<string,number>={};for(let stage=1;stage<=24;stage++){const target=targets.find(row=>row.key===`stage.${stage}.push`),level=Number(target?.levels);assert(target&&Number.isFinite(level)&&level>=1&&level<=60,'Missing canonical stage level '+stage);stageLevels[String(stage)]=level;}
 return {stageLevels,eta:median(bossEfficiencies),sources,efficiencyStatus:'retained historical S5 efficiency; not freshly measured'};
}
async function loadRemovalModelBasis(){
 const texts=await Promise.all([stageTargetSource,efficiencyBasisFile].map(path=>readFile(path,'utf8'))),sources=Object.fromEntries([stageTargetSource,efficiencyBasisFile].map((path,index)=>[path,sha(texts[index].replaceAll('\r\n','\n'))])),frozen=JSON.parse(texts[1]);
 assert.equal(frozen.schema,'roguelike-removal-basis-v1');assert.equal(frozen.source.path,efficiencySource);assert(/^[0-9a-f]{64}$/.test(frozen.source.sha256));
 const basis=removalModelBasis(JSON.parse(texts[0]).targets,frozen.boss.map((row:any)=>row.eta),sources);assert.equal(basis.eta,frozen.medianEta);return {...basis,efficiencyOrigin:{path:frozen.source.path,sha256:frozen.source.sha256}};
}
/** Match the original world.spineFlow branch exactly: stage model level, retained eta and integer targets.
 * Only the removed in-run multipliers disappear. Legacy definitions retain their separate calibration. */
export function removalModelTarget(definition:Pick<DungeonDefinition,'numericStage'|'kind'|'policy'>,legacyLevel:number,points:Point[],calibration:Calibration,basis:RemovalModelBasis){
 const target=removalTarget(definition,calibration),modelLevel=definition.numericStage?basis.stageLevels[String(definition.numericStage)]:legacyLevel;
 assert(Number.isFinite(modelLevel)&&modelLevel>=1&&modelLevel<=60,'Invalid model player level');
 const dps=interpolate(points,modelLevel,'D1'),ehp=interpolate(points,modelLevel,'EHP'),eta=definition.numericStage?basis.eta:calibration.bossEfficiency;
 return {target,modelLevel,actualLevel:Math.ceil(modelLevel),desiredHp:definition.numericStage?Math.round(dps*eta*70):dps*eta*target.bossSeconds*target.party,desiredDps:definition.numericStage?Math.round(ehp/30):ehp/30,efficiency:{value:eta,source:definition.numericStage?efficiencySource:'packages/content/legacy-dungeon-calibration.json',status:definition.numericStage?basis.efficiencyStatus:'declared legacy calibration'}};
}
export function removalScale(current:Scale,bossHp:number,rawDps:number,desiredHp:number,desiredDps:number):Scale{
 for(const n of [current.hp,current.attack,bossHp,rawDps,desiredHp,desiredDps])assert(Number.isFinite(n)&&n>0,'Non-positive derivation input');
 const snap=(v:number)=>Number(Math.max(.05,Math.round(v/.05)*.05).toFixed(2));
 return {hp:snap(current.hp*desiredHp/bossHp),attack:snap(current.attack*desiredDps/rawDps)};
}
/** Removing the only authorized leaves must make the entire object identical. */
export function assertDungeonOnlyChanges(changes:readonly SpineChange[]){
 const strip=(input:any)=>{const value=structuredClone(input);for(const owner of [value.policy,value.hardmode])if(owner?.enemyScale){delete owner.enemyScale.hp;delete owner.enemyScale.attack;if(!Object.keys(owner.enemyScale).length)delete owner.enemyScale;}if(value.policy&&!Object.keys(value.policy).length)delete value.policy;return value;};
 for(const change of changes){
  assert.equal(change.file,dungeonFile);assert.equal(change.path.length,2);assert.equal(change.path[0],'definitions');assert(Number.isSafeInteger(change.path[1])&&Number(change.path[1])>=0);assert.equal(change.op,undefined);
  assert.deepEqual(strip(change.before),strip(change.after),'Only dungeon enemyScale.hp/attack may change');
  for(const owner of [(change.after as any).policy,(change.after as any).hardmode])if(owner?.enemyScale)for(const key of ['hp','attack'])if(owner.enemyScale[key]!==undefined)assert(Number.isFinite(owner.enemyScale[key])&&owner.enemyScale[key]>0);
 }
}
export function removalTarget(definition:Pick<DungeonDefinition,'numericStage'|'kind'|'policy'>,calibration:{targetSeconds:Record<string,number>;raidSupportWeight:number}){
 const party=definition.kind==='raid'?Object.entries(definition.policy.party.roles).reduce((sum,[role,count])=>sum+count*(role==='damage'?1:calibration.raidSupportWeight),0):1;
 return {bossSeconds:definition.numericStage?70:calibration.targetSeconds[definition.kind],ttdSeconds:30,party:Math.max(1,party)};
}
async function protectedSourceHashes(){
 const paths=[stageTargetSource,efficiencyBasisFile,'packages/content/monsters.json','packages/content/world-tiers.json','packages/content/hub-chart.json','packages/content/legacy-dungeon-calibration.json','packages/content/tactical-graybox.json','packages/content/tactical-boards.json','packages/content/tactical-archetypes.json','packages/contracts/tactical.ts','tools/standard-player-model.ts','tools/spine/player.ts','tools/spine/bench.ts','packages/simulation/index.ts'];
 for(const file of await readdir('packages/simulation/tactical'))if(file.endsWith('.ts'))paths.push('packages/simulation/tactical/'+file);
 return Object.fromEntries(await Promise.all(paths.map(async path=>[path,sha((await readFile(path,'utf8')).replaceAll('\r\n','\n'))])));
}
function allowedOutput(path:string){const local=relative(process.cwd(),resolve(path)).replaceAll('\\','/');assert(!local.startsWith('../')&&!local.includes('/../'));assert(/^((\.qa|\.runtime)\/roguelike-removal[^/]*|docs\/reviews\/roguelike-removal-20261024)(\/|$)/.test(local),'Use a new removal-only output directory');return resolve(path);}
async function readOptional(path:string){try{return JSON.parse(await readFile(path,'utf8'));}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error;}}
/** Cached completed cases are read verbatim. An uncertain interrupted case is never rerun. */
async function onceCase<T>(output:string,key:string,signature:string,compute:()=>T|Promise<T>):Promise<T>{
 const file=resolve(output,'raw',key+'.json'),cached=await readOptional(file);
 if(cached){assert.equal(cached.signature,signature,'Cached case input drift');return cached.result;}
 await mkdir(dirname(file),{recursive:true});
 try{await writeFile(file+'.started',JSON.stringify({signature,...stamp()}),{flag:'wx'});}catch(error){if((error as NodeJS.ErrnoException).code==='EEXIST')throw Error('Unfinished measurement case; do not rerun: '+key);throw error;}
 const result=await compute();await save(file,{signature,result});return result;
}
async function enterPhase(output:string,phase:string,signature:string){const file=resolve(output,phase+'-started.json'),prior=await readOptional(file);if(prior){assert.equal(prior.signature,signature,'Phase input drift');return;}await mkdir(output,{recursive:true});await writeFile(file,JSON.stringify({signature,...stamp()}),{flag:'wx'});}
const regionFor=(id:string)=>isPlaneStage(id)?generatePlaneStage(id,41).region:regionById(id);
function rawScenario(source:DungeonDefinition,hard:boolean,tiers:any){
 const tier=hard&&source.hardmode?.worldTierScalingFrom?source.hardmode.worldTierScalingFrom:1,definition=characterDungeonDefinition(source,hard,tier),stage=definition.stages.length-1,region=regionFor(definition.stages[stage]);
 const world=definition.worldTierScaling?tiers.tiers.find((t:any)=>t.tier===tier).monster:{hp:1,attack:1};
 return {definition,stage,region,spawns:dungeonSpawns(region.spawns,definition.policy,definition.policy.minTier,stage,[],monsterContent,'starsea',world),worldTier:tier,worldDifficulty:world};
}
function sampleStart(region:Region,spawns:Spawn[]){
 const target=spawns.find(s=>s.boss)??spawns[0];assert(target,'No actual enemies');
 for(const radius of [1.25,2,3,4,5])for(let n=0;n<16;n++){const p={x:target.x+Math.cos(n*Math.PI/8)*radius,y:target.y+Math.sin(n*Math.PI/8)*radius};if(walkable(region,p,1))return p;}
 throw Error('No legal combat measurement position');
}
function actualRoom(definition:DungeonDefinition,region:Region,spawns:Spawn[],target:{bossSeconds:number;ttdSeconds:number;party:number},modelBasis:RemovalModelBasis){
 const boss=spawns.find(s=>s.boss),modelLevel=definition.numericStage?modelBasis.stageLevels[String(definition.numericStage)]:Math.min(60,Math.max(definition.level,boss?.monster?.level??definition.policy.monsterLevel??definition.level)),actualLevel=Math.ceil(modelLevel),player=resolvePlayer('removal-'+definition.id,standardState(actualLevel)),position=sampleStart(region,spawns),maxSeconds=Math.min(600,Math.max(120,target.bossSeconds*2));
 let bossSeconds:number|null=null;
 const common={requestedSkills:player.build.skills.map(s=>s.id),skillRanks:player.skillRanks,build:player.build,region:{...region,safe:position},spawns,seed:41,maxTicks:Math.round(maxSeconds*30),instrument:{created(w:any){w.hero.position={...position};w.radius=Math.max(region.width,region.height);},afterStep(w:any){if(boss&&bossSeconds===null&&w.events.some((e:any)=>e.type==='entity_died'&&e.id===boss.id))bossSeconds=w.tick/30;}}};
 const outgoing=sampleCombatBuild({...common,mode:'auto',stopWhen:'clear',approachTargets:true}),measuredBossSeconds=bossSeconds,incoming=sampleCombatBuild({...common,mode:'manual',stopWhen:'death'});
 const failures=[...(outgoing.failed?[outgoing.failed]:[]),...(outgoing.clearSeconds===null?['not-cleared']:[]),...(incoming.deathSeconds===null?['incoming-censored']:[]),...(incoming.incomingHits===0?['no-incoming-hit']:[])];
 return {modelLevel,actualLevel,target,maxSeconds,scope:definition.policy.party.max>1?'single-hero slice; not a multiplayer pass':'fixed-build combat slice; not a complete interactive dungeon run',outgoing,incoming,summary:{modelLevel,actualLevel,targetBossSeconds:target.bossSeconds,targetTtdSeconds:target.ttdSeconds,partyWeight:target.party,clearSeconds:outgoing.clearSeconds,bossSeconds:measuredBossSeconds,deathSeconds:incoming.deathSeconds,incomingHits:incoming.incomingHits,damageTaken:incoming.incomingDamage,heroHp:outgoing.hero.hp,failures,clearResidual:outgoing.clearSeconds===null?null:outgoing.clearSeconds-target.bossSeconds,bossResidual:measuredBossSeconds===null?null:measuredBossSeconds-target.bossSeconds,deathResidual:incoming.deathSeconds===null?null:incoming.deathSeconds-target.ttdSeconds}};
}
type RoomResult=ReturnType<typeof actualRoom>|{failure:string};
/** Arithmetic-only source repair. Reuses every stored player/pressure observation and never samples. */
export function repairRemovalModelPlan(original:RemovalPlan,before:any,basis:RemovalModelBasis,calibration:Calibration,protectedHashes:Record<string,string>){
 assert.equal(original.kind,'roguelike-removal-v1');assert.equal(original.modelBasis,undefined,'Already canonical; do not repair or retune a valid plan');
 assert.equal(sha(JSON.stringify(before)),original.beforeHash,'Original dungeon snapshot does not match measured before state');assert.deepEqual(original.points.map(p=>p.level),standardLevels);
 const next=structuredClone(before),rows=original.rows.map(record=>{
  const index=before.definitions.findIndex((d:any)=>d.id===record.dungeon);assert(index>=0,'Unknown measured raw dungeon');
  if(record.failure)return structuredClone(record);
  const definition=before.definitions[index],numericStage=record.hard?definition.hardmode?.numericStage:definition.numericStage;
  // Legacy rows were already using their canonical branch. Preserve their derived numbers exactly.
  const model=numericStage?removalModelTarget({...definition,numericStage} as DungeonDefinition,record.level,original.points,calibration,basis):null;
  const after=model?removalScale(record.before,record.bossHp,record.basis.rawDps,model.desiredHp,model.desiredDps):structuredClone(record.after);
  if(record.hard)next.definitions[index].hardmode.enemyScale={...next.definitions[index].hardmode.enemyScale,...after};else{next.definitions[index].policy??={};next.definitions[index].policy.enemyScale={...next.definitions[index].policy.enemyScale,...after};}
  return model?{...structuredClone(record),...model,level:model.modelLevel,after}:structuredClone(record);
 });
 const changes:SpineChange[]=before.definitions.flatMap((entry:any,index:number)=>JSON.stringify(entry)===JSON.stringify(next.definitions[index])?[]:[{file:dungeonFile,path:['definitions',index],before:entry,after:next.definitions[index],basis:'Correct model-input source bug only: reuse the original measured 13 points and room pressures; restore canonical stage level, retained S5 eta and integer target rounding; no remeasurement or residual-driven tuning.'}]);
 assertDungeonOnlyChanges(changes);
 return {...structuredClone(original),modelBasis:basis,protectedHashes,afterHash:sha(JSON.stringify(next)),changes,rows} as RemovalPlan;
}
export async function runRoguelikeRemovalRepair(args:string[]){
 const originalPath=args.find(a=>a.startsWith('--roguelike-removal-repair='))?.slice('--roguelike-removal-repair='.length),beforeCommit=args.find(a=>a.startsWith('--before='))?.slice(9),out=args.find(a=>a.startsWith('--out='))?.slice(6);
 assert(originalPath&&beforeCommit&&out&&args.length===3&&/^[0-9a-f]{8,40}$/.test(beforeCommit),'Use --roguelike-removal-repair=<original plan> --before=<measured Git commit> --out=<new repair directory>');
 const output=allowedOutput(out),originalText=await readFile(originalPath,'utf8'),original=JSON.parse(originalText) as RemovalPlan,git=(path:string)=>execFileSync('git',['show',beforeCommit+':open-world/'+path],{encoding:'utf8',windowsHide:true}),before=JSON.parse(git(dungeonFile));
 const basis=await loadRemovalModelBasis(),currentProtected=await protectedSourceHashes();
 for(const [path,hash]of Object.entries(original.protectedHashes)){
  const measuredSource=git(path);
  const canonical=measuredSource.replaceAll('\r\n','\n');
  assert([sha(measuredSource),sha(canonical),sha(canonical.replaceAll('\n','\r\n'))].includes(hash),'Original measured Git/archive blob differs: '+path);
  assert.equal(currentProtected[path],sha(measuredSource.replaceAll('\r\n','\n')),'Measured source changed: '+path);
 }
 assert.equal(basis.sources[stageTargetSource],sha(git(stageTargetSource).replaceAll('\r\n','\n')),'Stage target source changed after original measurement');
 const efficiencyText=git(efficiencySource),canonicalEfficiency=efficiencyText.replaceAll('\r\n','\n');
 assert([sha(efficiencyText),sha(canonicalEfficiency),sha(canonicalEfficiency.replaceAll('\n','\r\n'))].includes(basis.efficiencyOrigin!.sha256),'Retained efficiency source differs from measured Git baseline');
 const frozenEfficiency=await readJson(efficiencyBasisFile);
 assert.deepEqual(frozenEfficiency.boss,JSON.parse(efficiencyText).boss.map((row:any)=>({id:row.id,level:row.level,eta:row.eta})),'Retained efficiency values differ');
 const calibration=JSON.parse(git('packages/content/legacy-dungeon-calibration.json')),corrected=repairRemovalModelPlan(original,before,basis,calibration,currentProtected),metadata=stamp();
 corrected.commit=metadata.commit;
 const pointer={schema:'roguelike-removal-plan-repair-v1',originalPlanHash:sha(JSON.stringify(original)),originalPlanFileSha256:sha(originalText),correctedPlanFile:'corrected-removal-plan.json',correctedPlanHash:sha(JSON.stringify(corrected)),samplingCommit:original.commit,repairedByCommit:metadata.commit,repairImplementationSha256:sha(await readFile(import.meta.filename)),beforeCommit:execFileSync('git',['rev-parse',beforeCommit],{encoding:'utf8',windowsHide:true}).trim(),reusedPlayerPoints:original.points.length,reusedPressureSamples:original.rows.length,additionalMeasurements:0,modelBasis:basis,reason:'Correct numericStage model source: canonical stage level, retained S5 efficiency and Math.round. Legacy rows unchanged. No sample rerun or result-driven tuning.'};
 await mkdir(dirname(output),{recursive:true});await mkdir(output); // Existing repair directories are intentionally not overwritten.
 await save(output+'/corrected-removal-plan.json',corrected);await save(output+'/plan-repair.json',pointer);
 console.log(JSON.stringify({output,correctedPlanHash:pointer.correctedPlanHash,afterHash:corrected.afterHash,reusedPlayerPoints:pointer.reusedPlayerPoints,reusedPressureSamples:pointer.reusedPressureSamples,additionalMeasurements:0}));
}
export async function deriveRoguelikeRemoval(outputPath:string){
 const output=allowedOutput(outputPath),raw=await readJson(dungeonFile),modelBasis=await loadRemovalModelBasis(),protectedHashes=await protectedSourceHashes(),signature=sha(JSON.stringify({kind:'derive',raw,protectedHashes,seeds}));
 await enterPhase(output,'derive',signature);const existing=await readOptional(output+'/derive-summary.json');if(existing){assert.equal(existing.signature,signature);return existing;}
 const points:Point[]=[],failures:any[]=[];
 for(const level of standardLevels){
  const player=resolvePlayer('removal-standard-'+level,standardState(level)),rows:ReturnType<typeof benchSample>[]=[];
  for(const seed of seeds)for(const axis of ['D1','EHP'] as const)rows.push(await onceCase(output,`player-${level}-${axis}-${seed}`,signature,()=>benchSample(player,axis,seed,player.build.stats.hp)));
  const axisValue=(axis:string)=>{const selected=rows.filter(r=>r.axis===axis);return selected.every(r=>typeof r.value==='number'&&r.value>0&&!r.failed)?median(selected.map(r=>r.value!)):NaN;};
  const D1=axisValue('D1'),EHP=axisValue('EHP');if(!Number.isFinite(D1)||!Number.isFinite(EHP))throw Error('Standard-player measurement failure at level '+level);
  points.push({level,D1,EHP,hp:player.build.stats.hp,failures:rows.filter(r=>r.failed||r.censored).map(r=>`${r.axis}/${r.seed}:${r.failed??'finite-window-censored'}`)});console.log(JSON.stringify({phase:'derive-player',level,completed:points.length,total:standardLevels.length}));
 }
 await save(output+'/player-points.json',{...stamp(),measurementVersion,scope:'fresh current fixed out-of-run standard player; D1/EHP only',points});
 const calibration=await readJson('packages/content/legacy-dungeon-calibration.json'),tiers=await readJson('packages/content/world-tiers.json'),definitions=resolveDungeonContent(raw).definitions,next=structuredClone(raw),rows:any[]=[];
 for(const [index,source]of definitions.entries())for(const hard of [false,true]){
  if(hard&&!source.hardmode)continue;const key=source.id+(hard?'-hard':'');
  const record=await onceCase(output,'derive-dungeon-'+key,signature,()=>{
   try{const scenario=rawScenario(source,hard,tiers),boss=scenario.spawns.find(s=>s.boss);assert(boss?.monster,'No executable authored boss');
    const legacyLevel=Math.min(60,Math.max(scenario.definition.level,boss.monster.level)),model=removalModelTarget(scenario.definition,legacyLevel,points,calibration,modelBasis),basis=pressure(scenario.region,scenario.spawns),after=removalScale(scenario.definition.policy.enemyScale,boss.hp,basis.rawDps,model.desiredHp,model.desiredDps);
    return {dungeon:source.id,hard,level:model.modelLevel,...model,worldTier:scenario.worldTier,worldDifficulty:scenario.worldDifficulty,before:scenario.definition.policy.enemyScale,after,bossHp:boss.hp,basis};
   }catch(error){return {dungeon:source.id,hard,failure:String(error)};}
  });
  rows.push(record);if('failure'in record){failures.push(record);continue;}
  const entry=next.definitions[index];if(hard)entry.hardmode.enemyScale={...entry.hardmode.enemyScale,...record.after};else{entry.policy??={};entry.policy.enemyScale={...entry.policy.enemyScale,...record.after};}
  console.log(JSON.stringify({phase:'derive-dungeon',dungeon:source.id,hard}));
 }
 const changes:SpineChange[]=raw.definitions.flatMap((before:any,index:number)=>JSON.stringify(before)===JSON.stringify(next.definitions[index])?[]:[{file:dungeonFile,path:['definitions',index],before,after:next.definitions[index],basis:'Removed in-run DPS/EHP bonuses; fresh 13-point D1/EHP, fixed world tiers, declared boss duration/30s threat target and .05 multiplier steps; no reward/field/tactical changes.'}]);
 assertDungeonOnlyChanges(changes);
 const plan:RemovalPlan={...stamp(),kind:'roguelike-removal-v1',modelBasis,protectedHashes,beforeHash:sha(JSON.stringify(raw)),afterHash:sha(JSON.stringify(next)),changes,points,rows,failures};
 await save(output+'/removal-plan.json',plan);
 const summary={...stamp(),signature,scope:'dungeon-only derivation; not a whole-spine pass',plan:'removal-plan.json',planHash:sha(JSON.stringify(plan)),playerPoints:points,rawDefinitions:definitions.length,scenarios:rows.length,changes:changes.length,failures,protectedHashes,limits:['Derived HUB templates inherit raw seeds; never apply a second scale.','Story templates retain their independent declared scaling.','Verification is one actual World pass; no automatic corrections.']};await save(output+'/derive-summary.json',summary);return summary;
}
export async function verifyRoguelikeRemoval(outputPath:string){
 const output=allowedOutput(outputPath),original=await readJson(output+'/removal-plan.json') as RemovalPlan,repair=await readOptional(output+'/plan-repair.json');let plan=original,planSource='removal-plan.json';
 if(repair){assert.equal(repair.schema,'roguelike-removal-plan-repair-v1');assert.equal(repair.originalPlanHash,sha(JSON.stringify(original)));assert.equal(repair.samplingCommit,original.commit);assert.equal(repair.additionalMeasurements,0);assert.equal(repair.correctedPlanFile,'corrected-removal-plan.json');plan=await readJson(output+'/corrected-removal-plan.json');assert.equal(repair.correctedPlanHash,sha(JSON.stringify(plan)));planSource='corrected-removal-plan.json';}
 assert.equal(plan.kind,'roguelike-removal-v1');assertDungeonOnlyChanges(plan.changes);
 assert.deepEqual(await protectedSourceHashes(),plan.protectedHashes,'Field/world-tier/tactical/player sources changed');const raw=await readJson(dungeonFile);assert.equal(sha(JSON.stringify(raw)),plan.afterHash,'Apply the exact dungeon-only plan before verification');
 const signature=sha(JSON.stringify({phase:'verify',planHash:sha(JSON.stringify(plan)),applied:plan.afterHash}));await enterPhase(output,'verify',signature);const existing=await readOptional(output+'/verify-summary.json');if(existing){assert.equal(existing.signature,signature);return existing;}
 const calibration=await readJson('packages/content/legacy-dungeon-calibration.json'),tiers=await readJson('packages/content/world-tiers.json'),modelBasis=await loadRemovalModelBasis(),rows:any[]=[],residuals:any[]=[];
 assert.deepEqual(modelBasis,plan.modelBasis,'Canonical stage model basis changed');
 for(const source of resolveDungeonContent(raw).definitions)for(const hard of [false,true]){
  if(hard&&!source.hardmode)continue;const key=source.id+(hard?'-hard':'');
  const result=await onceCase<RoomResult>(output,'verify-raw-'+key,signature,()=>{try{const s=rawScenario(source,hard,tiers);return actualRoom(s.definition,s.region,s.spawns,removalTarget(s.definition,calibration),modelBasis);}catch(error){return {failure:String(error)};}});
  const row={scope:'raw-dungeon',dungeon:source.id,hard,...('summary'in result?result.summary:result)};rows.push(row);if('failure'in result||'summary'in result&&(result.summary.failures.length||Math.abs(result.summary.clearResidual??Infinity)>.2*result.target.bossSeconds||Math.abs(result.summary.deathResidual??Infinity)>6))residuals.push(row);
  console.log(JSON.stringify({phase:'verify-raw',dungeon:source.id,hard}));
 }
 for(const definition of dungeonContent.definitions.filter(d=>d.hub)){
  const result=await onceCase<RoomResult>(output,'verify-hub-'+definition.id,signature,()=>{try{
   const stage=definition.stages.length-1,run=newHubRun(definition);run.seed=41;const region=prepareHubRegion(regionFor(definition.stages[stage]),definition,stage,'removal-check',run),scale=hubNodeById.get(definition.hub!.node)?.combatScale??{hp:1,attack:1};
   const authored=definition.hub!.kind==='story'?Object.values(run.storySpawns??{}).at(-1)??[]:region.spawns;
   const spawns=definition.hub!.kind==='story'?scaleHubStorySpawns(authored,definition,stage,scale):dungeonSpawns(authored,definition.policy,definition.policy.minTier,stage,[],monsterContent,'starsea',scale);
   return actualRoom(definition,region,spawns,removalTarget(definition,calibration),modelBasis);
  }catch(error){return {failure:String(error)};}});
  const row={scope:'derived-hub-combat-slice',dungeon:definition.id,node:definition.hub!.node,...('summary'in result?result.summary:result)};rows.push(row);if('failure'in result||'summary'in result&&(result.summary.failures.length||Math.abs(result.summary.clearResidual??Infinity)>.2*result.target.bossSeconds||Math.abs(result.summary.deathResidual??Infinity)>6))residuals.push(row);
  console.log(JSON.stringify({phase:'verify-hub',node:definition.hub!.node}));
 }
 const summary={...stamp(),seeds:[41],signature,scope:'dungeon-only single verification; not whole-spine acceptance',planSource,originalPlanHash:sha(JSON.stringify(original)),planHash:sha(JSON.stringify(plan)),appliedHash:plan.afterHash,protectedHashes:plan.protectedHashes,samples:rows.length,rows,residuals,withinTargets:residuals.length===0,completed:true,limits:['One fixed seed41 actual World combat slice per dungeon/hardmode/HUB template, no simulation rerun.','Derived HUB/story interactions, route choices and multiplayer parties are not full-run acceptance.','No automatic correction or replacement reward; world-tier extra-round and shipyard-reroll rewards remain removed.']};
 await save(output+'/verify-summary.json',summary);return summary;
}
export function parseRemovalArgs(args:string[]){
 const phase=args.find(a=>a.startsWith('--roguelike-removal='))?.split('=')[1],output=args.find(a=>a.startsWith('--out='))?.slice(6);
 assert(output&&['derive','verify'].includes(phase??''),'Use --roguelike-removal=derive|verify --out=<new removal-only directory>');
 assert(args.length===2&&args.filter(a=>a.startsWith('--roguelike-removal=')).length===1&&args.filter(a=>a.startsWith('--out=')).length===1,'No automatic apply, extra rounds or tuning options');
 return {phase,output:allowedOutput(output)};
}
export async function runRoguelikeRemoval(args:string[]){
 const {phase,output}=parseRemovalArgs(args);
 const result=phase==='derive'?await deriveRoguelikeRemoval(output):await verifyRoguelikeRemoval(output);console.log(JSON.stringify(result));
}
