import {it,expect} from 'vitest';
import {World} from '../packages/simulation/index.ts';
import {regionById,skillCatalog} from '../packages/content/index.ts';
import {resolveMonsterSpawn} from '../packages/rules/monster-stats.ts';
import {newDungeonMeasurement,observeDungeonTick,dungeonDiagnostic} from '../apps/api/src/dungeon-diagnostics.ts';
import {dungeonDiagnosticSchema} from '../packages/contracts/dungeons.ts';
it('measures real boss damage and player injury, restores the same measurements, and changes the output target when configured seconds change',()=>{
 const original=regionById('meadow-boss'),template=original.spawns.find(s=>s.boss)!.monster!.template,spawn=resolveMonsterSpawn({id:'diagnostic-boss',template,rank:'boss',level:4,x:31,y:30}),region={...original,width:64,height:64,safe:{x:30,y:30},obstacles:[],spawns:[],landmarks:[]};spawn.hp*=100;
 let world=new World(region,{hp:100000,attack:12,armor:0,speed:6,mana:100,regen:0,effects:[]},[skillCatalog.find(s=>s.id==='cut')!],[spawn],[],41),measure=newDungeonMeasurement(0);world.setMode('manual');const hp=world.hero.hp;
 for(let i=0;i<300;i++){if(i%60===0)world.cast('cut',world.enemies[0]);world.step();observeDungeonTick(measure,world);if(i===149){world=World.restore(world.exportCheckpoint());measure=JSON.parse(JSON.stringify(measure));}}
 expect(measure.bossDamage).toBeGreaterThan(0);expect(measure.taken[world.playerId]).toBeGreaterThan(0);expect(measure.taken[world.playerId]).toBe(hp-world.hero.hp);
 const one=dungeonDiagnostic(measure,world.playerId,100000,30,60),two=dungeonDiagnostic(measure,world.playerId,100000,30,120);dungeonDiagnosticSchema.parse(one);expect(two.requiredDps).toBe(one.requiredDps!/2);expect(two.measuredDps).toBe(one.measuredDps);expect(one.bossRemainingPercent).toBeCloseTo(world.enemies[0].hp/world.enemies[0].maxHp*100);
});
it('does not invent a zero output gap before the character reaches a boss',()=>{const value=dungeonDiagnostic(newDungeonMeasurement(0),'hero',100,30,70);expect(value.dpsGap).toBeNull();expect(value.bossRemainingPercent).toBeNull();expect(value.suggestions.join('')).toContain('还没见到首领');});
