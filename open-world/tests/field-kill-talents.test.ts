import {it,expect} from 'vitest';
import type {CharacterState} from '../packages/contracts/index.ts';
import {talentDefinitions} from '../packages/content/deep-progression.ts';
import definitions from '../packages/content/field-kill-talents.json';
import {ensureProgression,applyProgressionAction,resolveBuild,makeGear} from '../packages/rules/index.ts';
import {World,type CombatEvent} from '../packages/simulation/index.ts';
import {regionById} from '../packages/content/index.ts';
function character():CharacterState{const gear=makeGear(0,crypto.randomUUID());gear.attack=2000;return {id:crypto.randomUUID(),name:'击杀效果获取',revision:0,build:1,level:50,xp:0,gold:1e8,material:1e6,gear:[gear],equipment:{weapon:gear.id},skills:['cut'],skillRanks:{cut:1},progress:{kills:0,regions:['meadow'],bosses:[],safe:'town',tasks:[]}};}
for(const definition of definitions)it(definition.name+' is acquired through real talent commands and executes on actual skill kills',()=>{
 const s=character();ensureProgression(s);expect(()=>applyProgressionAction(s,{op:'talent.learn',target:definition.id})).toThrow();
 // 关键天赋需在本树前四层投入 20 点。
 let spent=0;for(const t of talentDefinitions.filter(t=>t.branch===definition.branch&&!t.exclusive))for(let r=0;r<t.max&&spent<20;r++){applyProgressionAction(s,{op:'talent.learn',target:t.id});spent++;}applyProgressionAction(s,{op:'talent.learn',target:definition.id});const build=resolveBuild(s);expect(build.stats.rules?.some(r=>r.id===definition.parts.rules[0].id)).toBe(true);
 const stats={...build.stats,attack:2000,hp:10000,mana:10000},region={...regionById('meadow'),safe:{x:30,y:30},width:64,height:64,obstacles:[],spawns:[]},spawns=[{id:'victim',name:'首个实际目标',kind:'melee' as const,art:'raider',x:31.5,y:30,hp:1000,attack:0,elite:false,boss:false},{id:'receiver',name:'相邻实际目标',kind:'melee' as const,art:'raider',x:33,y:30,hp:10000,attack:0,elite:false,boss:false}],world=new World(region,stats,build.resolvedSkills,spawns,[],41),events:CombatEvent[]=[];world.setMode('manual');expect(world.cast('cut',world.enemies.find(e=>e.id==='victim'))).toBe(true);
 for(let i=0;i<120&&!events.some(e=>e.type==='effect_triggered'&&e.skill===definition.parts.rules[0].id);i++){world.step();events.push(...world.events);}
 expect(world.enemies.find(e=>e.id==='victim')!.alive).toBe(false);expect(world.effectStats[definition.parts.rules[0].id]?.count).toBeGreaterThan(0);
 if(definition.id==='special-corpse')expect(world.effectStats[definition.parts.rules[0].id].damage).toBe(50);
 if(definition.id==='special-chain')expect(world.enemies.find(e=>e.id==='receiver')!.hp).toBeLessThan(10000);
 if(definition.id==='support-momentum')expect(world.exportCheckpoint().data.selfBuffs).toEqual(expect.arrayContaining([expect.objectContaining({id:definition.parts.rules[0].id,stacks:1})]));
 const saved=world.exportCheckpoint();expect(World.restore(saved).exportCheckpoint()).toEqual(saved);
});
it('places the three kill talents as keystones of the support and special trees',()=>{expect(talentDefinitions).toHaveLength(41);expect(definitions.map(d=>[d.id,d.branch,d.tier,d.required,d.exclusive])).toEqual([['special-corpse','special',5,20,true],['special-chain','special',5,20,true],['support-momentum','support',5,20,true]]);for(const t of talentDefinitions.filter(t=>t.tier<5))expect(t.modifiers.length).toBeGreaterThan(0);});
