import {describe,expect,it} from 'vitest';
import {World} from '../packages/simulation/index.ts';
import {regionById} from '../packages/content/index.ts';
import {effectRuleSchema,type EffectRule} from '../packages/contracts/effects.ts';
import {describeAspectRule} from '../packages/content/aspect-description.ts';
import type {Spawn,Stats} from '../packages/contracts/index.ts';

const rule=(action:unknown,extra:Record<string,unknown>={}):EffectRule=>effectRuleSchema.parse({id:'hex-probe',name:'probe',description:'controlled D04 execution test',source:'qa',trigger:'hit',chance:1,icd:0,action,vfxKey:'hex/probe',...extra});
function fixture(rules:EffectRule[],positions=[{x:22,y:20},{x:23,y:20},{x:24,y:20}]){
 const stats:Stats={hp:1000,attack:100,armor:0,speed:0,mana:100,regen:0,effects:[],rules};
 const enemies:Spawn[]=positions.map((p,i)=>({id:'e'+i,name:'controlled target',kind:'melee',...p,hp:1000,attack:0,boss:false,elite:false,art:'raider'}));
 const w=new World({...regionById('meadow'),safe:{x:20,y:20},obstacles:[]},stats,[],enemies,[],41);w.setMode('manual');for(const e of w.enemies)e.cooldown=100000;return w;
}
function fire(w:World,trigger='hit'){(w as any).fireEffects(trigger,w.enemies[0],100);}
function hurt(w:World,amount=2000){(w as any).hurt(amount,'basic-melee',{category:'direct',damageType:'pure'});}
function dot(w:World,id:string,total:number,kind:'burn'|'poison'='burn'){
 w.applyStatus(id,{kind,duration:90,interval:30,total,damageType:kind==='burn'?'fire':'poison',strength:0,scope:'hit',cleanse:true},'hero','fixture-dot');
}

describe('HEX D04 P0 additive contracts and real World execution',()=>{
 it('accepts exact new actions and rejects invalid directions, empty statuses and unknown budgets',()=>{
  expect(rule({type:'blink',distance:6,direction:'away_from_enemies'}).action.type).toBe('blink');
  expect(()=>rule({type:'blink',distance:0,direction:'away_from_enemies'})).toThrow();
  expect(()=>rule({type:'blink',distance:6,direction:'random'})).toThrow();
  expect(()=>rule({type:'status_remove',statuses:[]})).toThrow();
  expect(()=>rule({type:'detonate',statuses:['burn'],ratio:1,remove:true,budget:'shared'})).toThrow();
  expect(describeAspectRule(rule({type:'status_remove',statuses:['freeze']}))).toContain('移除目标的冰冻');
  expect(describeAspectRule(rule({type:'blink',distance:6,direction:'away_from_enemies'}))).toContain('6格');
 });
 it('N7a survives at exactly one, remains death-proof for 60 ticks, then dies within the 1800-tick ICD',()=>{
  const r=rule({type:'buff',duration:60,maxStacks:1,mods:{},flags:{surviveAtOne:true}},{trigger:'lethal',icd:1800});
  const w=fixture([r]);hurt(w);expect(w.hero.hp).toBe(1);expect(w.effectStats[r.id].count).toBe(1);
  expect(w.events.some(e=>e.type==='entity_died'&&e.id==='hero')).toBe(false);
  w.tick=59;hurt(w);expect(w.hero.hp).toBe(1);expect(w.effectStats[r.id].count).toBe(1);
  const restored=World.restore(JSON.parse(JSON.stringify(w.exportCheckpoint())));
  for(const run of [w,restored]){run.tick=60;hurt(run);expect(run.hero.hp).toBe(0);expect(run.effectStats[r.id].count).toBe(1);}
  expect(restored.exportCheckpoint()).toEqual(w.exportCheckpoint());
 });
 it('N7a becomes available after the ICD without reviving an already dead hero',()=>{
  const w=fixture([rule({type:'buff',duration:60,maxStacks:1,mods:{},flags:{surviveAtOne:true}},{trigger:'lethal',icd:1800})]);
  hurt(w);w.tick=1800;w.hero.hp=100;hurt(w);expect(w.hero.hp).toBe(1);expect(w.effectStats['hex-probe'].count).toBe(2);
  w.tick=1860;hurt(w);w.tick=3600;hurt(w);expect(w.hero.hp).toBe(0);expect(w.effectStats['hex-probe'].count).toBe(2);
 });
 it('N7b consumes only the selected target statuses and emits their removal',()=>{
  const w=fixture([rule({type:'status_remove',statuses:['freeze']})]);
  for(const id of ['e0','e1'])w.applyStatus(id,{kind:'freeze',duration:90,strength:0,scope:'hit',cleanse:true},'hero','frost');
  dot(w,'e0',90);fire(w);
  expect(w.hasStatus('e0','freeze')).toBe(false);expect(w.hasStatus('e0','burn')).toBe(true);expect(w.hasStatus('e1','freeze')).toBe(true);
  w.step(); // Input-side status events are delivered with the next authoritative frame.
  expect(w.events.some(e=>e.type==='status_changed'&&e.id==='e0'&&e.status==='freeze'&&e.change==='consumed')).toBe(true);
 });
 it.each([false,true])('N7d uses each target budget, leaves clean neighbors untouched, remove=%s',remove=>{
  const w=fixture([rule({type:'detonate',statuses:['burn','poison','bleed'],ratio:.5,remove,radius:3,budget:'perTarget'})]);
  dot(w,'e0',100);dot(w,'e1',200);fire(w);
  expect(w.enemies.map(e=>e.hp)).toEqual([950,900,1000]);
  expect(w.hasStatus('e0','burn')).toBe(!remove);expect(w.hasStatus('e1','burn')).toBe(!remove);
  expect(w.events.filter(e=>e.type==='hit_resolved'&&e.id==='e2')).toEqual([]);
 });
 it('N7d preserves independent budgets and cooldown across checkpoint resume',()=>{
  const w=fixture([rule({type:'detonate',statuses:['burn'],ratio:.5,remove:false,radius:3,budget:'perTarget'},{icd:180})]);
  dot(w,'e0',100);dot(w,'e1',200);const restored=World.restore(JSON.parse(JSON.stringify(w.exportCheckpoint())));
  for(const run of [w,restored]){fire(run);fire(run);expect(run.enemies.map(e=>e.hp)).toEqual([950,900,1000]);}
  expect(restored.exportCheckpoint()).toEqual(w.exportCheckpoint());
 });
 it('keeps legacy detonate splash behavior when the new budget field is omitted',()=>{
  const w=fixture([rule({type:'detonate',statuses:['burn'],ratio:.5,remove:false,radius:3})]);dot(w,'e0',100);dot(w,'e1',200);fire(w);
  expect(w.enemies.map(e=>e.hp)).toEqual([950,950,950]);
 });
 it('N7e filters the newly applied kind, not any older status on the target',()=>{
  const r=rule({type:'extend',statuses:['burn'],duration:30,max:120,maxMode:'bonus'},{trigger:'status_apply',filter:{statusKinds:['burn']}}),w=fixture([r]);
  dot(w,'e0',90);expect(w.statuses.find(s=>s.effect.kind==='burn')!.ends).toBe(120);expect(w.effectStats[r.id].count).toBe(1);
  dot(w,'e0',90,'poison');expect(w.effectStats[r.id].count).toBe(1);expect(w.statuses.find(s=>s.effect.kind==='burn')!.ends).toBe(120);
  w.applyStatus('e0',{kind:'slow',duration:30,strength:.3,scope:'hit',cleanse:true});expect(w.effectStats[r.id].count).toBe(1);
  const restored=World.restore(JSON.parse(JSON.stringify(w.exportCheckpoint())));
  for(const run of [w,restored])dot(run,'e1',90);
  expect(restored.exportCheckpoint()).toEqual(w.exportCheckpoint());
 });
 it('N1 moves away from the centroid, not merely the nearest enemy, with no RNG draw',()=>{
  const r=rule({type:'blink',distance:6,direction:'away_from_enemies'}),w=fixture([r],[{x:22,y:20},{x:20,y:24},{x:35,y:20}]);
  const before=w.exportCheckpoint();fire(w);expect(w.exportCheckpoint().data.randomState).toBe(before.data.randomState);
  expect(w.hero.position.x).toBeCloseTo(20-6/Math.sqrt(5));expect(w.hero.position.y).toBeCloseTo(20-12/Math.sqrt(5));
  const restored=World.restore(JSON.parse(JSON.stringify(before)));fire(restored);expect(restored.exportCheckpoint()).toEqual(w.exportCheckpoint());
 });
 it('N1 stops before terrain and keeps a finite position for empty or centered crowds',()=>{
  const r=rule({type:'blink',distance:6,direction:'away_from_enemies'}),w=fixture([r]);
  w.region.obstacles=[{x:17,y:18,w:1,h:4}];fire(w);expect(w.hero.position.x).toBeGreaterThan(18);expect(w.hero.position.x).toBeLessThan(20);
  for(const positions of [[],[{x:18,y:20},{x:22,y:20}]]){const run=fixture([r],positions);fire(run);expect(run.hero.position).toEqual({x:20,y:20});}
 });
});
