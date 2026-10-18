import {gearBases,instantiateGearTemplate} from './index.ts';
import {applyItemPower} from './item-power.ts';
import {starseaBalance as balance} from '../content/starsea/balance.ts';
import {prologueConfig,type PrologueFamily} from '../content/starsea/prologue.ts';
import type {GearQuality} from '../contracts/index.ts';
/** New starsea characters use the same L1 weapon as the expected balance build.
 * The opening echo choice (prologue.json) only swaps the same-tier family template;
 * quality and attack affix stay the balance rule. Never upgrades an existing character's equipment. */
export function makeStarseaStarterWeapon(id:string,family:PrologueFamily='sword'){
 const rule=balance.starterWeapon,template=gearBases.find(g=>g.base===(family==='sword'?rule.template:prologueConfig.families[family].weaponTemplate));if(!template||template.slot!=='weapon')throw Error('Unknown starsea starter weapon');
 return applyItemPower(instantiateGearTemplate(template,id,rule.quality as GearQuality,[{id:id+'-attack',name:'攻击',stat:'attack',value:rule.attackAffix,tier:1,description:'攻击 +'+rule.attackAffix}]),1);
}
export function makeStarseaStarterJewelry(ids:string[]){return balance.starterJewelry.map((rule,i)=>{const template=gearBases.find(g=>g.base===rule.template);if(!template||template.slot!==rule.slot||!ids[i])throw Error('Unknown starsea starter jewelry');return applyItemPower(instantiateGearTemplate(template,ids[i],rule.quality,[{id:ids[i]+'-attack',name:'攻击',stat:'attack',value:rule.attackAffix,tier:1,description:'攻击 +'+rule.attackAffix}]),1);});}
