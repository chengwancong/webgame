// §5.2 修复开场武器的验收（推导一次、验证一次）：
// 1) 修复后对比起手武器，换装总评要是「更强 / 更偏输出」（第一次打造有看得见的回报，D5）；
// 2) 不压过本阶段掉落：风栖末段（L8）稀有武器掉落里，比修复件弱的不超过 1/3（制作件 = 本阶段掉落中上）。
// 用法：node --import tsx tools/spine/repair-weapon-check.ts
import assert from 'node:assert/strict';
import '../../packages/content/open-world/index.ts';
import {makeGear,makeGearByBase,resolveBuild} from '../../packages/rules/index.ts';
import {makeStarseaStarterWeapon} from '../../packages/rules/starsea-starter.ts';
import {newStarseaState} from '../../packages/rules/starsea.ts';
import {choosePrologueWeapon,finishPrologue} from '../../packages/rules/starsea-prologue.ts';
import {applyCraft} from '../../packages/rules/crafting.ts';
import {applyItemPower} from '../../packages/rules/item-power.ts';
import {issueCombatGear,freezeItemRules} from '../../packages/rules/item-issuance.ts';
import {compareVerdict} from '../../packages/rules/stat-comparison.ts';
import {prologueConfig} from '../../packages/content/starsea/prologue.ts';
import {craftRepairRecipe} from '../../packages/content/crafting.ts';
import type {CharacterState,Gear} from '../../packages/contracts/index.ts';
const starterSkills=prologueConfig.families.sword.starterSkills;
let n=0;const uuid=()=>'00000000-0000-4000-8000-'+String(++n).padStart(12,'0');
function seeded(seed:number){let x=seed>>>0;const next=()=>{x=(x*1664525+1013904223)>>>0;return x/2**32;};return {float:next,int:(a:number,b:number)=>a+Math.floor(next()*(b-a))};}
const place={atForge:true,reason:'',storyUnlocked:true,maxCraftLevel:0};
function character(family:'sword'|'staff'|'hidden'){
 const gear=[makeStarseaStarterWeapon(uuid()),makeGear(2,uuid())];
 const s={field:{gathered:[]},id:uuid(),name:'t',revision:0,build:1,level:1,xp:0,gold:282,material:0,gear,equipment:{weapon:gear[0].id,armor:gear[1].id},weaponLoadouts:{},skills:[...starterSkills],skillRanks:Object.fromEntries(starterSkills.map(id=>[id,1])),skillBooks:{},progress:{kills:0,regions:[],bosses:[],safe:'ss-map-wind',tasks:[]},starsea:newStarseaState()} as CharacterState;
 choosePrologueWeapon(s,family);finishPrologue(s);return s;
}
const wearing=(s:CharacterState,g:Gear)=>{const prev=s.equipment.weapon;s.gear.push(g);s.equipment.weapon=g.id;const st=resolveBuild(s).stats;s.equipment.weapon=prev;s.gear.pop();return st;};
console.log('repair output',craftRepairRecipe!.output);
for(const family of ['sword','staff','hidden'] as const){
 const up:Record<string,number>={},drops:Record<string,number>={};
 for(let seed=1;seed<=30;seed++){
  const s=character(family);s.level=4;Object.assign(s.progression!.materials,{wind_ore:4,wind_herb:2});
  const before=resolveBuild(s).stats,base=s.gear[0].base;applyCraft(s,{op:'craft',recipe:craftRepairRecipe!.id,slot:'weapon'},place,seeded(seed));
  const v=compareVerdict(before,resolveBuild(s).stats);up[v]=(up[v]??0)+1;
  s.level=8;const repaired=resolveBuild(s).stats;
  for(let d=1;d<=10;d++){const g=makeGearByBase(base,uuid());g.quality='rare';applyItemPower(g,8);issueCombatGear(g,g.ilvl!,3,8,false,freezeItemRules(),seeded(seed*100+d));const k=compareVerdict(repaired,wearing(s,g));drops[k]=(drops[k]??0)+1;}
 }
 const weaker=(drops.weaker??0)/300;
 console.log(family,'修复后对比起手',up,'| L8 稀有掉落对比修复件',drops,'掉落更弱占比',weaker.toFixed(2));
 assert.equal((up.stronger??0)+(up.output??0),30,family+' 修复后必须更强');
 assert.ok(weaker<=1/3,family+' 修复件压过了本阶段掉落');
}
console.log('全部通过');
