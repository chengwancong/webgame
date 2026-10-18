import {it,expect} from 'vitest';
import {World,distance} from '../packages/simulation/index.ts';
import {regionById,skillCatalog} from '../packages/content/index.ts';
import type {Stats,Spawn,Skill} from '../packages/contracts/index.ts';
import {applyAffixBonuses} from '../packages/simulation/set-calculator.ts';
import {makeGear} from '../packages/rules/index.ts';
const stats:Stats={hp:300,attack:20,armor:0,speed:6,mana:100,regen:0,effects:[]};
const spawn:Spawn={id:'target',kind:'guard',name:'target',x:8,y:8,hp:1000,attack:20,elite:false,boss:false,art:'raider'};
function setup(extra:Partial<Stats>={},skill:Skill={...skillCatalog.find(s=>s.id==='cut')!,damage:100,windup:0}){const w=new World(regionById('meadow'),{...stats,...extra},[skill],[spawn],[],11);w.hero.position={x:7,y:8};w.setMode('manual');w.enemies[0].cooldown=999;return w;}
it('a critical-damage affix improves the real default critical hit instead of lowering it',()=>{
 const gear=makeGear(0,'crit-gear');gear.affixes=[{id:'crit',name:'暴击伤害',stat:'critMultiplier',value:.2,tier:3,description:'暴击倍率 +0.2'}];const resolved=applyAffixBonuses(stats,gear);expect(resolved.critMultiplier).toBeCloseTo(1.7);
 const before=setup({critChance:1,penetration:1}),after=setup({...resolved,critChance:1,penetration:1});before.cast('cut');after.cast('cut');before.step();after.step();expect(before.enemies[0].hp).toBe(850);expect(after.enemies[0].hp).toBe(830);
});
it('critical hits, actual-damage lifesteal and guard penetration execute deterministically',()=>{
 const w=setup({critChance:1,critMultiplier:2,lifesteal:.15,penetration:1});w.hero.hp=100;w.cast('cut');w.step();expect(w.enemies[0].hp).toBe(800);expect(w.hero.hp).toBe(130);
 const plain=setup();plain.cast('cut');plain.step();expect(plain.enemies[0].hp).toBe(905);
 const overkill=setup({lifesteal:.5});overkill.enemies[0].hp=10;overkill.hero.hp=100;overkill.cast('cut');overkill.step();expect(overkill.hero.hp).toBe(105);
 const execute=setup({executeBonus:1,executeThreshold:.2,penetration:1});execute.enemies[0].hp=200;execute.cast('cut');execute.step();expect(execute.enemies[0].hp).toBe(0);
});
it('dodge preserves shields and cooldown reduction applies once with a safe cap',()=>{
 const w=setup({dodge:1,cdr:.5}),skill=w.skills[0];w.hero.shield=10;w.hero.shieldUntil=999;w.enemies[0].cooldown=0;w.cast(skill.id);expect(w.cooldowns[skill.id]).toBe(Math.round(skill.cooldown*.5));for(let i=0;i<60;i++)w.step();expect(w.hero.hp).toBe(stats.hp);expect(w.hero.shield).toBe(10);
});
it('multi-shot emits distinct fan trajectories and pull respects physical contact',()=>{
 const bolt={...skillCatalog.find(s=>s.id==='bolt')!,windup:0,projectiles:5,projectileSpread:.18};const w=setup({},bolt);w.enemies[0].position={x:12,y:8};expect(w.cast('bolt')).toBe(true);w.step();expect(w.projectiles).toHaveLength(5);expect(new Set(w.projectiles.map(p=>p.direction.y)).size).toBe(5);
 const whirl={...skillCatalog.find(s=>s.id==='whirl')!,windup:0,pull:1.5,radius:6};const pulled=setup({},whirl);pulled.enemies[0].position={x:10,y:8};const before=distance(pulled.hero.position,pulled.enemies[0].position);pulled.cast('whirl');pulled.step();expect(distance(pulled.hero.position,pulled.enemies[0].position)).toBeLessThan(before-1);expect(distance(pulled.hero.position,pulled.enemies[0].position)).toBeGreaterThan(.8);
});
