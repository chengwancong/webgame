import {prologueConfig,type PrologueFamily} from '../content/starsea/prologue.ts';
import {starseaBalance as balance} from '../content/starsea/balance.ts';
import {makeStarseaStarterWeapon} from './starsea-starter.ts';
import {StarseaError} from './starsea.ts';
import type {CharacterState} from '../contracts/index.ts';
import {ensureProgression} from './deep-progression.ts';
import {craftRepairRecipe} from '../content/crafting.ts';
/** 开场「坠星觉醒」的存档部分（docs/opening-hook-design.md）：服务端只记三选一和是否看完。
 * 开场战斗在客户端沙盒里跑，授予构筑不进存档，也不产生击杀、掉落和经验。
 * 没有 prologue 字段的角色（开场上线前创建）一律视为已完成，不补播也不补发。 */
export function prologuePending(s:CharacterState){return s.starsea?.prologue?.done===false;}
const fail=(message:string):never=>{throw new StarseaError('PROLOGUE',message);};
/** 按三选一换初始武器和起手技能。只在开场未完成、且武器和技能仍是建角时的剑系起手时生效；同一选择重复提交不改动。 */
export function choosePrologueWeapon(s:CharacterState,family:PrologueFamily){
 const p=s.starsea?.prologue;if(!p||p.done)fail('开场已经结束。');
 if(p!.weapon)return p!.weapon===family?false:fail('初始武器已经选定。');
 const sword=prologueConfig.families.sword,weapon=s.gear.find(g=>g.id===s.equipment.weapon);
 if(!weapon||weapon.base!==balance.starterWeapon.template||s.level!==1||s.skills.join()!==sword.starterSkills.join()||s.skills.some(id=>s.skillRanks[id]!==1))fail('角色已经调整过武器或技能，不能再换初始武器。');
 p!.weapon=family;if(family==='sword')return true;
 const next=makeStarseaStarterWeapon(weapon!.id,family);s.gear=s.gear.map(g=>g.id===next.id?next:g);
 const skills=prologueConfig.families[family].starterSkills;s.skills=[...skills];s.skillRanks=Object.fromEntries(skills.map(id=>[id,1]));s.weaponLoadouts={};s.build++;
 return true;
}
/** 看完或跳过。跳过时没选过就按剑（默认）处理。 */
export function finishPrologue(s:CharacterState){const p=s.starsea?.prologue;if(!p)fail('开场已经结束。');if(p!.done)return false;if(!p!.weapon)choosePrologueWeapon(s,'sword');p!.done=true;
 // 第一个打造目标：修复开场武器，自动钉选（docs/progression-goal-plan.md §5.2）；追踪条等工坊开放后才显示。
 const c=ensureProgression(s).crafting;if(craftRepairRecipe&&!c.pin)c.pin={recipe:craftRepairRecipe.id,slot:'weapon'};return true;}
