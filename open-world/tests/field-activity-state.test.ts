import {it,expect} from 'vitest';
import {World} from '../packages/simulation/index.ts';
import {regionById,skillCatalog} from '../packages/content/index.ts';
import type {Stats} from '../packages/contracts/index.ts';
const region={...regionById('meadow'),width:64,height:64,safe:{x:30,y:30},obstacles:[],spawns:[]},stats:Stats={hp:1000,attack:100,armor:0,speed:6,mana:1000,regen:0,effects:[]};
it('returns the real actor without healing, preserves remaining cooldowns and rule counters, and leaves prior field enemies at their existing HP',()=>{
 const skill=structuredClone(skillCatalog.find(s=>s.id==='cut')!),spawn={id:'existing-field-member',name:'现有营地成员',kind:'melee' as const,art:'raider',x:31,y:30,hp:500,attack:0,elite:false,boss:false},field=new World(region,stats,[skill],[spawn],[],41),event=new World(region,stats,[skill],[{...spawn,id:'event-member'}],[],73);
 field.enemies[0].hp=400;for(let i=0;i<10;i++)field.step();event.setMode('manual');expect(event.cast(skill.id)).toBe(true);for(let i=0;i<15;i++)event.step();event.hero.hp=123;event.hero.mana=56;event.comboCounts['consumed-lethal-guard']=1;event.effectStats['real-rule']={count:3,damage:42};
 const remaining=event.cooldowns[skill.id]-event.tick,enemyHp=field.enemies[0].hp,enemyWait=field.enemies[0].cooldown-field.tick;field.carrySoloRunState(event);
 expect(field.hero.hp).toBe(123);expect(field.hero.mana).toBe(56);expect(field.cooldowns[skill.id]-field.tick).toBe(remaining);expect(field.comboCounts['consumed-lethal-guard']).toBe(1);expect(field.effectStats['real-rule']).toEqual({count:3,damage:42});expect(field.enemies[0].hp).toBe(enemyHp);expect(field.enemies[0].cooldown-field.tick).toBe(enemyWait);
 expect(World.restore(field.exportCheckpoint()).hero).toEqual(field.hero);
});
it('cannot adopt a party world through the solo encounter transfer',()=>{const solo=new World(region,stats,[],[],[],41),party=new World(region,stats,[],[],[],73);party.addPlayer('party-member',stats,[]);expect(()=>solo.carrySoloRunState(party)).toThrow('party actors');});
