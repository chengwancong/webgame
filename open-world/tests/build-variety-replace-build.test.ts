import {it,expect} from 'vitest';
import {World} from '../packages/simulation/index.ts';
import {replaceCombatBuild} from '../packages/simulation/replace-build.ts';
import {regionById,skillCatalog} from '../packages/content/index.ts';
import {effectAtoms} from '../packages/content/effect-atoms.ts';
import type {Stats} from '../packages/contracts/index.ts';
const stats:Stats={hp:1000,attack:20,armor:20,speed:6,mana:500,regen:0,effects:[]},skill=()=>structuredClone(skillCatalog.find(s=>s.id==='fireball')!);
function world(){const w=new World({...regionById('meadow'),obstacles:[],safe:{x:10,y:10}},stats,[skill()],[{id:'t',name:'靶',kind:'ranged',x:12,y:10,hp:100000,attack:0,boss:false,elite:false,art:'raider'}],[],41);w.setMode('manual');w.enemies[0].cooldown=100000;return w;}
it('preserves pending casts, cooldowns, status clocks, counters, position and HP on a parameter update',()=>{
 const w=world();w.hero.hp=700;w.hero.mana=300;w.hero.shield=37;w.hero.shieldUntil=123;expect(w.cast('fireball',w.enemies[0])).toBe(true);w.applyStatus('t',{kind:'slow',scope:'hit',duration:90,strength:.3,cleanse:true},w.playerId,'review');
 const before=w.exportCheckpoint(),replacement={stats:{...stats,hp:2000,mana:700,rules:[structuredClone(effectAtoms[0])]},skills:[{...skill(),damage:100}]};replaceCombatBuild(w,replacement);const after=w.exportCheckpoint();
 expect(w.hero.hp).toBe(700);expect(w.stats.hp).toBe(2000);expect(w.skills[0].damage).toBe(100);expect(after.data.hero).toEqual(before.data.hero);
 for(const key of ['pending','cooldowns','statuses','projectiles','zones','sequences','comboCounts','selfBuffs','tick','serial','randomState'])if(key in before.data)expect(after.data[key]).toEqual(before.data[key]);
 replacement.stats.hp=3000;replacement.skills[0].damage=500;expect(w.stats.hp).toBe(2000);expect(w.skills[0].damage).toBe(100);
});
it('keeps already released projectile geometry and its resolved skill snapshot intact',()=>{
 const w=world();expect(w.cast('fireball',w.enemies[0])).toBe(true);for(let i=0;i<skill().windup+1;i++)w.step();expect(w.projectiles.length).toBeGreaterThan(0);const before=w.exportCheckpoint().data.projectiles;replaceCombatBuild(w,{stats:{...stats,castSpeed:.5} as Stats,skills:[{...skill(),damage:1234}]});expect(w.exportCheckpoint().data.projectiles).toEqual(before);
});
it('caps changed maxima without reviving a dead actor or refilling resources',()=>{
 const w=world();w.hero.hp=700;w.hero.mana=300;replaceCombatBuild(w,{stats:{...stats,hp:500,mana:200},skills:[skill()]});expect(w.hero.hp).toBe(500);expect(w.hero.mana).toBe(200);w.hero.hp=0;replaceCombatBuild(w,{stats,skills:[skill()]});expect(w.hero.hp).toBe(0);expect(w.hero.mana).toBe(200);
});
it('updates only the requested multiplayer actor and survives checkpoint restore',()=>{
 const w=world();w.addPlayer('one',stats,[skill()],{x:10,y:10});w.addPlayer('two',stats,[skill()],{x:15,y:10});w.forPlayer('one',()=>{w.hero.hp=600;w.hero.mana=100;w.cooldowns.fireball=123;});const other=structuredClone(w.players.get('two')!);
 replaceCombatBuild(w,{stats:{...stats,hp:1500},skills:[{...skill(),damage:88}]},'one');expect(w.players.get('two')).toEqual(other);const restored=World.restore(w.exportCheckpoint());restored.forPlayer('one',()=>{expect(restored.hero.hp).toBe(600);expect(restored.hero.mana).toBe(100);expect(restored.cooldowns.fireball).toBe(123);expect(restored.skills[0].damage).toBe(88);expect(restored.stats.hp).toBe(1500);});
});
it('validates the whole replacement before any mutation and rejects missing actors',()=>{
 const w=world(),before=w.exportCheckpoint();expect(()=>replaceCombatBuild(w,{stats:{...stats,hp:-1},skills:[skill()]})).toThrow();expect(w.exportCheckpoint()).toEqual(before);expect(()=>replaceCombatBuild(w,{stats,skills:[skill(),skill()]})).toThrow('Duplicate');expect(()=>replaceCombatBuild(w,{stats,skills:[skill()]},'missing')).toThrow('not found');expect(w.exportCheckpoint()).toEqual(before);
});
