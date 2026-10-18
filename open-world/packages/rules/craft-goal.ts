import type {CharacterState} from '../contracts/index.ts';
import type {CraftGoalPin,CraftGoalView} from '../contracts/crafting.ts';
import {craftRecipes,craftMaterialById,craftMaterials} from '../content/crafting.ts';
import {ensureCrafting,craftRecipeKnown,craftIslandOpen,CraftError} from './crafting.ts';

// 钉选只存目标，不扣任何东西；打造仍走 craft 指令由服务端结算，做完自动取消（见 applyCraft）。
const have=(s:CharacterState,id:string)=>id==='enhance_stone'?s.material:s.progression?.materials[id]??0;
function bossMaterial(island:string|null){return craftMaterials.find(m=>m.island===island&&m.tier==='T2');}
export function pinCraftGoal(s:CharacterState,pin:CraftGoalPin|null){
 const c=ensureCrafting(s);
 if(!pin){delete c.pin;return;}
 const r=craftRecipes.find(r=>r.id===pin.recipe);
 if(!r)throw new CraftError('CRAFT_UNKNOWN','没有这个配方。');
 if(!craftRecipeKnown(s,r)||!craftIslandOpen(s,r.island))throw new CraftError('CRAFT_LOCKED',r.unlockHint);
 for(const[selected,choices]of [[pin.slot,r.options.slots],[pin.tendency,r.options.tendencies],[pin.element,r.options.elements]] as const)if(selected&&!choices?.includes(selected))throw new CraftError('CRAFT_UNKNOWN',r.unlockHint);
 if(pin.element&&!bossMaterial(r.island))throw new CraftError('CRAFT_UNKNOWN',r.unlockHint);
 c.pin={recipe:r.id,...(pin.slot?{slot:pin.slot}:{}),...(pin.tendency?{tendency:pin.tendency}:{}),...(pin.element?{element:pin.element}:{})};
}
export function craftGoalView(s:CharacterState):CraftGoalView|null{
 const pin=s.progression?.crafting?.pin,r=pin&&craftRecipes.find(r=>r.id===pin.recipe);if(!pin||!r)return null;
 const need:Record<string,number>={...r.baseCost.materials},boss=pin.element?bossMaterial(r.island):undefined;
 if(boss)need[boss.id]=(need[boss.id]??0)+1;
 const materials=Object.entries(need).map(([id,count])=>{const m=craftMaterialById.get(id);return {id,name:m?.name??id,have:Math.min(have(s,id),count),need:count,sources:m?.sources??[]};});
 return {recipe:r.id,name:r.name,island:r.island,...(pin.slot?{slot:pin.slot}:{}),...(pin.tendency?{tendency:pin.tendency}:{}),...(pin.element?{element:pin.element}:{}),materials,gold:{have:Math.min(s.gold,r.baseCost.gold),need:r.baseCost.gold},ready:materials.every(m=>m.have>=m.need)&&s.gold>=r.baseCost.gold};
}
