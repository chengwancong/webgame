import {it,expect} from 'vitest';
import {World} from '../packages/simulation/index.ts';
import {skillCatalog,regionById} from '../packages/content/index.ts';
import {chapterBossSkills,monsterSkills} from '../packages/content/chapter-combat.ts';
import {vfxProfiles} from '../apps/web/src/vfx-profiles.ts';
import {groundSize,beamFootprint} from '../apps/web/src/vfx-geometry.ts';
import {runVfxScenario,vfxScenarios} from './fixtures/vfx-scenarios.ts';
import historical from './fixtures/vfx-gameplay-before.json';
import golden from './fixtures/vfx-gameplay-current.json';
it('retains current ruleset traces of the 19 skill promises and existing enemy presentations',()=>{
 // Historical inputs predate approved skill range/damage and navigation changes.
 // The historical file remains immutable. Repaired mechanics have outcome and
 // lifecycle assertions in skill-mechanisms.test.ts, rather than old no-op traces.
 expect(Object.keys(historical).length).toBeGreaterThan(0);
 const unchanged=new Set(['cut','whirl','rush','cleave','ground_slam','leap_strike','rampage','bolt','ember','chain','lance','snipe','barrage','lightning_bolt','frost','nova','ward','mend','barrier']);
 const outcomes=(samples:any[])=>samples.map(sample=>({...sample,zones:sample.zones.map(({position,radius,damage}:any)=>({position,radius,damage}))}));
 for(const scenario of vfxScenarios.filter(s=>s.type!=='player'||unchanged.has(s.id)))expect(outcomes(runVfxScenario(World,scenario)),scenario.type+'/'+scenario.id).toEqual(outcomes((golden.scenarios as any)[scenario.type+'/'+scenario.id]));
});
it('registers every real skill explicitly and clears only implemented mechanism gaps',()=>{
 expect(Object.keys(vfxProfiles).filter(k=>k.startsWith('player/'))).toHaveLength(skillCatalog.length);
 for(const s of skillCatalog)expect(vfxProfiles['player/'+s.id],s.id).toBeDefined();
 for(const s of Object.keys(monsterSkills))expect(vfxProfiles['monster/'+s]).toBeDefined();
 for(const b of Object.values(chapterBossSkills))for(const s of b.skills)expect(vfxProfiles['boss/'+s.id]).toBeDefined();
 for(const id of ['rain_of_arrows','meteor','fireball'])expect(vfxProfiles['player/'+id].mechanicsGap).toBeUndefined();
 expect(vfxProfiles['player/fireball'].flight).toBe('fireball-flight');expect(vfxProfiles['player/frost_bolt'].flight).toBe('ice-bolt-flight');expect(vfxProfiles['player/chain'].family).toBe('chain');
});
it('projects circle and beam boundaries using the exact isometric transform',()=>{
 const s=groundSize(3);expect(s.width).toBeCloseTo(271.529);expect(s.height).toBeCloseTo(152.735);
 expect(beamFootprint({x:0,y:0},{x:1,y:0},2,10)).toEqual([{x:-64,y:36},{x:256,y:216},{x:384,y:144},{x:64,y:-36}]);
});
it('carries cast identity through flight into the actual collision hit',()=>{
 const skill=skillCatalog.find(s=>s.id==='bolt')!,region={...regionById('meadow'),safe:{x:12,y:12},obstacles:[]};
 const w=new World(region,{hp:1000,attack:0,armor:0,speed:6,mana:1000,regen:0,effects:[]},[skill],[{id:'target',x:16,y:12,art:'raider',name:'target',kind:'ranged',hp:1000,attack:0,boss:false,elite:false}]);w.mode='manual';w.enemies[0].cooldown=999999;w.cast('bolt',w.enemies[0]);
 const events=[];for(let i=0;i<30;i++){w.step();events.push(...w.events);}const start=events.find(e=>e.type==='cast_started')!,release=events.find(e=>e.type==='cast_released')!,hit=events.find(e=>e.type==='hit_resolved')!;
 expect(start.castId).toBeDefined();expect(release.castId).toBe(start.castId);expect(hit.castId).toBe(start.castId);expect(hit.sourceId).toBe('hero');expect(hit.targetId).toBe('target');expect(hit.vfxKey).toBe('player/bolt');expect(hit.contact).toBeDefined();
});
it('activates a delayed surface on the real damage tick and stays frozen while paused',()=>{
 const w=new World({...regionById('meadow'),safe:{x:12,y:12},obstacles:[]},{hp:1000,attack:0,armor:0,speed:6,mana:100,regen:0,effects:[]},[],[]);w.mode='manual';
 w.zones.push({id:1,castId:7,sourceId:'giant',vfxKey:'monster/frost_stomp',position:{x:12,y:12},radius:3,damage:40,life:1,delay:5,enemy:true,slow:false});
 for(let i=0;i<4;i++){w.step();expect(w.events.some(e=>e.type==='effect_activated')).toBe(false);}
 w.paused=true;for(let i=0;i<5;i++)w.step();expect(w.tick).toBe(4);expect(w.zones[0].delay).toBe(1);w.paused=false;w.step();
 const activation=w.events.find(e=>e.type==='effect_activated')!,hit=w.events.find(e=>e.type==='hit_resolved')!;expect(activation.tick).toBe(5);expect(hit.tick).toBe(activation.tick);expect(activation.castId).toBe(7);expect(activation.position).toEqual({x:12,y:12});expect(w.hero.hp).toBe(960);
});
