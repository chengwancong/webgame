import {expect,it} from 'vitest';
import {World} from '../packages/simulation/index.ts';
import {effectRuleSchema,type EffectRule} from '../packages/contracts/effects.ts';
import {skillSchema,type Stats} from '../packages/contracts/index.ts';
import {regionById} from '../packages/content/index.ts';
import {replaceCombatBuild} from '../packages/simulation/replace-build.ts';
const rule=(id:string,action:object,extra:object={})=>effectRuleSchema.parse({id:'hex-'+id,hexMechanism:id,source:'gear-'+id,name:id,description:'controlled cap boundary',trigger:'hit',chance:1,icd:0,vfxKey:'hex/budget',action,...extra});
function fixture(rules:EffectRule[]){
 const stats:Stats={hp:1000,attack:100,armor:0,speed:1,mana:100,regen:0,effects:[],rules};
 const skill=skillSchema.parse({id:'basic',name:'basic',description:'controlled',kind:'single',damage:100,range:4,radius:0,cooldown:30,cost:10,windup:0,duration:1,mechanics:{damageType:'physical',targeting:'enemy',statuses:[]}});
 const w=new World({...regionById('meadow'),safe:{x:10,y:10},obstacles:[]},stats,[skill],[{id:'target',name:'target',kind:'melee',x:12,y:10,hp:10000,attack:0,boss:false,elite:false,art:'raider'}],[],41);
 w.mode='manual';w.hero.hp=100;w.enemies[0].cooldown=999999;return w;
}
function hit(w:World){const e=w.enemies[0],before=e.hp;(w as any).damage(e,100,false,'basic',{category:'direct',damageType:'physical',skill:w.skills[0],scaled:true});return before-e.hp;}
it('shares the actual HP and net shield budget across HEX rules and reconnect, but not ordinary healing',()=>{
 const w=fixture([rule('heal',{type:'heal',ref:'maxHp',ratio:.05}),rule('shield',{type:'shield',ref:'maxHp',ratio:.1,duration:90})]);
 hit(w);expect(w.hero.hp).toBe(150);expect(w.hero.shield).toBe(30);
 const resumed=World.restore(JSON.parse(JSON.stringify(w.exportCheckpoint())));
 for(const run of [w,resumed]){hit(run);expect(run.hero.hp).toBe(150);expect(run.hero.shield).toBe(30);(run as any).restoreResources(100,0,'ordinary');expect(run.hero.hp).toBe(250);run.tick=30;hit(run);expect(run.hero.hp).toBe(300);expect(run.hero.shield).toBe(60);}
 expect(resumed.exportCheckpoint()).toEqual(w.exportCheckpoint());
});
it('does not charge refreshed existing shield as recovery and never reduces a larger ordinary shield',()=>{
 const w=fixture([rule('shield',{type:'shield',ref:'maxHp',ratio:.1,duration:90})]);w.hero.shield=200;hit(w);expect(w.hero.shield).toBe(200);expect(w.hexRecoveryWindow??[]).toEqual([]);
});
it('refunds at most 60 percent of actually paid mana in the window; no free-cast farming',()=>{
 const w=fixture([rule('mana',{type:'heal',ref:'maxHp',ratio:0})]);w.hero.mana=0;
 (w as any).restoreResources(0,100,'hex-mana');expect(w.hero.mana).toBe(0);
 (w as any).noteHexManaSpend(20);(w as any).restoreResources(0,100,'hex-mana');expect(w.hero.mana).toBe(12);
 const resumed=World.restore(JSON.parse(JSON.stringify(w.exportCheckpoint())));(resumed as any).restoreResources(0,100,'hex-mana');expect(resumed.hero.mana).toBe(12);
 resumed.tick=30;(resumed as any).restoreResources(0,100,'hex-mana');expect(resumed.hero.mana).toBe(12);
});
it('caps the combined HEX damage multiplier without clipping ordinary multipliers',()=>{
 const a=rule('a',{type:'buff',duration:90,maxStacks:1,mods:{damageMult:.5}},{trigger:'passive'}),b=rule('b',{type:'amplify',ratio:.5,against:[]},{trigger:'passive'}),ordinary=rule('ordinary',{type:'buff',duration:90,maxStacks:1,mods:{damageMult:1}},{trigger:'passive',hexMechanism:undefined});
 const w=fixture([a,b,ordinary]);expect(hit(w)).toBe(320);
});
it('caps HEX reduction separately from ordinary mitigation',()=>{
 const w=fixture([rule('a',{type:'reduce',ratio:.5},{trigger:'passive'}),rule('b',{type:'reduce',ratio:.5},{trigger:'passive'})]);w.hero.hp=1000;
 (w as any).hurt(100,'target',{category:'direct',damageType:'pure',scaled:true});expect(w.hero.hp).toBe(935);
});
it('counts only movement while equipped, works before hostile damage, and does not bank old walking on re-equip',()=>{
 const r=rule('move',{type:'heal',ref:'maxHp',ratio:.01},{trigger:'moved',every:10}),w=fixture([r]);w.effectMoved=100;w.step();expect(w.hero.hp).toBe(100);
 w.effectMoved=110;w.step();expect(w.hero.hp).toBe(110);expect(w.hexCombat).toBeUndefined();
 replaceCombatBuild(w,{stats:{...w.stats,rules:[]},skills:w.skills});w.effectMoved=210;
 replaceCombatBuild(w,{stats:{...w.stats,rules:[r]},skills:w.skills});w.step();expect(w.hero.hp).toBe(110);w.effectMoved=220;w.step();expect(w.hero.hp).toBe(120);
});
it('rejects corrupt and future resource windows; frozen old checkpoints retain old execution policy',()=>{
 const w=fixture([rule('heal',{type:'heal',ref:'maxHp',ratio:.2})]),cp=w.exportCheckpoint();cp.data.hexRecoveryWindow=[{tick:1,amount:1}];expect(()=>World.restore(cp)).toThrow();
 const old=w.exportCheckpoint();delete (old.data.rules as any).hexPolicy;const restored=World.restore(old);hit(restored);expect(restored.hero.hp).toBe(300);
});
it('limits repeated HEX cooldown refunds to forty percent of the current cast, survives reconnect and resets on a new cast',()=>{
 const w=fixture([rule('cd',{type:'cooldown',mode:'current',ticks:50})]);w.skills[0].cooldown=100;
 (w as any).spendCooldown(w.skills[0]);(w as any).effectCooldown({type:'cooldown',mode:'current',ticks:50},w.skills[0],'cd');expect(w.cooldowns.basic).toBe(60);
 const restored=World.restore(JSON.parse(JSON.stringify(w.exportCheckpoint())));(restored as any).effectCooldown({type:'cooldown',mode:'current',reset:true},restored.skills[0],'cd');expect(restored.cooldowns.basic).toBe(60);
 restored.tick=60;(restored as any).spendCooldown(restored.skills[0]);(restored as any).effectCooldown({type:'cooldown',mode:'current',ticks:50},restored.skills[0],'cd');expect(restored.cooldowns.basic).toBe(120);
});
it('HEX refunds cannot cross the existing total CDR cap, and ordinary effects retain their prior semantics',()=>{
 const w=fixture([rule('cd',{type:'cooldown',mode:'current',ticks:50})]);w.skills[0].cooldown=100;w.stats.cdr=.7;
 (w as any).spendCooldown(w.skills[0]);expect(w.cooldowns.basic).toBe(30);
 (w as any).effectCooldown({type:'cooldown',mode:'current',ticks:50},w.skills[0],'cd');expect(w.cooldowns.basic).toBe(25);
 (w as any).effectCooldown({type:'cooldown',mode:'current',reset:true},w.skills[0]);expect(w.cooldowns.basic).toBe(0);
});
it('lifesteal, healing and shield from separate HEX sources share one same-frame 8% budget',()=>{
 const w=fixture([rule('life',{type:'buff',duration:90,maxStacks:1,mods:{lifesteal:1}},{trigger:'passive'}),rule('heal',{type:'heal',ref:'maxHp',ratio:1}),rule('shield',{type:'shield',ref:'maxHp',ratio:1,duration:90})]);
 hit(w);expect(w.hero.hp-100+w.hero.shield).toBe(80);
 for(let i=0;i<10;i++)hit(w);expect(w.hero.hp-100+w.hero.shield).toBe(80);
});
it('real paid casts feed the mana refund budget, and repeated hit procs cannot refund unspent mana',()=>{
 const w=fixture([rule('mana',{type:'mana',ref:'maxMana',ratio:1})]);w.skills[0].cost=100;
 expect(w.cast('basic',w.enemies[0])).toBe(true);expect(w.hero.mana).toBe(0);w.step();expect(w.hero.mana).toBe(60);
 for(let i=0;i<10;i++)hit(w);expect(w.hero.mana).toBe(60);
});
it('continuous recovery and fixed refund share a per-cast HEX cooldown budget',()=>{
 const w=fixture([rule('speed',{type:'buff',duration:90,maxStacks:1,mods:{cooldownRecovery:10}},{trigger:'passive'})]);w.skills[0].cooldown=100;
 (w as any).spendCooldown(w.skills[0]);for(let i=0;i<10;i++)w.step();
 expect(w.cooldowns.basic).toBe(60);
 (w as any).effectCooldown({type:'cooldown',mode:'current',ticks:90},w.skills[0],'another-refund');expect(w.cooldowns.basic).toBe(60);
});
it('a consumed cast multiplier remains attributed to HEX through DOT ticks and checkpoint restore',()=>{
 const w=fixture([rule('cast',{type:'buff',duration:90,maxStacks:1,mods:{damageMult:.5},consume:'nextSkillCast'},{filter:{attackSources:['basic']}}),rule('passive',{type:'buff',duration:90,maxStacks:1,mods:{damageMult:.5}},{trigger:'passive'})]);
 w.skills.push(skillSchema.parse({...w.skills[0],id:'spell',cost:0,mechanics:{damageType:'physical',targeting:'enemy',statuses:[{kind:'burn',duration:30,interval:30,total:100,strength:0,damageType:'fire',scope:'hit',cleanse:true}]}}));
 hit(w);expect(w.cast('spell',w.enemies[0])).toBe(true);w.step();
 const restored=World.restore(JSON.parse(JSON.stringify(w.exportCheckpoint())));
 for(const run of [w,restored]){while(run.tick<31)run.step();expect(run.events.filter(e=>e.type==='hit_resolved'&&e.category==='periodic').reduce((sum,e)=>sum+(e.amount??0),0)).toBe(160);}
});
