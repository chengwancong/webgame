import {expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {gearSchema,type CharacterState,type Gear} from '../packages/contracts/index.ts';
import {newStarseaState} from '../packages/rules/starsea.ts';
import {attachHexAffixes,freezeHexLoot,type HexAffixSource} from '../apps/api/src/hex-loot.ts';
function player(pity=true):CharacterState{
 const s:CharacterState={id:randomUUID(),name:'D13 controlled',revision:0,build:1,level:15,xp:0,gold:0,material:0,gear:[],equipment:{},skills:[],skillRanks:{},progress:{kills:0,regions:[],bosses:[],safe:'town',tasks:[]},starsea:newStarseaState(),hex:{awardedTasks:[],pity:{q01:pity}}};
 s.starsea!.quests={'HEX-Q01':{step:0,attempt:0,acceptedAt:1}};return s;
}
const gear=(extra:Partial<Gear>={}):Gear=>gearSchema.parse({id:randomUUID(),base:'blade',name:'controlled',slot:'weapon',quality:'magic',origin:{kind:'random'},attack:10,armor:0,effect:'none',rank:0,locked:false,affixes:[],requiredLevel:15,...extra});
const source=(kind:HexAffixSource['kind'],extra:Partial<HexAffixSource>={}):HexAffixSource=>({kind,region:'ss-map-mist',...extra});
it('Q01 guarantees the first eligible random carrier once and never adds another gear object',()=>{
 const s=player(false),p=freezeHexLoot()!,items=[gear()];
 expect(attachHexAffixes(s,items,source('elite'),p,()=>.999999)).toEqual(items);
 expect(items).toHaveLength(1);expect(items[0].hex?.tier).toBe('common');expect(s.hex!.pity!.q01).toBe(true);
 const second=gear();expect(attachHexAffixes(s,[second],source('elite'),p,()=>.999999)).toEqual([]);
 const before=structuredClone(items[0]);expect(attachHexAffixes(s,items,source('elite'),p,()=>0)).toEqual([]);expect(items[0]).toEqual(before);
});
it('does not spend guarantees on normal kills, white gear, core, stage-key or before accepting Q01',()=>{
 const s=player(false),p=freezeHexLoot()!;
 for(const item of [gear({quality:'common'}),gear({slot:'core'}),gear({origin:{kind:'stage-key',scope:'stage:1',key:'test'}})]){
  expect(attachHexAffixes(s,[item],source('elite'),p,()=>0)).toEqual([]);expect(item.hex).toBeUndefined();
 }
 expect(attachHexAffixes(s,[gear()],source('normal'),p,()=>0)).toEqual([]);expect(s.hex!.pity!.q01).toBe(false);
 s.starsea!.quests={};expect(attachHexAffixes(s,[gear()],source('elite'),p,()=>0)).toEqual([]);
 s.starsea!.done.push('HEX-Q01');expect(attachHexAffixes(s,[gear()],source('elite'),p,()=>.999999)).toEqual([]);
});
it('uses converted probabilities and actual gear-level caps with prerequisite filtering',()=>{
 const s=player(),p=freezeHexLoot()!,context=source('elite');
 let i=0;const item=gear();expect(attachHexAffixes(s,[item],context,p,()=>i++?0:p.sources.elite-1e-8)).toHaveLength(1);
 expect(attachHexAffixes(s,[gear()],context,p,()=>p.sources.elite)).toEqual([]);
 const low=gear({requiredLevel:10});expect(attachHexAffixes(s,[low],source('dungeonBoss',{target:'field-mist-1'}),p,()=>0)).toHaveLength(1);expect(low.hex?.tier).toBe('common');
 const magic=gear();expect(attachHexAffixes(s,[magic],source('dungeonBoss',{target:'field-mist-1'}),p,()=>0)).toHaveLength(1);expect(magic.hex?.tier).toBe('magic');
 const disallowed=new Set(['hex-detonation-sigil','hex-control-to-shield']);
 expect(disallowed.has(item.hex!.rune)).toBe(false);expect(disallowed.has(magic.hex!.rune)).toBe(false);
 expect(attachHexAffixes(s,[gear()],source('rare',{target:'unknown'}),p,()=>0)).toEqual([]);
 const staged=gear({requiredLevel:10,ilvl:15});
 expect(attachHexAffixes(s,[staged],source('dungeonBoss',{target:'field-mist-1'}),p,()=>0)).toHaveLength(1);
 expect(staged.hex?.tier).toBe('magic');expect(staged.requiredLevel).toBe(10);
});
it('Q03 attaches magic only to the highest eligible carrier and persists one-time use through reload',()=>{
 const s=player(),p=freezeHexLoot()!;s.starsea!.quests={};s.starsea!.done=['HEX-Q01'];
 const items=[gear({quality:'magic'}),gear({quality:'rare'}),gear({quality:'legendary'})];
 expect(attachHexAffixes(s,items,source('mistBoss',{region:'ss-map-boss-2',first:true}),p,()=>0)).toEqual([items[2]]);
 expect(items.filter(g=>g.hex)).toHaveLength(1);expect(items[2].hex?.tier).toBe('magic');
 const restored=JSON.parse(JSON.stringify(s));
 expect(attachHexAffixes(restored,[gear()],source('mistBoss',{first:true}),p,()=>0)).toEqual([]);
});
it('v1 frozen encounters cannot emit standalone runes through the v2 attachment path',()=>{
 const p=freezeHexLoot()!;p.version=1;
 expect(attachHexAffixes(player(false),[gear()],source('elite'),p,()=>0)).toEqual([]);
});
it('D13-9: first-boss magic satisfies both outstanding guarantees on one carrier',()=>{
 const s=player(false),p=freezeHexLoot()!,g=gear({quality:'rare'});
 expect(attachHexAffixes(s,[g],source('mistBoss',{first:true}),p,()=>0)).toEqual([g]);
 expect(g.hex?.tier).toBe('magic');expect(s.hex!.pity).toMatchObject({q01:true,q03:true,q03Pending:false});
 expect(attachHexAffixes(s,[gear()],source('elite'),p,()=>.999999)).toEqual([]);
});
it('D13-10: excluded first-boss carriers retain magic pity across reload until a qualified random drop',()=>{
 const s=player(false),p=freezeHexLoot()!;
 expect(attachHexAffixes(s,[gear({slot:'core'})],source('mistBoss',{first:true}),p,()=>0)).toEqual([]);
 expect(s.hex!.pity).toMatchObject({q01:false,q03Pending:true});expect(s.hex!.pity!.q03).toBeUndefined();
 const restored=JSON.parse(JSON.stringify(s));
 expect(attachHexAffixes(restored,[gear()],source('normal'),p,()=>0)).toEqual([]);
 expect(attachHexAffixes(restored,[gear({origin:{kind:'stage-key',scope:'stage:1',key:'test'}})],source('elite'),p,()=>0)).toEqual([]);
 const next=gear();expect(attachHexAffixes(restored,[next],source('event'),p,()=>.999999)).toEqual([next]);
 expect(next.hex?.tier).toBe('magic');expect(restored.hex.pity).toMatchObject({q01:true,q03:true,q03Pending:false});
});
