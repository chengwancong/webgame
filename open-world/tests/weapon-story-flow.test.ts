// numeric-spine S7：同步最终整数投影；比例/速度专用夹具避开最小生命和防作弊固定下限。
import {it,expect} from 'vitest';
import type {CharacterState} from '../packages/contracts/index.ts';
import {skillCatalog,starterSkills,regionById} from '../packages/content/index.ts';
import {makeGear,resolveBuild} from '../packages/rules/index.ts';
import {changeMainHand,migrateWeaponSkills,rememberWeaponSkills} from '../packages/rules/weapon-skills.ts';
import {newStarseaState,applyStarseaOp,recordStarseaKill,starseaView,starseaClearPlausible} from '../packages/rules/starsea.ts';
import {minimumClearMs} from '../apps/api/src/clear-floor.ts';
import {resumeRegion,rememberRegion} from '../packages/rules/world-location.ts';
import {World} from '../packages/simulation/index.ts';
import {starseaMap} from '../packages/content/starsea/index.ts';
const engine=starseaMap('ss-map-wind').landmarks.find(p=>p.id==='objective')!;
import {engineDefense} from '../packages/content/starsea/defense.ts';
const state=():CharacterState=>{const sword=makeGear(0,crypto.randomUUID()),bow=makeGear(1,crypto.randomUUID());return {id:crypto.randomUUID(),name:'流程',revision:0,build:1,level:3,xp:0,gold:123,material:9,gear:[sword,bow],equipment:{weapon:sword.id},skills:[...starterSkills],skillRanks:Object.fromEntries([...starterSkills,'bolt'].map(id=>[id,1])),skillBooks:{ember:2},progress:{kills:0,regions:['ss-map-port','ss-map-wind'],bosses:[],safe:'ss-map-wind',tasks:[]},starsea:newStarseaState()};};
it('restores each weapon bar without changing activation, ranks, books, gear or wallet',()=>{
 const s=state(),growth=JSON.stringify({r:s.skillRanks,b:s.skillBooks,g:s.gear,gold:s.gold});
 changeMainHand(s,s.gear[1].id);expect(s.skills).toEqual(['ward']);s.skills=['bolt','ward'];rememberWeaponSkills(s);changeMainHand(s,s.gear[0].id);expect(s.skills).toEqual(starterSkills);changeMainHand(s,s.gear[1].id);expect(s.skills).toEqual(['bolt','ward']);
 expect(JSON.stringify({r:s.skillRanks,b:s.skillBooks,g:s.gear,gold:s.gold})).toBe(growth);
});
it('db12 repair only clears incompatible slots and preserves an empty bar',()=>{
 const s=state();s.skills=['bolt'];const ranks={...s.skillRanks},gear=structuredClone(s.gear);expect(migrateWeaponSkills(s)).toBe(true);expect(s.skills).toEqual([]);expect(s.skillRanks).toEqual(ranks);expect(s.gear).toEqual(gear);expect(s.skillBooks).toEqual({ember:2});expect(s.gold).toBe(123);expect(migrateWeaponSkills(s)).toBe(false);
});
it('checks unlocked map and restores map landing rather than saved exact coordinates',()=>{
 const s=state();rememberRegion(s,'ss-map-port');expect(resumeRegion(s)).toBe('ss-map-port');rememberRegion(s,'ss-map-wind');expect(resumeRegion(s)).toBe('ss-map-wind');expect(()=>rememberRegion(s,'ss-map-ember')).toThrow();s.lastRegion='bogus';expect(resumeRegion(s)).toBe('ss-map-wind');
});
it('holds only in range, receives enemy attacks, fails on engine destruction, preserves battle checkpoint',()=>{
 const s=state(),b=resolveBuild(s),w=new World(regionById('ss-map-wind'),b.stats,b.resolvedSkills,[],[],8);w.hero.position={x:engine.x,y:engine.y};w.defense={position:{x:engine.x,y:engine.y},hp:engineDefense.hp,maxHp:engineDefense.hp,radius:6,requiredTicks:540,heldTicks:0,enemyIds:[],complete:false,failed:false};
 w.step();expect(w.defense.heldTicks).toBe(1);w.hero.position={x:engine.x+10,y:engine.y+7};w.step();expect(w.defense.heldTicks).toBe(1);const restored=World.restore(w.exportCheckpoint());expect(restored.defense).toEqual(w.defense);
 w.defense.hp=0;w.step();expect(w.defense.failed).toBe(true);expect(w.defense.complete).toBe(false);
});
it('keeps the battle running after the engine breaks: raiders leave and the hero can still walk to repair it',()=>{
 const s=state(),b=resolveBuild(s),raider={id:'q:ss-c01-t03:1:1:0',name:'暮界刀兵',x:engine.x+2,y:engine.y,hp:400,attack:10,kind:'melee',boss:false,elite:false} as any;
 const w=new World(regionById('ss-map-wind'),b.stats,b.resolvedSkills,[raider],[],8);w.hero.position={x:engine.x,y:engine.y};w.defense={position:{x:engine.x,y:engine.y},hp:0,maxHp:engineDefense.hp,radius:6,requiredTicks:540,heldTicks:0,enemyIds:[raider.id],complete:false,failed:false};
 w.step();expect(w.defense.failed).toBe(true);expect(w.enemies.find(e=>e.id===raider.id)?.alive).toBe(false);expect(w.kills).toHaveLength(0);
 const before=w.tick,start={...w.hero.position};w.control(1,0);for(let i=0;i<15;i++)w.step();expect(w.tick).toBe(before+15);expect(w.hero.position).not.toEqual(start);
});
it('falling during the defense fails it but stands the hero back up beside the engine instead of freezing',()=>{
 const s=state(),b=resolveBuild(s),w=new World(regionById('ss-map-wind'),b.stats,b.resolvedSkills,[],[],8);w.hero.position={x:engine.x+8,y:engine.y+7};w.hero.hp=0;w.defense={position:{x:engine.x,y:engine.y},hp:500,maxHp:engineDefense.hp,radius:6,requiredTicks:540,heldTicks:10,enemyIds:[],complete:false,failed:false};
 w.step();expect(w.defense.failed).toBe(true);expect(w.defense.downed).toBe(true);expect(w.hero.hp).toBe(b.stats.hp);expect(w.hero.position).toEqual({x:engine.x+1.5,y:engine.y});
 const before=w.tick;w.step();expect(w.tick).toBe(before+1);
});
it('engine defense: a fall mid-step fails it without ending the field battle',()=>{
 const s=state(),b=resolveBuild(s),brute={id:'q:ss-c01-t03:1:1:0',name:'暮界刀兵',x:engine.x+1,y:engine.y,hp:99999,attack:999999,kind:'melee',boss:false,elite:false} as any;
 const w=new World(regionById('ss-map-wind'),b.stats,b.resolvedSkills,[brute],[],8);w.setMode('manual');w.hero.position={x:engine.x,y:engine.y};w.defense={position:{x:engine.x,y:engine.y},hp:500,maxHp:engineDefense.hp,radius:6,requiredTicks:540,heldTicks:10,enemyIds:[brute.id],complete:false,failed:false};
 for(let i=0;i<120&&!w.defense.downed;i++){w.step();expect(w.hero.hp).toBeGreaterThan(0);}
 expect(w.defense.downed).toBe(true);expect(w.defense.failed).toBe(true);expect(w.stopReason).toBe('');expect(w.paused).toBe(false);
});
it('phases nearby wild monsters out of a story fight and puts them back untouched afterwards',()=>{
 const s=state(),b=resolveBuild(s),wild={id:'ss-map-wind:1:wolf',name:'狼',x:engine.x+3,y:engine.y,hp:300,attack:10,kind:'melee',boss:false,elite:false} as any,far={...wild,id:'ss-map-wind:1:far',x:engine.x+28,y:engine.y+27},raider={...wild,id:'q:ss-c01-t02:0:1:0',x:engine.x+2,y:engine.y+1};
 const w=new World(regionById('ss-map-wind'),b.stats,b.resolvedSkills,[wild,far,raider],[],8);w.targetId=wild.id;
 w.phaseOut({x:engine.x,y:engine.y},14,e=>e.id.startsWith('q:'));expect(w.enemies.map(e=>e.id).sort()).toEqual([far.id,raider.id].sort());expect(w.targetId).toBe('');
 for(let i=0;i<30;i++)w.step();expect(w.phased[0]).toMatchObject({id:wild.id,hp:300,position:{x:engine.x+3,y:engine.y}});expect(World.restore(w.exportCheckpoint()).phased.map(e=>e.id)).toEqual([wild.id]);
 w.phaseIn();expect(w.enemies.find(e=>e.id===wild.id)?.alive).toBe(true);expect(w.phased).toEqual([]);expect(w.kills).toEqual([]);
});
it('clear floor follows the real build: stronger characters may clear faster, and only too-fast clears are refused',()=>{
 const floor=(level:number)=>{const s=state();s.level=level;s.starsea!.quests={'ss-c01-t03':{step:0,attempt:0,acceptedAt:0}};s.starsea!.tracked='ss-c01-t03';const r=applyStarseaOp(s,'interact',{region:'ss-map-wind',target:'object:engine',now:0});return {ms:minimumClearMs(s,'ss-map-wind',{x:r.spawns[0].x,y:r.spawns[0].y},r.spawns.map(e=>({...e,hp:100}))),wave:s.starsea!.wave!};};
 const weak=floor(1),strong=floor(30);expect(weak.ms).toBeGreaterThan(strong.ms);expect(strong.ms).toBeGreaterThan(0);expect(weak.wave.startedAt).toBe(0);
 const wave={...weak.wave,minClearMs:weak.ms};expect(starseaClearPlausible(wave,weak.ms-1)).toBe(false);expect(starseaClearPlausible(wave,weak.ms)).toBe(true);
});
