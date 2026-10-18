import {describe,it,expect} from 'vitest';
import {World} from '../packages/simulation/index.ts';
import {regionById,skillCatalog} from '../packages/content/index.ts';
import type {Stats,Spawn} from '../packages/contracts/index.ts';

// These are pre-integration combat contracts, not animation-derived durations.
const baseline=[{id:'cut',windup:3,cooldown:24,cost:0,damage:29},{id:'cleave',windup:18,cooldown:180,cost:25,damage:55},{id:'ground_slam',windup:12,cooldown:90,cost:18,damage:42}];
const stats:Stats={hp:1000,attack:20,armor:4,speed:6,mana:100,regen:0,effects:[],critChance:0,cdr:0};
const target:Spawn={id:'source-motion-target',kind:'melee',name:'source-motion-target',x:8,y:8,hp:1000,attack:0,elite:false,boss:false,art:'raider'};

describe('GameRes visual integration preserves authoritative combat scheduling',()=>{
 for(const contract of baseline)it(`${contract.id} keeps original windup, cooldown, mana and actual hit tick`,()=>{
  const skill=skillCatalog.find(s=>s.id===contract.id)!;
  expect({windup:skill.windup,cooldown:skill.cooldown,cost:skill.cost,damage:skill.damage}).toEqual({windup:contract.windup,cooldown:contract.cooldown,cost:contract.cost,damage:contract.damage});
  const w=new World(regionById('meadow'),stats,[skill],[target],[],41);w.mode='manual';w.autoSkills=false;w.hero.position={x:7,y:8};w.enemies[0].cooldown=9999;
  expect(w.cast(contract.id,w.enemies[0])).toBe(true);expect(w.hero.mana).toBe(100-contract.cost);expect(w.cooldowns[contract.id]).toBe(contract.cooldown);expect(w.hero.actionUntil).toBe(contract.windup+8);
  const events=[];let didPause=false;
  for(let i=0;i<contract.windup+10;i++){
   if(!didPause&&w.tick===Math.floor(contract.windup/2)){didPause=true;const tick=w.tick,hp=w.enemies[0].hp;w.paused=true;for(let n=0;n<10;n++)w.step();expect(w.tick).toBe(tick);expect(w.enemies[0].hp).toBe(hp);expect(w.cast(contract.id,w.enemies[0])).toBe(false);w.paused=false;}
   w.step();events.push(...w.events.filter(e=>e.skill===contract.id));if(w.tick<contract.windup)expect(w.enemies[0].hp).toBe(1000);
  }
  const release=events.filter(e=>e.type==='cast_released'),hits=events.filter(e=>e.type==='hit_resolved'&&e.id===target.id);
  expect(release).toHaveLength(1);expect(release[0].tick).toBe(contract.windup);expect(hits).toHaveLength(1);expect(hits[0].tick).toBe(contract.windup);expect(hits[0].amount).toBe(contract.damage);expect(w.enemies[0].hp).toBe(1000-contract.damage);expect(w.hero.action).toBe('idle');
 });
});
