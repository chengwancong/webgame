import {describe,it,expect} from 'vitest';
import {World} from '../packages/simulation/index.ts';
import {regionById,skillCatalog} from '../packages/content/index.ts';
import {innateCombos,comboAspectRules,comboAspectSources,weaponSchools} from '../packages/content/weapon-combos.ts';
import {aspectDefinitions} from '../packages/content/deep-progression.ts';
import {skillWeapons} from '../packages/content/skill-weapons.ts';
import {weaponTypes,comboRuleSchema,type CharacterState,type ComboRule,type Spawn,type Stats} from '../packages/contracts/index.ts';
import {makeGear,makeGearByBase,resolveBuild,ensureProgression} from '../packages/rules/index.ts';
import {vfxProfiles} from '../apps/web/src/vfx-profiles.ts';

const spawn=(id:string,x:number,y=8,hp=500):Spawn=>({id,kind:'melee',name:id,x,y,hp,attack:0,elite:false,boss:false,art:'raider'});
const innate=(id:string)=>innateCombos.find(r=>r.id===id)!;
const aspect=(key:string,patch:Partial<ComboRule>={})=>({...comboAspectRules.get('aspect-combo-'+key)!,...patch}) as ComboRule;
function world(weapon:Stats['weapon'],combos:ComboRule[],spawns:Spawn[],skills=['cut']){
 const stats:Stats={weapon,hp:900,attack:20,armor:4,speed:6,mana:500,regen:10,effects:[],combos};
 const w=new World(regionById('meadow'),stats,skillCatalog.filter(s=>skills.includes(s.id)),spawns,[],7);
 w.hero.position={x:7,y:8};w.anchor={...w.hero.position};w.mode='manual';return w;
}
const run=(w:World,ticks:number)=>{const events=[];for(let i=0;i<ticks;i++){w.step();events.push(...w.events);}return events;};
const state=():CharacterState=>({id:crypto.randomUUID(),name:'连携',revision:0,build:1,level:20,xp:0,gold:0,material:0,gear:[],equipment:{},skills:['cut'],skillRanks:{cut:1},progress:{kills:0,regions:['meadow'],bosses:[],safe:'town',tasks:[]}});

describe('weapon combo content',()=>{
 it('every main hand type has bound skills, a school and an innate combo',()=>{
  for(const weapon of weaponTypes){
   // 魔杖只亲和法术（法术不限主手），因此没有专属武技；其余主手都有绑定武技。
   expect(Object.values(skillWeapons).some(list=>list.includes(weapon)),weapon).toBe(weapon!=='wand');
   expect(weaponSchools[weapon].name).toBeTruthy();
   expect(innateCombos.some(r=>r.weapons.includes(weapon)),weapon).toBe(true);
  }
  expect(skillCatalog.filter(s=>skillWeapons[s.id].includes('hidden')).map(s=>s.id)).toHaveLength(11);
 });
 it('combo aspects are published as aspects without bypassing schemas, and every combo vfx key exists',()=>{
  for(const source of comboAspectSources)expect(aspectDefinitions.find(a=>a.id==='aspect-combo-'+source.key)).toMatchObject({combo:true,modifiers:[]});
  for(const r of [...innateCombos,...comboAspectRules.values()]){comboRuleSchema.parse(r);const key='vfx' in r.action?r.action.vfx:'combo/'+r.id;if(r.action.type==='nova'||r.action.type==='shards'||r.action.type==='status')expect(vfxProfiles[key],key).toBeDefined();}
 });
 it('rejects action/trigger combinations that have no executor',()=>{
  expect(()=>comboRuleSchema.parse({...innate('innate-sword-qi'),trigger:'cast'})).toThrow();
  expect(()=>comboRuleSchema.parse({...aspect('warpath'),trigger:'hit'})).toThrow();
  expect(()=>comboRuleSchema.parse({...innate('innate-sword-qi'),every:undefined})).toThrow();
 });
});

describe('server-resolved combos',()=>{
 it('carries only the current main hand school, and a combo aspect only for its weapon',()=>{
  const s=state();expect(resolveBuild(s).stats.combos).toBeUndefined();
  const sword=makeGear(0,crypto.randomUUID());s.gear.push(sword);s.equipment.weapon=sword.id;
  expect(resolveBuild(s).stats.combos?.map(r=>r.id)).toEqual(['innate-sword-qi']);
  sword.quality='legendary';sword.aspectId='aspect-combo-bloodblade';ensureProgression(s).codex['aspect-combo-bloodblade']=3;
  const blood=resolveBuild(s).stats.combos!.find(r=>r.id==='aspect-combo-bloodblade')!;
  expect(blood.action.type==='status'&&blood.action.ratio).toBeCloseTo(.72);
  const knives=makeGearByBase('standard-hidden-t1-weapon',crypto.randomUUID());s.gear.push(knives);s.equipment.weapon=knives.id;
  expect(resolveBuild(s).stats.weapon).toBe('hidden');
  expect(resolveBuild(s).stats.combos?.map(r=>r.id)).toEqual(['innate-hidden-return']);
 });
});

describe('combo execution',()=>{
 it('sword qi bursts on every third direct hit and damages the neighbour',()=>{
  const w=world('sword',[innate('innate-sword-qi')],[spawn('a',8),spawn('b',9.5)]),[a,b]=w.enemies;
  for(let n=1;n<=3;n++){expect(w.cast('cut',a)).toBe(true);run(w,40);expect(b.hp<500,`after ${n} hits`).toBe(n===3);}
  expect(w.comboCounts['innate-sword-qi']).toBe(0);
 });
 it('an area release hitting many enemies advances the nth counter once',()=>{
  const w=world(undefined,[innate('innate-sword-qi')],[spawn('a',8),spawn('b',8,9),spawn('c',7,9),spawn('d',6,8)],['whirl']);
  expect(w.cast('whirl')).toBe(true);run(w,20);expect(w.comboCounts['innate-sword-qi']).toBe(1);
 });
 it('kill chains stop at the derived depth limit',()=>{
  const w=world(undefined,[innate('innate-heavy-quake')],[spawn('a',8,8,1),spawn('b',10,8,1),spawn('c',12,8,1),spawn('d',14,8,1)]);
  w.cast('cut',w.enemies[0]);run(w,8);
  expect(w.enemies.map(e=>e.alive)).toEqual([false,false,false,true]);
 });
 it('derived combo hits never re-trigger hit combos',()=>{
  const w=world(undefined,[{...innate('innate-sword-qi'),weapons:['staff'],every:2}],[spawn('a',8),spawn('b',9.5)]);
  for(let n=0;n<2;n++){w.cast('cut',w.enemies[0]);run(w,40);}
  expect(w.comboCounts['innate-sword-qi']).toBe(0);
  const hits=w.enemies[1].hp;run(w,30);expect(w.enemies[1].hp).toBe(hits);
 });
 it('echo repeats the cast once at reduced damage and never echoes itself',()=>{
  const w=world('sword',[aspect('afterimage',{chance:1})],[spawn('a',8)]),cut=w.skills[0];
  w.cast('cut',w.enemies[0]);const hits=run(w,40).filter(e=>e.type==='hit_resolved'&&e.skill==='cut').map(e=>e.amount);
  expect(hits).toEqual([cut.damage,Math.round(cut.damage*.6)]);expect(w.echoes).toEqual([]);
 });
 it('shock and conditional amplify raise damage only against afflicted targets',()=>{
  const plain=world('sword',[aspect('hemophage')],[spawn('a',8)]);plain.cast('cut',plain.enemies[0]);run(plain,5);const base=500-plain.enemies[0].hp;
  const bled=world('sword',[aspect('hemophage')],[spawn('a',8)]);bled.applyStatus('a',{kind:'bleed',duration:300,strength:0,scope:'hit',interval:300,total:0,damageType:'physical',cleanse:true,breakOnDamage:false,removeWithSource:false});
  bled.cast('cut',bled.enemies[0]);run(bled,5);expect(500-bled.enemies[0].hp).toBe(Math.round(base*1.35));
  const shocked=world(undefined,[innate('innate-wand-shock')],[spawn('a',8)]);shocked.cast('cut',shocked.enemies[0]);run(shocked,40);const first=500-shocked.enemies[0].hp;
  expect(shocked.hasStatus('a','shock')).toBe(true);shocked.cast('cut',shocked.enemies[0]);run(shocked,5);expect(500-shocked.enemies[0].hp-first).toBe(Math.round(base*1.12));
 });
 it('skill zone ticks fire hit combos, status DOT ticks do not',()=>{
  const zone=world(undefined,[innate('innate-wand-shock')],[spawn('a',9)],['gravity_well']);
  expect(zone.cast('gravity_well',zone.enemies[0])).toBe(true);run(zone,60);expect(zone.hasStatus('a','shock')).toBe(true);
  const dot=world(undefined,[innate('innate-wand-shock')],[spawn('a',9)],[]);
  dot.applyStatus('a',{kind:'poison',duration:90,strength:0,scope:'hit',interval:30,total:30,damageType:'poison',cleanse:true,breakOnDamage:false,removeWithSource:false},dot.playerId,'poison_arrow');
  run(dot,60);expect(dot.enemies[0].hp).toBeLessThan(500);expect(dot.hasStatus('a','shock')).toBe(false);
 });
 it('bow split fires on every third projectile hit without needing crit',()=>{
  const w=world(undefined,[innate('innate-bow-split')],[spawn('a',10),spawn('b',10,10)],['bolt']);
  for(let n=0;n<3;n++){w.cast('bolt',w.enemies[0]);run(w,40);}
  expect(w.enemies[1].hp).toBeLessThan(500);expect(w.comboCounts['innate-bow-split']).toBe(0);
 });
 it('wildfire spreads the victim burn to nearby enemies on kill',()=>{
  const w=world(undefined,[aspect('wildfire')],[spawn('a',8,8,1),spawn('b',9.5),spawn('c',8,9.5)]);
  w.applyStatus('a',{kind:'burn',duration:120,strength:0,scope:'hit',interval:30,total:40,damageType:'fire',cleanse:true,breakOnDamage:false,removeWithSource:false},w.playerId,'ember');
  w.cast('cut',w.enemies[0]);run(w,5);expect(w.hasStatus('b','burn')).toBe(true);expect(w.hasStatus('c','burn')).toBe(true);
 });
 it('combo counters and queued echoes survive a combat checkpoint',()=>{
  const w=world('sword',[innate('innate-sword-qi'),aspect('afterimage',{chance:1})],[spawn('a',8)]);
  w.cast('cut',w.enemies[0]);run(w,4);const restored=World.restore(w.exportCheckpoint());
  expect(restored.comboCounts).toEqual(w.comboCounts);expect(restored.echoes.map(x=>x.at)).toEqual(w.echoes.map(x=>x.at));
  const a=run(w,30).filter(e=>e.type==='hit_resolved').map(e=>e.amount),b=run(restored,30).filter(e=>e.type==='hit_resolved').map(e=>e.amount);expect(b).toEqual(a);
 });
});
