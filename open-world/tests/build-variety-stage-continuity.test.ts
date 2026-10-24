// numeric-spine：同步已应用计划的精确值，保留原机制断言。
import {it,expect} from 'vitest';
import {World} from '../packages/simulation/index.ts';
import {regionById,skillCatalog} from '../packages/content/index.ts';
import {lethalProtectionFixture} from './run-effects-fixtures.ts';
import {statsSchema} from '../packages/contracts/index.ts';
const actor='00000000-0000-4000-8000-000000000001';
const stats=statsSchema.parse({weapon:'sword',hp:1000,attack:20,armor:0,mana:100,speed:6,regen:0,effects:[]});
function world(at={x:10,y:10}){return new World({...regionById('meadow'),safe:at,obstacles:[]},stats,[],[{id:'stage-attacker',name:'阶段敌人',kind:'ranged',x:at.x+2,y:at.y,hp:100000,attack:0,boss:false,elite:false,art:'raider'}],[],41);}
it('stage carry preserves real charge deadlines, counters, self buffs and player mode without healing or copying old navigation',()=>{
 const old=world(),blink={...structuredClone(skillCatalog.find(s=>s.id==='blink')!),charges:2};old.addPlayer(actor,stats,[blink]);old.forPlayer(actor,()=>{old.setMode('manual');expect(old.cast('blink',undefined,{x:10,y:12})).toBe(true);});old.step();old.forPlayer(actor,()=>{old.hero.hp=123;old.comboCounts['run-counter']=4;old.effectStats['run-effect']={count:9,damage:888};old.setMode('auto');old.go({x:15,y:15});old.mode='auto';old.selfBuffs=[{id:'carry-buff',source:'已授予',starts:0,ends:1000,baseEnds:1000,stacks:1,action:{type:'buff',duration:1000,maxStacks:1,mods:{critChance:.15}}}];});
 const next=world({x:20,y:20});next.tick=old.tick;next.addPlayer(actor,stats,[blink]);next.carryPlayerRunState(actor,old.players.get(actor)!);next.carryStageIdentifiers(old);
 next.forPlayer(actor,()=>{expect(next.hero.hp).toBe(123);expect(next.hero.position).toEqual({x:20,y:20});expect(next.anchor).toEqual({x:20,y:20});expect(next.skillReadiness('blink').charges).toBe(1);expect(next.skillCharges).toEqual(old.players.get(actor)!.skillCharges);expect(next.comboCounts['run-counter']).toBe(4);expect(next.effectStats['run-effect']).toEqual({count:9,damage:888});expect(next.selfBuffs[0].id).toBe('carry-buff');expect(next.mode).toBe('auto');expect(next.movementIntent().destination).toBeUndefined();expect(next.effectLastPosition).toEqual({x:20,y:20});});
 expect(World.restore(JSON.parse(JSON.stringify(next.exportCheckpoint()))).exportCheckpoint()).toEqual(next.exportCheckpoint());
});
it('a consumed once-per-run lethal protection stays consumed after creating the next stage',()=>{
 const rule=lethalProtectionFixture(),s={...stats,rules:[rule]},old=world();old.addPlayer(actor,s,[]);old.forPlayer(actor,()=>{old.hero.hp=10;(old as any).hurt(2000,'probe',{category:'direct',damageType:'pure'});expect(old.hero.hp).toBe(850);expect(old.effectStats[rule.id].count).toBe(1);});old.step();
 const next=world({x:20,y:20});next.tick=old.tick;next.addPlayer(actor,s,[]);next.carryPlayerRunState(actor,old.players.get(actor)!);next.guardianUsed=new Set(old.guardianUsed);
 next.forPlayer(actor,()=>{(next as any).hurt(2000,'probe',{category:'direct',damageType:'pure'});expect(next.hero.hp).toBe(0);expect(next.effectStats[rule.id].count).toBe(1);expect(next.events.some(e=>e.type==='revived')).toBe(false);});
});
