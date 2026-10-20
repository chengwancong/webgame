/** GROW-03 one algebraic derivation and one candidate verification; no source writes or combat sweep. */
import '../../packages/content/open-world/index.ts';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {makeGear} from '../../packages/rules/index.ts';
import {makeStarseaStarterWeapon} from '../../packages/rules/starsea-starter.ts';
import {applyStarseaOp,newStarseaState} from '../../packages/rules/starsea.ts';
import {choosePrologueWeapon,finishPrologue} from '../../packages/rules/starsea-prologue.ts';
import {prologueConfig} from '../../packages/content/starsea/prologue.ts';
import {resolvePlayer} from './player.ts';
import {benchArena,benchSeeds} from './bench.ts';
import {sampleCombatBuild} from '../build-variety-benchmark.ts';
import {armorMitigation} from '../../packages/rules/combat-numerics.ts';
import {versions,type CharacterState} from '../../packages/contracts/index.ts';
const median=(v:number[])=>[...v].sort((a,b)=>a-b)[Math.floor(v.length/2)];
const uuid=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const fixtures=(['sword','staff','hidden'] as const).map((family,i)=>{
 const initial=prologueConfig.families.sword.starterSkills,gear=[makeStarseaStarterWeapon(uuid(i*10+1)),makeGear(2,uuid(i*10+2))];
 const s={field:{gathered:[]},id:uuid(i*10+3),name:'GROW03 derive',revision:0,build:1,level:1,xp:0,gold:0,material:0,gear,equipment:{weapon:gear[0].id,armor:gear[1].id},weaponLoadouts:{},skills:[...initial],skillRanks:Object.fromEntries(initial.map(id=>[id,1])),skillBooks:{},progress:{kills:0,regions:[],bosses:[],safe:'ss-map-wind',tasks:[]},starsea:newStarseaState()} as CharacterState;
 choosePrologueWeapon(s,family);finishPrologue(s);
 const spawns=applyStarseaOp(s,'start',{task:'ss-c01-t01',region:'ss-map-wind',now:1}).spawns.map((m,n)=>({...m,x:27+n,y:24}));
 return {family,state:s,spawns,player:resolvePlayer('grow03-'+family,s)};
});
const dps=fixtures.flatMap(f=>benchSeeds.map(seed=>{
 const result=sampleCombatBuild({requestedSkills:f.state.skills,skillRanks:f.state.skillRanks,build:f.player.build,region:benchArena,spawns:[{...f.spawns[0],hp:1e9,attack:0}],seed,maxTicks:300,mode:'semi',stopWhen:'window'});
 assert(!result.failed&&result.totalDamage>0);return {family:f.family,...result};
}));
// One fixed encounter value, not hidden scaling by player weapon.
const hp=Math.max(1,Math.round(median(dps.map(r=>r.totalDamage/10))*10));
const exposure=fixtures.flatMap(f=>benchSeeds.map(seed=>{
 const raw:number[]=[];
 const result=sampleCombatBuild({requestedSkills:f.state.skills,skillRanks:f.state.skillRanks,build:{...f.player.build,stats:{...f.player.build.stats,hp:1e9}},region:benchArena,spawns:f.spawns.map(m=>({...m,hp})),seed,maxTicks:600,mode:'semi',stopWhen:'window',instrument:{created(w){
  const engine=w as any,hurt=engine.hurt.bind(w);engine.hurt=(amount:number,...args:any[])=>{raw.push(amount);return hurt(amount,...args);};
 }}});
 // HP grant only prevents censoring while counting actual enemy attack opportunities.
 return {family:f.family,originalHp:f.player.build.stats.hp,armor:f.player.build.stats.armor,originalAttack:f.spawns[0].attack,raw,...result};
}));
assert(exposure.some(r=>r.raw.length),'No enemy exposure to derive attack');
const predicted=(attack:number)=>median(exposure.map(r=>r.raw.reduce((sum,raw)=>sum+armorMitigation(raw*attack/r.originalAttack,r.armor).damage,0)/r.originalHp));
let lo=0,hi=Math.max(...exposure.map(r=>r.originalAttack))*100;
for(let n=0;n<60;n++){const mid=(lo+hi)/2;if(predicted(mid)<.4)lo=mid;else hi=mid;}
const candidates=[Math.max(1,Math.floor(hi)),Math.max(1,Math.ceil(hi))];
const attack=candidates.sort((a,b)=>Math.abs(predicted(a)-.4)-Math.abs(predicted(b)-.4)||a-b)[0];
const verification=fixtures.flatMap(f=>benchSeeds.flatMap(seed=>[1,2].map(count=>{
 const result=sampleCombatBuild({requestedSkills:f.state.skills,skillRanks:f.state.skillRanks,build:f.player.build,region:benchArena,spawns:f.spawns.slice(0,count).map(m=>({...m,hp,attack})),seed,maxTicks:600,mode:'semi',stopWhen:count===1?'clear':'window'});
 const lossRatio=(f.player.build.stats.hp-result.hero.hp)/f.player.build.stats.hp;
 return {family:f.family,count,lossRatio,...result};
})));
const summary=fixtures.map(f=>{
 const one=verification.filter(r=>r.family===f.family&&r.count===1),two=verification.filter(r=>r.family===f.family&&r.count===2);
 const singleSeconds=median(one.map(r=>r.clearSeconds??Infinity)),lossRatio=median(two.map(r=>r.lossRatio));
 return {family:f.family,singleSeconds:Number.isFinite(singleSeconds)?singleSeconds:null,lossRatio,deaths:two.filter(r=>r.deathSeconds!==null).length,passed:singleSeconds>=9&&singleSeconds<=11&&lossRatio>=.35&&lossRatio<=.45&&two.every(r=>r.deathSeconds===null)};
});
const index=process.argv.indexOf('--output');assert(index>=0&&process.argv[index+1],'--output required');
const result={at:new Date().toISOString(),versions,scope:'Controlled actual starter builds, fixed near-contact arena and semi stationary mode. DPS probe uses high target HP and zero attack. Exposure probe uses high hero HP only to count attacks. Verification restores original hero HP and active enemy AI. Single shared HP/attack for all families. No source writes, no parameter sweep.',candidate:{hp,attack,predictedMedianLoss:predicted(attack)},summary,passed:summary.every(r=>r.passed),dps,exposure,verification};
await writeFile(process.argv[index+1],JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({candidate:result.candidate,summary,passed:result.passed}));
