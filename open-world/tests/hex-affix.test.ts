import {expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {gearSchema,snapshotSchema,type Gear,type CharacterState,type GearQuality} from '../packages/contracts/index.ts';
import {gearSlots} from '../packages/contracts/gear-slots.ts';
import {hexStateSchema} from '../packages/contracts/hex-runes.ts';
import {collectHexRules,resolveHexActive,hexEquipmentOrder} from '../packages/rules/hex-runes.ts';
import {hexRuneById} from '../packages/content/hex-runes.ts';
export function affixed(slot:typeof hexEquipmentOrder[number],rune:string,tier:GearQuality='common'):Gear{
 return gearSchema.parse({id:randomUUID(),base:slot==='weapon'?'blade':'cloth',name:'controlled gear',slot,origin:{kind:'random'},quality:'rare',attack:slot==='weapon'?10:0,armor:slot==='weapon'?0:5,effect:'none',rank:0,locked:false,affixes:[],requiredLevel:20,hex:{rune,tier}});
}
export function affixPlayer(gear:Gear[]):CharacterState{
 return {id:randomUUID(),name:'D13 controlled',revision:0,build:1,level:30,xp:0,gold:0,material:0,gear,equipment:Object.fromEntries(gear.map(g=>[g.slot,g.id])),skills:[],skillRanks:{},progress:{kills:0,regions:[],bosses:[],safe:'town',tasks:[]}};
}
it('exposes ordinary slots, optional gear HEX and pity state, not the removed socket/offer contract',()=>{
 expect(gearSlots).toEqual(['weapon','armor','helmet','boots','accessory','ring','core']);
 expect(Object.keys(snapshotSchema.shape.equipment.shape)).toEqual(gearSlots);
 expect(snapshotSchema.shape).not.toHaveProperty('hexSlotAccess');
 expect(snapshotSchema.shape).toHaveProperty('hexActive');
 expect(hexStateSchema.parse({awardedTasks:[],pity:{q01:true}})).toEqual({awardedTasks:[],pity:{q01:true}});
 expect(hexStateSchema.safeParse({awardedTasks:[],shards:20,offers:[]}).success).toBe(false);
 const g=affixed('weapon','hex-aftershock','magic');
 expect(gearSchema.parse(g).hex).toEqual(g.hex);
 for(const extra of [{slot:'core'},{quality:'common'},{origin:{kind:'stage-key',scope:'stage:1',key:'main'}},{origin:undefined},{slot:'hex1'}])expect(gearSchema.safeParse({...g,...extra}).success).toBe(false);
});
it('keeps both items wearable but activates only highest tier, tie-breaking by the six-slot order',()=>{
 const a=affixed('weapon','hex-aftershock'),b=affixed('armor','hex-aftershock','magic'),s=affixPlayer([a,b]);
 expect(resolveHexActive(s)).toEqual([{gear:a.id,rune:a.hex!.rune,tier:'common',active:false,reason:'duplicate'},{gear:b.id,rune:b.hex!.rune,tier:'magic',active:true}]);
 expect(collectHexRules(s).map(r=>r.source)).toEqual([b.id]);
 b.hex!.tier='common';expect(resolveHexActive(s).map(r=>r.active)).toEqual([true,false]);
 expect(s.gear).toHaveLength(2);expect(s.equipment.armor).toBe(b.id);
});
it('executes six distinct equipped mechanisms and ignores a HEX in the bag or old socket keys',()=>{
 const names=['hex-aftershock','hex-detonation-sigil','hex-footfall-heal','hex-control-to-shield','hex-cast-hit-relay','hex-bee-volley'];
 const s=affixPlayer(names.map((r,i)=>affixed(hexEquipmentOrder[i],r,'magic'))),before=structuredClone(s);
 expect(resolveHexActive(s).filter(r=>r.active)).toHaveLength(6);
 expect(new Set(collectHexRules(s).map(r=>r.source)).size).toBe(6);
 expect(s).toEqual(before);
 const extra=affixed('weapon','hex-void-rift');s.gear.push(extra);s.equipment.hex1=extra.id;
 expect(resolveHexActive(s).some(r=>r.gear===extra.id)).toBe(false);
});
it('D13 section6 uses two distinct active mechanisms for one resonance and duplicates never add another tier',()=>{
 const s=affixPlayer([affixed('weapon','hex-aftershock'),affixed('armor','hex-void-rift'),affixed('helmet','hex-aftershock','magic')]);
 const active=resolveHexActive(s).filter(r=>r.active);expect(active).toHaveLength(2);
 expect(active.map(r=>r.resonance)).toEqual([1.1,1.1]);
 expect(collectHexRules(s).find(r=>r.action.type==='nova')!.action).toMatchObject({ratio:.385});
 expect(collectHexRules(s).find(r=>r.action.type==='field')!.action).toMatchObject({ratio:.1375});
 delete s.equipment.armor;
 expect(resolveHexActive(s).filter(r=>r.active)).toHaveLength(1);
 expect(resolveHexActive(s).some(r=>r.resonance)).toBe(false);
 expect(collectHexRules(s)[0].action).toMatchObject({ratio:.35});
});
it('D13 section8 retains under-level affixes, permits a lower usable duplicate, and activates the higher tier on level-up',()=>{
 const a=affixed('weapon','hex-aftershock'),b=affixed('armor','hex-aftershock','magic');
 a.requiredLevel=10;b.requiredLevel=10;a.ilvl=15;b.ilvl=15;
 const s=affixPlayer([a,b]);s.level=14;
 expect(resolveHexActive(s)).toEqual([{gear:a.id,rune:a.hex!.rune,tier:'common',active:true},{gear:b.id,rune:b.hex!.rune,tier:'magic',active:false,reason:'level'}]);
 const before=structuredClone(s.gear);s.level=15;
 expect(resolveHexActive(s).map(r=>({active:r.active,reason:r.reason}))).toEqual([{active:false,reason:'duplicate'},{active:true,reason:undefined}]);
 expect(s.gear).toEqual(before);expect(b.requiredLevel).toBe(10);
});
