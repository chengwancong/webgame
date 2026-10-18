import {taskById} from '../content/task-tables.ts';
import {skillCatalog} from '../content/index.ts';
import {starseaMap} from '../content/starsea/index.ts';
import type {CharacterState} from '../contracts/index.ts';
import {skillWeaponAllowed,rememberWeaponSkills} from './skill-weapon-access.ts';
import {recoveryFamily,familyRecovery,familyGrants,routeRows,slotRows,skillSlotCount,signatureSealed,spellIslands,spellIsland,swapLine} from './skill-slots.ts';
export * from './skill-slots.ts';
type Gain={messages:string[]};
const skillName=(id:string)=>skillCatalog.find(x=>x.id===id)?.name??id;
/** 激活并在有空槽时自动装上。swap=true（找回的招牌技）时技能条满了先换下护盾、治疗类辅助（§11.3）。返回换下的技能。 */
function grant(s:CharacterState,id:string,swap=false){
 s.skillRanks[id]=Math.max(1,s.skillRanks[id]??0);let out:string|undefined;
 if(!s.skills.includes(id)&&skillWeaponAllowed(s,id)){
  if(s.skills.length<skillSlotCount(s))s.skills.push(id);
  else if(swap){const i=s.skills.findIndex(x=>{const k=skillCatalog.find(sk=>sk.id===x)?.kind;return k==='shield'||k==='heal';});if(i>=0){out=s.skills[i];s.skills[i]=id;}}
  rememberWeaponSkills(s);
 }
 s.build++;return out;
}
/** 任务完成时调用（服务端结算内）：招牌技找回、技能槽打开。 */
export function applySkillRecovery(s:CharacterState,task:string,g:Gain){
 if(!recoveryFamily(s))return;
 for(const r of familyGrants(s).filter(r=>r.task===task)){grant(s,r.skill);g.messages.push(r.line);}
 for(const r of familyRecovery(s).filter(r=>r.task===task)){const out=grant(s,r.skill,true);g.messages.push(r.line);if(out&&swapLine)g.messages.push(swapLine.replace('{new}',skillName(r.skill)).replace('{old}',skillName(out)));}
 // 选路的任务在选路时就开了技能位、说过这句（grantRouteSkill），完成时不再重复。
 if(!routeRows.some(r=>r.task===task))for(const r of slotRows.filter(r=>r.task===task))if(r.line)g.messages.push(r.line);
}
/** 选路时调用：送一个解决这条路难点的本武器招式（等级没到也送）。 */
export function grantRouteSkill(s:CharacterState,task:string,choice:'a'|'b',g:Gain){
 const f=recoveryFamily(s);if(!f)return;
 for(const r of slotRows.filter(r=>r.task===task))if(r.line)g.messages.push(r.line);
 for(const r of routeRows.filter(r=>r.family===f&&r.task===task&&r.choice===choice)){grant(s,r.skill);g.messages.push(r.line);}
}
/** 客户端用：封存列表、下一次找回、槽数、各岛可学法术。 */
export function skillRecoveryView(s:CharacterState){
 const family=recoveryFamily(s);if(!family)return;
 const rows=familyRecovery(s),next=rows.find(r=>signatureSealed(s,r.skill));
 return {family,slots:skillSlotCount(s),total:rows.length,recovered:rows.filter(r=>!signatureSealed(s,r.skill)).map(r=>r.skill),sealed:rows.filter(r=>signatureSealed(s,r.skill)).map(r=>r.skill),
  next:next?{skill:next.skill,name:skillName(next.skill),task:next.task,taskName:taskById.get(next.task)?.title??next.task,order:next.order}:null,
  islands:spellIslands.map(island=>({island,name:starseaMap(island).name,visited:Boolean(s.starsea?.islands.includes(island)),skills:skillCatalog.filter(k=>spellIsland(k.id)===island&&!rows.some(x=>x.skill===k.id)&&!familyGrants(s).some(x=>x.skill===k.id)).map(k=>k.id)}))};
}
