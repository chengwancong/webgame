import {it,expect} from 'vitest';
import {makeGear} from '../packages/rules/index.ts';
import {makeStarseaStarterWeapon} from '../packages/rules/starsea-starter.ts';
import {newStarseaState} from '../packages/rules/starsea.ts';
import {ensureProgression} from '../packages/rules/deep-progression.ts';
import {applyCraft,craftingView} from '../packages/rules/crafting.ts';
import {pinCraftGoal,craftGoalView} from '../packages/rules/craft-goal.ts';
import {freezeCraftingLoot} from '../apps/api/src/crafting-loot.ts';
import {prologueConfig} from '../packages/content/starsea/prologue.ts';
const starterSkills=prologueConfig.families.sword.starterSkills;
import {choosePrologueWeapon,finishPrologue} from '../packages/rules/starsea-prologue.ts';
import {craftTierPreview} from '../packages/rules/craft-tier-preview.ts';
import type {CharacterState} from '../packages/contracts/index.ts';
// 钉选目标装备、本岛招牌配方登岛即会（docs/progression-goal-plan.md §5.1）。
let n=0;const uuid=()=>'00000000-0000-4000-8000-'+String(++n).padStart(12,'0');
function character(islands:string[]):CharacterState{
 const gear=[makeStarseaStarterWeapon(uuid()),makeGear(2,uuid())];
 const s={field:{gathered:[]},id:uuid(),name:'t',revision:0,build:1,level:1,xp:0,gold:0,material:0,gear,equipment:{weapon:gear[0].id,armor:gear[1].id},weaponLoadouts:{},skills:[...starterSkills],skillRanks:Object.fromEntries(starterSkills.map(id=>[id,1])),skillBooks:{},progress:{kills:0,regions:[],bosses:[],safe:'ss-map-wind',tasks:[]},starsea:newStarseaState()} as CharacterState;
 s.starsea!.islands=islands;ensureProgression(s);return s;
}
const place={atForge:true,reason:'',storyUnlocked:true,maxCraftLevel:99};
const known=(s:CharacterState,id:string)=>craftingView(s,place).recipes.find(r=>r.id===id)!.known;

it('island signature recipes are known once the island is reached, and never drop',()=>{
 const s=character([]);
 expect(known(s,'wind-weapon')).toBe(false);
 s.starsea!.islands=['ss-map-wind'];
 for(const id of ['wind-weapon','wind-armor','wind-accessory'])expect(known(s,id)).toBe(true);
 expect(known(s,'mist-weapon')).toBe(false);expect(known(s,'wind-resist')).toBe(false);
 const drops=freezeCraftingLoot().recipes.map(r=>r.id);
 expect(drops).not.toContain('wind-weapon');expect(drops).toContain('wind-resist');expect(drops).toContain('forge-legacy-bow');
});

it('pin shows have/need with sources, adds the boss material for an element, and validates',()=>{
 const s=character(['ss-map-wind']);
 expect(craftGoalView(s)).toBeNull();
 expect(()=>pinCraftGoal(s,{recipe:'mist-weapon'})).toThrow();
 expect(()=>pinCraftGoal(s,{recipe:'wind-weapon',slot:'armor'})).toThrow();
 s.progression!.materials.wind_ore=12;s.gold=500;
 pinCraftGoal(s,{recipe:'wind-weapon',slot:'weapon',tendency:'martial',element:'fire'});
 const v=craftGoalView(s)!;
 expect(v).toMatchObject({recipe:'wind-weapon',element:'fire',ready:false,gold:{have:282,need:282}});
 expect(v.materials.find(m=>m.id==='wind_ore')).toMatchObject({have:12,need:20,name:'风纹铁'});
 expect(v.materials.find(m=>m.id==='wind_boss')).toMatchObject({have:0,need:1});
 expect(v.materials.every(m=>m.sources.length>0)).toBe(true);
 pinCraftGoal(s,null);expect(craftGoalView(s)).toBeNull();
});

it('crafting the pinned recipe clears the pin; another recipe keeps it',()=>{
 const s=character(['ss-map-wind']);
 Object.assign(s.progression!.materials,{wind_ore:60,wind_herb:30,wind_part:24});s.gold=2000;
 pinCraftGoal(s,{recipe:'wind-weapon',slot:'weapon',tendency:'martial'});
 expect(craftGoalView(s)!.ready).toBe(true);
 applyCraft(s,{op:'craft',recipe:'wind-armor',slot:'armor'},place);
 expect(craftGoalView(s)?.recipe).toBe('wind-weapon');
 applyCraft(s,{op:'craft',recipe:'wind-weapon',slot:'weapon',tendency:'martial'},place);
 expect(craftGoalView(s)).toBeNull();
});

const prologue=(family:'sword'|'staff')=>{const s=character(['ss-map-wind']);s.starsea!.prologue={done:false};choosePrologueWeapon(s,family);finishPrologue(s);return s;};
it('repair: auto-pinned after the prologue, reforges the starter in place once, ignores bag and stage limits',()=>{
 const s=prologue('staff'),starter=structuredClone(s.gear.find(g=>g.id===s.equipment.weapon)!);
 expect(craftGoalView(s)).toMatchObject({recipe:'repair-starter-weapon',ready:false});
 expect(known(s,'repair-starter-weapon')).toBe(true);
 Object.assign(s.progression!.materials,{wind_ore:4,wind_herb:2});s.gold=282;s.level=4;
 while(s.gear.length<400)s.gear.push(makeGear(2,uuid()));
 applyCraft(s,{op:'craft',recipe:'repair-starter-weapon',slot:'weapon'},{...place,maxCraftLevel:0});
 const g=s.gear.find(g=>g.id===starter.id)!;
 expect(s.equipment.weapon).toBe(starter.id);expect(g.base).toBe(starter.base);expect(g.ilvl).toBe(4);expect(g.quality).toBe('rare');
 expect(g.affixes.map(a=>a.stat)).toEqual(['attack','spellDamage']);expect(g.affixes[0]).toEqual(starter.affixes[0]);
 expect(craftGoalView(s)).toBeNull();
 expect(craftingView(s,place).recipes.some(r=>r.id==='repair-starter-weapon')).toBe(false);
 Object.assign(s.progression!.materials,{wind_ore:4,wind_herb:2});s.gold=282;
 expect(()=>applyCraft(s,{op:'craft',recipe:'repair-starter-weapon',slot:'weapon'},place)).toThrow();
});
it('repair is not offered to legacy characters and needs the starter equipped',()=>{
 const legacy=character(['ss-map-wind']);delete legacy.starsea!.prologue;
 expect(craftingView(legacy,place).recipes.some(r=>r.id==='repair-starter-weapon')).toBe(false);
 const s=prologue('sword');Object.assign(s.progression!.materials,{wind_ore:4,wind_herb:2});s.gold=282;
 s.equipment.weapon=undefined;
 expect(()=>applyCraft(s,{op:'craft',recipe:'repair-starter-weapon',slot:'weapon'},place)).toThrow('先装备开场武器');
});
it('tier preview: within 2 levels of the next tier, only for an island already open',()=>{
 const s=character(['ss-map-wind']);s.level=8;
 expect(craftTierPreview(s)).toBeNull();
 s.starsea!.islands.push('ss-map-mist');
 expect(craftTierPreview(s)).toMatchObject({level:10,tier:2,ratio:1.7,recipe:'mist-weapon'});
 s.level=7;expect(craftTierPreview(s)).toBeNull();
 s.level=15;s.starsea!.islands.push('ss-map-forge');expect(craftTierPreview(s)).toMatchObject({level:17,tier:3,ratio:1.65});
});

it('gap diagnosis: element death points to the resist potion, an old weapon tier to the open island recipe',async()=>{
 const {gapDiagnosis}=await import('../packages/rules/gap-diagnosis.ts');
 const s=character(['ss-map-wind','ss-map-mist','ss-map-forge']);s.level=12;
 expect(gapDiagnosis(s,{damageType:'火焰'})).toBe('火焰抗不足 → 赤炉抗性药剂（本岛宝箱或稀有怪发现）');
 s.progression!.recipes.push('forge-resist');
 expect(gapDiagnosis(s,{damageType:'fire'})).toBe('火焰抗不足 → 赤炉抗性药剂（工坊·炼金）');
 expect(gapDiagnosis(s,{damageType:'物理'})).toBe('武器还在 T1，雾铃定向武器可以换 T2（工坊·锻造）');
 s.starsea!.islands=['ss-map-wind'];
 expect(gapDiagnosis(s,{damageType:'物理'})).toBe('武器还在 T1，10 级起的掉落已经是 T2');
 s.level=8;expect(gapDiagnosis(s,{})).toBeNull();expect(gapDiagnosis(s,{outputShort:true})).toBe('再升 2 级，装备换 T2');
});
