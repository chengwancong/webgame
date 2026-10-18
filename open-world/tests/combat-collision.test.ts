import {describe,it,expect,vi} from 'vitest';
import {World,distance} from '../packages/simulation/index.ts';
import {moveBody,segmentContact,terrainContact} from '../packages/simulation/collision.ts';
import {regionById,skillCatalog,bodyCollision,type Region} from '../packages/content/index.ts';
import type {Stats,Spawn,Skill} from '../packages/contracts/index.ts';
const stats:Stats={hp:10000,attack:0,armor:0,speed:6,mana:1000,regen:0,effects:[]};
const region:Region={...regionById('meadow'),width:40,height:40,safe:{x:10,y:10},obstacles:[],spawns:[]};
const spawn=(id:string,x:number,y:number,kind:Spawn['kind']='melee'):Spawn=>({id,x,y,kind,name:id,hp:1000,attack:2,boss:false,elite:false,art:'raider'});
const skill=(id:string)=>skillCatalog.find(s=>s.id===id)!;
const make=(spawns:Spawn[],skills:Skill[]=[])=>(new World(region,stats,skills,spawns));

describe('combat contact and impact timing',()=>{
 it('blocks manual walking through a stationary enemy without stacking feet',()=>{
  const w=make([spawn('blocker',12,10)]);w.mode='manual';w.enemies[0].cooldown=9999;w.control(1,0);
  for(let i=0;i<40;i++){w.step();expect(distance(w.hero.position,w.enemies[0].position)).toBeGreaterThanOrEqual(bodyCollision.heroRadius+bodyCollision.enemyRadius-1e-5);}
  expect(w.hero.position.x).toBeLessThan(12);
 });
 it.each(['charger','assassin'] as const)('%s fast movement stops before the hero body',kind=>{
  const w=make([spawn('fast',12,10,kind)]);w.mode='manual';w.enemies[0].cooldown=0;w.step();
  expect(distance(w.hero.position,w.enemies[0].position)).toBeGreaterThanOrEqual(1.1-1e-5);
 });
 it('separates coincident ordinary monsters from the hero deterministically',()=>{
  const run=()=>{const w=make(Array.from({length:5},(_,i)=>spawn('same-'+i,10,10)));w.mode='manual';w.step();return w;};
  const w=run();expect(w.enemies.map(e=>e.position)).toEqual(run().enemies.map(e=>e.position));
  for(const e of w.enemies)expect(distance(e.position,w.hero.position)).toBeGreaterThanOrEqual(1.1-1e-4);
 });
 it('allows overlapping ordinary spawns and pursuit through another ordinary mob',()=>{
  const stacked=make(Array.from({length:4},(_,i)=>spawn('stack-'+i,15,10)));stacked.setMode('manual');stacked.step();expect(new Set(stacked.enemies.map(e=>JSON.stringify(e.position))).size).toBe(1);
  const w=make([spawn('front',12,10),spawn('rear',15,10)]);w.setMode('manual');w.applyStatus('front',{kind:'root',duration:300,strength:0,scope:'hit',cleanse:true});let gap=Infinity;
  for(let i=0;i<90;i++){w.step();gap=Math.min(gap,distance(w.enemies[0].position,w.enemies[1].position));expect(distance(w.hero.position,w.enemies[1].position)).toBeGreaterThanOrEqual(1.1-1e-5);}
  expect(gap).toBeLessThan(.2);expect(w.enemies[1].position.x).toBeLessThan(12);
 });
 it.each([['normal','elite'],['elite','normal'],['elite','elite'],['normal','boss'],['boss','normal'],['elite','boss'],['boss','boss']] as const)('keeps %s / %s contact solid', (first,second)=>{
  const actor=(id:string,rank:string)=>({...spawn(id,15,10),elite:rank==='elite',boss:rank==='boss'}),w=make([actor('a',first),actor('b',second)]);w.setMode('manual');
  const radius=(rank:string)=>rank==='boss'?bodyCollision.bossRadius:rank==='elite'?bodyCollision.eliteRadius:bodyCollision.enemyRadius;
  for(let i=0;i<60;i++){w.step();expect(distance(w.enemies[0].position,w.enemies[1].position)).toBeGreaterThanOrEqual(radius(first)+radius(second)-1e-4);}
 });
 it('does not treat a defeated monster as a body blocker',()=>{
  const w=make([spawn('dead',12,10)]);w.mode='manual';w.enemies[0].alive=false;w.control(1,0);for(let i=0;i<20;i++)w.step();expect(w.hero.position.x).toBeGreaterThan(12);
 });
 it('dash damage and release position follow the blocked landing point',()=>{
  const w=make([spawn('target',14,10)],[skill('rush')]);w.mode='manual';w.enemies[0].cooldown=9999;expect(w.cast('rush')).toBe(true);
  for(let i=0;i<skill('rush').windup;i++)w.step();
  expect(distance(w.hero.position,w.enemies[0].position)).toBeGreaterThanOrEqual(1.1-1e-5);expect(w.enemies[0].hp).toBeLessThan(1000);
  const event=w.events.find(e=>e.type==='cast_released');expect(event?.position).toEqual(w.hero.position);expect(event?.origin).toEqual(region.safe);
 });
 it('auto-cast dashes are short lunges: far targets do not pull the hero across the screen (progression-goal-plan §11.1)',()=>{
  const run=(x:number)=>{const w=make([spawn('target',x,10)],[skill('rush')]);w.mode='semi';w.autoSkills=true;w.enemies[0].cooldown=9999;let cast=false;for(let i=0;i<20;i++){w.step();cast||=w.events.some(e=>e.type==='cast_released'&&e.skill==='rush');}return cast;};
  expect(run(12)).toBe(true);expect(run(15.5)).toBe(false);
 });
 it('fast movement cannot cross a narrow wall even if the endpoint is open',()=>{
  const r={...region,obstacles:[{x:12,y:8,w:.2,h:4}]};const end=moveBody(r,{x:10,y:10},{x:16,y:10},6,.55,[],false);expect(end.x).toBeLessThan(12-.55);
 });
 it('manual cast events survive the next logic tick and release at windup completion',()=>{
  const w=make([spawn('target',12,10)],[skill('cut')]);w.mode='manual';w.enemies[0].cooldown=9999;w.cast('cut');w.step();
  expect(w.events.some(e=>e.type==='cast_started'&&e.skill==='cut')).toBe(true);expect(w.enemies[0].hp).toBe(1000);
  for(let i=1;i<skill('cut').windup;i++)w.step();expect(w.events.some(e=>e.type==='cast_released'&&e.skill==='cut')).toBe(true);expect(w.events.some(e=>e.type==='hit_resolved'&&e.skill==='cut')).toBe(true);
 });
 it('hits the nearest body crossed by a projectile segment, including grazing contact',()=>{
  const w=make([spawn('far',12,10),spawn('near',10.25,10.5)]);w.mode='manual';w.hero.position={x:8,y:8};w.enemies.forEach(e=>e.cooldown=9999);
  w.projectiles.push({id:1,position:{x:10,y:10},direction:{x:1,y:0},damage:25,life:20,enemy:false,pierce:false,hit:new Set(),skill:'bolt'});w.step();
  expect(w.enemies.find(e=>e.id==='near')!.hp).toBe(975);expect(w.enemies.find(e=>e.id==='far')!.hp).toBe(1000);expect(w.projectiles).toHaveLength(0);
 });
 it('resolves projectile wall contact before a target beyond the wall',()=>{
  const r={...region,obstacles:[{x:10.2,y:9,w:.05,h:2}]},w=new World(r,stats,[],[spawn('behind',11.2,10)]);w.mode='manual';w.enemies[0].cooldown=9999;
  w.projectiles.push({id:1,position:{x:10,y:10},direction:{x:1,y:0},damage:25,life:20,enemy:false,pierce:false,hit:new Set()});w.step();expect(w.enemies[0].hp).toBe(1000);expect(w.projectiles).toHaveLength(0);
 });
 it('uses earliest segment contact rather than endpoint distance',()=>{
  expect(segmentContact({x:0,y:0},{x:4,y:0},{x:2,y:.2},.5)).toBeLessThan(.5);expect(segmentContact({x:0,y:0},{x:4,y:0},{x:2,y:2},.5)).toBeNull();
  expect(terrainContact({...region,obstacles:[{x:2,y:-1,w:.1,h:2}]},{x:1,y:0},{x:4,y:0})).toBeCloseTo(.95/3);
 });
 it('does not advance queued impacts or movement while paused',()=>{
  const w=make([spawn('target',12,10)],[skill('cut')]);w.mode='manual';w.cast('cut');w.paused=true;for(let i=0;i<60;i++)w.step();expect(w.tick).toBe(0);expect(w.enemies[0].hp).toBe(1000);
  w.paused=false;for(let i=0;i<skill('cut').windup;i++)w.step();expect(w.enemies[0].hp).toBeLessThan(1000);
 });
 it('monster windup follows combat ticks instead of wall-clock timers',()=>{
  vi.useFakeTimers();try{
   const w=make([{...spawn('archer',12,10,'ranged'),art:'snow_ranger'}]);w.mode='manual';w.enemies[0].cooldown=0;w.step();w.paused=true;
   vi.advanceTimersByTime(5000);expect(w.tick).toBe(1);expect(w.projectiles).toHaveLength(0);expect(w.hero.hp).toBe(stats.hp);
   w.paused=false;for(let i=0;i<19;i++)w.step();expect(w.projectiles).toHaveLength(0);w.step();expect(w.projectiles).toHaveLength(1);for(let i=0;i<3;i++)w.step();expect(w.hero.hp).toBeLessThan(stats.hp);
  }finally{vi.useRealTimers();}
 });
});
