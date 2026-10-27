import {describe,expect,it} from 'vitest';
import {World,distance,walkable,type EnemyChaseOptions} from '../packages/simulation/index.ts';
import {regionById,type Region} from '../packages/content/index.ts';
import {dungeonContent} from '../packages/content/dungeons.ts';
import {treasureChaseRules} from '../packages/content/treasure-chase.ts';
import {newHubRun,prepareHubRegion,hubMimicChest,hubMimicPlacement,hubPublicState,startHubMimicChase,stepHubRuntime} from '../apps/api/src/hub-dungeon-runtime.ts';

const stats={hp:1000,attack:12,armor:0,speed:6,mana:100,regen:0,effects:[]};
const options:EnemyChaseOptions={speed:3,wakeTicks:30,totalTicks:540,restTicks:45,interceptTicks:75,stallTicks:45,arrivalRadius:.3,interceptRadius:1.5,interceptApproach:3};
function flat(obstacles:Region['obstacles']=[]){
 const region={...regionById('meadow'),width:40,height:40,safe:{x:10,y:12},portal:{x:35,y:35},obstacles,spawns:[],activationRadius:undefined};
 const w=new World(region,stats,[],[{id:'mimic',name:'宝箱怪',kind:'melee',art:'raider',x:12,y:12,hp:5000,attack:0,boss:false,elite:false}],[],41);w.setMode('manual');
 return{w,e:w.enemies[0]};
}
const run=(w:World,ticks:number)=>{for(let i=0;i<ticks;i++)w.step();};
const definition=()=>dungeonContent.definitions.find(d=>d.hub?.node==='mist-treasure')!;
const plainSeed=()=>{for(let seed=0;;seed++)if(!hubMimicChest('test',seed))return seed;};

describe('bounded treasure chase',()=>{
 it('waits for the wake animation, follows the route once, then returns to normal enemy AI',()=>{
  const {w,e}=flat();expect(w.startEnemyChase(e.id,[{x:18,y:12},{x:18,y:18}],options)).toBe(true);
  const start={...e.position};run(w,29);expect(e.position).toEqual(start);expect(e.chase?.phase).toBe('waking');
  run(w,30);expect(e.position.x).toBeGreaterThan(start.x);expect(e.position.y).toBeCloseTo(start.y);expect(e.chase?.phase).toBe('running');
  expect(w.startEnemyChase(e.id,[{x:20,y:20}],options)).toBe(false);
  while(e.chase?.phase!=='cornered'&&w.tick<540)w.step();
  expect(w.tick).toBeLessThan(540);const gap=distance(e.position,w.hero.position);run(w,15);expect(distance(e.position,w.hero.position)).toBeLessThan(gap);
 });
 it('a player waiting at the next destination intercepts once and creates the longer opening',()=>{
  const {w,e}=flat();w.hero.position={x:18,y:12};w.startEnemyChase(e.id,[{x:18,y:12},{x:18,y:18}],options);
  while(e.chase?.phase!=='staggered'&&w.tick<200)w.step();
  expect(e.chase?.interceptions).toBe(1);expect(e.chase!.phaseUntil-w.tick).toBe(options.interceptTicks);
  const p={...e.position};run(w,60);expect(e.position).toEqual(p);expect(e.chase?.interceptions).toBe(1);
  run(w,16);expect(e.chase?.leg).toBe(1);
 });
 it('respects slow and root instead of writing a second unchecked movement position',()=>{
  const normal=flat(),slowed=flat();for(const pair of [normal,slowed])pair.w.startEnemyChase(pair.e.id,[{x:22,y:12}],options);
  slowed.w.applyStatus(slowed.e.id,{kind:'slow',duration:180,strength:.5,scope:'hit',cleanse:true});
  run(normal.w,75);run(slowed.w,75);expect(slowed.e.position.x-12).toBeCloseTo((normal.e.position.x-12)/2,4);
  slowed.w.applyStatus(slowed.e.id,{kind:'root',duration:60,strength:1,scope:'hit',cleanse:true});const p={...slowed.e.position};run(slowed.w,20);expect(slowed.e.position).toEqual(p);
 });
 it('uses a reachable path around terrain and stops chasing at the finite deadline',()=>{
  const {w,e}=flat([{x:14,y:10,w:1,h:4}]);w.startEnemyChase(e.id,[{x:20,y:12}],options);
  for(let i=0;i<options.totalTicks;i++){w.step();expect(walkable(w.region,e.position,w.rules.bodyCollision.enemyRadius)).toBe(true);}
  expect(e.chase?.phase).toBe('cornered');
 });
 it('bounds body blocking without per-tick route retries',()=>{
  const {w,e}=flat();w.startEnemyChase(e.id,[{x:22,y:12}],options);run(w,30);
  // Root holds the same path; the global deadline still ends the chase.
  w.applyStatus(e.id,{kind:'root',duration:1000,strength:1,scope:'hit',cleanse:true});const path=structuredClone(e.chase!.path);run(w,200);expect(e.chase!.path).toEqual(path);run(w,310);expect(e.chase?.phase).toBe('cornered');
 });
 it('restores the exact route, phase clock and health without restarting the chase',()=>{
  const {w,e}=flat();w.startEnemyChase(e.id,[{x:18,y:12},{x:18,y:18}],options);run(w,70);e.hp=3210;
  const restored=World.restore(w.exportCheckpoint());expect(restored.enemies[0].chase).toEqual(e.chase);expect(restored.enemies[0].hp).toBe(3210);
  run(w,130);run(restored,130);expect(restored.enemies[0].position).toEqual(e.position);expect(restored.enemies[0].chase).toEqual(e.chase);
 });
 it('rejects malformed persisted route state',()=>{
  const {w,e}=flat();w.startEnemyChase(e.id,[{x:18,y:12}],options);const checkpoint=w.exportCheckpoint();checkpoint.data.enemies[0].chase.path=[{x:NaN,y:1}];expect(()=>World.restore(checkpoint)).toThrow();
 });
 it('degrades a route-less encounter to explicit cornered combat without teleporting',()=>{
  const {w,e}=flat(),position={...e.position};expect(w.startEnemyChase(e.id,[],options)).toBe(true);
  expect(e.chase?.phase).toBe('cornered');expect(e.position).toEqual(position);expect(World.restore(w.exportCheckpoint()).enemies[0].chase?.phase).toBe('cornered');
 });
});

describe('mimic chase content and original payout handoff',()=>{
 it.each(dungeonContent.definitions.filter(d=>d.hub?.kind==='treasure').map(d=>d.hub!.node))('%s intro box has a walkable two-leg chase in its real map',node=>{
  const d=dungeonContent.definitions.find(d=>d.hub?.node===node)!,h=newHubRun(d);h.seed=plainSeed();h.mimicIntro=true;
  const r=prepareHubRegion(regionById(d.stages[0]),d,0,'map-test',h),w=new World(r,stats,[],[],[],9);w.addPlayer('p',stats,[]);
  const chest=r.keyChests!.find(c=>c.id===h.mimic!.chest)!,opener=Array.from({length:8},(_,i)=>({x:chest.x+1.7*Math.cos(i*Math.PI/4),y:chest.y+1.7*Math.sin(i*Math.PI/4)})).find(p=>walkable(r,p,w.rules.bodyCollision.heroRadius))??chest;
  w.forPlayer('p',()=>{w.hero.position={x:opener.x,y:opener.y};w.setMode('manual');});const spawn=hubMimicPlacement(w,h,0,'map-test')!;w.addSpawns([spawn]);const e=w.enemies[0];h.mimic!.enemy=e.id;h.mimic!.player='p';
  expect(walkable(r,e.position,w.rules.bodyCollision.eliteRadius)).toBe(true);expect(startHubMimicChase(w,h,0)).toBe(true);expect(e.chase?.destinations).toHaveLength(2);let travelled=0;
  while(e.chase?.phase!=='cornered'&&w.tick<540){const before={...e.position};w.step();travelled+=distance(before,e.position);}
  expect(e.chase?.phase).toBe('cornered');expect(w.tick).toBeLessThanOrEqual(540);expect(travelled).toBeGreaterThan(treasureChaseRules.minimumRouteDistance*2);expect(w.hero.hp).toBe(stats.hp);
 });
 it('freezes chase rules and only the explicit intro flag guarantees a formerly plain seed',()=>{
  const d=definition(),seed=plainSeed(),intro=newHubRun(d);intro.seed=seed;intro.mimicIntro=true;
  prepareHubRegion(regionById(d.stages[0]),d,0,'test',intro);expect(intro.mimic?.chest).toBe('hub-chest-0');expect(intro.mimicRules).toEqual(treasureChaseRules);expect(intro.mimicRules).not.toBe(treasureChaseRules);
  const replay=newHubRun(d);replay.seed=seed;replay.mimicIntro=false;prepareHubRegion(regionById(d.stages[0]),d,0,'test',replay);expect(replay.mimic).toBeNull();
 });
 it('does not enable new mechanics for an old run without frozen chase rules',()=>{
  const d=definition(),h=newHubRun(d);delete h.mimicRules;h.mimicIntro=true;h.seed=plainSeed();prepareHubRegion(regionById(d.stages[0]),d,0,'test',h);expect(h.mimic).toBeNull();
  expect(startHubMimicChase(flat().w,h,0)).toBe(false);
 });
 it('starts with unchanged elite stats, persists the experience marker and uses the existing chest completion path',()=>{
  const d=definition(),h=newHubRun(d);h.mimicIntro=true;h.seed=plainSeed();const region=prepareHubRegion(regionById(d.stages[0]),d,0,'test',h),w=new World(region,stats,[],[],[],42);w.addPlayer('p',stats,[]);
  const spawn=hubMimicPlacement(w,h,0,'test')!;w.addSpawns([spawn]);const e=w.enemies.find(e=>e.id===spawn.id)!;h.mimic!.enemy=e.id;h.mimic!.player='p';const values={hp:e.hp,attack:e.attack,monster:structuredClone(e.monster)};
  expect(startHubMimicChase(w,h,0)).toBe(true);expect(h.mimic?.chase).toBe(true);expect({hp:e.hp,attack:e.attack,monster:e.monster}).toEqual(values);
  expect(e.chase!.speed).toBe(Math.min(e.monster!.ai.speed,stats.speed));expect(hubPublicState(w,d,h,0,w.tick,30).chase?.phase).toBe('waking');
  const until=e.chase!.until;expect(startHubMimicChase(w,h,0)).toBe(true);expect(e.chase!.until).toBe(until);
  e.alive=false;e.hp=0;stepHubRuntime(w,d,h,0,'test');expect(h.mimic?.done).toBe(true);expect(h.opening).toMatchObject({id:h.mimic!.chest,player:'p',mimic:true});
  delete h.opening;stepHubRuntime(w,d,h,0,'test');expect(h.opening).toBeUndefined();expect(hubPublicState(w,d,h,0,w.tick,30).chase).toBeUndefined();
 });
});
