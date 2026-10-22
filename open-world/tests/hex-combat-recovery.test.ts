import {expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {World} from '../packages/simulation/index.ts';
import {regionById} from '../packages/content/index.ts';
import {hexRunes} from '../packages/content/hex-runes.ts';
import {collectHexRules} from '../packages/rules/hex-runes.ts';
import {makeGear} from '../packages/rules/index.ts';
import {skillSchema,type CharacterState,type Stats} from '../packages/contracts/index.ts';

// Controlled execution/restore fixture, not a natural progression or TTK measurement.
// All HEX parameters are unchanged formal content; only actors and the input skill are controlled.
const inputSkill=skillSchema.parse({id:'qa-recovery-hit',name:'QA',description:'controlled direct hit',
 kind:'single',damage:100,range:8,radius:1,cooldown:2,cost:0,windup:3,duration:1,
 mechanics:{damageType:'physical',targeting:'enemy',statuses:[]}});
const qualities=['common','magic','rare','legendary'] as const;
// This fixture deliberately supplies only direct hits + DOT and asserts no HP
// restoration. Movement/control/relay prerequisites are exercised by the
// first-release tests; do not issue imaginary rare/legendary versions of them.
const samples=hexRunes.filter(r=>['hex-chain-lightning','hex-aftershock','hex-detonation-sigil'].includes(r.id));
function fixture(base:string,quality:typeof qualities[number]){
 const state:CharacterState={id:randomUUID(),name:'QA',revision:0,build:1,level:30,xp:0,gold:0,material:0,
  gear:[],equipment:{},skills:[],skillRanks:{},progress:{kills:0,regions:['town'],bosses:[],safe:'town',tasks:[]}};
 const gear=makeGear(0,randomUUID());gear.quality='legendary';gear.origin={kind:'random'};gear.requiredLevel=25;gear.hex={rune:base,tier:quality};state.gear.push(gear);state.equipment.weapon=gear.id;
 const stats:Stats={hp:1000,attack:100,armor:0,speed:0,mana:100,regen:0,effects:[],rules:collectHexRules(state)};
 const world=new World({...regionById('meadow'),obstacles:[],safe:{x:10,y:10}},stats,[inputSkill],
  [0,1,2,3].map(i=>({id:'target-'+i,name:'QA target',kind:'melee',x:12+i,y:10,hp:i===3?1:100000,
   attack:0,boss:false,elite:false,art:'raider'})),[],41);
 world.mode='manual';world.hero.hp=637;world.hero.mana=73;
 for(const enemy of world.enemies)enemy.cooldown=999999;
 // Persist a genuine dead instance, not a hand-written alive=false checkpoint.
 (world as any).damage(world.enemies[3],1,true,'qa-kill',{category:'derived',damageType:'pure'});
 return {world,state,gear,stats};
}
function dots(w:World){
 for(let i=0;i<3;i++)w.applyStatus('target-'+i,{kind:'burn',duration:600,interval:30,total:1000*(i+1),
  strength:0,damageType:'fire',scope:'hit',cleanse:true},w.playerId,'qa-dot');
}
function step(w:World){
 if(w.tick%10===0)expect(w.cast(inputSkill.id,w.enemies[0])).toBe(true);
 w.step();
}
for(const rune of samples)it.each(qualities)(`${rune.id} %s preserves in-flight combat and stops new procs after unequip`,quality=>{
 const {world:w,state,stats}=fixture(rune.id,quality);
 dots(w);
 for(let i=0;i<71;i++)step(w);
 // Tick 70 queued the input cast; capture actual runtime including RNG, counters,
 // active DOT/fields, ICD, HP and the killed target.
 const saved=JSON.parse(JSON.stringify(w.exportCheckpoint())),restored=World.restore(saved);
 expect(saved.data.pending.length).toBeGreaterThan(0);
 expect(restored.hero.hp).toBe(637);expect(restored.hero.mana).toBe(73);
 expect(restored.enemies[3]).toMatchObject({hp:0,alive:false});
 expect(restored.exportCheckpoint()).toEqual(w.exportCheckpoint());
 for(let i=0;i<180;i++){
  step(w);step(restored);
  expect(restored.events).toEqual(w.events);
  expect(restored.exportCheckpoint()).toEqual(w.exportCheckpoint());
 }
 const ids=collectHexRules(state).map(r=>r.id);
 expect(ids.reduce((n,id)=>n+(w.effectStats[id]?.count??0),0)).toBeGreaterThan(0);
 expect(w.enemies[3]).toMatchObject({hp:0,alive:false});
 // Real equip resolver + World build synchronization, not deleting rules in the checkpoint.
 delete state.equipment.weapon;
 const off={...stats,rules:collectHexRules(state)};
 const hp=w.hero.hp,dead=w.enemies[3].id;
 for(const run of [w,restored])run.applyBuild(off,[inputSkill]);
 const counts=ids.map(id=>w.effectStats[id]?.count??0);
 dots(w);dots(restored);
 for(let i=0;i<200;i++){step(w);step(restored);}
 expect(ids.map(id=>w.effectStats[id]?.count??0)).toEqual(counts);
 expect(w.stats.rules).toEqual([]);
 expect(w.hero.hp).toBe(hp);
 expect(w.enemies.find(e=>e.id===dead)).toMatchObject({hp:0,alive:false});
 expect(restored.exportCheckpoint()).toEqual(w.exportCheckpoint());
 // A second restore after unequip cannot resurrect the old equipped rule.
 const offRestored=World.restore(JSON.parse(JSON.stringify(w.exportCheckpoint())));
 for(let i=0;i<80;i++){step(w);step(offRestored);}
 expect(offRestored.exportCheckpoint()).toEqual(w.exportCheckpoint());
 expect(ids.map(id=>offRestored.effectStats[id]?.count??0)).toEqual(counts);
});
it.each(samples.map(r=>r.id))('%s keeps each party member independent through restore and one-member unequip',base=>{
 const {world:w,stats}=fixture(base,'legendary');
 w.addPlayer('a',structuredClone(stats),[inputSkill],{x:10,y:10});
 w.addPlayer('b',structuredClone(stats),[inputSkill],{x:10,y:11});
 for(const id of ['a','b'])w.forPlayer(id,()=>{w.mode='manual';dots(w);});
 const tick=(run:World)=>{
  // S1 consumes the shared target's DOT: periodically seed a new controlled
  // budget so B can trigger while A is on ICD, rather than expecting duplication.
  if(run.tick%50===0)run.forPlayer('b',()=>dots(run));
  for(const id of ['a','b'])run.forPlayer(id,()=>{
   if(run.tick%10===0)expect(run.cast(inputSkill.id,run.enemies[0])).toBe(true);
  });
  run.step();
 };
 for(let i=0;i<100;i++)tick(w);
 const copy=World.restore(JSON.parse(JSON.stringify(w.exportCheckpoint())));
 const ids=stats.rules!.map(r=>r.id);
 const count=(run:World,id:string)=>ids.reduce((sum,key)=>sum+(run.players.get(id)!.effectStats[key]?.count??0),0);
 expect(count(w,'a')).toBeGreaterThan(0);expect(count(w,'b')).toBeGreaterThan(0);
 const beforeA=count(w,'a'),beforeB=count(w,'b');
 for(const run of [w,copy]){
  run.forPlayer('a',()=>run.applyBuild({...stats,rules:[]},[inputSkill]));
  run.forPlayer('b',()=>dots(run));
 }
 for(let i=0;i<200;i++){tick(w);tick(copy);}
 expect(copy.exportCheckpoint()).toEqual(w.exportCheckpoint());
 expect(count(w,'a')).toBe(beforeA);
 expect(count(w,'b')).toBeGreaterThan(beforeB);
 expect(w.enemies[3]).toMatchObject({hp:0,alive:false});
});
