/** GROW-02 read-only baseline: real stage-key recipe + repair factory, no tuning or source writes. */
import '../../packages/content/open-world/index.ts';
import assert from 'node:assert/strict';
import {writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {makeGear,resolveBuild} from '../../packages/rules/index.ts';
import {makeStarseaStarterWeapon} from '../../packages/rules/starsea-starter.ts';
import {newStarseaState} from '../../packages/rules/starsea.ts';
import {choosePrologueWeapon,finishPrologue} from '../../packages/rules/starsea-prologue.ts';
import {applyCraft} from '../../packages/rules/crafting.ts';
import {compareVerdict,compareResolvedStats} from '../../packages/rules/stat-comparison.ts';
import {craftRepairRecipe,craftPolicy} from '../../packages/content/crafting.ts';
import {mainStatValues} from '../../packages/rules/main-stat-values.ts';
import {stageForItemLevel} from '../../packages/rules/item-power.ts';
import {craftStageKey,stageKeyPools} from '../../apps/api/src/stage-key-pools.ts';
import {prologueConfig} from '../../packages/content/starsea/prologue.ts';
import {versions, type CharacterState} from '../../packages/contracts/index.ts';
const pool=stageKeyPools[0],choice=pool.choices.find(c=>c.id==='stage-1-a')!;
const candidate=process.argv.includes('--candidate');
if(candidate){const gear=choice.outputs.find(o=>o.kind==='gear')!;gear.quality='rare';gear.itemLevel=stageForItemLevel(pool.level).level;gear.guaranteedOutput='repair-tendency';gear.starterAttack=true;}
const starterSkills=prologueConfig.families.sword.starterSkills;
const place={atForge:true,reason:'',storyUnlocked:true,maxCraftLevel:0};
const uuid=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
function seeded(seed:number){let x=seed>>>0;const next=()=>{x=(x*1664525+1013904223)>>>0;return x/2**32;};return {float:next,int:(a:number,b:number)=>a+Math.floor(next()*(b-a))};}
function character(family:'sword'|'staff'|'hidden',seed:number){
 const n=(['sword','staff','hidden'].indexOf(family)+1)*10000+seed*10;
 const gear=[makeStarseaStarterWeapon(uuid(n+1)),makeGear(2,uuid(n+2))];
 const s={field:{gathered:[]},id:uuid(n),name:'GROW02 audit',revision:0,build:1,level:1,xp:0,gold:282,material:0,gear,equipment:{weapon:gear[0].id,armor:gear[1].id},weaponLoadouts:{},skills:[...starterSkills],skillRanks:Object.fromEntries(starterSkills.map(id=>[id,1])),skillBooks:{},progress:{kills:0,regions:[],bosses:[],safe:'ss-map-wind',tasks:[]},starsea:newStarseaState()} as CharacterState;
 choosePrologueWeapon(s,family);finishPrologue(s);
 s.level=4;Object.assign(s.progression!.materials,{wind_ore:4,wind_herb:2});
 return s;
}
function sample(family:'sword'|'staff'|'hidden',seed:number){
 const original=character(family,seed),starter=resolveBuild(original),inputSnapshot=structuredClone(original),repaired=structuredClone(original);
 applyCraft(repaired,{op:'craft',recipe:craftRepairRecipe!.id,slot:'weapon'},place,seeded(seed));
 const repairedBuild=resolveBuild(repaired);
 const keyState=structuredClone(original);
 keyState.world={...(keyState.world??{}),stageKeys:{'stage:1':{stage:1,materials:pool.required,obtained:[]}}} as CharacterState['world'];
 const key=craftStageKey(keyState,1,choice.id).gear[0];
 assert(key&&key.slot==='weapon'&&key.quality===choice.outputs.find(o=>o.kind==='gear')!.quality);
 assert.equal(key.ilvl,choice.outputs.find(o=>o.kind==='gear')!.itemLevel??pool.level);
 keyState.equipment.weapon=key.id;
 const keyBuild=resolveBuild(keyState);
 assert.deepEqual(keyBuild.resolvedSkills.map(s=>s.id),original.skills);
 assert.deepEqual(original,inputSnapshot,'Input fixture must remain intact');
 const starterGear=original.gear.find(g=>g.id===original.equipment.weapon)!,repairedGear=repaired.gear.find(g=>g.id===repaired.equipment.weapon)!;
 const stat=craftPolicy.tendencyStats[family==='staff'?'spell':'martial'];
 const score=(g:typeof key)=>{const main=mainStatValues(g),attack=(main?.stat==='attack'?main.effective:g.attack)+g.affixes.filter(a=>a.stat==='attack').reduce((n,a)=>n+a.value,0);const output=g.affixes.filter(a=>a.stat===stat).reduce((n,a)=>n+a.value,0);return {attack,output,stat,value:attack*(1+output)};};
 const scores={starter:score(starterGear),repaired:score(repairedGear),key:score(key)};
 return {family,seed,key,starter:starterGear,repaired:repairedGear,scores,improves:scores.key.value>scores.starter.value,withinUpper:scores.key.value<=scores.repaired.value*1.15,
  vsStarter:compareVerdict(starter.stats,keyBuild.stats),vsRepaired:compareVerdict(repairedBuild.stats,keyBuild.stats),
  vsStarterStats:compareResolvedStats(starter.stats,keyBuild.stats),vsRepairedStats:compareResolvedStats(repairedBuild.stats,keyBuild.stats),
  remainingKeyMaterials:keyState.world!.stageKeys!['stage:1'].materials,obtained:keyState.world!.stageKeys!['stage:1'].obtained,
  limitation:'Claude 2026-10-20 declared score=main-hand attack*(1+repair-tendency bonus); not DPS. Candidate changes exist only in this measurement process.'};
}
const arg=process.argv.indexOf('--output');assert(arg>=0&&process.argv[arg+1],'--output required');
const rows:ReturnType<typeof sample>[]=[];
// One complete sample per family, then the remaining fixed identities; no parameter search.
for(const family of ['sword','staff','hidden'] as const)rows.push(sample(family,1));
for(const family of ['sword','staff','hidden'] as const)for(let seed=2;seed<=40;seed++)rows.push(sample(family,seed));
const tally=(values:string[])=>values.reduce((all,value)=>(all[value]=(all[value]??0)+1,all),{} as Record<string,number>);
const summary=['sword','staff','hidden'].map(family=>{const own=rows.filter(r=>r.family===family);return {family,n:own.length,vsStarter:tally(own.map(r=>r.vsStarter)),vsRepaired:tally(own.map(r=>r.vsRepaired)),strongerOrOutput:own.filter(r=>['stronger','output'].includes(r.vsStarter)).length,scoreImproves:own.filter(r=>r.improves).length,withinUpper:own.filter(r=>r.withinUpper).length};});
const sourceHash=createHash('sha256').update(await readFile('apps/api/src/stage-key-pools.json')).digest('hex');
await writeFile(process.argv[arg+1],JSON.stringify({at:new Date().toISOString(),versions,candidate,passed:rows.every(r=>r.improves&&r.withinUpper),scope:'Real recipe generation and repair comparison. 40 deterministic identities per family at level 4. Candidate flag applies one declared proposal in memory only. No DB/player/config writes; not natural progression or GUI.',sourceHash,pool:{stage:pool.stage,level:pool.level,required:pool.required,choice},summary,rows},null,2)+'\n');
console.log(JSON.stringify({sourceHash,summary}));
