// B2: one short player-facing line per enemy move, plus the shared fallback table.
// Follows docs/ui-copy-voice.md: say what the move does to you, not how it is built.
import type {CombatHitKind} from '../contracts/combat-review.ts';
import type {DamageType,StatusKind} from '../contracts/skill-mechanics.ts';

/** 状态小标签（≤4 字），贴在招式名旁边，不再另写句子。 */
export const statusLabels:Record<StatusKind,string>={
 burn:'灼烧',poison:'中毒',slow:'减速',stun:'眩晕',silence:'沉默',petrify:'石化',fear:'恐惧',root:'定身',
 blind:'致盲',time_stop:'停滞',attack_up:'攻强',speed_up:'加速',armor_down:'破甲',counter:'反击',immunity:'免疫',
 guardian:'守护',regen:'再生',bleed:'流血',shock:'感电',freeze:'冰冻',vulnerable:'易伤',
};
export type StatusLabel=typeof statusLabels;

export const damageTypeLabels:Record<DamageType,string>={
 physical:'物理',fire:'火焰',cold:'冰霜',lightning:'闪电',arcane:'奥术',shadow:'暗影',poison:'毒素',pure:'真实',
};

/** 招式怎么来的。按类型取，不按技能 ID 硬编码。 */
const hintsByKind:Record<CombatHitKind,string>={
 melee:'它会贴近你再出手',
 projectile:'它从远处打过来，侧身躲',
 zone:'地面先亮起红圈，走开就好',
 beam:'一条直线扫过来，往侧面躲',
 trap:'地上会留标记，别站上去',
 summon:'它会喊来帮手，先清小怪',
 buff:'它给同伴加力，优先打断',
 teleport:'它会突然消失，换个地方出现',
};
/** 带元素或持续伤害时补一句后果。 */
const elementTail:Partial<Record<DamageType,string>>={
 fire:'，留意火焰',
 poison:'，留意毒素',
 cold:'，留意冰霜',
 lightning:'，留意闪电',
 shadow:'，留意暗影',
 arcane:'，留意奥术',
};
export const maxSkillHintChars=20;
export function defaultSkillHint(kind:CombatHitKind,damageType?:DamageType|null){
 const base=hintsByKind[kind]??hintsByKind.melee,tail=damageType?elementTail[damageType]??'':'';
 const composed=base+tail;return composed.length<=maxSkillHintChars?composed:base;
}
/** 技能自带 hint 优先，没填的按类型回退。 */
export function skillHint(skill:{hint?:string;kind:string;damageType?:DamageType|null}){
 return skill.hint??defaultSkillHint(skill.kind as CombatHitKind,skill.damageType);
}
export function statusLabelList(statuses:readonly {kind:StatusKind}[]|undefined){
 return [...new Set((statuses??[]).map(s=>statusLabels[s.kind]).filter(Boolean))].slice(0,4);
}
