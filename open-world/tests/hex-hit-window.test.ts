import {expect,it} from 'vitest';
import {World} from '../packages/simulation/index.ts';
import {recordWindowHit,type HitWindows} from '../packages/simulation/hit-windows.ts';
import {regionById} from '../packages/content/index.ts';
import {effectRuleSchema,type EffectRule} from '../packages/contracts/effects.ts';
import {skillSchema,type Stats} from '../packages/contracts/index.ts';
import {describeAspectRule} from '../packages/content/aspect-description.ts';
const rule=(extra:object={})=>effectRuleSchema.parse({id:'hex-window-probe',name:'window',description:'controlled N23 test',source:'qa',trigger:'nHits',every:3,window:90,distinctSources:false,chance:1,icd:0,action:{type:'heal',ratio:.1,ref:'maxHp'},vfxKey:'hex/window',...extra});
const skills=['one','two','three'].map(id=>skillSchema.parse({id,name:id,description:'probe',kind:'single',damage:1,range:4,radius:1,cooldown:1,cost:0,windup:0,duration:1,mechanics:{damageType:'physical',targeting:'enemy',statuses:[]}}));
const stats=(rules:EffectRule[]):Stats=>({hp:1000,attack:1,armor:0,speed:0,mana:100,regen:0,effects:[],rules});
function fixture(r=rule()){
 const w=new World({...regionById('meadow'),safe:{x:10,y:10},obstacles:[]},stats([r]),structuredClone(skills),[0,1,2].map(i=>({id:'e'+i,name:'probe',kind:'melee',x:12+i,y:10,hp:10000,attack:0,boss:false,elite:false,art:'raider'})),[],41);
 w.mode='manual';w.hero.hp=100;for(const e of w.enemies)e.cooldown=99999;return w;
}
function hit(w:World,tick:number,index=0,target=0,extra:object={}){
 w.tick=tick;const s=w.skills[index];
 return (w as any).damage(w.enemies[target],1,false,s.id,{category:'direct',damageType:'physical',skill:s,scaled:true,...extra});
}
it('validates nHits fields without changing old hit rules',()=>{
 expect(describeAspectRule(rule({distinctSources:true}))).toContain('3秒内命中3次不同来源');
 for(const extra of [{every:undefined},{window:undefined},{window:0},{every:129},{count:'cast'},{also:['hit']},{trigger:'hit'},{trigger:'hit',window:undefined,distinctSources:undefined,also:['nHits']}]){
  expect(()=>rule(extra)).toThrow();
 }
 const legacy=effectRuleSchema.parse({...rule(),trigger:'hit',window:undefined,distinctSources:undefined});
 expect(legacy.trigger).toBe('hit');
});
it('counts landed direct hits within the inclusive 90-tick window',()=>{
 const w=fixture();hit(w,0);hit(w,20);expect(w.hero.hp).toBe(100);hit(w,90);
 expect(w.hero.hp).toBe(200);expect(w.effectStats['hex-window-probe'].count).toBe(1);
 expect(w.effectHitWindows?.['hex-window-probe']).toEqual([]);
});
it('drops expired hits rather than carrying them into a later three-hit window',()=>{
 const w=fixture();hit(w,0);hit(w,90);hit(w,91);expect(w.hero.hp).toBe(100);
 hit(w,92);expect(w.hero.hp).toBe(200);
});
it('keeps distinct sources by stable skill ID, refreshing a repeated source instead of counting it twice',()=>{
 const w=fixture(rule({distinctSources:true}));
 hit(w,0,0);hit(w,20,0);hit(w,40,1);expect(w.hero.hp).toBe(100);
 hit(w,60,2);expect(w.hero.hp).toBe(200);
});
it('does not let expired distinct sources or repeated AOE targets satisfy distinctSources',()=>{
 const w=fixture(rule({distinctSources:true}));
 hit(w,0,0,0);hit(w,0,0,1);hit(w,0,0,2);expect(w.hero.hp).toBe(100);
 hit(w,91,1);hit(w,92,2);expect(w.hero.hp).toBe(100);
 hit(w,93,0);expect(w.hero.hp).toBe(200);
});
it('counts three actual targets in one tick in non-distinct mode (hit count, not release count)',()=>{
 const w=fixture();for(let target=0;target<3;target++)hit(w,0,0,target);expect(w.hero.hp).toBe(200);
});
it('does not count DOT/skill-zone periodic or derived/recursive hits',()=>{
 const w=fixture();hit(w,0);hit(w,1);
 hit(w,2,0,0,{category:'periodic'});hit(w,3,0,0,{category:'derived'});hit(w,4,0,0,{comboDepth:1});
 expect(w.hero.hp).toBe(100);hit(w,5);expect(w.hero.hp).toBe(200);
});
it('respects filters before counting, cooldown at each threshold attempt, and maxTriggers',()=>{
 const filtered=fixture(rule({filter:{damageTypes:['fire']}}));for(let i=0;i<3;i++)hit(filtered,i);expect(filtered.effectHitWindows).toBeUndefined();
 const w=fixture(rule({icd:100,maxTriggers:2}));for(let i=0;i<6;i++)hit(w,i);
 expect(w.hero.hp).toBe(200);expect(w.comboReady['hex-window-probe']).toBe(102);
 for(let i=102;i<105;i++)hit(w,i);expect(w.hero.hp).toBe(300);
 for(let i=205;i<208;i++)hit(w,i);expect(w.hero.hp).toBe(300);
});
it('consumes a failed chance attempt consistently with nth and does not roll before a full window',()=>{
 const w=fixture(rule({chance:0})),before=w.exportCheckpoint().data.randomState;
 hit(w,0);hit(w,1);expect(w.exportCheckpoint().data.randomState).toBe(before);
 hit(w,2);expect(w.hero.hp).toBe(100);expect(w.effectHitWindows?.['hex-window-probe']).toEqual([]);
 expect(w.exportCheckpoint().data.randomState).not.toBe(before);
});
it('restores mid-window state and produces the same next result and RNG',()=>{
 const w=fixture(rule({distinctSources:true,icd:600}));hit(w,0,0);hit(w,10,1);
 const restored=World.restore(JSON.parse(JSON.stringify(w.exportCheckpoint())));
 for(const run of [w,restored])hit(run,20,2);
 expect(restored.hero.hp).toBe(200);expect(restored.exportCheckpoint()).toEqual(w.exportCheckpoint());
});
it('receives stable sources from actual skill casts, not only injected hit contexts',()=>{
 const w=fixture(rule({distinctSources:true}));
 for(const enemy of w.enemies)w.applyStatus(enemy.id,{kind:'root',duration:1000,strength:0,scope:'hit',cleanse:true},'fixture');
 for(const id of ['one','two','three']){
  expect(w.cast(id,w.enemies[0])).toBe(true);
  for(let i=0;i<3;i++)w.step();
 }
 expect(w.hero.hp).toBe(200);expect(w.effectStats['hex-window-probe'].count).toBe(1);
});
it('isolates window histories between players and preserves them on restore',()=>{
 const r=rule(),w=fixture(r);w.addPlayer('a',stats([r]),structuredClone(skills));w.addPlayer('b',stats([r]),structuredClone(skills));
 for(const id of ['a','b'])w.forPlayer(id,()=>{w.hero.hp=100;w.mode='manual';});
 w.forPlayer('a',()=>{hit(w,1);hit(w,2);});w.forPlayer('b',()=>hit(w,3));
 const restored=World.restore(JSON.parse(JSON.stringify(w.exportCheckpoint())));
 for(const run of [w,restored]){
  run.forPlayer('a',()=>hit(run,4));expect(run.players.get('a')!.hero.hp).toBe(200);expect(run.players.get('b')!.hero.hp).toBe(100);
  run.forPlayer('b',()=>{hit(run,5);hit(run,6);});expect(run.players.get('b')!.hero.hp).toBe(200);
 }
 expect(restored.exportCheckpoint()).toEqual(w.exportCheckpoint());
});
it('omits unused window state and reads legacy checkpoints without it',()=>{
 const w=fixture(effectRuleSchema.parse({...rule(),trigger:'hit',window:undefined,distinctSources:undefined}));
 expect(w.exportCheckpoint().data).not.toHaveProperty('effectHitWindows');
 const restored=World.restore(JSON.parse(JSON.stringify(w.exportCheckpoint())));expect(restored.effectHitWindows).toBeUndefined();
});
it('rejects malformed, oversized, future and out-of-order histories',()=>{
 const w=fixture();hit(w,10);const base=w.exportCheckpoint();
 for(const value of [null,[],{x:new Array(129).fill({tick:1,source:'a'})},{x:[{tick:11,source:'a'}]},{x:[{tick:2,source:'a'},{tick:1,source:'b'}]},{x:[{tick:1,source:''}]},{x:[{tick:1,source:'a',unknown:true}]}]){
  expect(()=>World.restore({...base,data:{...base.data,effectHitWindows:value}})).toThrow();
 }
});
it('bounds stored history even with many repeated sources',()=>{
 const state:HitWindows={};for(let i=0;i<10000;i++)recordWindowHit(state,'bounded',i,'same',128,10000,true);
 expect(state.bounded).toEqual([{tick:9999,source:'same'}]);
});
