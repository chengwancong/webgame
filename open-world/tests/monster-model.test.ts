// numeric-spine S7：同步最终整数投影；比例/速度专用夹具避开最小生命和防作弊固定下限。
import {it,expect} from 'vitest';
import {monsterContent,resolveMonsterContent} from '../packages/content/monsters.ts';
import {resolveMonsterSpawn,monsterLevelValues} from '../packages/rules/monster-stats.ts';
import {dungeonSpawns} from '../packages/rules/dungeon-build.ts';
import {dungeonContent,resolveDungeonContent} from '../packages/content/dungeons.ts';
import dungeonSource from '../packages/content/dungeons.json';
import {regionById,regions} from '../packages/content/index.ts';
import {World} from '../packages/simulation/index.ts';
import {parseMap} from '../packages/content/tiled.ts';
import meadow from '../packages/content/maps/meadow.json';
const placement={id:'monster-test',template:'raider',level:1,rank:'normal' as const,x:12,y:12};
const stats={hp:1000,attack:20,armor:0,speed:6,mana:100,regen:0,effects:[]};
it('uses the selected template, specified level, rank and difficulty as independent layers',()=>{
 const ordinary=resolveMonsterSpawn(placement),leveled=resolveMonsterSpawn({...placement,level:5}),elite=resolveMonsterSpawn({...placement,rank:'elite'}),hard=resolveMonsterSpawn(placement,monsterContent,{hp:3,attack:2,armor:1});
 // S5/monster-plan.json：按主干TTK/TTD和一刀线重建；层级、档位、难度仍由同一解析器独立折算。
 expect(ordinary.hp).toBe(1);expect(leveled.hp).toBe(1);expect(elite.hp).toBe(3);expect(hard.hp).toBe(1);
 expect(ordinary.attack).toBe(6);expect(leveled.attack).toBe(11);expect(elite.attack).toBe(8);expect(hard.attack).toBe(11);
 expect(hard.monster!.level).toBe(1);expect(hard.monster!.rank).toBe('normal');
});
it('keeps species differences at the same level and does not read the player level',()=>{
 const sample=regionById('tundra').spawns.filter(s=>!s.elite),unique=new Map(sample.map(s=>[s.monster!.template,[s.hp,s.attack]]));
 expect([...unique.values()]).toEqual([[1,11],[1,13],[1,11]]);
 for(const r of regions)for(const s of r.spawns)expect(s.monster?.level).toBeGreaterThan(0);
 expect(monsterLevelValues('campaign',3).hp).toBe(3);
});
it('binds skills and boss behavior independently from presentation artwork',()=>{
 const c=structuredClone(monsterContent);c.templates.find(t=>t.id==='frost_wolf')!.art='raider';c.templates.find(t=>t.id==='dragon_king')!.art='archer';
 const wolf=resolveMonsterSpawn({...placement,template:'frost_wolf',level:5},c),dragon=resolveMonsterSpawn({...placement,template:'dragon_king',level:9,rank:'boss'},c);
 expect(wolf).toMatchObject({art:'raider',monster:{skills:['frost_bite']}});expect(dragon.monster!.bossKey).toBe('dragon_king');
 const w=new World(regionById('dragonbone-boss'),stats,[],[dragon]);expect((w as any).getBossDefinition((w as any).bossKey(w.enemies[0])).id).toBe('ancient_dragon_king');
});
it('uses configured monster armor and penetration while preserving old guard snapshots',()=>{
 // 护甲与旧快照的独立夹具需要承受完整30点输入，不让新一刀线生命截断待验证的减伤量。
 const guard=resolveMonsterSpawn({...placement,template:'guard',level:2});guard.hp=1000;const w=new World(regionById('meadow'),stats,[],[guard]);
 (w as any).damage(w.enemies[0],30);expect(guard.hp-w.enemies[0].hp).toBe(25);
 const piercing=new World(regionById('meadow'),{...stats,penetration:1},[],[guard]);(piercing as any).damage(piercing.enemies[0],30);expect(guard.hp-piercing.enemies[0].hp).toBe(30);
 const recorded=w.exportCheckpoint();delete recorded.data.rules.monsters;delete recorded.data.enemies[0].monster;const old=World.restore(recorded),hp=old.enemies[0].hp;(old as any).damage(old.enemies[0],30);expect(hp-old.enemies[0].hp).toBe(25);
});
it('restores exact actor attributes, health and deaths without recalculating from current configuration',()=>{
 const enemy=resolveMonsterSpawn(placement),w=new World(regionById('meadow'),stats,[],[enemy]);w.enemies[0].hp=0;w.enemies[0].alive=false;
 const saved=w.exportCheckpoint(),restored=World.restore(saved);expect(restored.exportCheckpoint()).toEqual(saved);
 saved.data.enemies[0].monster.ai.speed=-1;expect(()=>World.restore(saved)).toThrow();
});
it('rejects missing map selectors, unknown templates, levels, ranks, skills and malformed curves',()=>{
 for(const p of [{...placement,template:'missing'},{...placement,level:0},{...placement,level:101},{...placement,rank:'unknown'}])expect(()=>resolveMonsterSpawn(p as any)).toThrow();
 const raw=structuredClone(monsterContent);raw.templates[0].skills=['missing'];expect(()=>resolveMonsterContent(raw)).toThrow('Unknown monster skill');
 const map=structuredClone(meadow);map.layers.find(l=>l.name==='spawns')!.objects[0].properties=map.layers.find(l=>l.name==='spawns')!.objects[0].properties.filter(p=>p.name!=='level');expect(()=>parseMap(map)).toThrow();
 const bad=structuredClone(dungeonSource) as any;bad.definitions[0].policy.monsterLevel=101;expect(()=>resolveDungeonContent(bad)).toThrow('Invalid monster level');
});
