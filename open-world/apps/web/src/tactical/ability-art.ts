/** Reuse each skill's registered hand-drawn artwork; never infer art from its display name. */
import {hasArt,skillArt} from '../ui-assets.ts';

export function tacticalAbilityArt(skillId:string):string|null{
 return hasArt(`skill-${skillId}`)?skillArt(skillId):null;
}
