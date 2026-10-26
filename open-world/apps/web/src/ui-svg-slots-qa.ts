import {itemSlot,panelHeaderHtml} from './ui-components.ts';
import {art} from './ui-assets.ts';
import {getEquipmentItem} from '../../../packages/content/index.ts';
import {renderItemTip} from './ui/item-tip.ts';

const equipment=[
 {base:'standard-sword-t1-weapon',quality:'common'},
 {base:'standard-sword-t1-armor',quality:'magic'},
 {base:'standard-hammer-t2-weapon',quality:'rare'},
 {base:'omega-sword-t3-weapon',quality:'legendary'},
] as const;
const emptySlots=()=>['helmet','weapon','boots'].map((part,index)=>`<span class="ui-svg-slot-sample">${itemSlot({action:'qa-empty-equipment',id:part,label:'未装备部位 '+part,src:art('gear-standard-sword-t1-'+part),className:'bag-eq is-empty',pressed:index===1,disabled:index===2,extra:`<em>${['头盔','武器','鞋子'][index]}</em>`})}</span>`).join('');
const tipTarget={querySelector:()=>({getAttribute:()=>art('item-skill-book')})} as unknown as HTMLElement;

export const slotQaCases=[
 {id:'svg-all-quality-slots',label:'SVG 全量 · 品质格复用',render:()=>`<section class="qa-primitives">${panelHeaderHtml('品质物品格')}<p class="ui-caption">沿用现有 E7 品质框与正式装备图，不叠加第二层 SVG 框。</p><div class="ui-svg-slots-row battle-result">${equipment.map(item=>itemSlot({action:'qa-quality-item',id:item.base,label:getEquipmentItem(item.base)!.name,src:art('gear-'+item.base),className:'loot-tile quality-'+item.quality,attributes:{'data-quality':item.quality}})).join('')}</div></section>`},
 {id:'svg-all-empty-equipment',label:'SVG 全量 · 未装备槽',render:()=>`<section class="qa-primitives">${panelHeaderHtml('未装备位置')}<p class="ui-caption">原剪影、尺寸和下方名称保留，SVG 仅增加轻内角。依次为普通、选中、禁用。</p><div class="ui-svg-slots-row">${emptySlots()}</div></section>`},
 {id:'svg-all-item-tip',label:'SVG 全量 · 物品提示',render:()=>`<section class="qa-primitives">${panelHeaderHtml('普通物品提示')}<div id="tooltip" class="item-tip ui-svg-tip-sample">${renderItemTip(tipTarget,{title:'技能书',rows:[['类型','技能书'],['持有','1']],note:'在技能界面核对激活条件后使用。',why:'当前是只读组件样例。'})}</div></section>`},
];
