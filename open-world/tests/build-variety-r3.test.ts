import {it,expect} from 'vitest';
import {World} from '../packages/simulation/index.ts';
import {regionById,skillCatalog} from '../packages/content/index.ts';
import {effectAtoms} from '../packages/content/effect-atoms.ts';
import {effectRuleSchema,type EffectRule} from '../packages/contracts/effects.ts';
import {statusEffectSchema,type StatusKind,type Skill} from '../packages/contracts/index.ts';
import {skillTags} from '../packages/content/skill-tags.ts';
const atom=(id:string)=>effectAtoms.find(r=>r.id==='atom-'+id)!;
function fixture(rules:EffectRule[]=[]){const w=new World({...regionById('meadow'),obstacles:[],safe:{x:10,y:10}},{hp:1000,attack:100,armor:10,speed:6,mana:500,regen:10,effects:[],rules},skillCatalog.filter(s=>['cut','bolt','rush','whirl','thunder_dash'].includes(s.id)).map(s=>structuredClone(s)),Array.from({length:6},(_,i)=>({id:'e'+i,name:'靶',kind:'melee',x:12+(i%3)*1.5,y:10+Math.floor(i/3)*1.5,hp:50000,attack:0,elite:false,boss:false,art:'raider'})),[],41);w.hero.position={x:10,y:10};w.anchor={...w.hero.position};w.mode='manual';(w as any).enemyStep=()=>{};return w;}
function checkpoint(w:World){const value=w.exportCheckpoint();delete value.data.enemyStep;return value;}
function status(w:World,kind:StatusKind,target='e0',extra:object={}){return w.applyStatus(target,statusEffectSchema.parse({kind,duration:90,strength:['burn','poison','bleed'].includes(kind)?0:.12,scope:'hit',cleanse:true,...(['burn','poison','bleed'].includes(kind)?{interval:30,total:300,damageType:kind==='burn'?'fire':kind==='poison'?'poison':'physical'}:{}),...extra}));}
function hit(w:World,id='e0',amount=100,skill:Skill=w.skills[0]){return (w as any).damage(w.enemies.find(e=>e.id===id),amount,false,skill.id,{category:'direct',damageType:skill.mechanics?.damageType??'physical',skill,scaled:true});}
const ticks=(w:World,n:number)=>{const events=[];for(let i=0;i<n;i++){w.step();events.push(...w.events);}return events;};
it.each(effectAtoms)('$id executes its declared atom behavior',r=>{
 const w=fixture([r]),target=w.enemies[0],a=r.action;w.hero.hp=200;w.upperBound=true;
 const skill=structuredClone(skillCatalog.find(s=>s.damage>0&&(!(r.action.type==='mana'&&r.action.ref==='cost')||s.cost>0)&&(!r.filter.tags||r.filter.tags.some(t=>skillTags(s).includes(t as never)))&&(!r.filter.damageTypes||r.filter.damageTypes.includes(s.mechanics!.damageType)))!);w.skills=[skill];if(a.type==='cooldown'&&a.mode==='others')w.skills.push(structuredClone(skillCatalog.find(s=>s.damage>0&&s.id!==skill.id)!));
 w.stats.rules=[];for(const kind of ['burn','poison','bleed','slow','blind','fear','stun','freeze','armor_down','shock','vulnerable'] as StatusKind[])status(w,kind);w.stats.rules=[r];
 if(r.trigger==='passive'){
  if(a.type==='amplify'){const baseline=World.restore(checkpoint(w));baseline.stats.rules=[];hit(baseline,'e0',100,skill);hit(w,'e0',100,skill);expect(w.enemies[0].hp).toBeLessThan(baseline.enemies[0].hp);return;}
  if(a.type==='buff'){
   if(a.statusOverrides){for(const [kind,override]of Object.entries(a.statusOverrides)){for(let i=0;i<override!.maxStacks+1;i++){status(w,kind as StatusKind);w.tick++;}expect(w.statuses.filter(s=>s.targetId==='e0'&&s.effect.kind===kind)).toHaveLength(override!.maxStacks);}return;}
   if(a.patches){const bolt=structuredClone(skillCatalog.find(s=>s.id==='bolt')!);w.skills=[bolt];expect(w.cast('bolt',target)).toBe(true);ticks(w,8);expect(w.projectiles.some(p=>p.returns)).toBe(true);return;}
   if(a.firstPerTarget){w.upperBound=false;w.statuses=[];hit(w);expect(w.events.some(e=>e.type==='hit_resolved'&&e.crit)).toBe(true);w.events=[];hit(w);expect(w.events.some(e=>e.type==='hit_resolved'&&e.crit)).toBe(false);return;}
   for(const flag of Object.keys(a.flags??{}))expect((w as any).buffFlag(flag)).toBe(true);
   for(const key of Object.keys(a.mods))expect((w as any).conditionalValue(key)).toBeGreaterThan(0);return;
  }
 }
 if(a.type==='cooldown'||a.type==='refund')for(const s of w.skills)w.cooldowns[s.id]=1000;
 if(r.trigger==='low_hp')w.hero.hp=200;
 const before={hp:w.hero.hp,mana:w.hero.mana,enemy:w.enemies.map(e=>e.hp),positions:w.enemies.map(e=>({...e.position})),cooldowns:{...w.cooldowns},status:w.statuses.length};
 if(r.trigger==='nth'){for(let i=0;i<(r.every??1);i++)(w as any).fireEffects(r.count??'hit',target,100,skill,[...w.statuses],0,true);}
 else if(r.trigger==='interval'||r.trigger==='moved'||r.trigger==='mana_spent'){w.effectsStarted=true;w.conditionClock.start=0;w.tick=r.every??1;if(r.trigger==='moved')w.effectMoved=r.every!;if(r.trigger==='mana_spent')w.conditionClock.manaSpent=r.every!;(w as any).stepEffects();}
 else (w as any).fireEffects(r.trigger,target,100,skill,[...w.statuses]);
 expect(w.effectStats[r.id]?.count,r.name+' trigger').toBeGreaterThan(0);
 switch(a.type){
  case 'status':expect(w.statuses.some(s=>s.effect.kind===a.status&&s.skill===r.id)).toBe(true);break;
  case 'nova':expect(w.enemies.some((e,i)=>e.hp<before.enemy[i])).toBe(true);break;
  case 'shards':expect(w.projectiles.length).toBeGreaterThan(0);break;
  case 'spread':expect(w.statuses.some(s=>s.targetId!=='e0'&&a.statuses.includes(s.effect.kind))).toBe(true);break;
  case 'echo':expect(w.echoes.length).toBeGreaterThan(0);break;
  case 'buff':expect(w.selfBuffs.some(b=>b.id===r.id)).toBe(true);break;
  case 'shield':expect(w.hero.shield).toBeGreaterThan(0);break;
  case 'heal':expect(w.hero.hp).toBeGreaterThan(before.hp);break;
  case 'mana':w.hero.mana=100;(w as any).comboAct((awaitRule(w,r.id)),target,100,1,[],skill);expect(w.hero.mana).toBeGreaterThan(100);break;
  case 'cooldown':case 'refund':if(a.type==='cooldown'&&a.mode==='others'){expect(w.cooldowns[w.skills[1].id]).toBe(w.tick);expect(w.cooldowns[skill.id]).toBe(1000);}else expect(w.cooldowns[skill.id]).toBeLessThan(1000);break;
  case 'field':expect(w.zones.length>0||w.enemies.some((e,i)=>e.position.x!==before.positions[i].x||e.position.y!==before.positions[i].y)).toBe(true);break;
  case 'detonate':expect(w.enemies.some((e,i)=>e.hp<before.enemy[i])).toBe(true);break;
  default:throw Error('Atom test needs concrete assertion '+a.type);
 }
});
function awaitRule(w:World,id:string){return (w as any).combosFor(w.stats.rules!.find(r=>r.id===id)!.trigger).find((r:any)=>r.id===id);}
it('freeze converts on the third cold application, breaks on non-cold, and slows a boss',()=>{const w=fixture([atom('chill')]),cold=structuredClone(skillCatalog.find(s=>s.id==='frost_blade')!);w.statuses=[];for(let i=0;i<3;i++)hit(w,'e0',10,cold);expect(w.hasStatus('e0','freeze')).toBe(true);hit(w,'e0',10,skillCatalog.find(s=>s.id==='cut')!);expect(w.hasStatus('e0','freeze')).toBe(false);w.enemies[1].boss=true;status(w,'freeze','e1');expect(w.hasStatus('e1','freeze')).toBe(false);expect(w.hasStatus('e1','slow')).toBe(true);});
it('independent shock stacks sum and expire independently; old single-stack behavior remains',()=>{const w=fixture();status(w,'shock','e0',{maxStacks:3,stackMode:'independent',duration:30});w.tick=10;status(w,'shock','e0',{maxStacks:3,stackMode:'independent',duration:60});expect((w as any).strength('e0','shock')).toBeCloseTo(.24);w.tick=31;expect((w as any).strength('e0','shock')).toBeCloseTo(.12);});
it('dot critical hits require permission and use half the critical chance',()=>{const w=fixture();w.stats.critChance=1;w.stats.dotCrit=1;status(w,'poison');const events=ticks(w,90).filter(e=>e.type==='hit_resolved'&&e.category==='periodic');expect(events.some(e=>e.crit)).toBe(true);const old=fixture();old.stats.critChance=1;status(old,'poison');expect(ticks(old,90).filter(e=>e.type==='hit_resolved'&&e.category==='periodic').every(e=>!e.crit)).toBe(true);});
it('returning projectiles hit on the outgoing and return paths and retain state through a checkpoint',()=>{const w=fixture([atom('return')]);w.skills=[structuredClone(skillCatalog.find(s=>s.id==='bolt')!)];expect(w.cast('bolt',w.enemies[0])).toBe(true);let returns=false;const events=[];for(let i=0;i<100;i++){w.step();events.push(...w.events);if(w.projectiles.some(p=>p.returning)){returns=true;const copy=World.restore(checkpoint(w));expect(copy.projectiles.some(p=>p.returning)).toBe(true);}}expect(returns).toBe(true);expect(events.filter(e=>e.type==='hit_resolved'&&e.id==='e0').length).toBeGreaterThanOrEqual(2);});
it.each(['kill_elite','dash','status_apply','hurt','dodge','block','shield_break','shield_gain','low_hp','lethal','interval','combat_start','moved','mana_empty','mana_spent','zone_end'] as const)('%s is bound to an actual World event',trigger=>{
 const rule=effectRuleSchema.parse({id:'probe-'+trigger,name:trigger,description:'trigger fixture',source:'test',tier:1,trigger,chance:1,icd:1,filter:{},when:[],scale:[],vfxKey:'player/mend',...(['interval','moved','mana_spent'].includes(trigger)?{every:1}:{}),action:{type:'heal',ratio:.01,ref:'maxHp'}}),w=fixture([rule]);w.hero.hp=500;
 const hurt=(amount:number)=>(w as any).withVfx({sourceId:'e0'},()=>(w as any).hurt(amount,'basic-melee',{category:'direct',damageType:'physical'}));
 if(trigger==='kill_elite'){w.enemies[0].elite=true;w.enemies[0].hp=1;hit(w);}
 if(trigger==='dash'){const skill=structuredClone(skillCatalog.find(s=>s.kind==='dash'&&s.mechanics?.targeting==='direction')!);w.skills=[skill];expect(w.cast(skill.id,undefined,{x:10,y:6})).toBe(true);ticks(w,skill.windup+2);}
 if(trigger==='status_apply')status(w,'burn');
 if(trigger==='hurt')hurt(50);
 if(trigger==='dodge'){w.stats.dodge=1;hurt(50);}
 if(trigger==='block'){w.stats.blockChance=.5;w.upperBound=true;hurt(50);}
 if(trigger==='shield_break'){w.hero.shield=10;w.hero.shieldUntil=100;(w as any).observeShield();hurt(100);}
 if(trigger==='shield_gain'){const shield=structuredClone(skillCatalog.find(s=>s.kind==='shield'&&s.damage>0)!);w.skills=[shield];expect(w.cast(shield.id)).toBe(true);ticks(w,shield.windup+2);}
 if(trigger==='low_hp'){w.hero.hp=310;hurt(150);}
 if(trigger==='lethal'){w.hero.hp=1;hurt(100);}
 if(trigger==='interval'||trigger==='combat_start')ticks(w,3);
 if(trigger==='moved'){w.control(0,-1);ticks(w,10);}
 if(trigger==='mana_empty'||trigger==='mana_spent'){const paid=structuredClone(skillCatalog.find(s=>s.id==='bolt')!);paid.cost=10;w.skills=[paid];if(trigger==='mana_empty')w.hero.mana=0;w.cast(paid.id,w.enemies[0]);ticks(w,2);}
 if(trigger==='zone_end'){const zone=structuredClone(skillCatalog.find(s=>s.id==='miasma')!);w.skills=[zone];expect(w.cast(zone.id,w.enemies[0])).toBe(true);ticks(w,zone.duration+zone.windup+3);}
 expect(w.effectStats[rule.id]?.count).toBeGreaterThan(0);
});
it('nextCast, nextHit and nextMelee consume once and buffs survive recovery',()=>{
 const w=fixture([atom('evasion')]);(w as any).fireEffects('dash',w.enemies[0],100,w.skills[0]);expect(w.selfBuffs).toHaveLength(1);const restored=World.restore(checkpoint(w));expect(restored.selfBuffs).toEqual(w.selfBuffs);expect(w.cast('cut',w.enemies[0])).toBe(true);expect(w.selfBuffs).toHaveLength(0);expect(ticks(w,12).some(e=>e.type==='hit_resolved'&&e.crit)).toBe(true);
 const melee=fixture([atom('whirl-edge')]);melee.upperBound=true;for(let i=0;i<5;i++)(melee as any).fireEffects('interval',melee.enemies[0],100);melee.upperBound=false;const before=melee.enemies[0].hp;hit(melee,'e0',100,skillCatalog.find(s=>s.id==='bolt')!);expect(before-melee.enemies[0].hp).toBe(100);expect(melee.selfBuffs).toHaveLength(1);const hp=melee.enemies[0].hp;hit(melee,'e0',100,skillCatalog.find(s=>s.id==='cut')!);expect(hp-melee.enemies[0].hp).toBe(175);expect(melee.selfBuffs).toHaveLength(0);
});
it('reflection targets the actual distant attacker; shields restrict their attached damage buff',()=>{
 const w=fixture([atom('thorns')]);w.enemies[0].position={x:20,y:10};const before=w.enemies[0].hp;(w as any).withVfx({sourceId:'e0'},()=>(w as any).hurt(50,'basic-ranged',{category:'direct',damageType:'physical'}));expect(w.enemies[0].hp).toBeLessThan(before);
 const shield=fixture([atom('bulwark')]);(shield as any).fireEffects('hurt',shield.enemies[0],100);expect((shield as any).buffValue('damageMult')).toBe(.2);shield.hero.shield=0;expect((shield as any).buffValue('damageMult')).toBe(0);
});
it('extend caps duration, passive reduction mitigates, and conduction removes arc decay',()=>{
 const base={id:'probe',name:'probe',description:'action fixture',source:'test',tier:1,chance:1,icd:0,filter:{},when:[],scale:[],vfxKey:'player/chain'};
 const extend=effectRuleSchema.parse({...base,trigger:'crit',action:{type:'extend',statuses:['poison'],duration:30,max:60}}),w=fixture([extend]);status(w,'poison');for(let i=0;i<10;i++)(w as any).fireEffects('crit',w.enemies[0],100,w.skills[0],[...w.statuses]);expect(w.statuses[0].ends).toBe(150);
 const reduce=effectRuleSchema.parse({...base,trigger:'passive',action:{type:'reduce',ratio:.2}}),a=fixture([reduce]),b=fixture();for(const x of [a,b])(x as any).withVfx({sourceId:'e0'},()=>(x as any).hurt(100,'basic-melee',{category:'direct',damageType:'physical'}));expect(a.hero.hp).toBeGreaterThan(b.hero.hp);
 const arc=effectRuleSchema.parse({...base,trigger:'hit',action:{type:'arc',ratio:.5,count:2,range:6,damageType:'lightning',decay:.7}}),conduct=fixture([arc,atom('conduction')]),plain=fixture([arc]);hit(conduct);hit(plain);const damage=(x:World)=>x.events.filter(e=>e.type==='hit_resolved'&&e.ruleId==='probe').map(e=>e.amount);expect(damage(conduct)).toEqual([50,50]);expect(damage(plain)).toEqual([50,35]);
});
it('all atoms stay within the global 24-action budget for ten minutes',()=>{
 const w=fixture(effectAtoms);w.stats.hp=1000000;w.hero.hp=w.stats.hp;w.stats.mana=100000;w.hero.mana=100000;w.stats.regen=1000;for(const e of w.enemies){e.hp=1e9;e.maxHp=1e9;}w.skills=skillCatalog.filter(s=>['fireball','frost_blade','thunder_arrow','venom_cleave'].includes(s.id)).map(s=>structuredClone(s));w.setMode('auto');w.upperBound=true;let max=0;
 for(let i=0;i<18000;i++){if(i%120===0)(w as any).withVfx({sourceId:'e0'},()=>(w as any).hurt(50,'basic-melee',{category:'direct',damageType:'physical'}));w.step();max=Math.max(max,(w as any).comboSpent);expect((w as any).comboSpent).toBeLessThanOrEqual(24);expect(w.hero.hp).toBeGreaterThan(0);}
 console.log(JSON.stringify({pressure:{seed:41,ticks:18000,maxActions:max,triggeredRules:Object.keys(w.effectStats).length}}));expect(max).toBeGreaterThan(0);expect(Object.keys(w.effectStats).length).toBeGreaterThan(10);
},120000);

it("converted freeze expires without the consumed slow legacy flag",()=>{const w=fixture([atom("chill")]),cold=structuredClone(skillCatalog.find(s=>s.id==="frost_blade")!);for(let i=0;i<3;i++)hit(w,"e0",10,cold);expect(w.hasStatus("e0","freeze")).toBe(true);ticks(w,46);expect(w.hasStatus("e0","freeze")).toBe(false);expect(w.hasStatus("e0","slow")).toBe(false);expect(w.enemies[0].slow).toBe(0);});
it('quake counts actual distinct hits, not nearby unhit enemies',()=>{const run=(four:boolean)=>{const w=fixture([atom('quake')]);w.skills=[structuredClone(skillCatalog.find(s=>s.id==='whirl')!)];w.enemies=w.enemies.slice(0,4);const positions=[{x:11.5,y:10},{x:10,y:11.5},{x:8.5,y:10},four?{x:10,y:8.5}:{x:10+w.skills[0].radius+.25,y:10}];w.enemies.forEach((e,i)=>e.position=positions[i]);expect(w.cast('whirl',w.enemies[0])).toBe(true);ticks(w,w.skills[0].windup+3);return w.effectStats['atom-quake']?.count??0;};expect(run(false)).toBe(0);expect(run(true)).toBe(1);});

it("conduction also removes the legacy chain effect attenuation",()=>{const normal=fixture(),full=fixture([atom("conduction")]);normal.stats.effects=["chain"];full.stats.effects=["chain"];hit(normal);hit(full);expect(50000-full.enemies[1].hp).toBe(100);expect(50000-normal.enemies[1].hp).toBeLessThan(100);});
