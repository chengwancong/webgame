import {expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {World} from '../packages/simulation/index.ts';
import {replaceCombatBuild} from '../packages/simulation/replace-build.ts';
import {attackSource} from '../packages/simulation/attack-source.ts';
import {effectRuleSchema,type EffectRule} from '../packages/contracts/effects.ts';
import {skillSchema,type Stats} from '../packages/contracts/index.ts';
import {regionById} from '../packages/content/index.ts';
import {describeAspectRule} from '../packages/content/aspect-description.ts';
import {hexRuneById,publicHexRunes} from '../packages/content/hex-runes.ts';
import {collectHexRules} from '../packages/rules/hex-runes.ts';
import {makeGear} from '../packages/rules/index.ts';
import type {CharacterState} from '../packages/contracts/index.ts';
const skills=['basic','spell'].map(id=>skillSchema.parse({id,name:id,description:'controlled',kind:'single',damage:100,range:4,radius:0,cooldown:1,cost:0,windup:0,duration:1,mechanics:{damageType:'physical',targeting:'enemy',statuses:[]}}));
const rule=(extra:object={})=>effectRuleSchema.parse({id:'hex-first-test',source:'gear-first',name:'controlled',description:'controlled',trigger:'hit',chance:1,icd:0,action:{type:'heal',ratio:.1,ref:'maxHp'},vfxKey:'hex/first',...extra});
function fixture(rules:EffectRule[]){
 const stats:Stats={hp:1000,attack:100,armor:0,speed:1,mana:100,regen:0,effects:[],rules};
 const w=new World({...regionById('meadow'),safe:{x:10,y:10},obstacles:[]},stats,structuredClone(skills),[0,1].map(i=>({id:'target'+i,name:'target',kind:'melee',x:12+i,y:10,hp:10000,attack:0,boss:false,elite:false,art:'raider'})),[],41);
 w.mode='manual';w.hero.hp=100;for(const e of w.enemies)e.cooldown=999999;return w;
}
function hit(w:World,index=0,target=0,extra:object={}){
 const s=w.skills[index],e=w.enemies[target],before=e.hp;
 (w as any).damage(e,100,false,s.id,{category:'direct',damageType:'physical',skill:s,scaled:true,...extra});
 return before-e.hp;
}
it('classifies slot zero independently of cost, tags and element; indirect and unknown never become basic',()=>{
 expect(attackSource({category:'direct',skill:skills[0]},skills)).toBe('basic');
 expect(attackSource({category:'direct',skill:skills[1]},skills)).toBe('cast');
 for(const category of ['periodic','derived'] as const)expect(attackSource({category,skill:skills[0]},skills,'basic')).toBe('proc');
 expect(attackSource({category:'direct',comboDepth:1,skill:skills[0]},skills)).toBe('proc');
 expect(attackSource(undefined,skills)).toBe('untyped');
 expect(attackSource({category:'direct',skill:skills[0]},[...skills].reverse(),'basic')).toBe('basic');
});
it('filters the real hit executor and preserves legacy unspecified filters',()=>{
 const w=fixture([rule({filter:{attackSources:['basic']}})]);
 hit(w,1);hit(w,0,0,{category:'periodic'});hit(w,0,0,{category:'derived'});expect(w.hero.hp).toBe(100);
 hit(w);expect(w.hero.hp).toBe(200);
 const old=fixture([rule()]);hit(old,1);expect(old.hero.hp).toBe(200);
});
it('counts A2 per target, resumes partial counters exactly and never pools AOE targets',()=>{
 const w=fixture([rule({trigger:'nth',count:'hit',every:5,countScope:'target'})]);
 for(let i=0;i<4;i++){hit(w,0,0);hit(w,0,1);}expect(w.hero.hp).toBe(100);
 const restored=World.restore(JSON.parse(JSON.stringify(w.exportCheckpoint())));
 for(const run of [w,restored]){hit(run,0,0);expect(run.hero.hp).toBe(200);hit(run,0,1);expect(run.hero.hp).toBe(300);}
 expect(restored.exportCheckpoint()).toEqual(w.exportCheckpoint());
 expect(describeAspectRule(w.stats.rules![0])).toContain('同一目标');
 expect(()=>rule({trigger:'cast',countScope:'target'})).toThrow();
});
it('EA5 skill casts arm basic only, and basic hits arm the next non-basic cast without self-consumption',()=>{
 const w=fixture([
  rule({id:'hex-relay-cast',trigger:'cast',filter:{attackSources:['cast']},action:{type:'buff',duration:99999,maxStacks:1,mods:{damageMult:.3},consume:'nextBasicHit'}}),
  rule({id:'hex-relay-basic',filter:{attackSources:['basic']},action:{type:'buff',duration:99999,maxStacks:1,mods:{damageMult:.2},consume:'nextSkillCast'}})
 ]);
 expect(w.cast('spell',w.enemies[0])).toBe(true);w.step();
 expect(hit(w,1)).toBe(100);expect(hit(w)).toBe(130);
 expect(hit(w)).toBe(100);
 w.tick=30;expect(w.cast('basic',w.enemies[0])).toBe(true);w.step();
 expect(w.selfBuffs.some(b=>b.id==='hex-relay-basic')).toBe(true);
 w.tick=60;expect(w.cast('spell',w.enemies[0])).toBe(true);
 const before=w.enemies[0].hp;w.step();expect(before-w.enemies[0].hp).toBe(120);
 expect(w.selfBuffs.some(b=>b.id==='hex-relay-basic')).toBe(false);
});
it('a failed cast cannot consume the prepared skill bonus',()=>{
 const w=fixture([rule({filter:{attackSources:['basic']},action:{type:'buff',duration:100,maxStacks:1,mods:{damageMult:.2},consume:'nextSkillCast'}})]);
 hit(w);w.cooldowns.spell=999;expect(w.cast('spell',w.enemies[0])).toBe(false);
 expect(w.selfBuffs).toHaveLength(1);
});
it('unequipping removes HEX buffs/owned fields immediately but preserves ICD and other player fields',()=>{
 const r=rule({trigger:'interval',every:1,icd:90,action:{type:'field',at:'self',radius:3,duration:90,interval:30,ratio:.25,damageType:'shadow'}});
 const w=fixture([r]);w.step();w.step();expect(w.zones.length).toBeGreaterThan(0);
 const other={...structuredClone(w.zones[0]),id:999,sourceId:'another'};w.zones.push(other);
 const ready=w.comboReady[r.id];
 replaceCombatBuild(w,{stats:{...w.stats,rules:[]},skills:w.skills});
 expect(w.zones).toEqual([other]);expect(w.comboReady[r.id]).toBe(ready);
 replaceCombatBuild(w,{stats:{...w.stats,rules:[r]},skills:w.skills});w.step();
 expect(w.zones.every(z=>z.sourceId==='another')).toBe(true);
});
it.each(['common','magic'] as const)('formal %s movement and control pair keeps exact parameters and only applies the D11 ten-percent resonance',q=>{
 const s:CharacterState={id:'qa-first',name:'controlled',revision:0,build:1,level:30,xp:0,gold:0,material:0,gear:[],equipment:{},skills:[],skillRanks:{},progress:{kills:0,regions:['town'],bosses:[],safe:'town',tasks:[]}};
 for(const [i,id] of ['hex-footfall-heal','hex-control-to-shield'].entries()){const g=makeGear(i?2:0,randomUUID());g.quality=q;g.origin={kind:'random'};g.requiredLevel=20;g.hex={rune:id,tier:q};s.gear.push(g);s.equipment[g.slot]=g.id;}
 const rules=collectHexRules(s),w=fixture(rules),move=rules[0],shield=rules[1];
 expect(move.action.type).toBe('heal');
 if(move.action.type!=='heal')throw Error('Expected formal healing action');
 expect(move.action.ratio).toBeCloseTo(.0055,15); // D13 half-scale plus one resonance; actual restored HP remains exact.
 expect(shield.action.type).toBe('shield');
 hit(w);w.step();w.effectMoved=q==='common'?10:9;w.step();expect(w.hero.hp).toBe(106);
 w.applyStatus(w.enemies[0].id,{kind:'root',duration:90,strength:0,scope:'hit',cleanse:true},w.playerId,'spell',w.skills[1]);
 expect(w.hero.shield).toBe(q==='common'?28:33);
 expect(w.hero.shieldUntil-w.tick).toBe(240);
 w.hero.shield=0;w.tick+=10;
 w.applyStatus(w.enemies[1].id,{kind:'stun',duration:90,strength:0,scope:'hit',cleanse:true},w.playerId,'spell',w.skills[1]);
 expect(w.hero.shield).toBe(0);
 const restored=World.restore(JSON.parse(JSON.stringify(w.exportCheckpoint())));
 expect(restored.exportCheckpoint()).toEqual(w.exportCheckpoint());
});
it('publishes only two tiers for new entries and preserves existing high-quality catalogue definitions',()=>{
 for(const id of ['hex-footfall-heal','hex-control-to-shield','hex-cast-hit-relay']){
  const publicRune=publicHexRunes.find(r=>r.id===id)!;
  expect(Object.keys(publicRune.tiers)).toEqual(['common','magic']);expect(publicRune.playstyle).toBeTruthy();expect(publicRune.flavor).toBeTruthy();
  expect(hexRuneById.get(id)!.tiers.rare).toBeUndefined();
 }
 expect(hexRuneById.get('hex-aftershock')!.tiers.legendary!.requiredLevel).toBe(25);
 expect(hexRuneById.get('hex-aftershock')!.tiers.common.rules[0].countScope).toBe('target');
});
it('formal movement healing advances from real movement input before combat, not a fabricated distance counter',()=>{
 const w=fixture(hexRuneById.get('hex-footfall-heal')!.tiers.magic.rules);
 w.control(0,1);for(let i=0;i<310;i++)w.step();
 expect(w.effectMoved).toBeGreaterThanOrEqual(9);expect(w.hero.hp).toBe(105);
 expect(w.effectStats['hex-footfall-heal-magic']?.count).toBe(1);expect(w.hexCombat).toBeUndefined();
});
it('neutral marks are owner-bound, expire, survive reconnect and consume exactly once before a follow-up cooldown operation',()=>{
 const mark=rule({id:'hex-mark-create',source:'own',filter:{attackSources:['cast']},action:{type:'mark',key:'relay',duration:150}});
 const consume=rule({id:'hex-mark-consume',source:'own',filter:{attackSources:['basic'],mark:'relay'},action:{type:'unmark',key:'relay'},after:[{type:'cooldown',mode:'all',ticks:15}]});
 const w=fixture([mark,consume]);w.cooldowns.spell=100;hit(w,1);
 expect(w.effectMarks).toHaveLength(1);expect(w.hasStatus(w.enemies[0].id,'vulnerable')).toBe(false);
 const restored=World.restore(JSON.parse(JSON.stringify(w.exportCheckpoint())));
 for(const run of [w,restored]){hit(run);expect(run.cooldowns.spell).toBe(85);hit(run);expect(run.cooldowns.spell).toBe(85);}
 expect(restored.exportCheckpoint()).toEqual(w.exportCheckpoint());
 const other=fixture([mark,{...consume,source:'another'}]);hit(other,1);hit(other);expect(other.effectMarks).toHaveLength(1);
 other.tick=151;hit(other);expect(other.effectStats[consume.id]).toBeUndefined();
});
it('consumption dispatch is once-only and cannot be taken by the wrong attack class',()=>{
 const w=fixture([rule({trigger:'interval',every:1,icd:100,action:{type:'buff',duration:100,maxStacks:1,mods:{},consume:'nextSkillHit'},consumeEffects:[{type:'heal',ratio:.1,ref:'maxHp'}]})]);
 w.step();w.step();hit(w);expect(w.hero.hp).toBe(100);
 hit(w,1);expect(w.hero.hp).toBe(200);hit(w,1);expect(w.hero.hp).toBe(200);
 expect(()=>rule({consumeEffects:[{type:'heal',ratio:.1}]})).toThrow();
});
it('keeps one mechanism ICD across quality and item swaps, including reconnect',()=>{
 const common=hexRuneById.get('hex-control-to-shield')!.tiers.common.rules[0],magic=hexRuneById.get('hex-control-to-shield')!.tiers.magic.rules[0];
 const w=fixture([{...common,source:'gear-1'}]);
 w.applyStatus(w.enemies[0].id,{kind:'stun',duration:10,strength:0,scope:'hit',cleanse:true},w.playerId,'spell',w.skills[1]);
 expect(w.hero.shield).toBe(25);w.hero.shield=0;w.tick=10;
 replaceCombatBuild(w,{stats:{...w.stats,rules:[{...magic,source:'gear-2'}]},skills:w.skills});
 const restored=World.restore(JSON.parse(JSON.stringify(w.exportCheckpoint())));
 for(const run of [w,restored]){
  run.applyStatus(run.enemies[1].id,{kind:'root',duration:10,strength:0,scope:'hit',cleanse:true},run.playerId,'spell',run.skills[1]);
  expect(run.hero.shield).toBe(0);run.tick=60;
  run.applyStatus(run.enemies[0].id,{kind:'root',duration:10,strength:0,scope:'hit',cleanse:true},run.playerId,'spell',run.skills[1]);
  expect(run.hero.shield).toBe(30);
 }
 expect(restored.exportCheckpoint()).toEqual(w.exportCheckpoint());
});
it.each(['common','magic'] as const)('executes formal relay %s bonuses without changing base damage or consuming on the other class',q=>{
 const rules=hexRuneById.get('hex-cast-hit-relay')!.tiers[q].rules,w=fixture(rules);
 expect(w.cast('spell',w.enemies[0])).toBe(true);w.step();expect(hit(w,1)).toBe(100);
 expect(hit(w)).toBe(q==='common'?115:120);
 w.tick=30;expect(w.cast('spell',w.enemies[0])).toBe(true);
 const before=w.enemies[0].hp;w.step();expect(before-w.enemies[0].hp).toBe(q==='common'?110:113);
});
it.each(['common','magic'] as const)('formal D12 mark %s uses shadow damage, a neutral mark, and one cooldown refund',q=>{
 const w=fixture(hexRuneById.get('hex-mark-relay')!.tiers[q].rules);
 // A real 1000-frame cooldown, not a 1-frame skill with a forged deadline.
 // The unchanged 15-frame refund is below D10's 40% per-cast ceiling.
 for(const skill of w.skills){skill.cooldown=1000;(w as any).spendCooldown(skill);}
 hit(w,1);expect(w.effectMarks).toHaveLength(1);
 expect(hit(w)).toBe(q==='common'?120:125);
 expect(w.cooldowns.basic+w.cooldowns.spell).toBe(1985);
 expect(w.events.find(e=>e.ruleId?.endsWith('-consume')&&e.type==='hit_resolved')?.damageType).toBe('shadow');
 expect(hit(w)).toBe(100);expect(w.cooldowns.basic+w.cooldowns.spell).toBe(1985);
});
it.each(['common','magic'] as const)('formal D12 rift %s stays at its initial position and ticks at 30 not 15 frames',q=>{
 const w=fixture(hexRuneById.get('hex-void-rift')!.tiers[q].rules);
 for(const e of w.enemies)w.applyStatus(e.id,{kind:'root',duration:1000,strength:0,scope:'hit',cleanse:true},'fixture');
 hit(w);w.tick=299;const before=w.enemies[0].hp;w.step();
 expect(w.zones).toHaveLength(1);const origin={...w.zones[0].position};
 const amount=q==='common'?13:15;expect(before-w.enemies[0].hp).toBe(amount);
 w.hero.position={x:5,y:5};
 for(let i=0;i<15;i++)w.step();expect(before-w.enemies[0].hp).toBe(amount);expect(w.zones[0].position).toEqual(origin);
 for(let i=0;i<15;i++)w.step();expect(before-w.enemies[0].hp).toBe(amount*2);
});
it.each(['common','magic'] as const)('formal D12 bees %s travel, ignore intervening enemies, slow the original target and recover midflight',q=>{
 const rules=hexRuneById.get('hex-bee-volley')!.tiers[q].rules,w=fixture(rules);
 w.enemies[0].position={x:16,y:10};w.enemies[1].position={x:13,y:10};
 for(const e of w.enemies)w.applyStatus(e.id,{kind:'root',duration:1000,strength:0,scope:'hit',cleanse:true},'fixture');
 hit(w);w.tick=239;w.step();hit(w);expect(w.projectiles).toHaveLength(0);
 hit(w,1);const before=w.enemies.map(e=>e.hp),count=q==='common'?3:4;expect(w.projectiles).toHaveLength(count);
 const restored=World.restore(JSON.parse(JSON.stringify(w.exportCheckpoint())));
 for(let i=0;i<30;i++){w.step();restored.step();}
 expect(before[0]-w.enemies[0].hp).toBe(10*count);expect(w.enemies[1].hp).toBe(before[1]);
 expect(w.statuses.find(s=>s.targetId===w.enemies[0].id&&s.effect.kind==='slow')?.effect).toMatchObject({strength:.2,duration:45});
 expect(restored.exportCheckpoint()).toEqual(w.exportCheckpoint());
});
it('D12 bees retarget after death, disappear without targets, and cannot survive source unequip',()=>{
 const rules=hexRuneById.get('hex-bee-volley')!.tiers.common.rules;
 for(const mode of ['retarget','empty','unequip']){
  const w=fixture(rules);hit(w);w.tick=239;w.step();hit(w,1);expect(w.projectiles).toHaveLength(3);
  if(mode==='unequip')replaceCombatBuild(w,{stats:{...w.stats,rules:[]},skills:w.skills});
  else{w.enemies[0].hp=0;w.enemies[0].alive=false;if(mode==='empty'){w.enemies[1].hp=0;w.enemies[1].alive=false;}}
  const before=w.enemies[1].hp;
  for(let i=0;i<30;i++)w.step();
  expect(w.projectiles).toHaveLength(0);
  expect(before-w.enemies[1].hp).toBe(mode==='retarget'?30:0);
 }
});
