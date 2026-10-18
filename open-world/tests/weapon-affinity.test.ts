import {describe,it,expect} from 'vitest';
import type {CharacterState,Gear} from '../packages/contracts/index.ts';
import {resolveBuild,makeGearByBase} from '../packages/rules/index.ts';
import {gearWeaponAffinity,gearWeaponLabel,mainHandAffinity} from '../packages/rules/weapon-skills.ts';
import {equipmentItems} from '../packages/content/equipment-catalog.ts';
import {weaponAffinityPower,skillWeapons} from '../packages/content/skill-weapons.ts';
import {skillCatalog,regionById} from '../packages/content/index.ts';
import {skillTags} from '../packages/content/skill-tags.ts';
import {World} from '../packages/simulation/index.ts';

const base=(family:string)=>{const item=equipmentItems.find(i=>i.part==='weapon'&&i.family===family&&i.obtainable)!;return item.runtimeBase??item.id;};
// UUID 末位十六进制奇数为法杖（法术），偶数为战杖（武技）。
const gear=(family:string,last='0'):Gear=>makeGearByBase(base(family),'00000000-0000-4000-8000-00000000000'+last);
const character=(weapon:Gear,skills:string[]):CharacterState=>({id:'affinity',name:'亲和',revision:1,build:1,level:30,xp:0,gold:0,material:0,gear:[weapon],equipment:{weapon:weapon.id},skills:skills.slice(0,4),skillRanks:Object.fromEntries(skills.map(id=>[id,1])),skillBooks:{},progress:{kills:0,regions:['town'],bosses:[],safe:'town',tasks:[]}});
const staffSkills=['staff_strike','staff_sweep','pole_vault','staff_flurry','seismic_staff','staff_cyclone'];

describe('weapon affinity',()=>{
 it('wand is spell-only, physical weapons are martial, staffs split per item and stay stable',()=>{
  expect(gearWeaponAffinity(gear('wand'))).toBe('spell');
  for(const family of ['sword','hammer','axe','hidden'])expect(gearWeaponAffinity(gear(family)),family).toBe('martial');
  expect(gearWeaponAffinity(gear('staff','0'))).toBe('martial');expect(gearWeaponLabel(gear('staff','0'))).toBe('战杖');
  expect(gearWeaponAffinity(gear('staff','1'))).toBe('spell');expect(gearWeaponLabel(gear('staff','1'))).toBe('法杖');
  const staff=gear('staff','7');expect(gearWeaponAffinity(staff)).toBe(gearWeaponAffinity(structuredClone(staff)));
  expect(mainHandAffinity({gear:[],equipment:{}})).toBeNull();
 });
 it('the server applies one tag-scoped [×] to the matching school only',()=>{
  const martial=resolveBuild(character(gear('staff','0'),['staff_strike','ember'])),spell=resolveBuild(character(gear('staff','1'),['staff_strike','ember']));
  const access=(b:typeof martial,id:string)=>b.skillAccess.find(s=>s.id===id)!;
  expect(martial.stats.zones).toContainEqual(expect.objectContaining({id:'weapon-affinity',kind:'mult',value:weaponAffinityPower,tags:['martial']}));
  expect(spell.stats.zones).toContainEqual(expect.objectContaining({id:'weapon-affinity',tags:['spell']}));
  expect(access(martial,'staff_strike').affinityBonus).toBe(weaponAffinityPower);expect(access(martial,'ember').affinityBonus).toBe(1);
  expect(access(spell,'ember').affinityBonus).toBe(weaponAffinityPower);expect(access(spell,'staff_strike').affinityBonus).toBe(1);
  // 同一技能、同一攻击力，只差亲和区：伤害比等于亲和倍率（取整误差内）。
  const ratio=access(martial,'staff_strike').current!.damage/access(spell,'staff_strike').current!.damage;expect(ratio).toBeCloseTo(weaponAffinityPower,1);
  const ember=access(spell,'ember').current!.damage/access(martial,'ember').current!.damage;expect(ember).toBeCloseTo(weaponAffinityPower,1);
  expect(access(martial,'staff_strike').weaponCompatible).toBe(true);expect(access(spell,'staff_strike').weaponCompatible).toBe(true);
  expect(resolveBuild(character(gear('wand'),['staff_strike'])).skillAccess.find(s=>s.id==='staff_strike')!.weaponCompatible).toBe(false);
  expect(resolveBuild(character(gear('sword'),['ember'])).skillAccess.find(s=>s.id==='ember')!.weaponCompatible).toBe(true);
 });
});

describe('staff martial skills',()=>{
 it('are physical martial skills bound only to the staff',()=>{
  for(const id of staffSkills){const sk=skillCatalog.find(s=>s.id===id)!;expect(skillWeapons[id]).toEqual(['staff']);expect(skillTags(sk).slice(0,3)).toEqual(['martial','melee','physical']);}
 });
 it.each(staffSkills)('%s casts with a staff main hand and applies its declared mechanics',id=>{
  const b=resolveBuild(character(gear('staff','0'),[id])),skill=b.skillAccess.find(s=>s.id===id)!.current!;
  const w=new World({...regionById('meadow'),safe:{x:10,y:10},obstacles:[]},{...b.stats,hp:100000,mana:10000,regen:0,critChance:0,lifesteal:0},[skill],[{id:'target',name:'靶',kind:'melee',x:12,y:10,hp:1000000,attack:0,boss:false,elite:false,art:'raider'}],[],41);
  w.setMode('manual');w.enemies[0].cooldown=100000;expect(w.cast(id,w.enemies[0])).toBe(true);
  const events=[];for(let i=0;i<120;i++){w.step();events.push(...w.events);}
  const hits=events.filter(e=>e.type==='hit_resolved'&&e.skill===id);expect(hits.length).toBe(skill.mechanics?.schedule?.hits??1);
  for(const status of skill.mechanics?.statuses??[])expect(events.some(e=>e.type==='status_changed'&&(e as {status?:string}).status===status.kind),status.kind).toBe(true);
 });
});
