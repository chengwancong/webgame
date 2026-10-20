/** Existing landing encounter with actual starter skills and active enemy AI; no HP derivation/apply. */
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
import {versions,type CharacterState} from '../../packages/contracts/index.ts';
const initial=prologueConfig.families.sword.starterSkills,rows=[];
const uuid=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
for(const [i,family]of (['sword','staff','hidden'] as const).entries()){
 const gear=[makeStarseaStarterWeapon(uuid(i*10+1)),makeGear(2,uuid(i*10+2))];
 const s={field:{gathered:[]},id:uuid(i*10+3),name:'Landing baseline',revision:0,build:1,level:1,xp:0,gold:0,material:0,gear,equipment:{weapon:gear[0].id,armor:gear[1].id},weaponLoadouts:{},skills:[...initial],skillRanks:Object.fromEntries(initial.map(id=>[id,1])),skillBooks:{},progress:{kills:0,regions:[],bosses:[],safe:'ss-map-wind',tasks:[]},starsea:newStarseaState()} as CharacterState;
 choosePrologueWeapon(s,family);finishPrologue(s);
 const spawned=applyStarseaOp(s,'start',{task:'ss-c01-t01',region:'ss-map-wind',now:1}).spawns;
 assert.equal(spawned.length,2);
 const player=resolvePlayer('grow03-'+family,s);
 for(const seed of benchSeeds)for(const count of [1,2]){
  const spawns=spawned.slice(0,count).map((m,n)=>({...m,x:27+n,y:24}));
  const sample=sampleCombatBuild({requestedSkills:s.skills,skillRanks:s.skillRanks,build:player.build,region:benchArena,spawns,seed,maxTicks:600,mode:'semi',stopWhen:count===1?'clear':'window'});
  assert.deepEqual(sample.requested,sample.executed);assert(Object.values(sample.casts).some(n=>n>0),'No actual casts');
  const lossRatio=(player.build.stats.hp-sample.hero.hp)/player.build.stats.hp;
  const row={family,count,lossRatio,...sample};rows.push(row);
  console.log(JSON.stringify({family,seed,count,skills:s.skills,enemyHp:spawns.map(x=>x.hp),clearSeconds:sample.clearSeconds,lossRatio,deathSeconds:sample.deathSeconds}));
 }
}
const n=process.argv.indexOf('--output');assert(n>=0&&process.argv[n+1],'--output required');
await writeFile(process.argv[n+1],JSON.stringify({at:new Date().toISOString(),versions,scope:'Current level1 starter builds only, 3 seeds, real quest spawn stats, controlled near-contact coordinates/open arena and stationary semi mode, enemy AI unmodified. No HP/skills/content writes. Not the proposed two-skill verification; clear enemy exhaustion is reported, not treated as sustained DPS.',rows},null,2)+'\n');
