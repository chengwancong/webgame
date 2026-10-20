import {expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {snapshotSchema,receiptSchema,validateResponse,type CharacterState} from '../packages/contracts/index.ts';
import {makeGear,resolveBuild} from '../packages/rules/index.ts';
import {collectHexRules,equipHex,unequipHex,makeHexGear} from '../packages/rules/hex-runes.ts';
import {generateGearAffixes} from '../packages/rules/affix-generator.ts';
import {rollInscription} from '../packages/rules/inscriptions.ts';

function player():CharacterState{return {id:randomUUID(),name:'HEX验证',revision:0,build:1,level:30,xp:0,gold:0,material:0,gear:[],equipment:{},skills:[],skillRanks:{},progress:{kills:0,regions:['town'],bosses:[],safe:'town',tasks:[]}};}
it.each(['hex/equip','hex/unequip','dev/hex-grant'])('validates %s with the same receipt contract consumed by the client',path=>{
 const s=player(),gear=makeHexGear('hex-chain-lightning','legendary',randomUUID());s.gear.push(gear);equipHex(s,gear.id,'hex2');
 const receipt=receiptSchema.parse({command_id:randomUUID(),revision:1,delta:{gold:0,xp:0,material:0},rewards:[],snapshot:{...s,revision:1,...resolveBuild(s),rewards:[],capacity:60}});
 expect(validateResponse(path,receipt)).toEqual(receipt);
 expect(()=>validateResponse(path,{ok:true})).toThrow();
});
it('keeps old saves empty and preserves both HEX slot IDs through snapshot validation',()=>{
 const schema=snapshotSchema.shape.equipment;
 expect(schema.parse({})).toEqual({});
 const state={hex1:randomUUID(),hex2:randomUUID()};expect(schema.parse(state)).toEqual(state);
 expect(schema.safeParse({hex1:null}).success).toBe(false);
});
it('equips, moves and removes the sample without duplicating its resolved rules or adding primary stats',()=>{
 const s=player(),g=makeHexGear('hex-chain-lightning','common',randomUUID());s.gear.push(g);
 const before=resolveBuild(s).stats;
 equipHex(s,g.id,'hex1');
 const after=resolveBuild(s).stats;
 expect(after.rules?.find(r=>r.id==='hex-chain-lightning-c')?.source).toBe(g.id);
 expect(after.attack).toBe(before.attack);expect(after.armor).toBe(before.armor);
 equipHex(s,g.id,'hex2');expect(s.equipment.hex1).toBeUndefined();expect(s.equipment.hex2).toBe(g.id);
 expect(collectHexRules(s)).toHaveLength(1);
 unequipHex(s,'hex2');expect(collectHexRules(s)).toEqual([]);
 expect(resolveBuild(s).stats.rules?.some(r=>r.id.startsWith('hex-'))??false).toBe(false);
 expect(s.gear).toEqual([g]);
});
it('rejects duplicate mechanisms, low level, ordinary gear and invalid slots without partial mutations',()=>{
 const s=player(),a=makeHexGear('hex-chain-lightning','common',randomUUID()),b=makeHexGear('hex-chain-lightning','magic',randomUUID()),normal=makeGear(0,randomUUID());
 s.gear.push(a,b,normal);equipHex(s,a.id,'hex1');const before=structuredClone(s);
 for(const action of [()=>equipHex(s,b.id,'hex2'),()=>equipHex(s,normal.id,'hex2'),()=>equipHex(s,b.id,'weapon'),()=>unequipHex(s,'weapon')]){
  expect(action).toThrow();expect(s).toEqual(before);
 }
 s.level=1;const low=structuredClone(s);expect(()=>equipHex(s,b.id,'hex1')).toThrow();expect(s).toEqual(low);
});
it('replaces an occupied slot without losing either item or allowing affix and inscription rolls',()=>{
 const s=player(),a=makeHexGear('hex-chain-lightning','common',randomUUID()),b=makeHexGear('hex-chain-lightning','magic',randomUUID());s.gear.push(a,b);
 equipHex(s,a.id,'hex1');equipHex(s,b.id,'hex1');expect(s.equipment.hex1).toBe(b.id);expect(s.gear).toHaveLength(2);
 const noRandom={int:()=>{throw Error('Unexpected RNG');},float:()=>{throw Error('Unexpected RNG');}};
 expect(generateGearAffixes(b,3,noRandom)).toEqual([]);expect(rollInscription(b,noRandom)).toBeUndefined();
});
