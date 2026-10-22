import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {groundLootLabel,lootPillar} from '../apps/web/src/ground-loot.ts';
it('prefixes HEX gear with a diamond and keeps the truncation rule',()=>{
 expect(groundLootLabel({name:'穿云弓'})).toEqual({short:'穿云弓',full:'穿云弓'});
 expect(groundLootLabel({name:'穿云弓',hex:{rune:'r1',tier:'common'}},'迅捷')).toEqual({short:'◆穿云弓',full:'◆穿云弓·迅捷'});
 expect(groundLootLabel({name:'一二三四五六七',hex:{rune:'r1',tier:'magic'}}).short).toBe('◆一二三四五…');
 expect(groundLootLabel({name:'一二三四五六七'}).short).toBe('一二三四五…');
 expect(groundLootLabel({name:'穿云弓',hex:{rune:'r1',tier:'common'}}).full).toBe('◆穿云弓·r1');
});
it('gives common/magic HEX drops a short beam and keeps rare/legendary beams',()=>{
 expect(lootPillar('common',true)).toEqual({height:90,life:1200});
 expect(lootPillar('magic',false)).toBeUndefined();
 expect(lootPillar('rare',false)).toEqual({height:120,life:1500});
 expect(lootPillar('legendary',true)).toEqual({height:170,life:2200});
});
it('draws no ground halo under HEX drops (AGENTS: no base ring) while keeping prefix and beam',()=>{
 const src=readFileSync(new URL('../apps/web/src/ground-loot-renderer.ts',import.meta.url),'utf8');
 expect(src).not.toMatch(/halo/i);
 expect(src).toContain('lootPillar(d.quality,!!d.hex)');
 expect(groundLootLabel({name:'穿云弓',hex:{rune:'r1',tier:'common'}}).short.startsWith('◆')).toBe(true);
 expect(lootPillar('common',true)).toBeDefined();
});
