import type {Skill} from '../contracts/index.ts';
import {tacticsSchema,type Tactics} from '../contracts/tactics.ts';
/**
 * 托管编排（planning-bd-v1/27 §3，R2）。默认编排由已装技能生成，与改版前的自动战斗行为一致：
 * 按技能栏顺序放、最近目标、有投射物就保持距离否则贴身、低血先保命，所有技能无条件。
 */
export function defaultTactics(skills:Pick<Skill,'id'|'kind'>[]):Tactics{
 return {order:skills.map(s=>s.id),target:'near',stance:skills.some(s=>s.kind==='projectile')?'range':'close',survival:true,conditions:{}};
}
/** 存档里的编排对齐当前技能栏：去掉已卸下的技能，新装的技能按技能栏顺序补在末尾。 */
export function resolveTactics(saved:Tactics|undefined,skills:Pick<Skill,'id'|'kind'>[]):Tactics{
 const base=defaultTactics(skills);if(!saved)return base;
 const ids=new Set(skills.map(s=>s.id)),order=[...new Set(saved.order)].filter(id=>ids.has(id));
 for(const s of skills)if(!order.includes(s.id))order.push(s.id);
 return {order,target:saved.target,stance:saved.stance,survival:saved.survival,conditions:Object.fromEntries(Object.entries(saved.conditions).filter(([id])=>ids.has(id))),...(saved.burstAuto===false?{burstAuto:false}:{})};
}
/** 服务端校验：技能只能是当前技能栏里的，顺序不重复。返回错误文案，合法时返回空串。 */
export function tacticsProblem(input:unknown,equipped:string[]):string{
 const parsed=tacticsSchema.safeParse(input);if(!parsed.success)return '编排格式不对。';
 const t=parsed.data,ids=new Set(equipped);
 if(new Set(t.order).size!==t.order.length)return '技能顺序里有重复。';
 if(t.order.some(id=>!ids.has(id))||Object.keys(t.conditions).some(id=>!ids.has(id)))return '编排里有不在技能栏的技能。';
 return '';
}
