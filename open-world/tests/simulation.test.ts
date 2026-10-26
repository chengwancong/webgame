import {describe,it,expect} from 'vitest';
import {World,distance,walkable,findPath,screenFacing} from '../packages/simulation/index.ts';
import {regions,regionById,skillCatalog} from '../packages/content/index.ts';
import type {Stats,Skill,Spawn} from '../packages/contracts/index.ts';
import {validateResponse} from '../packages/contracts/index.ts';
import {makeGear,resolveBuild} from '../packages/rules/index.ts';
import type {CharacterState} from '../packages/contracts/index.ts';
const stats:Stats={hp:300,attack:20,armor:4,speed:6,mana:100,regen:10,effects:[]};
const spawn=(id:string,x=8,y=8):Spawn=>({id,kind:'melee',name:id,x,y,hp:50,attack:2,elite:false,boss:false,art:'raider'});
function world(skills=skillCatalog,spawns=[spawn('one')]){const w=new World(regionById('meadow'),stats,skills,spawns,[],41);w.hero.position={x:7,y:8};w.anchor={...w.hero.position};return w;}
describe('actual world core',()=>{
 it('is deterministic under the same seed and commands',()=>{function run(){const w=world();w.setMode('auto');for(let i=0;i<600;i++)w.step();return {hero:w.hero,kills:w.kills,enemies:w.enemies};}expect(run()).toEqual(run());});
 it('uses cooldown and mana for manual and automatic casts',()=>{const w=world([skillCatalog.find(s=>s.id==='whirl')!]);expect(w.cast('whirl')).toBe(true);expect(w.hero.mana).toBe(85);expect(w.cast('whirl')).toBe(false);w.hero.mana=0;w.tick=200;expect(w.cast('whirl')).toBe(false);});
 it('moves in both coordinates and cannot cross a wall',()=>{const w=world();w.setMode('manual');w.control(1,1);for(let i=0;i<15;i++)w.step();expect(w.hero.position.x).toBeGreaterThan(7);expect(w.hero.position.y).toBeGreaterThan(8);w.hero.position={x:21.5,y:20};w.control(1,0);for(let i=0;i<90;i++)w.step();expect(walkable(w.region,w.hero.position)).toBe(true);expect(w.hero.position.x).toBeLessThan(22);});
 it('navigates around authored collision geometry',()=>{const r=regionById('meadow'),path=findPath(r,{x:20,y:20},{x:28,y:20});const pts=[{x:20,y:20},...path],len=pts.slice(1).reduce((v,p,i)=>v+distance(pts[i],p),0);expect(len).toBeGreaterThan(9);expect(path.every(p=>walkable(r,p))).toBe(true);});
 it('walks straight diagonals on open ground (screen-horizontal in iso)',()=>{const r={...regionById('meadow'),obstacles:[]},path=findPath(r,{x:10.5,y:30.5},{x:30.5,y:10.5});expect(path).toEqual([{x:30.5,y:10.5}]);});
 it('smoothed path segments never cross obstacles',()=>{const r=regionById('meadow'),from={x:20,y:20},path=findPath(r,from,{x:28,y:20}),pts=[from,...path];for(let i=1;i<pts.length;i++)for(let k=0;k<=20;k++)expect(walkable(r,{x:pts[i-1].x+(pts[i].x-pts[i-1].x)*k/20,y:pts[i-1].y+(pts[i].y-pts[i-1].y)*k/20})).toBe(true);});
 it('manual movement is a temporary takeover that keeps full-auto (doc 27 R1)',()=>{const w=world();w.setMode('auto');w.control(0,1);expect(w.mode).toBe('auto');expect(w.takingOver()).toBe(true);});
 it('stopping keeps a manual hero manual (field is manual only)',()=>{const w=world();w.setMode('manual');w.stop('test');expect(w.mode).toBe('manual');w.setMode('auto');w.stop('test');expect(w.mode).toBe('semi');});
 it('paused combat does not advance or produce kills',()=>{const w=world();w.paused=true;for(let i=0;i<100;i++)w.step();expect(w.tick).toBe(0);expect(w.kills).toEqual([]);});
 it('full-auto visibly navigates to confirmed pickups within its activity range',()=>{const w=world([],[]);w.pickups=[{x:10,y:8}];w.setMode('auto');for(let i=0;i<30;i++)w.step();expect(distance(w.hero.position,w.pickups[0])).toBeLessThan(1.6);expect(w.autoState).toBe('拾取战利品');});
 it('does not respawn rewarded monsters on reload',()=>{const w=new World(regionById('meadow'),stats,skillCatalog,[spawn('one')],['one']);expect(w.enemies.length).toBe(0);});
 it('piercing equipment changes projectile behavior',()=>{const w=world([skillCatalog.find(s=>s.id==='bolt')!],[spawn('a',10,8),spawn('b',12,8)]);w.stats={...stats,effects:['pierce']};w.hero.position={x:7,y:8};w.mode='manual';w.cast('bolt',w.enemies[0]);for(let i=0;i<20;i++)w.step();expect(w.enemies.every(e=>e.hp<50)).toBe(true);});
 it('chain, burn and ward effects have actual execution',()=>{const w=world([skillCatalog.find(s=>s.id==='cut')!],[spawn('a',8,8),spawn('b',8.5,8)]);w.stats={...stats,effects:['chain','burn','ward']};w.mode='manual';w.cast('cut',w.enemies[0]);for(let i=0;i<5;i++)w.step();expect(w.enemies[1].hp).toBeLessThan(50);expect(w.enemies[0].burn).toBeGreaterThan(w.tick);expect(w.hero.shield).toBeGreaterThan(0);});
 it('all published effect kinds can execute, no unknown mechanism strings',()=>{expect(new Set(skillCatalog.map(s=>s.kind))).toEqual(new Set(['single','area','projectile','zone','shield','heal','dash','chain']));expect(skillCatalog.length).toBeGreaterThanOrEqual(12);expect(regions.filter(r=>r.boss).map(r=>r.id)).toEqual(expect.arrayContaining(['meadow-boss','forest-boss','rift-boss','tundra-boss','abyss-boss','dragonbone-boss']));});
 it('summoned adds do not mint extra reward sources',()=>{const w=world([skillCatalog.find(s=>s.id==='whirl')!],[{...spawn('summoner'),kind:'summoner'}]);w.enemies[0].cooldown=0;for(let i=0;i<200;i++)w.step();expect(w.kills.every(k=>k.source_id==='summoner')).toBe(true);});
 it('does not resurrect a dead hero when a confirmed level updates the build',()=>{const w=world();w.hero.hp=0;w.applyBuild({...stats,hp:400},skillCatalog);expect(w.hero.hp).toBe(0);w.step();expect(w.tick).toBe(0);});
 it('rejects malformed successful responses instead of trusting compile-time types',()=>{expect(()=>validateResponse('character',{gold:100})).toThrow();expect(()=>validateResponse('control',{lease_id:'forged'})).toThrow();});
 it.each(['forest-boss','rift-boss'])('melee auto reaches a finite result through repeated warnings in %s',id=>{const gear=[makeGear(0,'weapon'),makeGear(2,'armor'),makeGear(3,'core')];const s:CharacterState={id:'policy',name:'melee',revision:0,build:1,level:id==='forest-boss'?3:5,xp:0,gold:0,material:0,gear,equipment:{weapon:'weapon',armor:'armor',core:'core'},skills:['cut','whirl','ward','mend'],skillRanks:{cut:1,whirl:1,ward:1,mend:1},progress:{kills:0,regions:[],bosses:[],safe:'town',tasks:[]}};const b=resolveBuild(s),r=regionById(id),w=new World(r,b.stats,b.resolvedSkills,r.spawns,[],11);w.radius=20;w.setMode('auto');for(let i=0;i<1800&&w.hero.hp>0&&w.enemies.some(e=>e.alive);i++)w.step();expect(w.hero.hp<=0||w.enemies.every(e=>!e.alive)).toBe(true);expect(w.tick).toBeLessThan(1800);if(w.hero.hp<=0)expect(w.stopReason).toContain('倒下');});
 it.each(['semi','auto'] as const)('does not auto-cast in town or spend a shield while idle in %s',mode=>{
 const ward=skillCatalog.find(s=>s.id==='ward')!;
 for(const region of [regionById('town'),regionById('meadow')]){const w=new World(region,stats,[ward],[]);w.setMode(mode);for(let i=0;i<300;i++)w.step();expect(w.hero.shield).toBe(0);expect(w.hero.mana).toBe(stats.mana);expect(w.cooldowns.ward).toBeUndefined();}
 });
 it('retains manual defensive casting in town',()=>{const w=new World(regionById('town'),stats,[skillCatalog.find(s=>s.id==='ward')!],[]);expect(w.cast('ward')).toBe(true);w.step();expect(w.hero.shield).toBeGreaterThan(0);expect(w.hero.mana).toBeLessThan(stats.mana);});
 it('reserves automatic shields until enemies threaten, including a targetless incoming projectile',()=>{
 const ward=skillCatalog.find(s=>s.id==='ward')!;const w=world([ward],[spawn('far',18,8)]);w.step();expect(w.cooldowns.ward).toBeUndefined();w.enemies[0].position={x:8,y:8};w.step();w.step();expect(w.hero.shield).toBeGreaterThan(0);
 const incoming=world([ward],[]);incoming.projectiles.push({id:1,position:{x:10,y:8},direction:{x:-1,y:0},damage:10,life:30,enemy:true,pierce:false,hit:new Set()});incoming.step();incoming.step();expect(incoming.hero.shield).toBeGreaterThan(0);
 const away=world([ward],[]);away.projectiles.push({id:1,position:{x:10,y:8},direction:{x:1,y:0},damage:10,life:30,enemy:true,pierce:false,hit:new Set()});away.step();expect(away.cooldowns.ward).toBeUndefined();
 });
 it('reacts to a ground warning without an enemy and still heals outside combat in the field',()=>{
 const w=world([skillCatalog.find(s=>s.id==='ward')!],[]);w.zones.push({id:1,position:{...w.hero.position},radius:2,damage:10,life:30,delay:15,enemy:true,slow:false});w.step();w.step();expect(w.hero.shield).toBeGreaterThan(0);
 const healing=world([skillCatalog.find(s=>s.id==='mend')!],[]);healing.hero.hp=100;for(let i=0;i<30;i++)healing.step();expect(healing.hero.hp).toBeGreaterThan(100);
 });

});

describe('等距朝向',()=>{
 it('按屏幕左右（x−y）而不是世界 x 决定朝向',()=>{
  const o={x:10,y:10};
  // 世界 x 增大但 y 增得更多：屏幕上在左下方，应朝左。
  expect(screenFacing(o,{x:11,y:13})).toBe(-1);
  // 世界 x 减小但 y 减得更多：屏幕上在右上方，应朝右。
  expect(screenFacing(o,{x:9,y:6})).toBe(1);
  expect(screenFacing(o,{x:12,y:10})).toBe(1);
  // 正上/正下方（x−y 不变）保持原朝向。
  expect(screenFacing(o,{x:12,y:12},-1)).toBe(-1);
  expect(screenFacing(o,{x:8,y:8},1)).toBe(1);
 });
});
