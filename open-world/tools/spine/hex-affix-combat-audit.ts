import assert from 'node:assert/strict';
import {writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {standardState,resolvePlayer} from './player.ts';
import {benchArena} from './bench.ts';
import {sampleCombatBuild} from '../build-variety-benchmark.ts';
import {resolveMonsterSpawn} from '../../packages/rules/monster-stats.ts';
import {versions} from '../../packages/contracts/index.ts';
import {resolveHexActive} from '../../packages/rules/hex-runes.ts';
const output=process.argv[2];if(!output)throw Error('Explicit audit output required');
const baseline=standardState(15,'staff'),affixed=structuredClone(baseline);
const runes=['hex-void-rift','hex-aftershock','hex-detonation-sigil','hex-footfall-heal','hex-control-to-shield','hex-bee-volley'];
baseline.gear.forEach(g=>g.origin={kind:'random'});
affixed.gear.forEach((gear,i)=>{assert(['magic','rare','legendary'].includes(gear.quality));gear.origin={kind:'random'};gear.hex={rune:runes[i],tier:'magic'};});
assert.equal(resolveHexActive(affixed).filter(r=>r.active).length,6,'All six audit affixes must be active, not silently excluded');
const rows:any[]=[];
for(const rank of ['elite','boss'] as const)for(const pressure of [false,true]){
 const spawns=[resolveMonsterSpawn({id:'field-0',template:'raider',level:15,rank,x:26.5,y:23.2})];
 // Reuse the established spine/field.ts pressure fixture, not a balance change.
 if(pressure)spawns[0].hp=1e15;
 const arms:any={};
 for(const [name,state] of [['baseline',baseline],['sixMagic',affixed]] as const){
  const player=resolvePlayer('d13-'+name,state);if(name==='sixMagic')assert.equal(new Set(player.build.stats.rules?.filter(r=>r.hexMechanism).map(r=>r.hexMechanism)).size,6);let effects:any={},hexDamage=0,totalDamage=0;
  const sample=sampleCombatBuild({requestedSkills:state.skills,skillRanks:state.skillRanks,build:player.build,region:benchArena,spawns:structuredClone(spawns),seed:41,maxTicks:9000,mode:'auto',stopWhen:pressure?'death':'clear',instrument:{afterStep(w){effects=structuredClone(w.effectStats);for(const e of w.events)if(e.type==='hit_resolved'&&e.id!==w.playerId&&e.amount){totalDamage+=e.amount;if(e.ruleId&&player.build.stats.rules?.some(r=>r.id===e.ruleId&&r.hexMechanism))hexDamage+=e.amount;}}}});
  arms[name]={sample,effects,hexDamage,totalDamage,hexDirectContribution:totalDamage?hexDamage/totalDamage:0};
 }
 const a=arms.baseline.sample,b=arms.sixMagic.sample;
 rows.push({rank,pressure,arms,comparison:pressure?{incomingRatio:a.incomingDamage?b.incomingDamage/a.incomingDamage:null,meetsD13Section9:b.incomingDamage>=a.incomingDamage*.6,baselineMaySurvive:true}:{killTimeRatio:a.clearSeconds&&b.clearSeconds?b.clearSeconds/a.clearSeconds:null,meetsD13Section9:a.clearSeconds!==null&&b.clearSeconds!==null&&b.clearSeconds>=a.clearSeconds*.7}});
}
const paths=['packages/simulation/index.ts','packages/simulation/effect-state.ts','packages/rules/hex-runes.ts','packages/content/hex-runes.json','packages/content/hex-policy.json','tools/standard-player-model.ts'];
const fingerprints=Object.fromEntries(await Promise.all(paths.map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex')])));
const report={at:new Date().toISOString(),versions,design:'D13 §9 comparison arm only; D10 §5.2 caps and zero-trigger mechanisms need separate directed assertions',scope:'Controlled deterministic real World simulation using existing L15 staff standardState and spine field pressure fixture. Not natural acquisition, GUI combat, human playtime, or all eight unreleased high-risk combinations. No tuning/sweep.',runes,baselineGear:baseline.gear,skills:baseline.skills,fingerprints,rows};
await writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(rows.map(({rank,pressure,arms,comparison})=>({rank,pressure,baseline:{clear:arms.baseline.sample.clearSeconds,death:arms.baseline.sample.deathSeconds},sixMagic:{clear:arms.sixMagic.sample.clearSeconds,death:arms.sixMagic.sample.deathSeconds},comparison}))));
