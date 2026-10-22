import {versions,type CharacterState,type Receipt} from '../contracts/index.ts';
import type {ProgressionAction,ProgressionPreview} from '../contracts/deep-progression.ts';
import {craftRecipes,craftMaterialById} from '../content/crafting.ts';
import {progressionConfig} from '../content/deep-progression.ts';
import {ensureProgression} from './deep-progression.ts';
import {craftIslandOpen,craftRecipeKnown} from './crafting.ts';
import {addHubReputation} from './hub-port.ts';
import {requireHub,HubOutsideError,type HubState} from './hub-state.ts';
import {resolveBuild} from './index.ts';

/** B4 fills these from authored/derived content. Missing offers are unavailable,
 * never a free purchase/donation. The generic recipe learning price is existing data. */
export type HubPortEconomy={
 donationOffers?:Record<string,{materials:Record<string,number>;rep:number}>;
 recipeOffers?:Record<string,{tier:number;gold?:number;material?:number}>;
};
function atPort(s:CharacterState,h:HubState){
 requireHub(!s.dungeon?.instance,'BUILD_LOCKED','请先结束当前副本。');requireHub(s.starsea?.location?.map==='ss-map-port','HUB_PLACE','请回到拾星港工坊办理。');requireHub(Boolean(h.chart.cleared['wind-story-1']),'HUB_FORGE_LOCKED','先通关 风栖 · 剧情 1，开放工坊。');
}
/** Root routes the existing reputation.donate command here inside write().
 * target=forge, value=server-authored offer ID, no arbitrary client-priced quantity. */
export function donateHubProgression(s:CharacterState,h:HubState,action:ProgressionAction,numbers:HubPortEconomy={}):Receipt['delta']{
 requireHub(action.op==='reputation.donate'&&action.target==='forge'&&Boolean(action.value)&&action.slot===undefined,'HUB_DONATION','请选择工坊的材料捐献方案。');atPort(s,h);
 const offer=numbers.donationOffers?.[action.value!];requireHub(offer,'HUB_DONATION_PENDING','捐献成本待 B4 推导完成，暂不可捐献。');
 const entries=Object.entries(offer.materials);requireHub(Number.isSafeInteger(offer.rep)&&offer.rep>0&&entries.length>0&&entries.every(([id,n])=>craftMaterialById.has(id)&&Number.isSafeInteger(n)&&n>0),'HUB_DONATION_PENDING','捐献成本待 B4 推导完成，暂不可捐献。');
 const p=ensureProgression(s);requireHub(entries.every(([id,n])=>(id==='enhance_stone'?s.material:p.materials[id]??0)>=n),'HUB_DONATION_MISSING','捐献材料不足。');
 const materials:Record<string,number>={};let material=0;
 for(const[id,n]of entries){if(id==='enhance_stone'){s.material-=n;material-=n;}else{p.materials[id]-=n;materials[id]=-n;}}
 addHubReputation(h,'forge',offer.rep);return {gold:0,xp:0,material,progression:{materials,reputation:{'hub:forge':offer.rep}}};
}
/** Same validation and cost execution on clones, without spending or advancing HUB. */
export function previewHubDonation(s:CharacterState,h:HubState,action:ProgressionAction,numbers:HubPortEconomy={}):ProgressionPreview{
 const copy=structuredClone(s),hubCopy=structuredClone(h),offer=numbers.donationOffers?.[action.value??''],stats=resolveBuild(structuredClone(s)).stats;
 const entries=Object.entries(offer?.materials??{}).filter(([,n])=>Number.isSafeInteger(n)&&n>0),cost={gold:0,material:entries.find(([id])=>id==='enhance_stone')?.[1]??0,items:Object.fromEntries(entries.filter(([id])=>id!=='enhance_stone'))};
 let enabled=true,reason='';try{donateHubProgression(copy,hubCopy,action,numbers);}catch(e){if(!(e instanceof HubOutsideError))throw e;enabled=false;reason=e.message;}
 const before={attack:stats.attack,hp:stats.hp,armor:stats.armor};return {revision:s.revision,ruleset_version:versions.rules,action,cost,enabled,reason,summary:enabled?`捐献后工坊声望 +${offer!.rep}`:reason,before,after:{...before}};
}
export function buyHubRecipe(s:CharacterState,h:HubState,recipeId:string,numbers:HubPortEconomy={}){
 atPort(s,h);const recipe=craftRecipes.find(r=>r.id===recipeId);requireHub(recipe,'HUB_RECIPE_UNKNOWN','配方不存在。');
 const offer=numbers.recipeOffers?.[recipeId];requireHub(offer&&Number.isInteger(offer.tier)&&offer.tier>=1&&offer.tier<=4,'HUB_RECIPE_PENDING','配方购买阶级待 B4 配置完成，暂不可购买。');
 const gold=offer.gold??progressionConfig.costs.recipeLearn.gold,material=offer.material??progressionConfig.costs.recipeLearn.material;
 requireHub(Number.isSafeInteger(gold)&&gold>=0&&Number.isSafeInteger(material)&&material>=0&&gold+material>0,'HUB_RECIPE_PENDING','配方售价待 B4 推导完成，暂不可购买。');
 requireHub(h.port.rep.forge>=progressionConfig.reputationThresholds[offer.tier],'HUB_RECIPE_REP',`工坊声望需达到第 ${offer.tier} 阶。`);requireHub(craftIslandOpen(s,recipe.island),'HUB_RECIPE_REGION','请先开放配方所属航区。');
 const p=ensureProgression(s);requireHub(!craftRecipeKnown(s,recipe),'HUB_RECIPE_KNOWN','已经学会这张配方。');requireHub(!recipe.output.pattern&&!recipe.output.repair,'HUB_RECIPE_SOURCE','这张图样需要从原有来源获取。');requireHub(s.gold>=gold&&s.material>=material,'HUB_RECIPE_COST','购买配方所需资源不足。');
 s.gold-=gold;s.material-=material;p.recipes.push(recipeId);return {recipe:recipeId,goldSpent:gold,materialSpent:material};
}
