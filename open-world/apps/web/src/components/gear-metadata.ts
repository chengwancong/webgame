import {effectAtomById} from '../../../../packages/content/effect-atoms.ts';
import type {Gear,GearQuality,GearSet,GearVerdict,EquippedSetInfo} from '../../../../packages/contracts/index.ts';
import {gearSetIdentity} from '../../../../packages/content/set-effects.ts';
import {getGearSet} from '../../../../packages/content/gear-sets.ts';
import {pipsHtml,iconHtml,sectionTitleHtml,esc,statRowHtml,statusBadgeHtml} from '../ui-components.ts';
import type {StatusTone} from '../ui/primitives.ts';
export const qualityLabels:Record<GearQuality,string>={common:'普通',magic:'魔法',rare:'稀有',legendary:'传说'};
export const qualityColors:Record<GearQuality,string>={common:'var(--color-rarity-common)',magic:'var(--color-rarity-magic)',rare:'var(--color-rarity-rare)',legendary:'var(--color-rarity-legendary)'};
export function gearQuality(gear:Gear){return gear.quality??'common';}
/** 换装总评由服务端给出，界面只挑中文标签与配色。 */
const verdictLabels:Record<GearVerdict,string>={stronger:'更强',output:'更偏输出',sustain:'更偏续航',weaker:'较弱',even:'差不多'};
const verdictTones:Record<GearVerdict,StatusTone>={stronger:'success',output:'success',sustain:'success',weaker:'danger',even:'neutral'};
const verdictHints:Record<GearVerdict,string>={stronger:'属性提升更均衡；实际收益取决于装配技能。',output:'含元素与技能类型增伤的属性参考；仅匹配流派时生效。',sustain:'回复、生存或能量属性提升更多；击杀回复在单体首领战中受限。',weaker:'通用属性评分较低；请同时查看流派词条与能量收益。',even:'通用属性评分接近；请按流派与能量需求选择。'};
export function gearVerdictHtml(verdict?:GearVerdict){return verdict?statusBadgeHtml(verdictLabels[verdict],verdictTones[verdict],{className:'gear-verdict',title:verdictHints[verdict]}):'';}
/** ▲涨绿 / ▼跌红 + 差值：不写“提升/降低”，一眼看出方向。 */
export function deltaChangeHtml(change:number|null,format:(amount:number)=>string){return change===null?'待核对':change===0?'—':`${change>0?'▲':'▼'} ${format(change)}`;}
export function gearAffixes(gear:Gear){
 if(!gear.affixes?.length&&!gear.inscription&&!gear.affixNode)return '';
 return `<section class="gear-affix-list" aria-label="装备词缀">${sectionTitleHtml('词缀',{count:String(gear.affixes.length)})}${gear.inscription?statRowHtml({label:'铭纹',value:effectAtomById.get(gear.inscription.atomId)?.name??'铭纹',secondary:'小型铭纹'}):''}${gear.affixNode?`<p>${esc(gear.affixNode.kind==='max'?'可提升的副属性已达最高档位':`强化 +${gear.affixNode.rank}：${gear.affixNode.kind==='opened'?'开启新副属性':'副属性提升一档'}`)}</p>`:''}${gear.affixes.map(affix=>statRowHtml({label:affix.description||affix.name,emphasizeLabelNumbers:true,value:'',className:'gear-affix tier-'+affix.tier})).join('')}</section>`;
}
export function SetBonusTooltip(set:GearSet,progress:EquippedSetInfo|undefined){
 return `<section class="gear-set-bonuses" aria-label="套装加成">${sectionTitleHtml(set.name,{actionsHtml:progress?pipsHtml({value:progress.count,max:progress.total,label:set.name+'套装件数'}):statusBadgeHtml('待核对','warning')})}${set.bonuses.map(bonus=>{const active=progress?.activeBonuses.includes(bonus.pieces)??false;return `<div class="gear-set-bonus ${active?'active':'inactive'}"><span>${bonus.pieces} 件</span><p>${esc(progress?.bonusDescriptions?.[String(bonus.pieces)]??bonus.description)}</p>${progress?pipsHtml({value:active?bonus.pieces:0,max:bonus.pieces,label:`${bonus.pieces}件加成，${active?'已激活':'未激活'}`}):statusBadgeHtml('待核对','warning')}</div>`;}).join('')}</section>`;
}
export function gearSetLabel(gear:Gear){return gear.setId?`<div class="gear-set-label"><span>套装</span><b>${esc(gear.setName??gear.setId)}</b></div><p class="gear-set-unavailable">套装进度暂不可用</p>`:'';}
export function gearSetDetails(gear:Gear,sets:EquippedSetInfo[]|undefined,projected?:EquippedSetInfo[]){
 if(!gear.setId)return '';const definition=getGearSet(gear.setId);if(!definition)return gearSetLabel(gear);
 const preview=projected?.find(set=>set.setId===gearSetIdentity(gear));const progress=sets?.find(set=>set.setId===gearSetIdentity(gear))??(preview?{...preview,count:0,activeBonuses:[]}:(sets?{setId:definition.id,setName:definition.name,count:0,total:definition.id.startsWith('set-')?6:definition.pieces.length,activeBonuses:[]}:undefined));
 if(definition.id.startsWith('set-')&&!progress?.bonusDescriptions)return gearSetLabel(gear);
 return SetBonusTooltip({...definition,name:gear.setName&&gear.setName!==definition.name?gear.setName+' · '+definition.name:definition.name},progress);
}
export function gearSetChanges(current:EquippedSetInfo[]|undefined,next:EquippedSetInfo[]|undefined){
 if(!current||!next)return '';
 const ids=[...new Set([...current,...next].map(set=>set.setId))];
 return ids.map(id=>{const before=current.find(s=>s.setId===id),after=next.find(s=>s.setId===id);if(before?.count===after?.count&&JSON.stringify(before?.activeBonuses)===JSON.stringify(after?.activeBonuses)&&before?.artStage===after?.artStage)return '';
 const definition=getGearSet(id),activated=after?.activeBonuses.filter(p=>!before?.activeBonuses.includes(p))??[],lost=before?.activeBonuses.filter(p=>!after?.activeBonuses.includes(p))??[];
 const beforeCount=before?.count??0,afterCount=after?.count??0,change=afterCount-beforeCount,movement=change>0?'增加 '+change+' 件':change<0?'失去 '+Math.abs(change)+' 件':'件数不变';
 const changedStage=before?.artStage&&after?.artStage&&before.artStage!==after.artStage,retained=after?.activeBonuses.filter(p=>before?.activeBonuses.includes(p))??[];
 return `<div class="gear-set-change"><b>套装 ${esc(after?.setName??before?.setName??id)}：</b><span>换上后${movement}（${beforeCount}/${after?.total??before?.total} → ${afterCount}/${after?.total??before?.total}）</span>${changedStage?`<p class="${after!.artStage!>before!.artStage!?'positive':'negative'}">换上后，现有套装加成会改变</p>${retained.map(p=>`<p>${p} 件套加成：${esc(after?.bonusDescriptions?.[String(p)]??'当前数值尚未记录')}</p>`).join('')}`:''}${activated.map(p=>`<p class="positive">激活 ${p} 件套加成：${esc(after?.bonusDescriptions?.[String(p)]??definition?.bonuses.find(b=>b.pieces===p)?.description??'套装加成')}</p>`).join('')}${lost.map(p=>`<p class="negative">失去 ${p} 件套加成：${esc(before?.bonusDescriptions?.[String(p)]??definition?.bonuses.find(b=>b.pieces===p)?.description??'套装加成')}</p>`).join('')}</div>`;}).join('');
}
