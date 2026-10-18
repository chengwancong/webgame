import type {CharacterState} from '../contracts/index.ts';
import {craftRecipes,craftSignatureRecipe} from '../content/crafting.ts';
import {gearStages} from './item-power.ts';
// 换代预告（docs/progression-goal-plan.md §5.4）：离下一阶还差 2 级以内，且下一阶的定向配方在玩家已开放的岛上。
// 纯函数、不依赖 node 模块，客户端追踪条直接用。
export function craftTierPreview(s:Pick<CharacterState,'level'|'starsea'>){
 const next=gearStages.find(g=>g.level>s.level);if(!next||next.level-s.level>2)return null;
 const prev=gearStages[gearStages.indexOf(next)-1]!,recipe=craftRecipes.find(r=>craftSignatureRecipe(r)&&r.output.level===next.level&&(!s.starsea||s.starsea.islands.includes(r.island??'')));
 return recipe?{level:next.level,tier:next.tier,ratio:Math.round(next.scale/prev.scale*100)/100,island:recipe.island,recipe:recipe.id}:null;
}
