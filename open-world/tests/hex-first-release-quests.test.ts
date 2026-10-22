// @ts-nocheck
// Retired D11/D12 socket/choice specifications. D13 explicitly removed this
// protocol. Kept for history; current acceptance is tests/hex-affix*.test.ts.
import {it as historicalIt,expect} from 'vitest';
const it=historicalIt.skip;
import {randomUUID} from 'node:crypto';
import type {CharacterState,Receipt} from '../packages/contracts/index.ts';
import {newStarseaState,applyStarseaOp,recordStarseaKill,recordHexInventoryFacts,starseaView} from '../packages/rules/starsea.ts';
import {hexSlotAccess,makeHexGear,equipHex} from '../packages/rules/hex-runes.ts';
import {grantHexQuestRewards,chooseHexReward} from '../apps/api/src/hex-rewards.ts';
import {questEligible} from '../packages/rules/quest-conditions.ts';
import {resolveNpcPhase} from '../packages/rules/world-phase.ts';
import {npcPositions} from '../packages/content/task-tables.ts';
const mist='ss-map-mist',port='ss-map-port';
export function hexQuestPlayer():CharacterState{
 const s:CharacterState={id:randomUUID(),name:'D12 controlled',revision:0,build:1,level:15,xp:0,gold:0,material:0,gear:[],equipment:{},skills:['cut','whirl'],skillRanks:{cut:1,whirl:1},progress:{kills:0,regions:[port,mist],bosses:[],safe:port,tasks:[]},starsea:newStarseaState()};
 Object.assign(s.starsea!,{quests:{},tracked:null,islands:['ss-map-wind',mist],discovered:['ow-mist-z2'],npcs:['ss-npc-qingmang','ss-npc-tongling'],prologue:{done:true}});
 return s;
}
const delta=():Receipt['delta']=>({gold:0,xp:0,material:0});
it('D12 formal quest source executes kill -> actual obtain -> talk -> equip -> boss -> return, and grants once',()=>{
 const s=hexQuestPlayer(),st=s.starsea!;
 const old=makeHexGear('hex-aftershock','common',randomUUID());s.gear.push(old);
 expect(hexSlotAccess(s).hex1.unlocked).toBe(false);expect(()=>equipHex(s,old.id,'hex1')).toThrow('引导');
 expect(questEligible(s,'HEX-Q02')).toBe(false);expect(questEligible(s,'HEX-Q03')).toBe(false);
 applyStarseaOp(s,'accept',{task:'HEX-Q01',region:mist,now:1});
 expect(()=>applyStarseaOp(s,'interact',{task:'HEX-Q01',region:mist,target:'kill:z2_invader'})).toThrow();
 recordStarseaKill(s,mist,'other-zone',false,undefined,{x:235,y:331});
 expect(st.quests['HEX-Q01'].step).toBe(0);
 for(let i=0;i<12;i++)recordStarseaKill(s,mist,'invader-'+i,false,undefined,{x:137,y:331});
 expect(st.quests['HEX-Q01'].step).toBe(1);
 recordHexInventoryFacts(s,new Set(s.gear.map(g=>g.id)));expect(st.quests['HEX-Q01'].step).toBe(1);
 const before=new Set(s.gear.map(g=>g.id));s.gear.push(makeHexGear('hex-footfall-heal','common',randomUUID()));
 recordHexInventoryFacts(s,before);expect(st.quests['HEX-Q01'].step).toBe(2);
 expect(s.hex).toBeUndefined();
 applyStarseaOp(s,'talk',{task:'HEX-Q01',region:mist,target:'npc:ss-npc-qingmang'});
 expect(hexSlotAccess(s).hex1.unlocked).toBe(true);expect(hexSlotAccess(s).hex2.unlocked).toBe(false);
 const d=delta();grantHexQuestRewards(s,d);const offer=s.hex!.offers[0];
 expect(offer.candidates).toHaveLength(4);expect(new Set(offer.candidates.map(c=>c.playstyle)).size).toBe(4);
 const frozen=structuredClone(s.hex);grantHexQuestRewards(s,d);expect(s.hex).toEqual(frozen);
 const picked=offer.candidates.find(c=>c.playstyle==='贴身绞杀')!,gear=chooseHexReward(s,offer.id,picked.id);
 equipHex(s,gear.id,'hex1');expect(()=>equipHex(s,gear.id,'hex2')).toThrow('引导');
 applyStarseaOp(s,'accept',{task:'HEX-Q02',region:port,now:2});
 expect(st.quests['HEX-Q02'].step).toBe(1);
 recordStarseaKill(s,'ss-map-boss-2','mist-boss',true);
 expect(st.quests['HEX-Q02'].step).toBe(2);
 applyStarseaOp(s,'talk',{task:'HEX-Q02',region:port,target:'npc:ss-npc-tongling'});
 expect(st.done).toEqual(expect.arrayContaining(['HEX-Q01','HEX-Q02','HEX-Q03']));
 expect(hexSlotAccess(s).hex2.unlocked).toBe(true);grantHexQuestRewards(s,d);
 expect(s.hex!.shards).toBe(20);expect(s.hex!.offers.find(o=>o.task==='HEX-Q03')!.candidates).toHaveLength(3);
 expect(new Set(s.hex!.offers.find(o=>o.task==='HEX-Q03')!.candidates.map(c=>c.playstyle)).size).toBe(3);
 expect(st.completion!.text).toContain('石板响');expect(st.completion!.text).toContain('稀有');
 const end=structuredClone(s);grantHexQuestRewards(s,delta());expect(s).toEqual(end);
 expect(()=>chooseHexReward(s,offer.id,picked.id)).toThrow('已经选取');
});
it('D12 priority displays one Qingmang, preserves old rows and restores them after completion/reload',()=>{
 const s=hexQuestPlayer(),original=structuredClone(npcPositions);
 const shown=resolveNpcPhase(s,npcPositions).filter(n=>n.npc==='ss-npc-qingmang');
 expect(shown).toEqual([{npc:'ss-npc-qingmang',map:mist,x:131,y:339,priority:100}]);
 expect(starseaView(s)!.npcPositions.filter(n=>n.npc==='ss-npc-qingmang')).toEqual([{npc:'ss-npc-qingmang',map:mist,x:131,y:339}]);
 const duplicate=npcPositions.find(n=>n.id==='hex-q01-qingmang')!;
 expect(()=>resolveNpcPhase(s,[...npcPositions,{...duplicate,id:'duplicate'}])).toThrow('同时命中');
 s.starsea!.done.push('HEX-Q01');
 expect(resolveNpcPhase(s,npcPositions).some(n=>n.priority===100)).toBe(false);
 expect(resolveNpcPhase(JSON.parse(JSON.stringify(s)),npcPositions)).toEqual(resolveNpcPhase(s,npcPositions));
 expect(npcPositions).toEqual(original);
});
it('requires level 10 and the island, keeps a one-pick offer immutable after rejected candidates',()=>{
 const s=hexQuestPlayer();s.level=9;expect(questEligible(s,'HEX-Q01')).toBe(false);
 s.level=10;s.starsea!.discovered=[];expect(questEligible(s,'HEX-Q01')).toBe(false);
 s.starsea!.discovered.push('ow-mist-z2');s.starsea!.done.push('HEX-Q01');grantHexQuestRewards(s,delta());
 const before=structuredClone(s);expect(()=>chooseHexReward(s,'HEX-Q01',randomUUID())).toThrow('本次奖励');expect(s).toEqual(before);
});
