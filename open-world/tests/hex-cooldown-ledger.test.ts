import {expect,it} from 'vitest';
import {World} from '../packages/simulation/index.ts';
import {regionById} from '../packages/content/index.ts';
import {effectRuleSchema,type EffectRule} from '../packages/contracts/effects.ts';
import {skillSchema} from '../packages/contracts/index.ts';
import {importHexCooldownView} from '../packages/simulation/hex-cooldowns.ts';
import {replaceCombatBuild} from '../packages/simulation/replace-build.ts';
function rule(id:string,action:object,extra:object={}):EffectRule{return effectRuleSchema.parse({id:'hex-'+id,hexMechanism:id,source:'gear-'+id,name:id,description:'Controlled D10 boundary; not released content',trigger:'hurt',chance:1,icd:0,vfxKey:'hex/protection',action,...extra});}
function world(rules:EffectRule[]){
 const sk=skillSchema.parse({id:'basic',name:'basic',description:'controlled',kind:'single',damage:100,range:4,radius:0,cooldown:100,cost:0,windup:0,duration:1,mechanics:{damageType:'physical',targeting:'enemy',statuses:[]}});
 const w=new World({...regionById('meadow'),safe:{x:10,y:10},obstacles:[]},{hp:1000,attack:100,armor:0,speed:1,mana:100,regen:0,effects:[],rules},[sk],[{id:'target',name:'target',kind:'melee',x:12,y:10,hp:1000,attack:0,boss:false,elite:false,art:'raider'}],[],41);
 w.mode='manual';w.enemies[0].cooldown=999999;return w;
}
const hurt=(w:World,amount=10)=>(w as any).hurt(amount,'controlled',{category:'direct',damageType:'pure',scaled:true});
it('imports a relative server view without browser wall-clock dependence and never shortens a known cooldown',()=>{
 const ready:Record<string,number>={'hex:known':999};
 importHexCooldownView(ready,30,{observedAt:10000,readyAt:{'hex:new':12000,'hex:known':10010}},500);
 expect(ready).toEqual({'hex:new':75,'hex:known':999});
 expect(()=>importHexCooldownView(ready,30,{observedAt:0,readyAt:{'other':3}})).toThrow();
});
it.each([2,3] as const)('policy v%s: one invulnerability source wins the shared 20s window; base duration and extensions never exceed 8s',version=>{
 const immortal={type:'buff',duration:1000,maxStacks:1,mods:{},flags:{immortal:true}},a=rule('a',immortal),b=rule('b',immortal),w=world([a,b]);w.rules.hexPolicy!.version=version;
 hurt(w);expect(w.effectStats[a.id].count).toBe(1);expect(w.effectStats[b.id]).toBeUndefined();
 const immune=w.statuses.filter(s=>s.effect.kind==='immunity');expect(immune).toHaveLength(1);expect(immune[0].ends-immune[0].started).toBe(240);expect(w.comboReady['hex:group-invuln']).toBe(600);
 w.tick=100;(w as any).effectExtend({type:'extend',buff:a.id,statuses:['immunity'],duration:1000,max:1000},{id:w.playerId});expect(immune[0].ends).toBe(240);expect(w.selfBuffs.find(x=>x.id===a.id)!.ends).toBe(240);
 replaceCombatBuild(w,{stats:{...w.stats,rules:[b]},skills:w.skills});w.tick=241;hurt(w);expect(w.effectStats[b.id]).toBeUndefined();
 const restored=World.restore(JSON.parse(JSON.stringify(w.exportCheckpoint())));restored.tick=600;hurt(restored);expect(restored.effectStats[b.id].count).toBe(1);
});
it.each([2,3] as const)('policy v%s: lethal saves share a 120s minimum even with a shorter content ICD and death actually resets the ledger',version=>{
 const save={type:'buff',duration:60,maxStacks:1,mods:{},flags:{surviveAtOne:true}},a=rule('save-a',save,{trigger:'lethal',icd:30}),b=rule('save-b',save,{trigger:'lethal',icd:60}),w=world([a,b]);w.rules.hexPolicy!.version=version;
 hurt(w,2000);expect(w.hero.hp).toBe(1);expect(w.effectStats[a.id].count).toBe(1);expect(w.effectStats[b.id]).toBeUndefined();expect(w.comboReady['hex:group-lethal-save']).toBe(3600);expect(w.comboReady['hex:save-a']).toBe(3600);
 w.tick=61;hurt(w,2000);expect(w.hero.hp).toBe(0);expect(w.hexLedger?.deaths).toBe(1);expect(w.hexLedger?.triggers).toEqual({});expect(Object.keys(w.comboReady).filter(x=>x.startsWith('hex'))).toEqual([]);
});
it('kill-triggered fixed refunds use the same HEX cap instead of the legacy shortcut',()=>{
 const w=world([rule('refund',{type:'refund',ticks:90},{trigger:'kill'})]);(w as any).spendCooldown(w.skills[0]);w.enemies[0].hp=1;
 (w as any).damage(w.enemies[0],100,false,'basic',{category:'direct',damageType:'physical',skill:w.skills[0],scaled:true});
 expect(w.cooldowns.basic).toBe(60);
});
it('a frozen pre-shared-policy world keeps its previous protection semantics',()=>{
 const r=rule('old',{type:'buff',duration:300,maxStacks:1,mods:{},flags:{immortal:true}}),w=world([r]);
 w.rules.hexPolicy={...w.rules.hexPolicy!,version:1};delete w.rules.hexPolicy.lethalSaveMinimumTicks;
 hurt(w);expect(w.statuses.find(s=>s.effect.kind==='immunity')!.ends).toBe(300);
 expect(w.comboReady['hex:group-invuln']).toBeUndefined();
});
it('rejects future trigger metadata and preserves per-actor isolation',()=>{
 const r=rule('one',{type:'heal',ratio:.01,ref:'maxHp'},{icd:60}),w=world([r]);w.addPlayer('owner',structuredClone(w.stats),structuredClone(w.skills),{x:10,y:10});w.addPlayer('friend',structuredClone(w.stats),structuredClone(w.skills),{x:11,y:10});
 w.forPlayer('friend',()=>hurt(w));expect(w.players.get('friend')!.hexLedger?.triggers['hex:one']).toBeTruthy();expect(w.hexLedger).toBeUndefined();
 const cp=w.exportCheckpoint();cp.data.hexLedger={deaths:0,triggers:{'hex:one':{tick:1,ready:60}}};expect(()=>World.restore(cp)).toThrow('Future HEX trigger');
});
it('different cooldown-reset pieces in the same frame refund half, floor once before the cap, and retain the frame across reconnect',()=>{
 const first=rule('hex-cycle-reset',{type:'cooldown',mode:'all',ticks:11}),second=rule('hex-finisher-refund',{type:'cooldown',mode:'all',ticks:11}),w=world([first,second]);
 (w as any).spendCooldown(w.skills[0]);hurt(w);expect(w.cooldowns.basic).toBe(84);
 expect(w.hexResetFrame).toEqual({tick:0,first:'hex-cycle-reset'});
 const restored=World.restore(JSON.parse(JSON.stringify(w.exportCheckpoint())));
 (restored as any).effectCooldown({type:'cooldown',mode:'all',ticks:11},undefined,'hex-finisher-refund');expect(restored.cooldowns.basic).toBe(79);
 w.tick=1;hurt(w);expect(w.cooldowns.basic).toBe(68);
 w.tick=2;hurt(w);expect(w.cooldowns.basic).toBe(60); // still respects the total40% limit
});
