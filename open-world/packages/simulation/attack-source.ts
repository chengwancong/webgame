import type {Skill} from '../contracts/index.ts';
import type {DamageContext} from './skill-runtime.ts';
export type AttackSource='basic'|'cast'|'proc'|'untyped';
/** D05/D10: resolved slot zero is basic. Never infer from cost, melee tags or damage type.
 * A cast freezes this classification in its VFX origin, so changing a bar cannot
 * reclassify an in-flight projectile. Old snapshots can resolve against their frozen bar. */
export function attackSource(context:Pick<DamageContext,'category'|'comboDepth'|'skill'>|undefined,skills:readonly Skill[],frozen?:AttackSource):AttackSource{
 if(context?.category==='periodic'||context?.category==='derived'||context?.comboDepth)return 'proc';
 if(frozen)return frozen;
 if(!context?.skill)return 'untyped';
 return context.skill.id===skills[0]?.id?'basic':'cast';
}
