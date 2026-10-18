import {describe,it,expect} from 'vitest';
import {World,distance,type CombatEvent} from '../packages/simulation/index.ts';
import {skillCatalog,type Region} from '../packages/content/index.ts';
import {resolveBuild} from '../packages/rules/index.ts';
import {skillSchema,statusEffectSchema,type CharacterState,type Skill,type Stats,type Spawn} from '../packages/contracts/index.ts';
const region:Region={id:'skill-controlled',name:'受控机制场',subtitle:'',width:60,height:40,theme:'meadow',safe:{x:10,y:10},portal:{x:4,y:4},boss:false,auto:false,obstacles:[],spawns:[],landmarks:[]};
const stats:Stats={hp:1000,attack:30,armor:0,speed:6,mana:1000,regen:0,effects:[]};
const spawn=(id='target',x=12,y=10,patch:Partial<Spawn>={}):Spawn=>({id,name:id,x,y,hp:10000,attack:0,kind:'ranged',boss:false,elite:false,art:'raider',...patch});
const raw=(id:string,patch:Partial<Skill>={})=>({...structuredClone(skillCatalog.find(s=>s.id===id)!),...patch});
function world(ids:string[],spawns=[spawn()],extra:Partial<Stats>={}){const w=new World(structuredClone(region),{...stats,...extra},ids.map(id=>raw(id)),spawns,[],41);w.setMode('manual');w.enemies.forEach(e=>e.cooldown=100000);return w;}
function step(w:World,ticks:number){const events:CombatEvent[]=[];for(let i=0;i<ticks;i++){w.step();events.push(...w.events);}return events;}
const hits=(events:CombatEvent[],id:string)=>events.filter(e=>e.type==='hit_resolved'&&e.skill===id&&e.id!=='hero');
const resolve=(ids:string[],rank=1,cdr=0)=>{const state:CharacterState={id:'controlled-build',name:'受控授予',level:20,revision:1,build:1,xp:0,gold:10000,material:0,gear:[],equipment:{},skills:ids,skillRanks:Object.fromEntries(skillCatalog.map(s=>[s.id,rank])),progress:{kills:0,regions:['town','meadow'],bosses:[],safe:'town',tasks:[]}};const build=resolveBuild(state);return {state,...build,stats:{...build.stats,weapon:undefined},resolvedSkills:ids.map(id=>build.skillAccess.find(sk=>sk.id===id)!.current!)}; /* Isolated mechanism fixtures exercise skills separately from equipment binding. */};
const status=(kind:string,duration:number,strength=1,extra:Record<string,unknown>={})=>statusEffectSchema.parse({kind,duration,strength,scope:'hit',cleanse:true,...extra});

describe('current source damage provenance and status lifecycle',()=>{
 it('C01 burns exactly three times on a relative clock, without crit, lifesteal or reapplying itself',()=>{
  const w=world(['cut'],[spawn()],{effects:['burn'],critChance:1,critMultiplier:2,lifesteal:.5});w.skills[0].windup=0;w.skills[0].damage=100;w.hero.hp=100;
  expect(w.cast('cut')).toBe(true);const initial=step(w,1);expect(hits(initial,'cut')[0].amount).toBe(200);expect(w.hero.hp).toBe(200);
  const events=step(w,900),burn=hits(events,'burn');expect(burn.map(e=>e.tick)).toEqual([31,61,91]);expect(burn.map(e=>e.amount)).toEqual([8,8,8]);expect(burn.every(e=>e.category==='periodic'&&e.sourceId==='hero')).toBe(true);expect(w.hero.hp).toBe(200);expect(w.statuses).toHaveLength(0);
 });
 it('C01 same-source refresh preserves the next tick and survives serialized restoration',()=>{
  const w=world(['cut'],[spawn()],{effects:['burn']});w.skills[0].windup=0;w.cast('cut');step(w,20);w.cast('cut');step(w,1);const restored=World.restore(JSON.parse(JSON.stringify(w.exportCheckpoint())));
  const a=step(w,180),b=step(restored,180);expect(hits(a,'burn').map(e=>e.tick)).toEqual([31,61,91]);expect(b).toEqual(a);expect(restored.exportCheckpoint()).toEqual(w.exportCheckpoint());
 });
 it('C01 two players retain independent DOT sources after focus changes and disconnection',()=>{
  const w=world([],[spawn()]);w.addPlayer('a',{...stats,effects:['burn']},[raw('cut',{windup:0})],{x:10,y:10});w.addPlayer('b',{...stats,effects:['burn'],critChance:1,lifesteal:1},[raw('cut',{windup:0})],{x:10,y:12});
  for(const id of ['a','b'])w.forPlayer(id,()=>w.setMode('manual'));w.forPlayer('a',()=>w.cast('cut',w.enemies[0]));step(w,1);w.forPlayer('b',()=>{w.hero.position={x:10,y:10};w.cast('cut',w.enemies[0]);});step(w,1);w.focusPlayer('b');w.setConnected('a',false);
  const events=step(w,150);expect(hits(events,'burn').filter(e=>e.sourceId==='a')).toHaveLength(3);expect(hits(events,'burn').filter(e=>e.sourceId==='b')).toHaveLength(3);expect(hits(events,'burn').every(e=>e.amount===8)).toBe(true);
 });
 it('C02 blessing changes real attacks without changing the frozen base or stacking over 300 seconds',()=>{
  const w=world([],[spawn('caster',12,10),spawn('ally',14,10,{kind:'melee',attack:25})],{hp:100000});const ally=w.enemies[1];
  for(let tick=0;tick<9000;tick++){if(tick%300===0)(w as any).releaseMonster({at:w.tick,owner:'caster',target:'hero',position:w.hero.position,skillId:'dragon_blessing',vfx:{sourceId:'caster'}});w.step();expect((w as any).enemyAttack(ally)).toBeLessThanOrEqual(30);expect(ally.attack).toBe(25);}
  expect((w as any).enemyAttack(ally)).toBe(25);(w as any).releaseMonster({at:w.tick,owner:'caster',target:'hero',position:w.hero.position,skillId:'dragon_blessing',vfx:{sourceId:'caster'}});ally.position={x:11.5,y:10};ally.cooldown=0;const hp=w.hero.hp;w.step();expect(hp-w.hero.hp).toBe(30);w.enemies[0].alive=false;w.step();expect((w as any).enemyAttack(ally)).toBe(25);
 });
 it.each(['frost_bite','shield_bash'])('C03 %s applies only on a real in-range melee contact',id=>{
  const w=world([],[spawn('caster',11.5,10,{attack:20})]);(w as any).releaseMonster({at:0,owner:'caster',target:'hero',position:w.hero.position,skillId:id,vfx:{sourceId:'caster'}});expect(w.hasStatus('hero',id==='frost_bite'?'slow':'stun')).toBe(true);
  w.clearStatuses('hero');w.hero.position={x:18,y:10};(w as any).releaseMonster({at:0,owner:'caster',target:'hero',position:{x:10,y:10},skillId:id,vfx:{sourceId:'caster'}});expect(w.statuses).toHaveLength(0);
 });
 it('C03 a dodged contact cannot attach stun or slow',()=>{const w=world([],[spawn('caster',11.5,10,{attack:20})],{dodge:1});for(const skillId of ['frost_bite','shield_bash'])(w as any).releaseMonster({at:0,owner:'caster',target:'hero',position:w.hero.position,skillId,vfx:{sourceId:'caster'}});expect(w.hero.hp).toBe(stats.hp);expect(w.statuses).toHaveLength(0);});
 it('C03 an enemy slowing zone changes player movement and releases on exit/cleanse',()=>{
  const a=world([],[]),b=world([],[]);a.zones.push({id:1,position:{x:10,y:10},radius:3,damage:0,life:90,delay:0,enemy:true,slow:true,sourceId:'enemy',skill:'frost_stomp'});a.control(1,0);b.control(1,0);step(a,15);step(b,15);expect(a.hero.position.x-10).toBeLessThan((b.hero.position.x-10)*.7);a.hero.position={x:20,y:10};step(a,2);expect(a.hasStatus('hero','slow')).toBe(false);
 });
});

describe('melee and projectile promises',()=>{
 it.each([['dual_strike',2,28,15],['blade_fury',3,15,100],['volley',3,20,40]] as const)('%s pays once and divides its original total into %i hits', (id,count,total,ticks)=>{
  const w=world([id]);const mana=w.hero.mana;expect(w.cast(id)).toBe(true);const cd=w.cooldowns[id],events=step(w,ticks),damage=hits(events,id);expect(damage).toHaveLength(count);expect(damage.reduce((n,e)=>n+e.amount!,0)).toBe(total);expect(w.hero.mana).toBe(mana-w.skills[0].cost);expect(w.cooldowns[id]).toBe(cd);
 });
 it('dual strike cancels later contact when the original target dies; a stun cancels the remaining sequence',()=>{
  const w=world(['dual_strike']);w.cast('dual_strike');step(w,4);w.enemies[0].alive=false;expect(hits(step(w,20),'dual_strike')).toHaveLength(0);
  const b=world(['blade_fury']);b.cast('blade_fury');step(b,5);b.applyStatus('hero',status('stun',30),'target','test');expect(hits(step(b,100),'blade_fury')).toHaveLength(0);
 });
 it('execute applies only its own threshold, and berserker/war cry change incoming/outgoing defense then expire',()=>{
  const a=world(['execute']),b=world(['execute']);a.enemies[0].hp=2100;b.enemies[0].hp=1900;a.cast('execute');b.cast('execute');expect(hits(step(a,10),'execute')[0].amount).toBe(80);expect(hits(step(b,10),'execute')[0].amount).toBe(120);
  const rage=world(['berserker'],[spawn()],{armor:100}),normal=world([],[],{armor:100});(normal as any).hurt(100,'basic-melee');const baseline=stats.hp-normal.hero.hp;rage.cast('berserker');step(rage,10);expect(rage.effectiveStats().armor).toBe(80);(rage as any).hurt(100,'basic-melee');expect(stats.hp-rage.hero.hp).toBeGreaterThan(baseline);step(rage,60);expect(rage.effectiveStats().armor).toBe(100);const hp=rage.hero.hp;(rage as any).hurt(100,'basic-melee');expect(hp-rage.hero.hp).toBe(baseline);
  const baselineCry=world(['cut'],[spawn('target',12,10,{kind:'guard'})]);baselineCry.cast('cut');const normalHit=hits(step(baselineCry,3),'cut')[0].amount!;const cry=world(['war_cry','cut'],[spawn('target',12,10,{kind:'guard'})]);cry.cast('war_cry');step(cry,3);cry.cast('cut');expect(hits(step(cry,3),'cut')[0].amount).toBeGreaterThan(normalHit);step(cry,120);cry.cast('cut');expect(hits(step(cry,3),'cut')[0].amount).toBe(normalHit);
 });
 it('blood rage increases actual resolved skill damage, drains health, and returns to the baseline',()=>{
  const build=resolve(['blood_rage','cut']),w=new World(region,build.stats,build.resolvedSkills,[spawn()]);w.setMode('manual');w.enemies[0].cooldown=100000;w.cast('blood_rage');step(w,2);const base=build.resolvedSkills.find(s=>s.id==='cut')!.damage;expect(w.effectiveStats().attack).toBeGreaterThan(build.stats.attack);w.cast('cut');expect(hits(step(w,3),'cut')[0].amount).toBeGreaterThan(base);const hp=w.hero.hp;step(w,180);expect(w.hero.hp).toBeLessThan(hp);expect(w.effectiveStats().attack).toBe(build.stats.attack);expect(w.stats).toEqual(build.stats);
 });
 it('multi-shot has three independent fan paths within one damage budget; piercing traverses three targets',()=>{
  const w=world(['multi_shot'],[spawn('top',16,8.5),spawn('middle',16,10),spawn('bottom',16,11.5)]);w.cast('multi_shot',w.enemies[1]);const events=step(w,40);expect(new Set(hits(events,'multi_shot').map(e=>e.id)).size).toBe(3);expect(hits(events,'multi_shot').reduce((n,e)=>n+e.amount!,0)).toBe(16);
  const p=world(['pierce_arrow'],[spawn('first',13),spawn('second',15),spawn('third',17)]);p.cast('pierce_arrow',p.enemies[0]);expect(new Set(hits(step(p,45),'pierce_arrow').map(e=>e.id)).size).toBe(3);
 });
 it.each(['explosive_shot','fireball'])('%s uses a small flight body and damages nearby targets once at contact',id=>{
  const w=world([id],[spawn('main',16,10),spawn('near',16,11.1),spawn('outside',16,15)]);w.cast(id,w.enemies[0]);step(w,10);expect(w.projectiles[0].radius).toBe(.3);const events=step(w,35);expect(hits(events,id).filter(e=>e.id==='main')).toHaveLength(1);expect(hits(events,id).filter(e=>e.id==='near')).toHaveLength(1);expect(hits(events,id).filter(e=>e.id==='outside')).toHaveLength(0);
 });
 it.each(['rain_of_arrows','meteor'])('%s performs positive damage at a fixed ground position',id=>{
  const w=world([id],[spawn('main',16,10),spawn('outside',16,18)]);w.cast(id,undefined,{x:16,y:10});const events=step(w,150),damage=hits(events,id),base=id==='meteor'?damage.filter(e=>e.category==='direct'):damage;expect(base.length).toBe(id==='meteor'?1:3);expect(base.reduce((n,e)=>n+e.amount!,0)).toBe(w.skills[0].damage);expect(damage.every(e=>e.id==='main')).toBe(true);if(id==='meteor'){const burn=damage.filter(e=>e.category==='periodic');expect(burn).toHaveLength(3);expect(burn.reduce((n,e)=>n+e.amount!,0)).toBe(18);}
 });
 it('poison ticks end, homing turns, frost reduces movement and dark arrow has its own armor penetration',()=>{
  const poison=world(['poison_arrow'],[spawn('target',14)]);poison.cast('poison_arrow');const events=step(poison,180);expect(hits(events,'poison_arrow').filter(e=>e.category==='periodic')).toHaveLength(3);expect(poison.statuses).toHaveLength(0);
  const homing=world(['arcane_missile'],[spawn('target',20)]);homing.cast('arcane_missile');step(homing,5);const before=homing.projectiles[0].direction.y;homing.enemies[0].position.y=13;step(homing,1);expect(homing.projectiles[0].direction.y).toBeGreaterThan(before);
  const slow=world(['frost_bolt'],[spawn()]);slow.cast('frost_bolt');step(slow,14);expect(slow.hasStatus('target','slow')).toBe(true);step(slow,65);expect(slow.hasStatus('target','slow')).toBe(false);
  const a=world(['dark_arrow'],[spawn('target',14,10,{kind:'guard'})]),b=world(['dark_arrow'],[spawn('target',14,10,{kind:'guard'})]);b.skills[0].mechanics!.penetration=0;a.cast('dark_arrow');b.cast('dark_arrow');expect(hits(step(a,30),'dark_arrow')[0].amount).toBeGreaterThan(hits(step(b,30),'dark_arrow')[0].amount!);
 });
});

describe('control, support and defensive promises',()=>{
 it.each([['stun_strike','stun'],['silence','silence'],['petrify','petrify'],['fear','fear'],['blind','blind'],['time_stop','time_stop']] as const)('%s applies a real %s lifecycle', (id,kind)=>{
  const w=world([id]);w.cast(id);step(w,w.skills[0].windup);expect(w.hasStatus('target',kind)).toBe(true);step(w,100);expect(w.hasStatus('target',kind)).toBe(false);expect(w.tick).toBe(100+w.skills[0].windup);
 });
 it('root forbids movement while allowing attacks; silence preserves basic attacks; stun prevents both',()=>{
  for(const kind of ['root','silence','stun']){const w=world([],[spawn('target',11.5,10,{kind:'melee',attack:10})]);w.enemies[0].cooldown=0;w.applyStatus('target',status(kind,60),'hero','test');const hp=w.hero.hp;step(w,10);expect(w.hero.hp<hp).toBe(kind!=='stun');}
  const w=world([],[spawn('target',16,10,{kind:'melee'})]);w.applyStatus('target',status('root',30));const pos={...w.enemies[0].position};step(w,20);expect(w.enemies[0].position).toEqual(pos);step(w,20);expect(distance(w.enemies[0].position,pos)).toBeGreaterThan(0);
 });
 it('fear moves away, pull has finite displacement, bosses resist, and time stop leaves the world clock running',()=>{
  const fear=world(['fear'],[spawn('target',12,10,{kind:'melee'})]);fear.cast('fear');step(fear,10);const before=distance(fear.hero.position,fear.enemies[0].position);step(fear,20);expect(distance(fear.hero.position,fear.enemies[0].position)).toBeGreaterThan(before);
  for(const id of ['vortex_blade','gravity_well','vortex']){const w=world([id],[spawn('target',14,10)]),before=distance(w.hero.position,w.enemies[0].position);w.cast(id,undefined,id==='vortex_blade'?undefined:{x:11,y:10});step(w,55);expect(distance(w.hero.position,w.enemies[0].position)).toBeLessThan(before);expect(distance(w.hero.position,w.enemies[0].position)).toBeGreaterThanOrEqual(1.099);}
  const boss=world(['time_stop'],[spawn('boss',12,10,{boss:true})]);boss.cast('time_stop');const events=step(boss,25);expect(events.some(e=>e.change==='immune'&&e.id==='boss')).toBe(true);expect(boss.tick).toBe(25);
 });
 it('blind produces seeded misses and cannot reroll them after reconnection',()=>{
  const w=world([],[spawn('target',11.5,10,{kind:'melee',attack:10})]);w.applyStatus('target',status('blind',600,.25));const restored=World.restore(JSON.parse(JSON.stringify(w.exportCheckpoint())));
  const attack=(x:World)=>{const events:CombatEvent[]=[];for(let i=0;i<100;i++){x.enemies[0].cooldown=0;x.step();events.push(...x.events);}return events;};const events=attack(w);expect(events.some(e=>e.type==='missed')).toBe(true);expect(attack(restored)).toEqual(events);
 });
 it('haste changes displacement then expires; regeneration records only effective healing',()=>{
  const a=world(['haste'],[]),b=world([],[]);a.cast('haste');step(a,2);step(b,2);a.control(1,0);b.control(1,0);step(a,30);step(b,30);expect(a.hero.position.x-b.hero.position.x).toBeCloseTo(1.5);step(a,100);expect(a.effectiveStats().speed).toBe(stats.speed);
  const regen=world(['regen'],[]);regen.hero.hp=stats.hp-20;regen.cast('regen');const events=step(regen,200).filter(e=>e.type==='healed');expect(events).toHaveLength(6);expect(events.reduce((n,e)=>n+e.amount!,0)).toBe(20);expect(regen.hero.hp).toBe(stats.hp);expect(regen.statuses).toHaveLength(0);
 });
 it('blink casts without enemies at a chosen legal point and rejects blocked paths before charging',()=>{
  const w=world(['blink'],[]);expect(w.cast('blink',undefined,{x:16,y:10})).toBe(true);step(w,1);expect(w.hero.position.x).toBeCloseTo(16);expect(w.hero.position.y).toBe(10);
  const blocked=world(['blink'],[]);blocked.region.obstacles=[{x:12,y:8,w:1,h:4}];const mana=blocked.hero.mana;expect(blocked.cast('blink',undefined,{x:16,y:10})).toBe(false);expect(blocked.hero.mana).toBe(mana);expect(blocked.lastCastFailure).toBe('blocked');
 });
 it('cleanse works at full health; second wind restores mana at full health; neither overflows',()=>{
  const w=world(['cleanse','second_wind'],[]);expect(w.cast('cleanse')).toBe(false);expect(w.lastCastFailure).toBe('unneeded');w.applyStatus('hero',status('slow',60,.3),'enemy','test');expect(w.cast('cleanse')).toBe(true);step(w,2);expect(w.statuses).toHaveLength(0);w.hero.mana=100;expect(w.cast('second_wind')).toBe(true);const events=step(w,10);expect(w.hero.hp).toBe(stats.hp);expect(w.hero.mana).toBe(120);expect(events.find(e=>e.type==='resource_restored')?.amount).toBe(50);
 });
 it('counter uses actual blocked damage without recursion; phase distinguishes physical from fire',()=>{
  const w=world(['counter_strike'],[spawn('target',11.5,10,{kind:'melee',attack:20})]);w.cast('counter_strike');step(w,1);w.enemies[0].cooldown=0;const hp=w.enemies[0].hp,events=step(w,1);expect(hp-w.enemies[0].hp).toBe(20);expect(hits(events,'counter_strike')[0].category).toBe('derived');step(w,61);w.enemies[0].cooldown=0;expect(hits(step(w,1),'counter_strike')).toHaveLength(0);
  const phase=world(['phase_shift'],[]);phase.cast('phase_shift');step(phase,1);const hp0=phase.hero.hp;(phase as any).hurt(20,'basic-melee',{category:'direct',damageType:'physical'});expect(phase.hero.hp).toBe(hp0);(phase as any).hurt(20,'fire',{category:'direct',damageType:'fire'});expect(phase.hero.hp).toBe(hp0-20);step(phase,90);(phase as any).hurt(20,'basic-melee',{category:'direct',damageType:'physical'});expect(phase.hero.hp).toBe(hp0-40);
 });
 it('guardian intercepts one lethal hit and keeps consumption in the restored checkpoint',()=>{
  const w=world(['guardian_angel'],[]);w.cast('guardian_angel');step(w,1);(w as any).hurt(2000,'test',{category:'direct',damageType:'physical'});expect(w.hero.hp).toBe(300);expect(w.guardianUsed.has('hero')).toBe(true);const restored=World.restore(JSON.parse(JSON.stringify(w.exportCheckpoint())));(restored as any).hurt(2000,'test',{category:'direct',damageType:'physical'});expect(restored.hero.hp).toBe(0);expect(restored.guardianUsed.has('hero')).toBe(true);expect(()=>(w as any).hurt(20,'unclassified')).toThrow('Undeclared damage type');
 });
 it('ally healing and regeneration belong to the selected independent player',()=>{
  const w=world([],[]);w.addPlayer('a',stats,[raw('regen'),raw('second_wind')],{x:10,y:10});w.addPlayer('b',stats,[],{x:12,y:10});for(const id of ['a','b'])w.forPlayer(id,()=>w.setMode('manual'));w.players.get('b')!.hero.hp=100;w.players.get('a')!.hero.hp=500;
  expect(w.castAlly('a','b','regen',6)).toBe(true);const events=step(w,200);expect(w.players.get('a')!.hero.hp).toBe(500);expect(w.players.get('b')!.hero.hp).toBe(135);expect(events.filter(e=>e.type==='healed').every(e=>e.sourceId==='a'&&e.targetId==='b')).toBe(true);
 });
});

describe('schema, cooldown and all 55 skill growth contracts',()=>{
 it('rejects unknown effects and conflicting schedules',()=>{const a=raw('cut');(a.mechanics!.statuses as any).push({kind:'pretend',duration:30});expect(()=>skillSchema.parse(a)).toThrow();const z=raw('meteor');z.mechanics!.zone!.hits=3;expect(()=>skillSchema.parse(z)).toThrow();});
 it.each(skillCatalog.map(s=>s.id))('%s has at least one effective rank benefit and survives its wire schema',id=>{
  const a=resolve([id],1),b=resolve([id],2),current=a.resolvedSkills[0],next=b.resolvedSkills[0];expect(skillSchema.parse(current).mechanics).toEqual(current.mechanics);expect({damage:current.damage,range:current.range,cooldown:current.cooldown,mechanics:current.mechanics}).not.toEqual({damage:next.damage,range:next.range,cooldown:next.cooldown,mechanics:next.mechanics});const max=resolve([id],5);expect(max.skillAccess.find(s=>s.id===id)!.next).toBe(null);
 });
 it('resolved cooldown is exactly what the executor schedules, without applying cdr twice',()=>{
  const built=resolve(['cut']),skill=built.resolvedSkills[0];skill.resolution={...skill.resolution!,skillCooldownReduction:.75,statsCooldownReduction:.75,effectiveCooldownReduction:.75,finalCooldown:4};skill.cooldown=4;const w=new World(region,{...built.stats,cdr:.75},[skill],[spawn()]);w.setMode('manual');expect(w.cast('cut')).toBe(true);expect(w.cooldowns.cut).toBe(4);
 });
});
