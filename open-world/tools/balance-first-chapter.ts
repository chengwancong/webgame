import {World} from '../packages/simulation/index.ts';
import {regionById,starterSkills} from '../packages/content/index.ts';
import {makeGear,resolveBuild} from '../packages/rules/index.ts';
import {versions,type CharacterState} from '../packages/contracts/index.ts';
import {writeFile} from 'node:fs/promises';
import {sourceVersion} from './source-version.mjs';
const seeds=[11,23,47,71,101];
const rows=[];
for(const level of [1,2,3])for(const policy of ['auto','stationary'] as const)for(const loadout of ['starter','melee','ranged'])for(const seed of seeds){
 const skills=loadout==='starter'?starterSkills:loadout==='melee'?['cut','ward']:['bolt','ward'];
 const gear=[makeGear(loadout==='ranged'?1:0,'weapon'),makeGear(2,'armor')];
 const state:CharacterState={id:'probe',name:'probe',revision:0,build:1,level,xp:0,gold:0,material:0,gear,equipment:{weapon:'weapon',armor:'armor'},skills,skillRanks:Object.fromEntries(skills.map(id=>[id,1])),progress:{kills:0,regions:['town','meadow'],bosses:[],safe:'town',tasks:[]}};
 const resolved=resolveBuild(state);
 for(const encounter of ['normal','elite','boss'] as const){
  const r=regionById(encounter==='boss'?'meadow-boss':'meadow');
  const spawn=encounter==='boss'?r.spawns[0]:r.spawns.find(m=>encounter==='elite'?m.elite:!m.elite)!;
  const w=new World(r,resolved.stats,resolved.resolvedSkills,[{...spawn,id:`${r.id}:1:${spawn.id}`}],[],seed);
  w.hero.position={x:spawn.x-2,y:spawn.y};w.setMode(policy==='auto'?'auto':'semi');w.radius=20;
  let dangers=0,hits=0;
  for(let i=0;i<2700&&w.hero.hp>0&&w.enemies.some(e=>e.alive);i++){w.step();dangers+=w.events.filter(e=>e.type==='danger_started').length;hits+=w.events.filter(e=>e.type==='hit_resolved'&&e.id==='hero').length;}
  rows.push({level,policy,loadout,seed,encounter,win:w.enemies.every(e=>!e.alive),seconds:Number((w.tick/30).toFixed(2)),hp:w.hero.hp,hpMax:resolved.stats.hp,hits,dangers,kills:w.kills.length});
 }
 if(policy==='auto'){
  const r=regionById('meadow'),spawns=r.spawns.map(spawn=>({...spawn,id:`${r.id}:1:${spawn.id}`}));
  const w=new World(r,resolved.stats,resolved.resolvedSkills,spawns,[],seed);w.setMode('auto');
  const gateReady=()=>w.kills.length>=6&&w.kills.some(k=>spawns.find(s=>s.id===k.source_id)?.elite);
  let hits=0;
  for(let i=0;i<2700&&w.hero.hp>0&&!gateReady();i++){w.step();hits+=w.events.filter(e=>e.type==='hit_resolved'&&e.id==='hero').length;}
  rows.push({level,policy,loadout,seed,encounter:'field-gate',win:gateReady()&&w.hero.hp>0,seconds:Number((w.tick/30).toFixed(2)),hp:w.hero.hp,hpMax:resolved.stats.hp,hits,dangers:0,kills:w.kills.length});
 }
}
const summary=[...new Set(rows.map(r=>`${r.level}/${r.policy}/${r.loadout}/${r.encounter}`))].map(key=>{const sample=rows.filter(r=>`${r.level}/${r.policy}/${r.loadout}/${r.encounter}`===key);return {key,wins:sample.filter(r=>r.win).length,samples:sample.length,minHp:Math.min(...sample.map(r=>r.hp)),minSeconds:Math.min(...sample.map(r=>r.seconds)),maxSeconds:Math.max(...sample.map(r=>r.seconds))};});
const result={source:await sourceVersion(),versions,seeds,assumptions:['No gear affixes or upgrades','Server-resolved activated rank-1 skills','Single fights start 2 cells from each enemy; full-auto versus stationary semi-auto','Field starts at actual safe point with all enemies and default radius, until 6 kills including 1 elite','Use server-style cycle-1 spawn IDs, which affect initial attack timing','No loot or player progression during fights; mana and HP start full','Automated strategies do not establish human difficulty'],summary,rows};
const out=process.argv.find(s=>s.startsWith('--out='))?.slice(6);if(out)await writeFile(out,JSON.stringify(result,null,2));
console.log(JSON.stringify({samples:rows.length,output:out??null,versions}));
