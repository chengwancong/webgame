import {describe,it,expect} from 'vitest';
import {World} from '../packages/simulation/index.ts';
import {regionById} from '../packages/content/index.ts';
import {HitFeedback,CameraShake,combatShakeTier} from '../apps/web/src/hit-feedback.ts';
import {combatShakeDirection} from '../apps/web/src/hit-feedback.ts';
import {physicalBodyMotion} from '../apps/web/src/physical-motion.ts';
const make=()=>new World(regionById('meadow'),{hp:100,armor:0,attack:20,speed:6,mana:100,regen:0,effects:[]},[],[{id:'target',x:8,y:8,name:'target',kind:'melee',hp:100,attack:1,elite:false,boss:false,art:'raider'}]);
const hit=(w:World,tick:number,patch:object={})=>{w.tick=tick;w.events=[{type:'hit_resolved',id:'target',position:{...w.enemies[0].position},amount:20,tick,sourceId:'hero',category:'direct',vfxKey:'player/whirl',...patch}];};
describe('render-only hit feedback',()=>{
 it('uses power-based 6/10/16 pixel displacement, elite scale, and a returning ground lift',()=>{
  const w=make(),f=new HitFeedback(()=>false);for(const [key,pixels]of [['cut',6],['whirl',10],['cleave',16]] as const){hit(w,10,{vfxKey:'player/'+key});f.consume(w);const s=f.state('target',11);expect(Math.hypot(s.x,s.y)).toBeCloseTo(pixels);}
  w.enemies[0].elite=true;hit(w,20,{vfxKey:'player/cleave'});f.consume(w);const elite=f.state('target',21);expect(Math.hypot(elite.x,elite.y)).toBeCloseTo(9.6);
  w.enemies[0].elite=false;hit(w,30,{vfxKey:'player/ground_slam'});f.consume(w);expect(f.state('target',34).y).toBeLessThan(0);expect(f.state('target',38)).toMatchObject({x:0,y:0});expect(combatShakeDirection(w,w.events[0]).y).toBe(1);
 });
 it('aligns jump landing and forward recovery to the real release, disabling all offsets in reduced motion',()=>{
  expect(physicalBodyMotion('leap_strike',4,8,{x:1,y:0},false).y).toBe(-18);expect(physicalBodyMotion('leap_strike',8,8,{x:1,y:0},false).y).toBe(0);
  expect(physicalBodyMotion('cut',3,3,{x:1,y:0},false).x).toBe(8);expect(physicalBodyMotion('cut',9,3,{x:1,y:0},false).x).toBe(0);
  expect(physicalBodyMotion('cleave',3,3,{x:1,y:1},true)).toEqual({x:0,y:0,groundY:0});
 });
 it('caps every shake vector at six pixels including boss death, with zero reduced-motion output',()=>{
  const s=new CameraShake();for(const tier of [1,2,3,4]){s.trigger(tier,tier*20,{x:.12,y:1});for(let n=0;n<8;n+=.25){const p=s.offset(tier*20+n);expect(Math.hypot(p.x,p.y)).toBeLessThanOrEqual(6);expect(s.offset(tier*20+n,true)).toEqual({x:0,y:0});}}
  const w=make();w.enemies[0].boss=true;expect(combatShakeTier(w,{type:'entity_died',id:'target',tick:1,position:{x:1,y:1}},new Set())).toBe(4);
 });
 it('pauses only display animation with a six tick cooldown and honors critical/kill durations',()=>{
  const w=make(),f=new HitFeedback(()=>false),before=structuredClone(w.enemies[0].position);hit(w,10);f.consume(w);expect(f.state('hero',11).paused).toBe(true);expect(f.state('hero',12).paused).toBe(false);expect(f.animationAge('hero',0,12)).toBe(10);
  hit(w,13,{crit:true});f.consume(w);expect(f.state('hero',14).paused).toBe(false);hit(w,16,{crit:true});f.consume(w);expect(f.state('target',18).paused).toBe(true);expect(f.state('target',19).paused).toBe(false);expect(w.tick).toBe(16);expect(w.enemies[0].position).toEqual(before);
  hit(w,22);w.events.push({type:'entity_died',id:'target',tick:22,position:before});f.consume(w);expect(f.state('target',25).paused).toBe(true);
 });
 it('gives light melee hits a one-tick stop, light projectiles none, and kills five ticks',()=>{
  const w=make(),f=new HitFeedback(()=>false);hit(w,10,{vfxKey:'player/cut'});f.consume(w);expect(f.state('target',10).paused).toBe(true);expect(f.state('target',11).paused).toBe(false);
  hit(w,20,{vfxKey:'player/bolt'});f.consume(w);expect(f.state('target',20).paused).toBe(false);
  hit(w,30,{vfxKey:'player/bolt'});w.events.push({type:'entity_died',id:'target',tick:30,position:{...w.enemies[0].position}});f.consume(w);expect(f.state('target',34).paused).toBe(true);expect(f.state('target',35).paused).toBe(false);
 });
 it('never displaces a boss; reduced motion retains tint while disabling stop/squash/displacement',()=>{
  const w=make();w.enemies[0].boss=true;hit(w,10,{crit:true});const f=new HitFeedback(()=>false);f.consume(w);expect(f.state('target',11)).toMatchObject({x:0,y:0,scaleX:1.03,scaleY:.97});
  const reduced=new HitFeedback(()=>true);reduced.consume(w);expect(reduced.state('target',11)).toMatchObject({x:0,y:0,scaleX:1,scaleY:1,paused:false,fill:true});expect(reduced.state('target',11).tint).toBeDefined();expect(reduced.state('target',14).tint).toBeUndefined();
 });
 it('does not flash the hero on full absorption or healing and uses red only for actual HP loss',()=>{
  const w=make(),f=new HitFeedback(()=>false);hit(w,10,{id:'hero',amount:0});f.consume(w);expect(f.state('hero',10).tint).toBeUndefined();hit(w,11,{id:'hero',amount:15});f.consume(w);expect(f.state('hero',11)).toMatchObject({fill:true,tint:0xf39f8e});expect(f.vignette(11)).toBe(.35);
 });
 it('holds health loss trails for ten ticks then contracts over twelve; healing resets immediately',()=>{
  const f=new HitFeedback(()=>false);expect(f.trailHp('hero',100,0)).toBe(100);expect(f.trailHp('hero',60,1)).toBe(100);expect(f.trailHp('hero',60,11)).toBe(100);expect(f.trailHp('hero',60,17)).toBe(80);expect(f.trailHp('hero',60,23)).toBe(60);expect(f.trailHp('hero',90,24)).toBe(90);
 });
 it('lets higher shake tiers interrupt lower, prevents repeat/eclipsed shake, and reduces quadratically',()=>{
  const s=new CameraShake();expect(s.trigger(1,10)).toBe(true);expect(s.trigger(1,11)).toBe(false);expect(s.trigger(3,11)).toBe(true);expect(s.trigger(2,12)).toBe(false);expect(s.offset(12,true)).toEqual({x:0,y:0});expect(s.offset(19)).toEqual({x:0,y:0});expect(s.trigger(3,19)).toBe(true);
  const w=make();hit(w,10,{id:'hero',amount:12});expect(combatShakeTier(w,w.events[0],new Set())).toBe(2);w.events[0].vfxKey='boss/ice_lance';expect(combatShakeTier(w,w.events[0],new Set())).toBe(3);
 });
});
