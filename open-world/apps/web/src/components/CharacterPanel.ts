import {statLabels} from '../../../../packages/contracts/stats.ts';
import {DamageBreakdown} from './DamageBreakdown.ts';
import type {Skill} from '../../../../packages/contracts/index.ts';
import type {RuleTelemetry} from '../damage-breakdown-model.ts';
import type {Gear,Snapshot,Stats} from '../../../../packages/contracts/index.ts';
import {affixDisplayValue} from '../../../../packages/contracts/affix-units.ts';
import {mainStatValues} from '../../../../packages/rules/main-stat-values.ts';
import {effectText} from '../../../../packages/content/index.ts';
import {skillTagLabel} from '../../../../packages/content/skill-tags.ts';
import {formatBig} from '../../../../packages/content/big-number.ts';
import {CharacterPaperdoll} from './CharacterPaperdoll.ts';
import type {HexRuneView} from '../hex-rune-tip.ts';
import type {HexSlot} from '../hex-rune-slots.ts';
import {HexRuneChooser} from '../hex-rune-chooser.ts';
import {hexChooserItemsFromSnapshot} from '../hex-rune-view.ts';
import {GearDetails} from './GearDetails.ts';
import {filterGear} from './GearFilter.ts';
import {gearAffixes,gearQuality,qualityLabels} from './gear-metadata.ts';
import {art} from '../ui-assets.ts';
import {type SlotMark,statIcon,sectionTitleHtml,esc,buttonHtml,itemSlot,panelHeaderHtml,statusBadgeHtml,stateBlockHtml,statRowHtml} from '../ui-components.ts';
import {equipmentPartLabels,runtimeSlotForPart,type GearSlotFilter} from '../equipment-slots.ts';
export type CharacterPanelOptions={chooserOpen:boolean;detailsOpen:boolean;blocked:boolean;recovering?:boolean;damage?:{stats:Stats;skills:Skill[];telemetry:RuleTelemetry|null;sourceNames?:Record<string,string>};hexCatalog?:Record<string,HexRuneView>;hexChooser?:{slot:HexSlot;selected:string}};
/** Main stat after reinforcement, mirroring `mainStatContribution` in packages/rules/main-stats.ts. Legacy gear without a main stat has none. */
export function gearMainStat(gear:Gear){const value=mainStatValues(gear);return value?{stat:value.stat,value:value.effective}:undefined;}
export const mainStatText=(stat:string,value:number)=>affixDisplayValue(stat,value);
/** Worn first, then candidates sharing the worn main stat by value, then the rest. */
export function characterSelection(snapshot:Snapshot,part:Exclude<GearSlotFilter,''>,selected:string){const slot=runtimeSlotForPart(part),worn=(gear:{id:string})=>Boolean(slot&&snapshot.equipment[slot]===gear.id),base=gearMainStat(snapshot.gear.find(gear=>slot&&snapshot.equipment[slot]===gear.id)??({} as Gear)),rank=(gear:Gear)=>{const main=gearMainStat(gear);return worn(gear)?Infinity:main&&base&&main.stat===base.stat?main.value:-Infinity;},items=filterGear(snapshot.gear,'',part).sort((a,b)=>rank(b)-rank(a)||0);return {items,selected:items.find(gear=>gear.id===selected)??items.find(gear=>slot&&snapshot.equipment[slot]===gear.id)??items[0]};}
const number=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?String(Math.round(value*100)/100):'—';
const percent=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?number(value*100)+'%':'—';
// 伤害构成（docs/build-depth-design.md §2）：技能伤害 = 攻击 × 系数 × 成长 × (1+Σ[+]) × Π[×]；带标签的乘区只对对应技能生效。
function zonesHtml(snapshot:Snapshot){
 const zones=snapshot.stats.zones??[];if(!zones.length)return '';
 const add=zones.filter(z=>z.kind==='add'&&!z.tags?.length).reduce((n,z)=>n+z.value,0);
 const rows=zones.map(z=>`<li>${esc(z.label)}${z.tags?.length?' <small>（'+esc(skillTagLabel(z.tags))+'）</small>':''} · <b>${z.kind==='add'?'[+]'+number(z.value*100)+'%':'[×]'+number(z.value)}</b></li>`).join('');
 const skills=snapshot.resolvedSkills.filter(sk=>sk.damage>0&&sk.tags?.length).map(sk=>`<li>${esc(sk.name)}${sk.tags?.length?' <small>'+esc(skillTagLabel(sk.tags))+'</small>':''} · <b>${formatBig(sk.damage)}</b></li>`).join('');
 return `<section class="character-effects character-zones" aria-label="伤害构成">${sectionTitleHtml('伤害乘区')}<p>加算池合计 [+]${number(add*100)}%，每个 [×] 独立相乘</p><ul>${rows}</ul>${skills?`${sectionTitleHtml('技能单次伤害')}<ul>${skills}</ul>`:''}</section>`;
}
function summary(snapshot:Snapshot,options:CharacterPanelOptions){
 const stats=snapshot.stats,details:readonly [keyof Stats,string,'percent'|'multiple'][]=[['critChance','暴击率','percent'],['critMultiplier','暴击伤害','multiple'],['cdr','冷却缩减','percent'],['dodge','闪避率','percent'],['lifesteal','生命偷取','percent'],['penetration','护甲穿透','percent'],['executeBonus','斩杀伤害加成','percent'],['executeThreshold','斩杀生命阈值','percent'],['damageReduction','伤害减免','percent'],['blockChance','格挡几率','percent'],['allResist','全抗性','percent']];
 // 元素抗性按实际结算显示：全抗＋对应元素，上限 75%（护甲之后结算，物理不吃抗性）。
 const resists=(['fire','cold','lightning','arcane','shadow','poison'] as const).filter(el=>(stats[`${el}Resist`]??0)>0).map(el=>statRowHtml({iconHtml:statIcon(el+'Resist',{size:16}),label:statLabels[el+'Resist']??el,value:percent(Math.min(.75,(stats.allResist??0)+(stats[`${el}Resist`]??0))),className:'character-extended-stat'}));
 const shown=details.filter(([key,,type])=>{const value=stats[key];return typeof value==='number'&&Number.isFinite(value)&&(type==='percent'?value!==0:value!==1&&value!==0)&&(key!=='critMultiplier'||(stats.critChance??0)>0);});
 const effects=[...new Set(stats.effects)].filter(effect=>effect!=='none').map(effect=>effectText[effect]);
 for(const [id,label] of [['tonic_attack','攻击合剂'],['tonic_hp','生命合剂']]){const remaining=snapshot.progression?.buffs[id]??0;if(remaining>0)effects.push(`${label} · 剩余 ${remaining} 次击杀`);}
 return `<aside class="character-summary" data-character-scroll="stats" aria-label="角色属性">${sectionTitleHtml('你的属性')}<div class="character-core-stats">${(['hp','attack','armor'] as const).map(key=>`<div class="character-core-stat ${key}">${statRowHtml({iconHtml:statIcon(key,{size:24}),label:{hp:'生命',attack:'攻击',armor:'护甲'}[key],value:number(stats[key]),className:'ui-stat--value character-core-value',valueAttributes:{'data-character-stat':key}})}</div>`).join('')}</div><div class="character-secondary">${[['最大能量',number(stats.mana)],['能量恢复',number(stats.regen)+' /秒'],['移动速度',number(stats.speed)]].map(([label,value])=>statRowHtml({label,value,className:'character-secondary-stat'})).join('')}</div><section class="character-details">${buttonHtml('详细属性',{action:'character-details',size:'compact',attributes:{'aria-expanded':options.detailsOpen,'aria-controls':'character-detail-stats'},className:'character-detail-toggle'})}${options.detailsOpen?`<div id="character-detail-stats">${shown.length||resists.length?shown.map(([key,label,type])=>{const value=stats[key];return statRowHtml({iconHtml:statIcon(key,{size:16}),label,value:type==='percent'?percent(value):number(value)+' 倍',className:'character-extended-stat'});}).join('')+resists.join(''):'<p class="character-detail-empty">暂无额外属性</p>'}</div>${DamageBreakdown(options.damage?.stats??snapshot.stats,options.damage?.skills??snapshot.resolvedSkills,options.damage?.telemetry??null,options.damage?.sourceNames)}`:''}</section>${effects.length?`<section class="character-effects">${sectionTitleHtml('当前效果')}<ul>${effects.map(effect=>`<li>${esc(effect)}</li>`).join('')}</ul></section>`:''}</aside>`;
}
/** Static card for the worn piece in swap mode; the selected side is the live `GearDetails` with the server's 装备后 comparison. */
function wornCard(gear:Gear){
 const quality=gearQuality(gear),main=gearMainStat(gear);
 return `<aside class="gear-detail bag-detail character-worn quality-${quality}" aria-label="穿戴中：${esc(gear.name)}"><header class="bag-detail-heading"><img class="gear-art" src="${art('gear-'+gear.base)}" alt=""><div><small>穿戴中 · ${qualityLabels[quality]}</small><h3 class="quality-${quality}">${esc(gear.name)}${gear.rank?' +'+gear.rank:''}</h3></div></header><div class="gear-scroll bag-detail-scroll" data-character-scroll="worn-${esc(gear.id)}">${main?statRowHtml({label:'主属性 · '+(statLabels[main.stat]??main.stat),value:mainStatText(main.stat,main.value),primary:true,className:'gear-primary-stat'}):''}${gearAffixes(gear)}${gear.effect!=='none'?`<p class="bag-description">${esc(effectText[gear.effect])}</p>`:''}</div></aside>`;
}
function candidateDelta(gear:Gear,worn:Gear|undefined){
 if(!worn||gear.id===worn.id)return gear.id===worn?.id?'<span class="character-candidate-tag">穿戴中</span>':'';
 const main=gearMainStat(gear),base=gearMainStat(worn);if(!main||!base||main.stat!==base.stat)return '';
 const delta=Math.round((main.value-base.value)*1e6)/1e6;
 return `<span class="character-candidate-delta ${delta>0?'up':delta<0?'down':'even'}" aria-label="主属性比穿戴中${delta>0?'高':delta<0?'低':'持平'}">${delta>0?'▲ ':delta<0?'▼ ':''}${delta?mainStatText(main.stat,Math.abs(delta)):'持平'}</span>`;
}
/** Swap mode (2026-10-11, docs/character-equipment-ui.md 方案 B): part rail | candidates | worn → selected, side by side; the stats column steps aside until the chooser closes. */
function swapView(snapshot:Snapshot,part:Exclude<GearSlotFilter,''>,selected:string,busy:boolean){
 const selection=characterSelection(snapshot,part,selected),label=part==='core'?'旧核心':equipmentPartLabels[part],slot=runtimeSlotForPart(part),worn=snapshot.gear.find(gear=>slot&&gear.id===snapshot.equipment[slot]);
 const rows=selection.items.length?selection.items.map(gear=>{const equipped=Object.values(snapshot.equipment).includes(gear.id),quality=gearQuality(gear),main=gearMainStat(gear);return itemSlot({action:'select',id:gear.id,pressed:gear.id===selection.selected?.id,label:gear.name+'，'+(equipped?'已装备':'未装备'),className:'character-candidate quality-'+quality,title:gear.name+'，'+(equipped?'已穿戴':'未装备'),marks:gear.locked?[{corner:'tl',kind:'lock',label:'已锁定'} as SlotMark]:[],extra:`<img src="${art('gear-'+gear.base)}" alt=""><span><b class="quality-${quality}">${esc(gear.name)}${gear.rank?' +'+gear.rank:''}</b><small>${main?esc(statLabels[main.stat]??main.stat)+' '+mainStatText(main.stat,main.value)+' · ':''}${qualityLabels[quality]}</small></span>${candidateDelta(gear,worn)}`});}).join(''):stateBlockHtml({kind:'empty',title:'暂无候选',message:'当前没有该部位的装备。',compact:true});
 const pair=Boolean(worn&&selection.selected&&selection.selected.id!==worn.id);
 const detail=selection.selected?GearDetails(selection.selected,snapshot,'character',busy):`<aside class="character-empty">${stateBlockHtml({kind:'empty',title:label+'未装备',message:'当前没有该部位的可穿戴装备。',compact:true})}</aside>`;
 return `<section class="character-chooser" role="region" aria-label="${label}装备候选">${panelHeaderHtml('更换'+label,{level:'section',closeAction:'character-chooser-close',closeLabel:'收起换装'})}<div class="character-candidate-hint">${sectionTitleHtml('候选',{count:`${selection.items.length} 件`})}${worn?'<small>▲▼ 为主属性与穿戴中相比</small>':''}</div><div class="character-candidate-grid" data-character-scroll="candidates-${part}">${rows}</div></section><section class="character-compare${pair?' has-pair':''}" aria-label="装备对比">${pair?wornCard(worn!)+'<span class="character-compare-arrow" aria-hidden="true">→</span>':''}${detail}</section>`;
}
/** HEX socket chooser (HEX-F01) takes the gear swap view's place; only with a non-empty catalog, so it stays inert before HEX-B02. */
function hexChooserView(snapshot:Snapshot,options:CharacterPanelOptions,busy:boolean){
 const chooser=options.hexChooser,catalog=options.hexCatalog??{};
 if(!chooser||!Object.keys(catalog).length)return '';
 return HexRuneChooser({slot:chooser.slot,selected:chooser.selected||undefined,level:snapshot.level,items:hexChooserItemsFromSnapshot(snapshot,catalog),catalog,busy});
}
export function CharacterPanel(snapshot:Snapshot,part:Exclude<GearSlotFilter,''>,selected:string,figureURL:string|undefined,busy:boolean,options:CharacterPanelOptions={chooserOpen:false,detailsOpen:true,blocked:false}){
 const hex=hexChooserView(snapshot,options,busy),swapping=options.chooserOpen||Boolean(hex);
 return `<div class="character-panel${swapping?' is-swapping':''}"><section class="character-paperdoll${swapping?' chooser-open':''}" aria-label="人物与装备">${CharacterPaperdoll(snapshot,options.chooserOpen&&!hex?part:'',figureURL,options.hexCatalog,hex?options.hexChooser!.slot:'',busy)}</section>${hex||(options.chooserOpen?swapView(snapshot,part,selected,busy):summary(snapshot,options))}<footer class="character-footer">${options.blocked?`<span role="status">${statusBadgeHtml('连接待恢复，装备与属性待同步','warning',{variant:'inline'})}</span>${buttonHtml('恢复连接',{action:'recover',size:'compact',variant:'secondary',busy:options.recovering,busyLabel:'正在恢复…'})}`:''}</footer></div>`;
}
