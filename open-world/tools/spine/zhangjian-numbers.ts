import {gearMaxRank} from '../../packages/rules/item-power.ts';
import {rankSlots} from '../../packages/contracts/zhangjian.ts';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {hubSeeds,switchGuard} from './hub-rewards.ts';
import {standardState,resolvePlayer} from './player.ts';
import {sampleCombatBuild} from '../build-variety-benchmark.ts';
import {resolveMonsterSpawn} from '../../packages/rules/monster-stats.ts';
import {hubChartContent} from '../../packages/content/hub-chart.ts';
import {dungeonContent} from '../../packages/content/dungeons.ts';
import {regionById,type Region} from '../../packages/content/index.ts';
import {newHubRun,prepareHubRegion} from '../../apps/api/src/hub-dungeon-runtime.ts';
import {dungeonSpawns} from '../../packages/rules/dungeon-build.ts';
import {grantPet,applyRegionWeakness} from '../../packages/rules/zhangjian.ts';
import {migrateSlotRanks} from '../../packages/rules/zhangjian-build.ts';
import {petContent} from '../../packages/content/zhangjian.ts';
import type {CharacterState,Spawn} from '../../packages/contracts/index.ts';
const median=(v:number[])=>[...v].sort((a,b)=>a-b)[Math.floor(v.length/2)];
const arena:Region={id:'hub-z-measure',name:'Z measurement',subtitle:'',theme:'meadow',width:64,height:64,safe:{x:2,y:2},portal:{x:60,y:60},obstacles:[],spawns:[],landmarks:[],boss:false,auto:true,rest:false};
const sample=(state:CharacterState,target:Spawn,seed:number,window=false)=>{const p=resolvePlayer('z',state);return sampleCombatBuild({requestedSkills:p.build.skills.map(s=>s.id),skillRanks:p.skillRanks,build:p.build,region:arena,spawns:[{...structuredClone(target),id:'target',x:27,y:24}],seed,maxTicks:(window?60:180)*30,mode:'auto',stopWhen:window?'window':'clear',approachTargets:true,instrument:{created(w){w.hero.position={x:24,y:24};w.radius=64;}}});};
/** Include passive/crit damage in the heavy ceiling; never treat skill share as total contribution. */
export function derivePetRatios(heavy:{share:number;dpsGain:number},ratio:number){
 const target=.115,total=1+heavy.dpsGain,active=total*heavy.share,passive=total-active;
 if(!(active>0&&passive<1/(1-target)))throw Error('Passive contribution already exceeds the heavy ceiling');
 const k=ratio*(1/(1-target)-passive)/active/1.3;
 return {free:Number((k*.6).toFixed(6)),light:Number(k.toFixed(6)),heavy:Number((k*1.3).toFixed(6))};
}
/** B4 standard-player/World sampler, fixed five seeds; no parameter sweep. */
export async function runZhangjianNumbers(args:string[]){
 switchGuard();
 if(args.includes('--apply')){
  const path=args.find(a=>a.startsWith('--summary='))?.slice(10);if(!path)throw Error('Apply requires frozen derive summary');
  const measured=JSON.parse(await readFile(path,'utf8')),ratios=derivePetRatios(measured.pets.heavy,petContent.tiers.heavy.activeRatio);
  const out=path.replace('derive-summary.json','applied-plan.json');await writeFile(out,JSON.stringify({source:measured.source,targetHp:measured.targetHp,activeRatio:ratios,basis:'Same frozen measurement; total contribution includes passive/crit. Target 11.5%, 60:100:130.'},null,2),{flag:'wx'});
  const file='packages/content/pets.json',content=JSON.parse(await readFile(file,'utf8'));for(const tier of ['free','light','heavy'] as const)content.tiers[tier].activeRatio=ratios[tier];await writeFile(file,JSON.stringify(content,null,2)+'\n');console.log(JSON.stringify({applied:out,activeRatio:ratios}));return;
 }
 const output=args.find(a=>a.startsWith('--out='))?.slice(6)??'.runtime/hub-z-numbers',mode=args.includes('--derive')?'derive':'verify';await mkdir(output,{recursive:true});
 const source=process.env.AW_SOURCE_COMMIT??execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();await writeFile(output+'/'+mode+'-started.json',JSON.stringify({source,seeds:hubSeeds,at:new Date().toISOString()}),{flag:'wx'});
 const d=dungeonContent.definitions.find(d=>d.hub?.node==='wind-gate')!,node=hubChartContent.nodes.find(n=>n.id==='wind-gate')!,run=newHubRun(d),r=prepareHubRegion(regionById(d.stages[0]),d,0,'z-numbers',run);
 const gate=applyRegionWeakness(dungeonSpawns(r.spawns,d.policy,1,0,[],undefined,'starsea',node.combatScale??{hp:1,attack:1}),node.id).find(e=>e.boss)!;if(!gate?.monster)throw Error('Missing B4 authored gate target');
 const calibrationPath=args.find(a=>a.startsWith('--calibration='))?.slice(14);if(!calibrationPath)throw Error('Required fixed calibration raw file');const calibration=JSON.parse(await readFile(calibrationPath,'utf8'));const targetHp=Math.ceil(Math.max(...calibration.filter((r:any)=>r.kind==='pet'||r.kind==='resonance').map((r:any)=>(r.base??r.off).dps))*120);
 const durable=()=>{const t=resolveMonsterSpawn({id:'boss',template:gate.monster!.template,level:30,rank:'boss',x:27,y:24});t.monster!.difficulty.hp*=targetHp/t.hp;t.hp=targetHp;return t;};
 const raw:any[]=[];
 for(const seed of hubSeeds){
  const lightning=standardState(gate.monster.level,'staff');lightning.skills=['chain'];lightning.skillRanks.chain=1;const neutral=structuredClone(gate);delete neutral.monster!.weakness;
  const off=sample(lightning,neutral,seed),on=sample(lightning,gate,seed);raw.push({kind:'weakness',seed,off,on});
  const state=standardState(30);for(const g of state.gear)g.rank=gearMaxRank(g,5);const plain=sample(state,durable(),seed,true);state.slotRanks=Object.fromEntries(rankSlots.map(slot=>[slot,15]));const resonance=sample(state,durable(),seed,true);raw.push({kind:'resonance',seed,off:plain,on:resonance});
  const petState=standardState(30);migrateSlotRanks(petState);const target=durable(),base=sample(petState,target,seed,true);
  for(const tier of ['free','light','heavy'] as const){const s=structuredClone(petState),id='wind-'+tier;grantPet(s,id);s.pets!.owned[id].level=30;raw.push({kind:'pet',tier,seed,base,on:sample(s,target,seed,true)});}
 }
 await writeFile(output+'/'+mode+'-raw.json',JSON.stringify(raw));
 const weakness=raw.filter(r=>r.kind==='weakness').map(r=>({seed:r.seed,off:r.off.clearSeconds,on:r.on.clearSeconds,speedup:r.off.clearSeconds&&r.on.clearSeconds?1-r.on.clearSeconds/r.off.clearSeconds:null,failures:[r.off.failed,r.on.failed]}));
 const resonance=raw.filter(r=>r.kind==='resonance').map(r=>({seed:r.seed,gain:r.on.dps/r.off.dps-1,failures:[r.off.failed,r.on.failed]}));
 const pets=Object.fromEntries((['free','light','heavy'] as const).map(tier=>{const rs=raw.filter(r=>r.kind==='pet'&&r.tier===tier);return [tier,{share:median(rs.map(r=>(r.on.rules['pet-wind-'+tier]?.damage??0)/r.on.totalDamage)),dpsGain:median(rs.map(r=>r.on.dps/r.base.dps-1)),activations:rs.map(r=>r.on.rules['pet-wind-'+tier]?.count??0),failures:rs.map(r=>r.on.failed)}];}));
 const summary={source,targetHp,seeds:hubSeeds,weakness,resonance,pets,scope:'B4 sampler and standard player. Weakness uses authored wind-gate and lightning-only staff. Pet/resonance use a 60s durable L30 template boss; HP = maximum preflight DPS x 120, unchanged across derive/verify. Only durability is normalized, no healing/reset. Original authored short-kill samples remain preserved; not live account manipulation.',targetConflict:'M17 free 5.5%, light 9.2%, heavy <=12% with 60:100:130 conflicts with handoff free 8-12%. D-Z10 follows M17 proportions and heavy ceiling; free 8% remains explicit residual.'};
 if(mode==='derive'){
  const h=pets.heavy.share;if(!(h>0&&h<1))throw Error('No measured pet contribution; cannot derive');
  const ratios=derivePetRatios(pets.heavy,petContent.tiers.heavy.activeRatio);
  const plan={source,targetHp,basis:'Measured total contribution including passives; target 11.5%; fixed 60:100:130.',activeRatio:ratios};
  await writeFile(output+'/plan.json',JSON.stringify(plan,null,2),{flag:'wx'});
 }
 await writeFile(output+'/'+mode+'-summary.json',JSON.stringify(summary,null,2));console.log(JSON.stringify({mode,source,pets,weakness:weakness.map(r=>r.speedup),resonance:resonance.map(r=>r.gain)}));
}
