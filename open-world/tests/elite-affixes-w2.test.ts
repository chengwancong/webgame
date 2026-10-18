import {it,expect} from 'vitest';
import {World,type CombatEvent} from '../packages/simulation/index.ts';
import {regionById,type Region} from '../packages/content/index.ts';
import {monsterContent} from '../packages/content/monsters.ts';
import {resolveMonsterSpawn} from '../packages/rules/monster-stats.ts';
import {applyEliteAffixes,rollEliteAffixes} from '../packages/rules/elite-affixes.ts';
import {eliteAffixes} from '../packages/content/elite-affixes.ts';
import type {EliteAffix} from '../packages/contracts/monsters.ts';
import type {Stats} from '../packages/contracts/index.ts';
const region:Region={...regionById('meadow'),width:64,height:64,activationRadius:40,aggroRadius:8,safe:{x:30,y:30},obstacles:[],spawns:[]},stats:Stats={hp:100000,attack:1,armor:0,speed:6,mana:100,regen:0,effects:[]};
function fight(affix:EliteAffix){const template=monsterContent.templates.find(t=>t.kind==='melee')!,spawn=applyEliteAffixes(resolveMonsterSpawn({id:'elite-affix-proof',template:template.id,rank:'elite',level:template.referenceLevel,x:31,y:30}),[affix]);spawn.monster!.ai.skillChance=1;const w=new World(region,stats,[],[spawn],[],41);w.setMode('manual');return w;}
function events(w:World,count:number){const all:CombatEvent[]=[];for(let i=0;i<count;i++){w.step();all.push(...w.events);}return all;}
it('all six declared affixes can be acquired through the real unique random pool',()=>{
 const all=new Set<EliteAffix>();for(let seed=1;seed<=300;seed++)for(const affix of rollEliteAffixes([2,3],seed,'acquisition-proof'))all.add(affix);
 expect([...all].sort()).toEqual(Object.keys(eliteAffixes).sort());
});
it('fire trails warn, inflict actual periodic damage and preserve their frozen intervals and areas across reconnect',()=>{
 const w=fight('fire_trail'),seen=events(w,130);expect(seen.some(e=>e.type==='danger_started'&&e.skill==='elite_fire_trail'&&e.windup===15)).toBe(true);expect(seen.some(e=>e.type==='hit_resolved'&&e.skill==='elite_fire_trail')).toBe(true);
 const saved=w.exportCheckpoint(),restored=World.restore(saved);expect(restored.exportCheckpoint()).toEqual(saved);
 const slow=fight('fire_trail');slow.rules.eliteAffixes.fire_trail.every=90;const first=events(slow,180).filter(e=>e.type==='danger_started'&&e.skill==='elite_fire_trail').length,fast=fight('fire_trail'),second=events(fast,180).filter(e=>e.type==='danger_started'&&e.skill==='elite_fire_trail').length;expect(second).toBeGreaterThan(first);
 expect(events(restored,30)).toEqual(events(w,30));
});
it('summoning uses the existing real minion executor, cap and nonreward policy, then restores the same minions',()=>{
 const w=fight('summon_minions'),seen=events(w,100);expect(seen.some(e=>e.type==='cast_released'&&e.skill==='summon_undead')).toBe(true);const minions=w.enemies.filter(e=>!e.reward);expect(minions).toHaveLength(2);expect(minions.every(e=>!e.elite&&!e.boss)).toBe(true);expect(World.restore(w.exportCheckpoint()).enemies).toEqual(w.enemies);
});
it('teleport has an actual windup, legal endpoint, changed-config distance and identical pending-cast recovery',()=>{
 const w=fight('teleport');let cast:CombatEvent|undefined;for(let i=0;i<100&&!cast;i++)cast=events(w,1).find(e=>e.type==='cast_started'&&e.skill==='elite_teleport');expect(cast).toBeDefined();expect(cast!.windup).toBe(24);expect(cast!.radius).toBe(1.6);
 const original={...w.enemies[0].position},restored=World.restore(w.exportCheckpoint()),one=events(w,25),two=events(restored,25);expect(two).toEqual(one);expect(one.some(e=>e.type==='displaced'&&e.skill==='elite_teleport')).toBe(true);expect(w.enemies[0].position).not.toEqual(original);
 const far=fight('teleport');far.rules.monsterSkills.elite_teleport.teleportDistance=5;const altered=events(far,100).find(e=>e.type==='cast_started'&&e.skill==='elite_teleport')!;expect(altered.target!.x-far.region.safe.x).toBe(5);
});
