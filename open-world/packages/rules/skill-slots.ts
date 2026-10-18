import {skillRecoveryRows} from '../content/task-tables.ts';
import {skillCatalog} from '../content/index.ts';
import {skillWeapons} from '../content/skill-weapons.ts';
import type {CharacterState} from '../contracts/index.ts';
/** 技能找回、技能槽、法术按岛（docs/progression-goal-plan.md §4）。规则全部来自任务.xlsx「技能找回」。
 * 没有开场记录的角色（老角色）不受影响：不封存、4 个槽、法术不加岛屿条件。 */
type Family='sword'|'staff'|'hidden';
type Rows=typeof skillRecoveryRows;
type Pick_<K extends Rows[number]['kind']>=Extract<Rows[number],{kind:K}>;
const of=<K extends Rows[number]['kind']>(kind:K)=>skillRecoveryRows.filter((r):r is Pick_<K>=>r.kind===kind);
export const recoveryRows=of('recovery').sort((a,b)=>a.order-b.order),routeRows=of('route'),grantRows=of('grant'),slotRows=of('slot'),spellIslandRows=of('spell-island').sort((a,b)=>a.max_level-b.max_level),skillIslandRows=of('skill-island');
export const swapLine=of('swap')[0]?.line;
export const maxSkillSlots=Math.max(...slotRows.map(r=>r.slots));
type Holder={starsea?:CharacterState['starsea']};
/** 走新成长流程的角色的武器倾向；老角色为 null。 */
export function recoveryFamily(s:Holder):Family|null{const p=s.starsea?.prologue;return p?(p.weapon??'sword'):null;}
const taskDone=(s:Holder,task:string)=>Boolean(s.starsea?.done.includes(task));
export function familyRecovery(s:Holder){const f=recoveryFamily(s);return f?recoveryRows.filter(r=>r.family===f):[];}
/** 本武器倾向的招牌技，在找回任务完成前封存：不能激活、不能升级、不进战斗。 */
export function signatureRow(s:Holder,id:string){return familyRecovery(s).find(r=>r.skill===id);}
export function signatureSealed(s:Holder,id:string){const r=signatureRow(s,id);return Boolean(r&&!taskDone(s,r.task));}
/** 任务送的技能（不分武器或只给某把武器），完成前封存。 */
export function grantRow(s:Holder,id:string){const f=recoveryFamily(s);return f?grantRows.find(r=>r.skill===id&&(!r.family||r.family===f)):undefined;}
export function familyGrants(s:Holder){const f=recoveryFamily(s);return f?grantRows.filter(r=>!r.family||r.family===f):[];}
/** 招牌技或任务送的技能，在对应任务完成前都不能激活、不能升级、不进战斗。 */
export function skillSealed(s:Holder,id:string){const r=grantRow(s,id);return signatureSealed(s,id)||Boolean(r&&!taskDone(s,r.task));}
// 技能位：任务完成或这个任务的路线已经选定（进港路选路时就要能装上送的招）。
const slotReached=(s:Holder,task:string)=>taskDone(s,task)||Boolean(s.starsea?.quests?.[task]?.choice);
export function skillSlotCount(s:Holder){if(!recoveryFamily(s))return maxSkillSlots;return Math.max(...slotRows.filter(r=>!r.task||slotReached(s,r.task)).map(r=>r.slots));}
/** 法术与辅助（任意主手可用）：先看单列归岛的技能，其余按解锁等级落入岛屿等级带。 */
export function spellIsland(id:string){const listed=skillIslandRows.find(r=>r.skill===id);if(listed)return listed.island;const sk=skillCatalog.find(x=>x.id===id);if(!sk||skillWeapons[id]?.length)return;return spellIslandRows.find(r=>sk.unlockLevel<=r.max_level)?.island;}
/** 法术所属岛的出现顺序：单列的岛在前（风栖），再按等级带。 */
export const spellIslands=[...new Set([...skillIslandRows.map(r=>r.island),...spellIslandRows.map(r=>r.island)])];
/** 新流程下需要「到过所属岛」的法术；招牌技和任务送的技能走任务，不走岛屿条件。 */
export function spellIslandGate(s:Holder,id:string){if(!recoveryFamily(s)||signatureRow(s,id)||grantRow(s,id))return;const island=spellIsland(id);if(!island)return;return {island,visited:Boolean(s.starsea?.islands.includes(island))};}
