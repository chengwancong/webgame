// M17 前端可直接引用的显示层（不能引入 node:crypto 依赖链；rules/zhangjian.ts 会经 deep-progression 带进来）。
import type {DamageType} from '../contracts/skill-mechanics.ts';
import type {LoadoutView,RankSlot} from '../contracts/zhangjian.ts';
export const slotNames:Record<RankSlot,string>={weapon:'武器',armor:'衣服',helmet:'头盔',boots:'鞋子',accessory:'项链',ring:'戒指'};
export const elementNames:Record<DamageType,string>={physical:'物理',fire:'火焰',cold:'冰霜',lightning:'雷电',arcane:'奥术',shadow:'暗影',poison:'毒素',pure:'真实'};
/** 节点卡片下的一行提示：弱点优先，其次抗性。没有可说的返回 null。 */
export function elementHint(el:{threat:DamageType;weakness:DamageType},view:LoadoutView):{text:string;switchTo?:number}|null{
 if(!view.current.elements.includes(el.weakness)){const other=view.slots.find(x=>!x.empty&&x.index!==view.active&&x.elements.includes(el.weakness));if(other)return {text:other.name+'能打出'+elementNames[el.weakness]+'弱点',switchTo:other.index};}
 if(el.threat!=='physical'&&el.threat!=='pure'&&(view.current.resist[el.threat]??0)<.1)return {text:elementNames[el.threat]+'抗性 '+Math.round((view.current.resist[el.threat]??0)*100)+'%'};
 return null;
}

