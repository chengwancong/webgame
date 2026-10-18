import {it,expect} from 'vitest';
import {adoptCombatPermit} from '../apps/web/src/combat-permit.ts';
import {World} from '../packages/simulation/index.ts';
import {regionById} from '../packages/content/index.ts';
import {skillCatalog} from '../packages/content/index.ts';
import type {Stats,Permit} from '../packages/contracts/index.ts';
const stats:Stats={hp:300,attack:20,armor:4,speed:6,mana:100,regen:10,effects:[]};
it('routine renewal during a paid attack windup still releases that attack once',()=>{
 const old=permit('old'),cut=skillCatalog.find(s=>s.id==='cut')!;
 const current=new World(regionById('meadow'),stats,[cut],[{...old.spawns[0],x:10,y:10,attack:0,hp:10000}],[],41);
 current.hero.position={x:8,y:10};current.setMode('manual');expect(current.cast('cut')).toBe(true);
 const mana=current.hero.mana,cooldown=current.cooldowns.cut;
 adoptCombatPermit(current,old,old,{stats,resolvedSkills:[cut],build:1});
 expect(current.hero.mana).toBe(mana);expect(current.cooldowns.cut).toBe(cooldown);
 let hits=0;for(let t=0;t<30;t++){current.step();hits+=current.events.filter(e=>e.type==='hit_resolved'&&e.skill==='cut').length;}
 expect(hits).toBe(1);
});
const permit=(id:string,build=1):Permit=>({id,region:'meadow',cycle:id==='old'?1:2,build,rules:'ow-7',expires_at:'2026-10-01T00:00:00Z',spawns:[{id:id+'-enemy',kind:'melee',name:'enemy',x:16,y:18,hp:80,attack:2,elite:false,boss:false,art:'raider'}],completed:[],seed:41,from_tick:0,sequence:0});
function world(){const w=new World(regionById('meadow'),stats,[],permit('old').spawns,[],41);w.tick=933;w.hero.position={x:7,y:8};w.hero.hp=121;w.hero.mana=16;return w;}
it('a level-change renewal adopts the new spawn epoch and report cursor together',()=>{
 const current=world(),old=permit('old'),fresh=permit('new',2),result=adoptCombatPermit(current,old,fresh,{stats:{...stats,hp:318},resolvedSkills:[],build:2});
 expect(result.world).not.toBe(current);expect(result.world.tick).toBe(0);expect(result.lastTick).toBe(0);expect(result.sequence).toBe(0);expect(result.build).toBe(2);expect(result.world.enemies.map(e=>e.id)).toEqual(['new-enemy']);expect(result.world.hero.hp).toBeGreaterThan(0);expect(result.world.hero.mana).toBe(16);
 // The first report for this new authorization is sequence 1/from_tick 0,
 // never the retired cycle's sequence 2/from_tick 922.
 expect({sequence:result.sequence+1,from_tick:result.lastTick}).toEqual({sequence:1,from_tick:0});
});
it('rollover preserves actual walking, activity settings and remaining cooldowns on the new clock',()=>{
 const current=world();current.go({x:10,y:8});current.radius=20;current.avoidElite=true;current.hero.shield=40;current.hero.shieldUntil=963;current.cooldowns.ward=993;
 const result=adoptCombatPermit(current,permit('old'),permit('new'),{stats,resolvedSkills:[],build:1});expect(result.world.hero.shieldUntil).toBe(30);expect(result.world.cooldowns.ward).toBe(60);expect(result.world.radius).toBe(20);expect(result.world.avoidElite).toBe(true);for(let i=0;i<10;i++)result.world.step();expect(result.world.hero.position.x).toBeGreaterThan(7);
});
it('a same-cycle renewal retains the current simulation and synchronizes its acknowledged cursor',()=>{
 const current=world(),fresh={...permit('old',2),from_tick:933,sequence:4};const result=adoptCombatPermit(current,permit('old'),fresh,{stats,resolvedSkills:[],build:2});expect(result.world).toBe(current);expect(result.sequence).toBe(4);expect(result.lastTick).toBe(933);expect(result.world.hero.hp).toBe(121);
});
it('an empty cleared area stays empty while its permit and build are renewed',()=>{
 const old=permit('old'),current=new World(regionById('meadow'),stats,[],old.spawns,[],41);current.enemies.forEach(e=>{e.hp=0;e.alive=false;});current.tick=60;
 const refreshed={...old,build:2,from_tick:60,sequence:1,completed:old.spawns.map(m=>m.id)};
 const result=adoptCombatPermit(current,old,refreshed,{stats,resolvedSkills:[],build:2});expect(result.world).toBe(current);expect(result.world.enemies.filter(e=>e.alive)).toEqual([]);
 const resumed=new World(regionById('meadow'),stats,[],refreshed.spawns,refreshed.completed,41);expect(resumed.enemies).toEqual([]);
});
it('a same-cycle renewal appends a new authorized respawn without replacing surviving actors',()=>{
 const old=permit('old'),current=world(),survivor=current.enemies[0];survivor.hp=17;current.hero.shield=12;
 const added={...old.spawns[0],id:'old-enemy~r1',hp:80},fresh={...old,spawns:[...old.spawns,added],from_tick:current.tick};
 const result=adoptCombatPermit(current,old,fresh,{stats,resolvedSkills:[],build:1});expect(result.world).toBe(current);expect(current.enemies[0]).toBe(survivor);expect(survivor.hp).toBe(17);expect(current.enemies.some(e=>e.id===added.id)).toBe(true);expect(current.hero.shield).toBe(12);
 adoptCombatPermit(current,fresh,fresh,{stats,resolvedSkills:[],build:1});expect(current.enemies.filter(e=>e.id===added.id)).toHaveLength(1);
});
it('renewal never revives a dead hero and rejects mismatched build or region authority',()=>{
 const current=world();current.hero.hp=0;const snapshot={stats:{...stats,hp:400},resolvedSkills:[],build:2};expect(adoptCombatPermit(current,permit('old'),permit('new',2),snapshot).world.hero.hp).toBe(0);expect(()=>adoptCombatPermit(current,permit('old'),permit('new',3),snapshot)).toThrow();expect(()=>adoptCombatPermit(current,permit('old'),{...permit('new',2),region:'forest'},snapshot)).toThrow();
});
