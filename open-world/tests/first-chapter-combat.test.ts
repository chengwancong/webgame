import {it,expect} from 'vitest';
import {World} from '../packages/simulation/index.ts';
import {regionById,starterSkills} from '../packages/content/index.ts';
import {makeGear,resolveBuild} from '../packages/rules/index.ts';
import type {CharacterState} from '../packages/contracts/index.ts';
const seeds=[11,23,47,71,101];
const loadouts={starter:starterSkills,melee:['cut','ward'],ranged:['bolt','ward']};
function starter(level:number,loadout:keyof typeof loadouts){
 const skills=loadouts[loadout],gear=[makeGear(loadout==='ranged'?1:0,'weapon'),makeGear(2,'armor')];
 const state:CharacterState={id:'combat-policy',name:'policy',revision:0,build:1,level,xp:0,gold:0,material:0,gear,equipment:{weapon:'weapon',armor:'armor'},skills,skillRanks:Object.fromEntries(skills.map(id=>[id,1])),progress:{kills:0,regions:['town','meadow'],bosses:[],safe:'town',tasks:[]}};
 return resolveBuild(state);
}
for(const level of [1,2])for(const loadout of Object.keys(loadouts) as (keyof typeof loadouts)[]){
 it(`level ${level} ${loadout} can beat the first boss without upgrades or perfect dodging`,()=>{
  const resolved=starter(level,loadout),region=regionById('meadow-boss');
  for(const seed of seeds)for(const mode of ['auto','semi'] as const){
   const spawns=region.spawns.map(s=>({...s,id:`${region.id}:1:${s.id}`}));
   const world=new World(region,resolved.stats,resolved.resolvedSkills,spawns,[],seed);
   // Auto starts at the real entrance; semi stands in melee range and takes
   // warning strikes deliberately to check beginner tolerance.
   if(mode==='semi')world.hero.position={x:spawns[0].x-2,y:spawns[0].y};
   world.setMode(mode);let warnings=0,phases=0;
   while(world.tick<1200&&world.hero.hp>0&&world.enemies[0].alive){world.step();warnings+=world.events.filter(e=>e.type==='danger_started').length;phases+=world.events.filter(e=>e.type==='phase_changed').length;}
   expect(world.enemies[0].alive,`${mode}, seed ${seed}`).toBe(false);
   expect(world.hero.hp).toBeGreaterThan(resolved.stats.hp*.35);
   expect(world.tick).toBeLessThan(1200);
   expect(warnings).toBeGreaterThan(0);expect(phases).toBeGreaterThan(0);
  }
 });
 it(`level ${level} ${loadout} can unlock the first boss from a full field at its real entrance`,()=>{
  const resolved=starter(level,loadout),region=regionById('meadow');
  for(const seed of seeds){
   const spawns=region.spawns.map(s=>({...s,id:`${region.id}:1:${s.id}`}));
   const world=new World(region,resolved.stats,resolved.resolvedSkills,spawns,[],seed);world.setMode('auto');
   const gateReady=()=>world.kills.length>=6&&world.kills.some(k=>spawns.find(s=>s.id===k.source_id)?.elite);
   while(world.tick<900&&world.hero.hp>0&&!gateReady())world.step();
   expect(gateReady(),`seed ${seed}`).toBe(true);expect(world.hero.hp).toBeGreaterThan(resolved.stats.hp*.5);
  }
 });
}
