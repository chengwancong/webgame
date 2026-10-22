import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {gearSchema,type CharacterState,type Gear} from '../packages/contracts/index.ts';
import {newStarseaState} from '../packages/rules/starsea.ts';
import {freezeHexLoot} from '../apps/api/src/hex-loot.ts';
import {applyHubGateHexGuarantee} from '../apps/api/src/hub-dungeon-hex.ts';
function player():CharacterState{const s:CharacterState={id:randomUUID(),name:'HUB Q03 boundary',revision:0,build:1,level:15,xp:0,gold:0,material:0,gear:[],equipment:{},skills:[],skillRanks:{},progress:{kills:0,regions:[],bosses:[],safe:'ss-map-port',tasks:[]},starsea:newStarseaState(),hex:{awardedTasks:[],pity:{q01:true}}};s.starsea!.done.push('HEX-Q01');return s;}
const gear=(extra:Partial<Gear>={}):Gear=>gearSchema.parse({id:randomUUID(),base:'blade',name:'HUB test carrier',slot:'weapon',quality:'rare',origin:{kind:'random'},attack:10,armor:0,effect:'none',rank:0,locked:false,affixes:[],ilvl:15,requiredLevel:10,...extra});
const context={region:'ss-map-mist',target:'hub-mist-gate'};
it('promotes only the highest fresh common HEX to magic, preserving rune, equipment identity/quality and every unrelated item',()=>{
 const s=player(),old=gear({quality:'legendary'}),highest=gear({hex:{rune:'hex-aftershock',tier:'common'}}),other=gear({quality:'magic'});s.gear=[old,highest,other];const before=structuredClone(s.gear),ids=new Set([highest.id,other.id]);
 const result=applyHubGateHexGuarantee(s,ids,freezeHexLoot()!,context,()=>.99999);expect(result?.gear.id).toBe(highest.id);expect(result?.addedHex).toBe(false);expect(highest).toEqual({...before[1],hex:{rune:'hex-aftershock',tier:'magic'}});expect(old).toEqual(before[0]);expect(other).toEqual(before[2]);expect(s.hex!.pity).toMatchObject({q03:true,q03Pending:false});
 const settled=structuredClone(s);expect(applyHubGateHexGuarantee(s,ids,freezeHexLoot()!,context,()=>0)).toBeUndefined();expect(s).toEqual(settled);
});
it('uses the existing random magic guarantee for a fresh plain carrier and never downgrades an already magic rune',()=>{
 const s=player(),plain=gear();s.gear=[plain];expect(applyHubGateHexGuarantee(s,new Set([plain.id]),freezeHexLoot()!,context,()=>0)?.addedHex).toBe(true);expect(plain.hex?.tier).toBe('magic');
 const second=player(),magic=gear({hex:{rune:'hex-aftershock',tier:'magic'}}),before=structuredClone(magic);second.gear=[magic];expect(applyHubGateHexGuarantee(second,new Set([magic.id]),freezeHexLoot()!,context,()=>.99999)?.addedHex).toBe(false);expect(magic).toEqual(before);expect(second.hex!.pity!.q03).toBe(true);
});
