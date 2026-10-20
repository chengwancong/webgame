import {expect,it} from 'vitest';
import {World} from '../packages/simulation/index.ts';
import {regionById} from '../packages/content/index.ts';
import {effectRuleSchema} from '../packages/contracts/effects.ts';
const make=(action:object,trigger='passive')=>effectRuleSchema.parse({id:'hex-p1-probe',name:'probe',description:'technical fixture, not published content',source:'qa',trigger,chance:1,icd:0,action,vfxKey:'hex/probe'});
function world(action:object,trigger='passive'){
 const w=new World({...regionById('meadow'),obstacles:[],safe:{x:10,y:10}},{hp:1000,attack:100,armor:0,speed:0,mana:100,regen:0,effects:[],rules:[make(action,trigger)]},[],[0,1,2,3].map(i=>({id:'e'+i,name:'probe',kind:'melee',x:12+i,y:10,hp:1000,attack:0,boss:false,elite:false,art:'raider'})),[],41);w.mode='manual';return w;
}
it.each([1,.65,.3,.1])('N2 applies the declared missing-HP curve at target HP fraction %s',fraction=>{
 const w=world({type:'amplify',ratio:0,targetMissingHp:{coefficient:.25/.7,cap:.25}});w.enemies[0].hp=1000*fraction;
 const before=w.enemies[0].hp,rng=w.exportCheckpoint().data.randomState;
 (w as any).damage(w.enemies[0],10,true,'qa',{category:'derived',damageType:'pure',scaled:true,comboDepth:1});
 expect(before-w.enemies[0].hp).toBe(Math.round(10*(1+Math.min(.25,(1-fraction)*(.25/.7)))));
 expect(w.exportCheckpoint().data.randomState).toBe(rng);
});
it('N2 survives checkpoints and rejects invalid curves',()=>{
 expect(()=>make({type:'amplify',ratio:0,targetMissingHp:{coefficient:-1,cap:.25}})).toThrow();
 expect(()=>make({type:'amplify',ratio:0,targetMissingHp:{coefficient:1,cap:Infinity}})).toThrow();
 const w=world({type:'amplify',ratio:0,targetMissingHp:{coefficient:.45/.7,cap:.45}});w.enemies[0].hp=300;
 const restored=World.restore(JSON.parse(JSON.stringify(w.exportCheckpoint())));
 for(const run of [w,restored])(run as any).damage(run.enemies[0],100,true,'qa',{category:'derived',damageType:'pure',scaled:true,comboDepth:1});
 expect(w.enemies[0].hp).toBe(155);expect(restored.exportCheckpoint()).toEqual(w.exportCheckpoint());
});
it('N7c seeds fear onto the nearest living neighbors of a dead elite without a carried status',()=>{
 const seed={kind:'fear',duration:60,strength:0,scope:'hit',cleanse:true}; // explicit test duration, not C6 tuning
 const w=world({type:'spread',statuses:['fear'],radius:6,count:2,seed},'kill_elite');w.enemies[0].elite=true;w.enemies[0].alive=false;w.enemies[0].hp=0;
 const restored=World.restore(JSON.parse(JSON.stringify(w.exportCheckpoint())));
 for(const run of [w,restored]){
  (run as any).fireEffects('kill_elite',run.enemies[0]);
  expect(run.hasStatus('e0','fear')).toBe(false);expect(run.hasStatus('e1','fear')).toBe(true);expect(run.hasStatus('e2','fear')).toBe(true);expect(run.hasStatus('e3','fear')).toBe(false);
  expect(run.statuses.every(s=>s.skill==='hex-p1-probe'&&s.effect.duration===60)).toBe(true);
 }
 expect(restored.exportCheckpoint()).toEqual(w.exportCheckpoint());
 expect(()=>make({type:'spread',statuses:['burn'],radius:6,count:2,seed},'kill_elite')).toThrow();
});
it('spread without seed still requires an existing player-owned status',()=>{
 const w=world({type:'spread',statuses:['fear'],radius:6,count:2},'kill_elite');(w as any).fireEffects('kill_elite',w.enemies[0]);expect(w.statuses).toEqual([]);
});
