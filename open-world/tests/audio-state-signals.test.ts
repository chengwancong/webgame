import {test,expect} from 'vitest';
import {StateAudioSignals} from '../apps/web/src/audio/state-signals.ts';
import {forgeFailureSound,receiptSound,forgeWorkingSound,inscriptionSound,SoundGate} from '../apps/web/src/audio/receipt-sounds.ts';
import {wiredSamples} from '../apps/web/src/audio/sample-bank.ts';
test('状态音只响应已确认的新事实，重放与初次恢复不发奖音',()=>{const audio=new StateAudioSignals(),snapshot:any={id:'hero',revision:1,starsea:{done:[],gates:[],rumors:[],waypoints:[],discovered:[],quests:{q:{step:0}},fieldFacts:{open_chest:[]}}};expect(audio.consume(snapshot)).toEqual([]);snapshot.revision++;snapshot.starsea.rumors.push('clue');snapshot.starsea.gates.push('gate');snapshot.starsea.quests.q.step++;expect(audio.consume(snapshot)).toEqual(expect.arrayContaining(['stinger/clue','world/gate-open','world/quest-progress']));expect(audio.consume(snapshot)).toEqual([]);snapshot.revision++;snapshot.starsea.done.push('q');expect(audio.consume(snapshot)).toContain('stinger/quest-complete');});
test('声望只读服务端rank；宝箱只对未领取到已领取转换播放',()=>{const audio=new StateAudioSignals(),view:any={revision:1,sections:[{id:'reputation',items:[{id:'wind',rank:1}]}]},dungeon:any={id:'one',status:'running',chests:[{id:'c',claimed:false}]};expect(audio.consume(undefined,view,dungeon)).toEqual(['world/dungeon-enter']);view.revision++;view.sections[0].items[0].rank=2;dungeon.chests[0].claimed=true;expect(audio.consume(undefined,structuredClone(view),dungeon)).toEqual(expect.arrayContaining(['stinger/reputation-up','cue/chest-open','cue/chest-reward']));expect(audio.consume(undefined,structuredClone(view),dungeon)).toEqual([]);});
test('AUDIO-W01：新增世界音随确认事实触发，金币250ms内合并，锻造拒绝才播失败音',()=>{const audio=new StateAudioSignals(),snap:any={id:'h',revision:1,gold:100,starsea:{done:[],gates:[],rumors:[],waypoints:[],discovered:[],quests:{},fieldFacts:{open_chest:[]}}};expect(audio.consume(snap,undefined,undefined,0)).toEqual([]);snap.revision++;snap.gold=150;snap.starsea.done.push('q');snap.starsea.discovered.push('d');snap.starsea.fieldFacts.open_chest.push('c');expect(audio.consume(snap,undefined,undefined,1000)).toEqual(expect.arrayContaining(['world/gold-gain','world/quest-complete','world/discovery','world/chest-open','world/chest-reward']));snap.revision++;snap.gold=120;expect(audio.consume(snap,undefined,undefined,1100)).toEqual([]);snap.revision++;snap.gold=100;expect(audio.consume(snap,undefined,undefined,1300)).toEqual(['world/gold-spend']);expect(forgeFailureSound('gear/upgrade')).toBe('ui/forge-fail');expect(forgeFailureSound('gear/equip')).toBeUndefined();expect(wiredSamples('ui/confirm','one')?.length).toBeGreaterThan(0);for(const k of ['world/quest-complete','world/chest-open','world/chest-reward','world/gold-gain','world/gold-spend','world/discovery','ui/forge-fail'])expect(wiredSamples(k,'one')?.length).toBeGreaterThan(0);});
test('AUDIO-W02/W03：首领狂暴语音有样本；锻造/铭纹/分解/穿戴/通知音按触发点与去抖放行',()=>{
 for(const k of ['voice/meadow-boss','voice/ow-boss-wind-1','voice/dragon_king'])expect(wiredSamples(k,'enrage')?.length).toBeGreaterThan(0);
 expect(wiredSamples('voice/no-such-boss','enrage')).toBeUndefined();
 for(const k of ['forge-working','inscription','salvage-material','equip-cloth','equip-leather','popup','notification','reward-count','reward-end'])expect(wiredSamples('ui/'+k,'one')?.length).toBeGreaterThan(0);
 expect(receiptSound('gear/salvage',{})).toBe('ui/salvage-material');expect(receiptSound('gear/salvage-batch',{})).toBe('ui/salvage-batch');expect(receiptSound('reward/claim-many',{})).toBe('ui/reward-end');
 const gear:Record<string,{name:string;slot:string}>={a:{name:'学徒布袍',slot:'armor'},b:{name:'猎手皮甲',slot:'armor'},c:{name:'精钢胸甲',slot:'armor'},d:{name:'行者之靴',slot:'boots'}};
 expect(['a','b','c','d'].map(id=>receiptSound('gear/equip',{gear_id:id},x=>gear[x]))).toEqual(['ui/equip-cloth','ui/equip-leather','ui/equip-metal','ui/equip-leather']);
 expect(forgeWorkingSound('gear/upgrade')).toBe('ui/forge-working');expect(forgeWorkingSound('crafting/action')).toBe('ui/forge-working');expect(forgeWorkingSound('gear/equip')).toBeUndefined();
 expect(inscriptionSound('gear/salvage',{progression:{materials:{r1:1}}})).toBe('ui/inscription');expect(inscriptionSound('gear/salvage',{})).toBeUndefined();
 const gate=new SoundGate();expect([gate.allow('n',0),gate.allow('n',100),gate.allow('n',500)]).toEqual([true,false,true]);
});
test('AUDIO-W04：foley 受击/命中材质/脚步/闪现有样本，重击阈值与80ms去抖',async()=>{
 const {FoleyGate,hitMaterial,hurtKey}=await import('../apps/web/src/audio/foley-events.ts'),{groundMaterial}=await import('../apps/web/src/audio/footsteps.ts');
 for(const k of ['hurt','hurt-heavy','hit-flesh','hit-metal','hit-stone','hit-spirit','step-metal','step-water','blink'])expect(wiredSamples('foley/'+k,'one')?.length).toBeGreaterThan(0);
 expect(wiredSamples('foley/land','one')).toBeUndefined();
 expect(hurtKey(14,100)).toBe('foley/hurt');expect(hurtKey(15,100)).toBe('foley/hurt-heavy');expect(hurtKey(0,100)).toBe('foley/hurt');
 expect(['beast','machine','dragon-oath','rift','nope'].map(hitMaterial)).toEqual(['flesh','metal','stone','spirit',undefined]);
 expect([groundMaterial('ss-map-forge'),groundMaterial('ss-map-mist'),groundMaterial('ss-map-port'),groundMaterial('ss-map-rift')]).toEqual(['metal','water','wood','stone']);
 const gate=new FoleyGate();expect([gate.allow('a',0),gate.allow('a',1),gate.allow('a',2),gate.allow('a',3),gate.allow('b',3)]).toEqual([true,false,false,true,true]);
});
test('AUDIO-W05：词缀冲击音按词缀+技能映射，事件音有样本，线索同时播 world/clue',async()=>{
 const {affixImpact}=await import('../apps/web/src/audio/foley-events.ts');
 for(const k of ['frost-nova','fire-trail','summon','teleport'])expect(wiredSamples('affix/'+k,'impact')?.length).toBeGreaterThan(0);
 expect(wiredSamples('affix/swift','impact')).toBeUndefined();
 for(const k of ['teleport','return-town','clue','beacon-activate','npc-bubble'])expect(wiredSamples('world/'+k,'one')?.length).toBeGreaterThan(0);
 expect(wiredSamples('amb/travel','loop')?.length).toBeGreaterThan(0);
 expect(affixImpact('frost_nova',['frost_nova'])).toBe('affix/frost-nova');expect(affixImpact('summon_undead',['summon_minions'])).toBe('affix/summon');
 expect(affixImpact('frost_nova',[])).toBeUndefined();expect(affixImpact('frost_nova',undefined)).toBeUndefined();expect(affixImpact('basic-melee',['swift'])).toBeUndefined();
 const audio=new StateAudioSignals(),snap:any={id:'h',revision:1,gold:1,starsea:{done:[],gates:[],rumors:[],waypoints:[],discovered:[],quests:{},fieldFacts:{open_chest:[]}}};audio.consume(snap,undefined,undefined,0);snap.revision++;snap.starsea.rumors.push('r');expect(audio.consume(snap,undefined,undefined,1)).toEqual(expect.arrayContaining(['stinger/clue','world/clue']));
});
