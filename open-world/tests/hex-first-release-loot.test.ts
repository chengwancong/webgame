// @ts-nocheck
// Retired D11/D12 socket/choice specifications. D13 explicitly removed this
// protocol. Kept for history; current acceptance is tests/hex-affix*.test.ts.
import {it as historicalIt,expect} from 'vitest';
const it=historicalIt.skip;
import {randomUUID} from 'node:crypto';
import type {CharacterState} from '../packages/contracts/index.ts';
import {newStarseaState} from '../packages/rules/starsea.ts';
import {freezeHexLoot,rollHexLoot,type HexLootSource} from '../apps/api/src/hex-loot.ts';
import {hexRuneById} from '../packages/content/hex-runes.ts';
function player():CharacterState{
 const s:CharacterState={id:randomUUID(),name:'loot audit',revision:0,build:1,level:15,xp:0,gold:0,material:0,gear:[],equipment:{},skills:[],skillRanks:{},progress:{kills:0,regions:[],bosses:[],safe:'town',tasks:[]},starsea:newStarseaState()};
 s.starsea!.quests={'HEX-Q01':{step:0,attempt:0,acceptedAt:1}};return s;
}
const source=(kind:HexLootSource['kind'],extra:Partial<HexLootSource>={}):HexLootSource=>({kind,region:'ss-map-mist',...extra});
it('gates before quest acceptance, outside Mist, normal kills, and undeclared rare/dungeon sources',()=>{
 const s=player(),p=freezeHexLoot()!,rng=()=>0;
 expect(rollHexLoot(s,source('normal'),p,rng)).toBeUndefined();
 delete s.starsea!.quests['HEX-Q01'];expect(rollHexLoot(s,source('elite'),p,rng)).toBeUndefined();
 s.starsea!.done.push('HEX-Q01');expect(rollHexLoot(s,source('elite'),p,rng)).toBeDefined();
 expect(rollHexLoot(s,source('elite',{region:'ss-map-wind'}),p,rng)).toBeUndefined();
 expect(rollHexLoot(s,source('rare',{target:'other'}),p,rng)).toBeUndefined();
 expect(rollHexLoot(s,source('dungeonBoss',{target:'nightmare'}),p,rng)).toBeUndefined();
});
it.each([['elite',.025,false],['event',.06,false],['event',.12,true],['dungeonChest',.10,false]] as const)('uses the exact D11 %s boundary %s first=%s',(kind,chance,first)=>{
 const s=player(),p=freezeHexLoot()!,context=source(kind,{target:'field-mist-1',first});
 let call=0;expect(rollHexLoot(s,context,p,()=>call++===0?chance-1e-8:0)).toBeDefined();
 expect(rollHexLoot(s,context,p,()=>chance)).toBeUndefined();
});
it('never selects an unmet prerequisite and upgrades only at level 13 within the +2 quality cap',()=>{
 const s=player(),p=freezeHexLoot()!,context=source('rare',{target:'ow-mist-rare1'});
 for(let n=0;n<100;n++){let index=0;const result=rollHexLoot(s,context,p,()=>index++?n/100:0)!;expect(hexRuneById.get(result.base)!.prereq).toBeUndefined();}
 s.level=12;expect(rollHexLoot(s,context,p,()=>0)!.quality).toBe('common');
 s.level=13;expect(rollHexLoot(s,context,p,()=>0)!.quality).toBe('magic');
 s.level=7;expect(rollHexLoot(s,source('elite'),p,()=>0)).toBeUndefined();
});
it('freezes independent private copies rather than mutable live source objects',()=>{
 const p=freezeHexLoot()!;p.sources.elite=1;
 expect(freezeHexLoot()!.sources.elite).toBe(.025);
 expect(freezeHexLoot()!.biasWeight).toBe(3);
});
