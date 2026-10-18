// B2 §2.3: one mapping table from "how you died" to at most three clickable suggestions.
// The table is the single source; the client only renders what it is given.
import type {CombatAdvice,CombatHitKind} from '../contracts/combat-review.ts';
import {periodicDamageKinds,type DamageType,type StatusKind} from '../contracts/skill-mechanics.ts';

export type DeathCause='burst'|'area'|'element'|'output'|'unknown';

const adviceByCause:Record<DeathCause,CombatAdvice[]>={
 // 近身爆发 / 背刺 / 被围
 burst:[{label:'控场技能',target:'skills'},{label:'加生存天赋',target:'survival'},{label:'强化护甲',target:'forge',focus:'armor'}],
 // 远程 / 地面范围
 area:[{label:'加生存天赋',target:'survival'},{label:'强化护甲',target:'forge',focus:'armor'}],
 // 元素伤害或持续伤害
 element:[{label:'换抗性装备',target:'bag'},{label:'加生存天赋',target:'survival'},{label:'控场技能',target:'skills'}],
 // 没死但超时，或对首领打不动
 output:[{label:'强化武器',target:'forge',focus:'weapon'},{label:'加输出天赋',target:'damage'},{label:'换把主手',target:'bag'}],
 unknown:[{label:'强化护甲',target:'forge',focus:'armor'},{label:'加生存天赋',target:'survival'}],
};
export const maxCombatAdvice=3;
const elemental=new Set<DamageType>(['fire','cold','lightning','arcane','shadow','poison']);

/** 死因只由招式的形态、伤害类型和附带状态推导，不按技能 ID 硬编码。 */
export function deathCause(hit:{kind:CombatHitKind;damageType?:string|null;statuses?:readonly StatusKind[]}):DeathCause{
 if((hit.statuses??[]).some(kind=>periodicDamageKinds.includes(kind as typeof periodicDamageKinds[number])))return 'element';
 // 近身、召唤、突袭位移都是“被近身”问题；元素只在不是贴身招式时才指向抗性。
 if(hit.kind==='melee')return 'burst';
 if(hit.kind==='summon'||hit.kind==='buff')return 'burst';
 if(hit.kind==='teleport')return 'burst';
 if(hit.damageType&&elemental.has(hit.damageType as DamageType))return 'element';
 return 'area';
}
/** 输出不够时输出类建议优先；其余按死因给，最多 3 条且去重。 */
export function selectCombatAdvice(cause:DeathCause,outputShort=false):CombatAdvice[]{
 const ordered=outputShort?[...adviceByCause.output,...adviceByCause[cause]]:adviceByCause[cause]??adviceByCause.unknown;
 const seen=new Set<string>();
 return ordered.filter(a=>{const key=a.label+a.target;if(seen.has(key))return false;seen.add(key);return true;}).slice(0,maxCombatAdvice);
}
