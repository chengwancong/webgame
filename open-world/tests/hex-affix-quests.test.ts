import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import type {CharacterState} from '../packages/contracts/index.ts';
import {newStarseaState,applyStarseaOp,recordHexZoneKills,recordHexInventoryFacts,recordStarseaKill,starseaView} from '../packages/rules/starsea.ts';
import {makeGear} from '../packages/rules/index.ts';
import {applyItemPower} from '../packages/rules/item-power.ts';
import {attachHexAffixes,freezeHexLoot} from '../apps/api/src/hex-loot.ts';
import {taskById,stepsByTask} from '../packages/content/task-tables.ts';
import {resolveHexActive} from '../packages/rules/hex-runes.ts';
function actor():CharacterState{
 const s:CharacterState={id:randomUUID(),name:'D13 quest rules',revision:0,build:1,level:15,xp:0,gold:0,material:0,gear:[],equipment:{},skills:['cut','whirl'],skillRanks:{cut:1,whirl:1},progress:{kills:0,regions:['ss-map-wind','ss-map-mist'],bosses:[],safe:'ss-map-port',tasks:[]},starsea:newStarseaState()};
 Object.assign(s.starsea!,{quests:{},tracked:null,islands:['ss-map-wind','ss-map-mist'],discovered:['ow-mist-z2'],prologue:{done:true},npcs:['ss-npc-qingmang','ss-npc-tongling']});return s;
}
it('D13 formal source uses affixed-item facts and only the approved ordinary quest rewards',()=>{
 for(const [id,xp,gold]of [['HEX-Q01',2232,120],['HEX-Q02',3341,160],['HEX-Q03',6121,400]] as const){
  const row=taskById.get(id)!;expect(row.reward_xp).toBe(xp);expect(row.reward_gold).toBe(gold);
  expect(Object.keys(row).some(k=>k.startsWith('reward_hex_'))).toBe(false);
 }
 expect(stepsByTask.get('HEX-Q01')![1].key).toBe('obtain:hex_gear');expect(stepsByTask.get('HEX-Q02')![0].key).toBe('equip:hex_gear');
});
it('server-settled zone kills and actual pickup advance Q01; ordinary equip/boss/return complete Q02/Q03 once',()=>{
 const s=actor(),st=s.starsea!;
 applyStarseaOp(s,'accept',{task:'HEX-Q01',region:'ss-map-mist',now:1});
 const gear=makeGear(0,randomUUID());gear.quality='magic';gear.origin={kind:'random'};applyItemPower(gear,12);
 expect(attachHexAffixes(s,[gear],{kind:'elite',region:'ss-map-mist'},freezeHexLoot(),()=>0)).toEqual([gear]);
 s.gear.push(gear);recordHexInventoryFacts(s,new Set());expect(st.quests['HEX-Q01'].step).toBe(0);
 const kills=Array.from({length:12},(_,i)=>({id:'settled-'+i,position:{x:137,y:331}}));
 recordHexZoneKills(s,'ss-map-mist',[kills[0],kills[0]]);
 expect(st.quests['HEX-Q01'].progress?.['kill:z2_invader']).toBe(1);
 recordHexZoneKills(s,'ss-map-mist',kills.slice(1));expect(st.quests['HEX-Q01'].step).toBe(2);
 const first=applyStarseaOp(s,'talk',{task:'HEX-Q01',region:'ss-map-mist',target:'npc:ss-npc-qingmang'}).gain;
 expect(first.xp).toBe(2232);expect(first.gold).toBe(120);expect(st.done).toContain('HEX-Q01');
 expect(s.hex).not.toHaveProperty('offers');expect(s.hex).not.toHaveProperty('shards');
 applyStarseaOp(s,'accept',{task:'HEX-Q02',region:'ss-map-port',now:2});expect(st.quests['HEX-Q02'].step).toBe(0);
 s.equipment.weapon=gear.id;recordHexInventoryFacts(s,new Set([gear.id]));expect(st.quests['HEX-Q02'].step).toBe(1);
 delete s.equipment.weapon;recordHexInventoryFacts(s,new Set([gear.id]));s.equipment.weapon=gear.id;recordHexInventoryFacts(s,new Set([gear.id]));expect(st.quests['HEX-Q02'].step).toBe(1);
 recordStarseaKill(s,'ss-map-boss-2','boss',true);expect(st.quests['HEX-Q02'].step).toBe(2);
 const end=applyStarseaOp(s,'talk',{task:'HEX-Q02',region:'ss-map-port',target:'npc:ss-npc-tongling'}).gain;
 expect(end.completed.map(c=>c.id)).toEqual(['HEX-Q02','HEX-Q03']);expect(end.xp).toBe(3341+6121);expect(end.gold).toBe(160+400);
 expect(st.completion?.text).toContain('石板响');expect(st.completion?.text).toContain('rare 的印还在更远的地方。这一封送到了，下一封我先替你收着。');
 expect(resolveHexActive(s)[0].active).toBe(true);
 const before=structuredClone(s);expect(()=>applyStarseaOp(s,'talk',{task:'HEX-Q02',region:'ss-map-port',target:'npc:ss-npc-tongling'})).toThrow();expect(s).toEqual(before);
});
it('visiting and Qingmang phase are actual progress, not merely a level-unlocked island',()=>{
 const s=actor();s.starsea!.discovered=[];
 expect(starseaView(s)!.npcPositions.some(n=>n.npc==='ss-npc-qingmang'&&n.x===131&&n.y===339)).toBe(false);
 s.starsea!.discovered.push('ow-mist-z2');
 expect(starseaView(s)!.npcPositions.filter(n=>n.npc==='ss-npc-qingmang')).toEqual([{npc:'ss-npc-qingmang',map:'ss-map-mist',x:131,y:339}]);
 s.starsea!.done.push('HEX-Q01');
 expect(starseaView(s)!.npcPositions.some(n=>n.npc==='ss-npc-qingmang'&&n.x===131&&n.y===339)).toBe(false);
});
