import type {AugmentTier} from '../../../packages/contracts/run-augments.ts';
import {panelHeaderHtml,sealEmblem,sectionTitleHtml,buttonHtml,statusBadgeHtml,stateBlockHtml,esc} from './ui-components.ts';
export type AugmentCard={id:string;name:string;description:string;tier:AugmentTier;related?:boolean};
/** autoPickAt / fitsBuild 与 contracts self.augments 同名：全自动下的自动选卡时间点、服务端判定贴合构筑的卡。 */
export type AugmentPanelState={offered:AugmentCard[];chosen:{id:string;name:string}[];rerollsLeft:number;offerVersion:number;busy:boolean;error?:string;autoPickAt?:string;fitsBuild?:string[]};
const tierNames={silver:'银',gold:'金',prismatic:'棱彩'};
/** ART-HD augment-frames 图集（1778×1812）；卡框 440×600，贴合徽章 96×96。 */
const _AF_SRC='/art/hub-fun/augment-frames.png',_AF_W=1778,_AF_H=1812;
const _AF_TIER:{[k:string]:[number,number]}={silver:[2,2],gold:[446,2],prismatic:[890,2]};
const _AF_BADGE:[number,number]=[1334,1210];
/** 卡框铺满整张卡（底层，不占文档流），按百分比裁图集，卡片尺寸变化时随之拉伸。 */
function _afFrame(tier:AugmentTier):string{
 const[fx,fy]=_AF_TIER[tier]??_AF_TIER.silver,fw=440,fh=600,pct=(v:number)=>+v.toFixed(3)+'%';
 return `<span aria-hidden="true" class="augment-card-frame" style="position:absolute;inset:0;z-index:-1;pointer-events:none;background:url(${_AF_SRC}) ${pct(fx/(_AF_W-fw)*100)} ${pct(fy/(_AF_H-fh)*100)}/${pct(_AF_W/fw*100)} ${pct(_AF_H/fh*100)} no-repeat"></span>`;
}
function _afBadge(d:number):string{
 const[fx,fy]=_AF_BADGE,fw=96,s=d/fw,bw=Math.round(_AF_W*s),bh=Math.round(_AF_H*s);
 return `<span aria-hidden="true" class="augment-fit-badge" style="display:inline-block;width:${d}px;height:${d}px;background:url(${_AF_SRC}) ${-Math.round(fx*s)}px ${-Math.round(fy*s)}px/${bw}px ${bh}px no-repeat"></span>`;
}
/** 自动选卡倒计时文字（M15 U5，整数秒）；没有 autoPickAt 或已到点返回空串。控制器每秒只改这一行，不重画面板。 */
export function augmentCountdownText(autoPickAt:string|undefined,now=Date.now()){if(!autoPickAt)return '';const left=Math.ceil((Date.parse(autoPickAt)-now)/1000);return Number.isFinite(left)&&left>0?left+' 秒后自动选择':'';}
/** Public-component functional dialog. The dungeon controller owns commands,
 * pending state and server views; rendering never pauses or changes combat. */
export function AugmentPanel(state:AugmentPanelState){
 const valid=state.offered.length===3&&new Set(state.offered.map(o=>o.id)).size===3&&new Set(state.offered.map(o=>o.tier)).size===1;
 // 倒计时行常驻（到点后隐藏），每秒由控制器改 [data-augment-countdown] 的文字，不闪烁也不挤动卡片
 const countdown=augmentCountdownText(state.autoPickAt),autoCountdown=state.autoPickAt?`<p class="ui-caption" data-augment-countdown role="status"${countdown?'':' hidden'}>${countdown}</p>`:'';
 const fitsBuild=new Set(state.fitsBuild??[]);
 const options=valid?state.offered.map((o,idx)=>`<section aria-label="${esc(o.name)}" data-augment-index="${idx+1}" style="position:relative;isolation:isolate;padding:28px">${_afFrame(o.tier)}${sectionTitleHtml(o.name,{count:tierNames[o.tier]})}${o.related?statusBadgeHtml('适合你','success',{title:'与你当前的技能和装备相关'}):''}${fitsBuild.has(o.id)?_afBadge(24)+statusBadgeHtml('贴合构筑','success',{title:'到点自动选择时优先选这张'}):''}<p>${esc(o.description)}</p>${buttonHtml('选择',{action:'augment-choose',id:o.id,variant:'primary',busy:state.busy,attributes:{'data-offer-version':state.offerVersion,'data-augment-index':idx+1}})}</section>`).join(''):stateBlockHtml({kind:state.offered.length?'loading':'empty',title:state.offered.length?'正在同步潮印选项':'当前没有待选潮印',message:state.offered.length?'选项准备完成后即可选择。':'下一次机会开放时，会出现新的三选一。',compact:true});
 return `<div class="confirm-overlay ui-confirm-overlay" data-ui="confirmation" data-panel="augments"><section class="confirm-box ui-confirm" role="dialog" tabindex="-1" aria-modal="true" aria-label="选择潮印" aria-busy="${state.busy}">${panelHeaderHtml('选择潮印',{emblemHtml:sealEmblem('arcane'),closeAction:'augment-hide',closeLabel:'稍后选择',closeDisabled:state.busy})}<div class="ui-confirm__body">${autoCountdown}${options}${state.chosen.length?`${sectionTitleHtml('本场已选')}<p>${state.chosen.map(a=>esc(a.name)).join(' · ')}</p>`:''}<p>仅在本次副本生效。选择期间战斗继续推进。</p></div><p class="ui-confirm__status" role="${state.error?'alert':'status'}">${esc(state.error??(state.busy?'正在保存选择…':!valid&&state.offered.length?'正在同步潮印选项':''))}</p><div class="ui-confirm__actions">${buttonHtml('稍后选择',{action:'augment-hide',disabled:state.busy})}${statusBadgeHtml('剩余'+state.rerollsLeft+'次','neutral')}${buttonHtml('换一组',{action:'augment-reroll',variant:'secondary',busy:state.busy,disabled:!valid||state.rerollsLeft<=0,attributes:{'data-offer-version':state.offerVersion}})}</div></section></div>`;
}
