import {expect,it} from 'vitest';
import type {CharacterState,Spawn,Stats} from '../packages/contracts/index.ts';
import {petFlows,petViewSchema,type PetFlow} from '../packages/contracts/zhangjian.ts';
import {petContent,petFamilyById} from '../packages/content/zhangjian.ts';
import {regionById} from '../packages/content/index.ts';
import {monsterContent} from '../packages/content/monsters.ts';
import {resolveMonsterSpawn} from '../packages/rules/monster-stats.ts';
import {petActiveRatio,petActiveRule,petBuildParts} from '../packages/rules/zhangjian-build.ts';
import {currentElements,elementHint,grantPet,loadoutView,petView,saveLoadout,setPetLineup} from '../packages/rules/zhangjian.ts';
import {World} from '../packages/simulation/index.ts';

const families=['wind-free','wind-light','wind-heavy'] as const;
type Family=typeof families[number];
const targetHp=100000;
const baseStats:Stats={hp:10000,attack:1000,armor:0,speed:1,mana:100,regen:0,effects:[]};
function character():CharacterState{
 return {id:'pet-r1-controlled',name:'宠物隔离验证',revision:0,build:1,level:30,xp:0,gold:0,material:0,gear:[],equipment:{},skills:[],skillRanks:{},progress:{kills:0,regions:['town'],bosses:[],safe:'town',tasks:[]}};
}
function owned(family:Family,level=1,flow:PetFlow='blade'){
 const s=character();grantPet(s,family);s.pets!.owned[family]={level,xp:0,flow};return s;
}
function world(s:CharacterState,count=4){
 // Resolve a real catalogue entry so checkpoints retain a valid frozen
 // template and curve. Override only the isolated target's combat parameters:
 // zero armor/attack, no skills, and long-range AI on a long cooldown.
 const template=monsterContent.templates.find(t=>t.kind==='ranged'&&!t.bossKey&&!t.bossProfile)!;
 const targets:Spawn[]=Array.from({length:count},(_,i)=>{
  const target=resolveMonsterSpawn({id:'pet-r1-target-'+i,template:template.id,level:template.referenceLevel,rank:'normal',x:12+i*2,y:10});
  target.hp=targetHp;target.attack=0;
  Object.assign(target.monster!,{baseStats:{hp:targetHp,attack:0,armor:0},armor:0,skills:[],ai:{...target.monster!.ai,range:100,cooldown:999999,skillChance:0,basicAttackBonus:0}});
  return target;
 });
 const w=new World({...regionById('meadow'),safe:{x:10,y:10},obstacles:[]},{...structuredClone(baseStats),rules:petBuildParts(s).rules},[],targets,[],41);
 w.mode='manual';for(const e of w.enemies)e.cooldown=999999;return w;
}
function advance(w:World,tick:number){while(w.tick<tick)w.step();}
function damage(w:World){return w.enemies.map(e=>targetHp-e.hp);}
function restored(w:World){return World.restore(JSON.parse(JSON.stringify(w.exportCheckpoint())));}

it('风绒实际每60帧只攻击最近的一名目标，单次为原等级伤害的一半',()=>{
 const s=owned('wind-free',20,'storm'),w=world(s),base=petActiveRatio(petFamilyById.get('wind-free')!,20),expected=Math.round(baseStats.attack*(Math.round(base*1000)/1000)*.5);
 advance(w,60);expect(damage(w)).toEqual([0,0,0,0]);
 w.step();expect(w.tick).toBe(61);expect(damage(w)).toEqual([expected,0,0,0]);
 const hits=w.events.filter(e=>e.type==='hit_resolved');expect(hits).toHaveLength(1);expect(hits[0]).toMatchObject({id:'pet-r1-target-0',damageType:'lightning',category:'derived',ruleId:'pet-wind-free'});
 advance(w,120);expect(damage(w)).toEqual([expected,0,0,0]);
 w.step();expect(damage(w)).toEqual([expected*2,0,0,0]);expect(w.hero.shield).toBe(0);
});

it.each([1,10,20,30])('风芽鹿Lv%i给予真实生命护盾，90帧后过期，120帧后再释放且从不输出',level=>{
 const w=world(owned('wind-light',level,'storm')),amount=Math.round(baseStats.hp*.04*(1+petContent.levelRatioBonus*(level-1)));
 advance(w,120);expect(w.hero.shield).toBe(0);expect(damage(w)).toEqual([0,0,0,0]);
 w.step();expect(w.hero.shield).toBe(amount);expect(w.hero.shieldUntil).toBe(211);
 const applied=w.events.find(e=>e.type==='shielded'&&e.shieldPhase==='applied'&&e.ruleId==='pet-wind-light');
 expect(applied).toMatchObject({amount,shieldGained:amount,shieldRemaining:amount,ruleId:'pet-wind-light'});
 advance(w,210);expect(w.hero.shield).toBe(amount);w.step();expect(w.hero.shield).toBe(0);
 advance(w,240);expect(w.hero.shield).toBe(0);w.step();expect(w.hero.shield).toBe(amount);expect(w.hero.shieldUntil).toBe(331);
 expect(damage(w)).toEqual([0,0,0,0]);expect(w.hero.hp).toBe(baseStats.hp);
});

it('风芽鹿遇到更大护盾空转时保留盾量，事件只报告实际新增为0并归因正确',()=>{
 const w=world(owned('wind-light'));advance(w,120);w.hero.shield=800;w.hero.shieldUntil=1000;w.step();
 expect(w.hero.shield).toBe(800);expect(w.hero.shieldUntil).toBe(1000);
 const applied=w.events.find(e=>e.type==='shielded'&&e.shieldPhase==='applied'&&e.ruleId==='pet-wind-light');
 expect(applied).toMatchObject({amount:400,shieldGained:0,shieldRemaining:800,ruleId:'pet-wind-light'});
 expect(damage(w)).toEqual([0,0,0,0]);
});

it.each([1,2,4])('岚羽面对%i个敌人只付首击与可用的两跳，不回弹、不补偿缺失目标',count=>{
 const level=20,w=world(owned('wind-heavy',level,'ember'),count),base=Math.round(petActiveRatio(petFamilyById.get('wind-heavy')!,level)*1000)/1000;
 const ratios=[1,.7,.49].map(weight=>base*weight/2.19),expected=Array.from({length:count},(_,i)=>i<3?Math.round(baseStats.attack*ratios[i]):0);
 advance(w,120);expect(damage(w)).toEqual(Array(count).fill(0));w.step();expect(damage(w)).toEqual(expected);
 expect(w.events.find(e=>e.type==='effect_triggered'&&e.ruleId==='pet-wind-heavy')).toMatchObject({action:'nova',followupActions:['arc']});
 const hits=w.events.filter(e=>e.type==='hit_resolved');expect(hits).toHaveLength(Math.min(count,3));expect(new Set(hits.map(e=>e.id)).size).toBe(hits.length);
 for(const hit of hits)expect(hit).toMatchObject({damageType:'fire',category:'derived',ruleId:'pet-wind-heavy'});
 expect(ratios.reduce((a,b)=>a+b,0)).toBeCloseTo(base,12);
 advance(w,240);expect(damage(w)).toEqual(expected);w.step();expect(damage(w)).toEqual(expected.map(n=>n*2));
});

it('旧范围岚羽检查点恢复后仍执行冻结范围规则，事件不冒充局外新连锁',()=>{
 const level=20,flow='ember',s=owned('wind-heavy',level,flow),w=world(s),legacy=petActiveRule(petFamilyById.get('wind-heavy')!,level,flow);
 const ratio=Math.round(petActiveRatio(petFamilyById.get('wind-heavy')!,level)*1000)/1000;
 // Reconstruct the pre-R1 frozen rule for the same pet identity. Current
 // catalogue/view remains chain, but the saved encounter still owns this AOE.
 legacy.action={type:'nova',ratio,radius:petContent.activeRadius,damageType:'fire',ref:'attack',at:'target'};delete legacy.after;
 w.stats.rules=[legacy];advance(w,120);const copy=restored(w);
 expect(petView('wind-heavy',{level,xp:0,flow}).activeEffect?.kind).toBe('chain');
 expect(copy.stats.rules?.[0].action).toMatchObject({type:'nova',radius:3});expect(copy.stats.rules?.[0].after).toBeUndefined();
 const amount=Math.round(baseStats.attack*ratio);
 for(const run of [w,copy]){
  run.step();expect(damage(run)).toEqual([amount,amount,0,0]);
  const triggered=run.events.find(e=>e.type==='effect_triggered'&&e.ruleId==='pet-wind-heavy');
  expect(triggered).toMatchObject({action:'nova'});expect(triggered).not.toHaveProperty('followupActions');
  expect(run.events.filter(e=>e.type==='hit_resolved').map(e=>e.id)).toEqual(['pet-r1-target-0','pet-r1-target-1']);
 }
 expect(copy.exportCheckpoint()).toEqual(w.exportCheckpoint());
});

it.each(families)('%s作为助阵时只保留被动，真实World中不放主动',family=>{
 const s=owned(family,20,'storm');setPetLineup(s,null,[family]);const parts=petBuildParts(s),w=world(s);
 expect(parts.stats.length).toBeGreaterThan(0);expect(parts.stats.every(stat=>stat.source==='pet:'+family)).toBe(true);expect(parts.rules).toEqual([]);
 advance(w,241);expect(damage(w)).toEqual([0,0,0,0]);expect(w.hero.shield).toBe(0);expect(w.effectStats['pet-'+family]).toBeUndefined();
});

it('一只上阵加两只助阵仍只有上阵主动，助阵鹿不提供护盾、助阵岚羽不追加连锁',()=>{
 const s=owned('wind-free');grantPet(s,'wind-light');grantPet(s,'wind-heavy');setPetLineup(s,'wind-free',['wind-light','wind-heavy']);
 const parts=petBuildParts(s),w=world(s);expect(parts.rules.map(r=>r.id)).toEqual(['pet-wind-free']);
 expect(new Set(parts.stats.map(x=>x.source))).toEqual(new Set(families.map(id=>'pet:'+id)));
 advance(w,241);expect(damage(w)[0]).toBeGreaterThan(0);expect(damage(w).slice(1)).toEqual([0,0,0]);expect(w.hero.shield).toBe(0);
});

it.each(families.flatMap(family=>[false,true].map(afterFirst=>({family,afterFirst}))))('$family恢复检查点保留主动时序及状态（首放之后=$afterFirst）',({family,afterFirst})=>{
 const w=world(owned(family,20,'venom')),every=family==='wind-free'?60:120;
 // Start combat naturally at tick 1. Cover a reconnect just before the first
 // activation and one during the first shield's lifetime / next attack wait.
 advance(w,afterFirst?every+20:every-1);const copy=restored(w);
 expect(copy.exportCheckpoint()).toEqual(w.exportCheckpoint());
 while(w.tick<every*2+92){w.step();copy.step();expect(copy.exportCheckpoint()).toEqual(w.exportCheckpoint());}
});

it('当前元素与已保存方案排除护盾流派、助阵流派和已不拥有宠物，保留伤害宠物保存时的流派',()=>{
 const s=owned('wind-light',10,'storm');grantPet(s,'wind-free');grantPet(s,'wind-heavy');
 s.pets!.owned['wind-free'].flow='ember';s.pets!.owned['wind-heavy'].flow='shade';
 setPetLineup(s,'wind-light',['wind-free']);saveLoadout(s,0,'保护');
 setPetLineup(s,'wind-free',['wind-light']);saveLoadout(s,1,'输出');
 setPetLineup(s,'wind-heavy',[]);saveLoadout(s,2,'已失去');
 delete s.pets!.owned['wind-heavy'];expect(currentElements(s)).toEqual([]);
 s.pets!.owned['wind-free'].flow='venom';setPetLineup(s,'wind-light',['wind-free']);
 expect(currentElements(s)).toEqual([]);const view=loadoutView(s,baseStats);
 expect(view.current.elements).toEqual([]);expect(view.slots.map(slot=>slot.elements)).toEqual([[],['fire'],[]]);
 expect(elementHint({threat:'physical',weakness:'lightning'},view)?.switchTo).toBeUndefined();
 expect(elementHint({threat:'physical',weakness:'fire'},view)?.switchTo).toBe(1);
 setPetLineup(s,'wind-free',['wind-light']);expect(currentElements(s)).toEqual(['poison']);
});

it.each(families.flatMap(family=>[1,10,20,30].map(level=>({family,level}))))('$family Lv$level的视图通过契约并与九流派可执行规则逐项一致',({family,level})=>{
 for(const flow of petFlows){
  const own={level,xp:0,flow},view=petViewSchema.parse(petView(family,own)),effect=view.activeEffect!,rule=petActiveRule(petFamilyById.get(family)!,level,flow);
  expect(effect.intervalSeconds).toBe(rule.every!/30);
  if(rule.action.type==='shield'){
   expect(effect).toMatchObject({kind:'shield',dealsDamage:false,damageElement:null,damageRatios:[],targetLimit:1,shieldPercent:rule.action.ratio*100,durationSeconds:rule.action.duration/30});
   expect(view.activeLine).toContain('护盾');expect(view.flowDescription).toContain('不造成元素伤害');
  }else{
   if(rule.action.type!=='nova')throw Error('Expected pet damage action');
   const arc=rule.after?.find(a=>a.type==='arc'),ratios=[rule.action.ratio];
   if(arc?.type==='arc')for(let i=0;i<arc.count;i++)ratios.push(arc.ratio*arc.decay**i);
   expect(effect).toMatchObject({kind:family==='wind-heavy'?'chain':'single',dealsDamage:true,damageElement:rule.action.damageType,damageRatios:ratios,targetLimit:family==='wind-heavy'?3:1});
   expect(effect.damageElement).toBe(petContent.flows[flow]);
  }
 }
});
