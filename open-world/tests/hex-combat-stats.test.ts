import {expect,it} from 'vitest';
import {World} from '../packages/simulation/index.ts';
import {serverHexCombatStats,serverWorldHexCombatStats} from '../packages/simulation/hex-combat-stats.ts';
import {hexCombatStatsSchema} from '../packages/contracts/hex-combat-stats.ts';
import {effectRuleSchema} from '../packages/contracts/effects.ts';
import {regionById} from '../packages/content/index.ts';
const rule=effectRuleSchema.parse({id:'qa-hex',hexMechanism:'hex-aftershock',source:'gear-1',name:'QA',description:'controlled attribution',trigger:'hit',chance:1,icd:30,action:{type:'nova',ratio:.5,radius:3,ref:'hit',damageType:'pure'},vfxKey:'hex/qa'});
function world(){return new World({...regionById('meadow'),safe:{x:10,y:10},obstacles:[]},{hp:1000,attack:100,armor:0,speed:1,mana:100,regen:0,effects:[],rules:[structuredClone(rule)]},[],[{id:'target',name:'target',kind:'melee',x:12,y:10,hp:10000,attack:0,boss:false,elite:false,art:'raider'}],[],41);}
function hit(w:World,n=100){(w as any).damage(w.enemies[0],n,false,'basic',{category:'direct',damageType:'pure',scaled:true});}
const view=(w:World)=>hexCombatStatsSchema.parse(serverHexCombatStats(w.hexStatistics,w.stats.rules));
it('counts actual triggered rules and directly attributed HP damage, not buff benefit or shield absorption',()=>{
 const w=world();expect(view(w).share).toBeNull();expect(view(w).rules[0].triggers).toBe(0);
 hit(w);expect(view(w)).toMatchObject({coverage:'complete',totalDamage:150,directDamage:50,share:1/3,rules:[{rule:'qa-hex',triggers:1,directDamage:50}]});
 hit(w);expect(view(w)).toMatchObject({totalDamage:250,directDamage:50,rules:[{triggers:1}]});
 w.enemies[0].shield=100;hit(w);expect(view(w).totalDamage).toBe(250);
 w.enemies[0].hp=3;hit(w);expect(view(w).totalDamage).toBe(253);
});
it('preserves observations through checkpoint restore, death and stage transfer without recounting',()=>{
 const w=world();hit(w);const restored=World.restore(JSON.parse(JSON.stringify(w.exportCheckpoint())));expect(view(restored)).toEqual(view(w));
 (restored as any).hurt(10000,'fatal',{category:'direct',damageType:'pure',scaled:true});expect(view(restored)).toEqual(view(w));
 const next=world();next.addPlayer('p',next.stats,[]);next.carryPlayerRunState('p',restored as any);expect(serverWorldHexCombatStats(next,'p')).toEqual(view(w));
 expect(serverWorldHexCombatStats(next,'unknown').coverage).toBe('unavailable');
});
it('isolates party damage, triggers and projection even when a different actor is focused',()=>{
 const w=world();w.addPlayer('p',w.stats,[]);w.addPlayer('q',{...w.stats,rules:[]},[]);
 w.forPlayer('p',()=>hit(w));w.forPlayer('q',()=>hit(w,200));
 expect(serverWorldHexCombatStats(w,'p')).toMatchObject({totalDamage:150,directDamage:50});
 expect(serverWorldHexCombatStats(w,'q')).toMatchObject({totalDamage:200,directDamage:0,rules:[]});
 const restored=World.restore(JSON.parse(JSON.stringify(w.exportCheckpoint())));expect(serverWorldHexCombatStats(restored,'p')).toEqual(serverWorldHexCombatStats(w,'p'));
});
it('old checkpoints explicitly remain unknown, then partial; no invented historical zero or full-run share',()=>{
 const checkpoint=world().exportCheckpoint();delete checkpoint.data.hexStatistics;
 const old=World.restore(checkpoint);expect(view(old)).toMatchObject({coverage:'unavailable',totalDamage:null,directDamage:null,share:null,rules:[]});
 hit(old);expect(view(old)).toMatchObject({coverage:'partial',totalDamage:150,directDamage:50});
 const next=world();next.addPlayer('p',next.stats,[]);const emptyOld=World.restore(checkpoint);next.carryPlayerRunState('p',emptyOld as any);expect(serverWorldHexCombatStats(next,'p').coverage).toBe('unavailable');
});
it('retains historical rule identity after unequip and rejects corrupt persisted measurements',()=>{
 const w=world();hit(w);w.stats.rules=[];expect(view(w).rules[0]).toMatchObject({rune:'hex-aftershock',source:'gear-1',triggers:1});
 const checkpoint=w.exportCheckpoint();checkpoint.data.hexStatistics.totalDamage=1;expect(()=>World.restore(checkpoint)).toThrow();
});
