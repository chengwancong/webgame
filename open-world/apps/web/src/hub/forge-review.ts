/** Static review data only; real components and detail hydration, never writes a player. */
import type {Gear,Snapshot,GearTip,GrowthPreview} from '../../../../packages/contracts/index.ts';
import type {RankSlot} from '../../../../packages/contracts/zhangjian.ts';
import {rankSlots,type SlotsView} from '../../../../packages/contracts/zhangjian.ts';
export function forgeReviewSlots():SlotsView{return {slots:rankSlots.map(slot=>({slot,rank:0,gearId:'forge-review-'+slot,gearCap:12,effective:0,cost:{gold:200,material:1}})),resonance:{tier:0,lowest:0,next:{rank:3,missing:6},bonusPercent:0}};}
import {slotUpgradePanelHtml} from './slot-upgrade-panel.ts';
import {ForgePanel} from '../components/ForgePanel.ts';
import {loadGearDetails,forgetGearDetails} from '../components/GearDetails.ts';
import {craftingTabsHtml} from '../components/CraftingPanel.ts';
import type {CraftingUI} from '../crafting-controller.ts';
import {panelHeaderHtml,resourceAmountHtml} from '../ui-components.ts';
export const forgeReviewStates=['zero','exact','max','reroll'] as const;
export type ForgeReviewState=typeof forgeReviewStates[number];
let selected:RankSlot='weapon',tab='upgrade';
const gear:Gear={id:'forge-review-weapon',base:'standard-sword-t1-weapon',slot:'weapon',name:'青锋长剑',attack:0,armor:0,effect:'none',rank:0,locked:false,quality:'rare',attributeVersion:2,mainStat:{stat:'attack',value:11},affixes:[{id:'attack',name:'攻击',tier:1,stat:'attack',value:3,description:'攻击 +3'}]};
export function renderForgeReview(host:HTMLElement,state:ForgeReviewState,action='',id=''){
 if(action==='slot-select')selected=id as RankSlot;
 if(action==='craft-tab')tab=id;
 if(!action){selected='weapon';tab=state==='reroll'?'reroll':'upgrade';}
 const v=forgeReviewSlots();v.slots.forEach(s=>{s.rank=state==='max'?12:0;s.effective=s.rank;s.gearCap=12;s.gearId='forge-review-'+s.slot;s.cost=state==='max'?null:{gold:200,material:1};s.block=state==='max'?'已强化到满级':undefined;});
 v.resonance=state==='max'?{tier:5,lowest:12,next:null,bonusPercent:10}:{tier:0,lowest:0,next:{rank:3,missing:6},bonusPercent:0};
 const names={weapon:'青锋长剑',armor:'守望轻甲',helmet:'青锋头盔',boots:'青锋长靴',accessory:'羽叶吊坠',ring:'花芽之戒'};
 const s={id:'static-forge-review',name:'工坊验收',revision:1,gold:state==='zero'?0:200,material:state==='zero'?0:1,gear:v.slots.map(slot=>({...gear,id:slot.gearId!,slot:slot.slot,name:names[slot.slot],base:'standard-sword-t1-'+(slot.slot==='armor'?'armor':slot.slot==='accessory'?'necklace':slot.slot),rank:slot.rank})),equipment:{weapon:gear.id}} as Snapshot;
 const quote={gear_id:gear.id,revision:1,current:{stats:{attack:35}},equipped:{stats:{attack:35}},upgraded:{stats:{attack:state==='max'?35:37}},cost:{gold:200,material:1},max:state==='max',upgradeBlock:'',salvage:{allowed:false,material:3},verdict:{}} as unknown as GrowthPreview;
 const body=tab==='reroll'?ForgePanel(s,s.gear[0],false):slotUpgradePanelHtml(v,s,false,{selected,preview:quote});
 host.classList.add('open');host.innerHTML=`<section class="panel panel-wide" data-panel="forge" role="dialog" aria-modal="true" aria-label="拾星港工坊">${panelHeaderHtml('拾星港工坊',{closeAction:'close',closeLabel:'关闭',actionsHtml:resourceAmountHtml('gold',s.gold,{compact:true})+resourceAmountHtml('material',s.material,{compact:true})})}${craftingTabsHtml({tab} as CraftingUI)}${body}</section>`;
 if(tab==='reroll'){
  forgetGearDetails();const tip={gear:s.gear[0],revision:1,primary_attribute:'attack',attributes:{base:{attack:11,armor:0},enhancement:{attack:0,armor:0},effective:{attack:11,armor:0}},comparison:{},reforge:{allowed:true,reason:'',gold:100,material:1,level:23},currentSets:[],equippedSets:[]} as unknown as GearTip;
  loadGearDetails(s.gear[0],s,{busy:false,preview:async()=>quote,tip:async()=>tip,error:()=>{},current:()=>s});
 }
}
