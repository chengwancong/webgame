import {statLabels} from '../../../../packages/contracts/stats.ts';
import {affixDisplayValue} from '../../../../packages/contracts/affix-units.ts';
import type {Gear,GearTip,GrowthPreview,Snapshot} from '../../../../packages/contracts/index.ts';
import {effectText} from '../../../../packages/content/index.ts';
import {equipmentClassification} from '../../../../packages/content/equipment-catalog.ts';
import {gearWeaponLabel,gearWeaponAffinity,weaponAffinityNames} from '../../../../packages/rules/weapon-skills.ts';
import {art} from '../ui-assets.ts';
import {marksHtml,sectionTitleHtml,esc,buttonHtml,statusBadgeHtml,stateBlockHtml,resourceCostHtml,statRowHtml,currencyIconHtml,iconHtml,statPlateHtml,pipsHtml} from '../ui-components.ts';
import {mainStatValues} from '../../../../packages/rules/main-stat-values.ts';
import {gearSlotLabels} from '../equipment-slots.ts';
import {hexAffixSectionHtml,hexPreviewHtml} from '../hex-rune-view.ts';
import {beginPreview,previewStillCurrent,type PreviewToken} from '../preview-guard.ts';
import {deltaChangeHtml,gearAffixes,gearSetLabel,gearSetDetails,gearQuality,gearVerdictHtml,qualityLabels} from './gear-metadata.ts';

const finite=(value:unknown):number|null=>typeof value==='number'&&Number.isFinite(value)?value:null;
export function gearUpgradeCostHtml(snapshot:Pick<Snapshot,'gold'|'material'>,quote?:Pick<GrowthPreview,'cost'|'max'|'upgradeBlock'>){
 if(quote?.upgradeBlock)return '';
 if(quote?.max===true)return statusBadgeHtml('已达强化上限','neutral');
 const rows=([['gold','金币',snapshot.gold],['material','强化石',snapshot.material]] as const).map(([id,label,balance])=>{const amount=finite(quote?.cost?.[id]),owned=finite(balance);return {id,label,amount,owned,availability:amount===null||owned===null?'unknown' as const:owned>=amount?'enough' as const:'short' as const,iconHtml:currencyIconHtml(id)};});
 return resourceCostHtml(rows,'强化消耗',{compact:true});
}
/** 主手倾向：战杖／法杖逐件不同；显示武器类型名与亲和系别。 */
const weaponTraitText=(gear:Gear)=>{const label=gearWeaponLabel(gear),affinity=gearWeaponAffinity(gear);return label&&affinity?` · ${label} · 擅长${weaponAffinityNames[affinity]}`:'';};
/** `forge` is the port workshop page (2026-10-11): only there are upgrade and reroll offered; bag and character only view, wear, lock and salvage. The bag renders its own card (`bagGearCard`). */
export type GearDetailsContext='bag'|'character'|'forge';
export function GearDetails(gear:Gear,snapshot:Snapshot,context:GearDetailsContext,busy:boolean){
 if(context==='bag')return bagGearCard(gear,snapshot,busy);
 const worn=Object.values(snapshot.equipment).includes(gear.id),quality=gearQuality(gear);
 const quoteArea=`<div id="preview" data-gear="${esc(gear.id)}" data-preview-context="${context}" aria-busy="true"><p class="gear-quote-state" role="status">读取中…</p></div>`;
 return `<aside class="gear-detail bag-detail quality-${quality}" data-detail-kind="equipment"><header class="bag-detail-heading" aria-label="${esc(gear.name)}，${worn?'已装备':'未装备'}${gear.locked?'，已锁定':''}"><img class="gear-art" src="${art('gear-'+gear.base)}" alt=""><div><small>${gearSlotLabels[gear.slot]} · ${qualityLabels[quality]}${weaponTraitText(gear)}</small><h3 class="quality-${quality}">${esc(gear.name)}${gear.rank?' +'+gear.rank:''}</h3><div class="gear-statuses">${marksHtml([...(worn?[{corner:'tr',kind:'check',label:'已装备'} as const]:[]),...(gear.locked?[{corner:'tl',kind:'lock',label:'已锁定'} as const]:[])])}</div></div></header><div class="gear-scroll bag-detail-scroll" data-bag-detail-scroll${context==='character'?` data-character-scroll="detail-${esc(gear.id)}"`:''}>
 <div id="gear-primary-summary" class="gear-card-primary">${statRowHtml({label:'主属性',value:null,secondary:'读取中…',primary:true,className:'gear-primary-stat'})}</div>${quoteArea}${gearAffixes(gear)}${hexAffixSectionHtml(gear,snapshot.hexActive)}<div id="gear-inscription-description"></div>${context!=='forge'?'<p class="bag-muted gear-forge-hint">强化与重铸：前往拾星港工坊</p>':gear.affixes.length?`<section aria-label="副属性重铸">${sectionTitleHtml('副属性重铸')}<p>${gear.rerollSlot===undefined?'首次选定后，本件只可反复重铸这一条；其余属性保留。':'已固定重铸第 '+(gear.rerollSlot+1)+' 条副属性。'}</p><label for="reroll-affix-slot">选择重铸副属性</label><select id="reroll-affix-slot" class="ui-select" ${busy||gear.rerollSlot!==undefined?'disabled':''}><option value="">请选择一条</option>${gear.affixes.map((a,index)=>`<option value="${index}" ${gear.rerollSlot===index?'selected':''}>${esc(a.description)}</option>`).join('')}</select><div id="reforge-quote">正在核对重铸条件…</div>${buttonHtml('重铸该条',{action:'reroll',id:gear.id,variant:'secondary',disabled:true,attributes:{'data-reforge-allowed':false}})}</section>`:''}<div id="gear-set-summary">${gearSetLabel(gear)}</div>${equipmentClassification(gear.base)?`<p class="bag-description">${esc(equipmentClassification(gear.base))}</p>`:''}${gear.effect!=='none'?`<p class="bag-description">${esc(effectText[gear.effect])}</p>`:''}
 ${context==='character'?`<div class="cmp" data-gear="${esc(gear.id)}"><div class="cmp-attributes">${stateBlockHtml({kind:'loading',title:'读取换装对比',message:'正在核对你的属性变化。',compact:true})}</div></div>`:''}
 </div><div class="actions bag-detail-actions">${context==='forge'?buttonHtml('强化',{action:'upgrade',id:gear.id,variant:'primary',size:'action',disabled:true,className:'bag-primary',attributes:{'data-gear-quote-operation':'upgrade'}})+`<div class="bag-secondary-actions">${buttonHtml(gear.locked?'解除锁定':'锁定',{action:'lock',id:gear.id,variant:'secondary',size:'compact',className:'ui-button--dense',disabled:busy})}</div>`:buttonHtml(worn?'卸下':snapshot.equipment[gear.slot]?'替换':'装备',{action:worn?'unequip':'equip',id:gear.id,variant:'primary',size:'action',disabled:busy,className:'bag-primary'})+`<div class="bag-secondary-actions">${buttonHtml(gear.locked?'解除锁定':'锁定',{action:'lock',id:gear.id,variant:'secondary',size:'compact',className:'ui-button--dense',disabled:busy})}${buttonHtml('分解',{action:'salvage-confirm',id:gear.id,variant:'secondary',size:'compact',className:'ui-button--dense',disabled:true,attributes:{'data-gear-quote-operation':'salvage'}})}</div>`}</div></aside>`;
}
/** Bag variant (2026-10-20 redesign): big art, one main number against what is worn, icon affix rows, direct wear/replace. Numbers still come from the server tip. */
const signed=(stat:string,value:number)=>'+'+affixDisplayValue(stat,value);
export function mainStatTileHtml(stat:string,value:number|null,pill=''){return `<div class="bag-main">${statPlateHtml(stat,'main')}<div class="bag-main__text"><small>${esc(statLabels[stat]??stat)}</small><b class="ui-number">${value===null?'—':esc(affixDisplayValue(stat,value))}</b></div>${pill}</div>`;}
const deltaPillHtml=(stat:string,delta:number|undefined,worn:boolean)=>worn?'<span class="bag-pill bag-pill--flat">已穿戴</span>':delta===undefined?'':delta===0?'<span class="bag-pill bag-pill--flat">持平</span>':`<span class="bag-pill${delta<0?' bag-pill--bad':''}">${delta>0?'▲':'▼'} ${esc(affixDisplayValue(stat,Math.abs(delta)))}</span>`;
function bagGearCard(gear:Gear,snapshot:Snapshot,busy:boolean){
 const worn=Object.values(snapshot.equipment).includes(gear.id),quality=gearQuality(gear),main=mainStatValues(gear),occupied=Boolean(snapshot.equipment[gear.slot]);
 const affixes=gear.affixes.map(affix=>`<li class="bag-affix tier-${affix.tier}">${statPlateHtml(affix.stat,'affix')}<span>${esc(statLabels[affix.stat]??affix.name)}</span><b class="ui-number">${esc(signed(affix.stat,affix.value))}</b></li>`).join('');
 const sub=[gearSlotLabels[gear.slot]+weaponTraitText(gear),gear.setId?gear.setName??gear.setId:''].filter(Boolean).join(' · ');
 const lockLabel=gear.locked?'解除锁定':'锁定';
 return `<aside class="gear-detail bag-card quality-${quality}" data-detail-kind="equipment" data-quality="${quality}" aria-label="${esc(gear.name)}，${worn?'已装备':'未装备'}${gear.locked?'，已锁定':''}"><div class="bag-card__show"><span class="bag-card__tag">${qualityLabels[quality]}</span>${worn?'<span class="bag-card__state">已穿戴</span>':gear.locked?`<span class="bag-card__state bag-card__state--lock">${iconHtml('lock',{size:16})}已锁定</span>`:''}<img src="${art('gear-'+gear.base)}" alt="" draggable="false"></div><div class="bag-card__info gear-scroll" data-bag-detail-scroll><h3 class="bag-card__name">${esc(gear.name)}${gear.rank?` <small>+${gear.rank}</small>`:''}</h3><p class="bag-card__sub">${esc(sub)}</p><div id="gear-primary-summary" data-variant="tile">${main?mainStatTileHtml(main.stat,main.effective,worn?deltaPillHtml(main.stat,undefined,true):''):''}</div>${affixes?`<ul class="bag-affixes" aria-label="装备词缀">${affixes}</ul>`:''}${hexAffixSectionHtml(gear,snapshot.hexActive)}<div id="gear-inscription-description"></div>${gear.effect!=='none'?`<p class="bag-card__effect">${esc(effectText[gear.effect])}</p>`:''}<div id="preview" class="bag-card__quote" data-gear="${esc(gear.id)}" data-preview-context="bag" aria-busy="true"></div><p class="bag-card__note">${iconHtml('hammer',{size:20})}强化与重铸：拾星港工坊</p></div><div class="bag-card__acts">${buttonHtml(worn?'卸下':occupied?'替换':'装备',{action:worn?'unequip':'equip',id:gear.id,variant:worn?'secondary':'primary',size:'action',disabled:busy,className:'bag-primary bag-card__big'})}${buttonHtml(lockLabel,{action:'lock',id:gear.id,variant:'secondary',size:'icon',iconHtml:iconHtml('lock',{size:24}),pressed:Boolean(gear.locked),disabled:busy,className:'bag-card__sq'})}${buttonHtml('分解',{action:'salvage-confirm',id:gear.id,variant:'danger',size:'icon',iconHtml:iconHtml('salvage',{size:24}),disabled:true,className:'bag-card__sq',attributes:{'data-gear-quote-operation':'salvage'}})}</div></aside>`;
}
const detailRequests=new Map<string,Promise<[GrowthPreview,GearTip]>>();
/** 重试按钮：丢掉缓存的报价，下一次重绘重新向服务端取。 */
export function forgetGearDetails(){detailRequests.clear();}
export type GearDetailsOptions={busy:boolean;preview:(id:string)=>Promise<GrowthPreview>;tip:(id:string)=>Promise<GearTip>;error:(error:unknown)=>void;/** 当前最新的角色快照；重试时用它，不用重绘时捕获的旧快照。 */current?:()=>Snapshot|undefined;/** 本地快照落后于服务端 revision 时，拉取最新快照并重绘。 */resync?:()=>void};
/** 每个 #preview 节点最近一次发起的加载；节点还在转圈、而令牌已被作废（重绘之外的原因，如收到回执）时据此续载。 */
const nodeLoads=new WeakMap<Element,PreviewToken>();
const resyncLog=new Map<string,number[]>();
const RESYNC_LIMIT=2,RESYNC_WINDOW=10000,RESUME_LIMIT=3;
/** 终态：报价读不到时给出原因和重试，不能永远停在“读取中…”。 */
function failQuote(gearId:string,message:string){
 const node=document.querySelector<HTMLElement>('#preview');if(!node||node.dataset.gear!==gearId)return;
 node.setAttribute('aria-busy','false');node.dataset.state='error';
 node.innerHTML=stateBlockHtml({kind:'error',title:'报价读取失败',message,compact:true,action:{label:'重新获取',action:'gear-preview-retry',id:gearId}});
 const summary=document.querySelector('#gear-primary-summary');if(summary&&summary.getAttribute('data-variant')!=='tile')summary.innerHTML=statRowHtml({label:'主属性',value:null,secondary:'未能读取',primary:true,className:'gear-primary-stat'});
}
export function loadGearDetails(gear:Gear,snapshot:Snapshot,options:GearDetailsOptions){
 const token=beginPreview(gear.id,snapshot.revision);
 const host=document.querySelector<HTMLElement>('#preview');if(host&&host.dataset.gear===gear.id)nodeLoads.set(host,token);
 // 面板每次重绘都会重新调用这里；同一件装备、同一 revision 复用在途/已完成的请求，
 // 否则频繁重绘会不断作废上一个请求，主属性永远停在“读取中…”（Grok：背包/人物/工坊悬停）。
 const key=gear.id+'@'+snapshot.revision;let request=detailRequests.get(key);
 if(!request){request=Promise.all([options.preview(gear.id),options.tip(gear.id)]);detailRequests.set(key,request);request.catch(()=>detailRequests.delete(key));while(detailRequests.size>24)detailRequests.delete(detailRequests.keys().next().value!);}
 /** 令牌被作废但本节点没被重绘替换（工坊页收到回执不会重绘）：用最新快照续载，次数有限。 */
 const stranded=()=>{const node=document.querySelector<HTMLElement>('#preview');return node&&node.dataset.gear===gear.id&&node.getAttribute('aria-busy')==='true'&&nodeLoads.get(node)===token?node:null;};
 const resume=()=>{const node=stranded();if(!node)return;const tries=Number(node.dataset.retries??0);if(tries>=RESUME_LIMIT){failQuote(gear.id,'角色状态一直在变化，报价没能读完。');return;}node.dataset.retries=String(tries+1);loadGearDetails(gear,options.current?.()??snapshot,options);};
 void request.then(([quote,details])=>{
  if(!previewStillCurrent(token)){resume();return;}
  if(quote.gear_id!==gear.id||details.gear.id!==gear.id){detailRequests.delete(key);failQuote(gear.id,'服务器返回的不是这件装备的报价，请重新获取。');return;}
  if(quote.revision!==snapshot.revision||details.revision!==snapshot.revision){
   detailRequests.delete(key);
   const now=performance.now(),log=(resyncLog.get(gear.id)??[]).filter(t=>now-t<RESYNC_WINDOW);
   if(options.resync&&log.length<RESYNC_LIMIT){log.push(now);resyncLog.set(gear.id,log);options.resync();}
   else failQuote(gear.id,'角色状态刚刚更新，报价与当前存档对不上，请重新获取。');
   return;
  }
  const node=document.querySelector<HTMLElement>('#preview');if(!node||node.dataset.gear!==gear.id)return;
  node.dataset.seq=String(token.seq);node.dataset.revision=String(token.revision);node.dataset.generation=String(token.generation);node.setAttribute('aria-busy','false');
  const primary=details.primary_attribute,summary=document.querySelector('#gear-primary-summary');
  if(summary?.getAttribute('data-variant')==='tile'){const worn=Object.values(snapshot.equipment).includes(gear.id);summary.innerHTML=mainStatTileHtml(primary,details.attributes.effective[primary]??null,deltaPillHtml(primary,details.comparison[primary]?.delta,worn));}
  else if(summary)summary.innerHTML=statRowHtml({label:'主属性 · '+(statLabels[primary]??primary),value:affixDisplayValue(primary,details.attributes.effective[primary]),secondary:`基础 ${affixDisplayValue(primary,details.attributes.base[primary])} + 强化 ${affixDisplayValue(primary,details.attributes.enhancement[primary])}`,primary:true,className:'gear-primary-stat'});
  const inscription=document.querySelector('#gear-inscription-description');if(inscription)inscription.innerHTML=details.inscription_info?`<p>${esc(details.inscription_info.description)}</p>`:'';
  const reforge=document.querySelector<HTMLButtonElement>('[data-action=reroll]'),reforgeQuote=document.querySelector('#reforge-quote'),select=document.querySelector<HTMLSelectElement>('#reroll-affix-slot');if(reforge&&details.reforge){const ready=details.reforge.allowed&&snapshot.gold>=details.reforge.gold&&snapshot.material>=details.reforge.material&&!options.busy;reforge.dataset.reforgeAllowed=String(ready);reforge.disabled=!ready||!select?.value;if(reforgeQuote)reforgeQuote.innerHTML=(details.reforge.reason?statusBadgeHtml(details.reforge.reason,'warning',{variant:'inline'}):'')+resourceCostHtml([{id:'gold',label:'金币',amount:details.reforge.gold,owned:snapshot.gold,availability:snapshot.gold>=details.reforge.gold?'enough':'short',iconHtml:currencyIconHtml('gold')},{id:'material',label:'强化石',amount:details.reforge.material,owned:snapshot.material,availability:snapshot.material>=details.reforge.material?'enough':'short',iconHtml:currencyIconHtml('material')}],'重铸消耗',{compact:true});}
  const sets=document.querySelector('#gear-set-summary');if(sets)sets.innerHTML=gearSetDetails(gear,details.currentSets,details.equippedSets);
  const comparison=document.querySelector(`.cmp[data-gear="${gear.id}"] .cmp-attributes`);
  if(comparison){const rows=Object.entries(details.comparison).filter(([,r])=>r.delta!==0);comparison.innerHTML=rows.length?sectionTitleHtml('装备后',{actionsHtml:gearVerdictHtml(quote.verdict)})+rows.map(([key,r])=>statRowHtml({label:statLabels[key]??key,value:affixDisplayValue(key,r.equipped),previousValue:affixDisplayValue(key,r.current),change:deltaChangeHtml(r.delta,amount=>affixDisplayValue(key,amount)),tone:r.delta>0?'positive':'negative',valueTone:r.delta>0?'positive':'negative',className:'ui-stat--delta gear-comparison-stat'})).join(''):`<p class="gear-comparison-none">${Object.values(snapshot.equipment).includes(gear.id)?'当前已穿戴':'穿上后属性不变'}</p>`;}
  const worn=Object.values(snapshot.equipment).includes(gear.id);
  for(const chip of document.querySelectorAll<HTMLElement>('[data-stage-delta]')){const delta=worn?undefined:details.comparison[chip.dataset.stageDelta!]?.delta;chip.className='bag-chip__delta'+(delta?delta>0?' is-up':' is-down':'');chip.textContent=delta?(delta>0?'▲ ':'▼ ')+affixDisplayValue(chip.dataset.stageDelta!,Math.abs(delta)):'';}
  const setChip=document.querySelector<HTMLElement>('#bag-set-chip');if(setChip){const set=[...(details.currentSets??[])].sort((a,b)=>b.count-a.count)[0];setChip.innerHTML=set?`<span>${esc(set.setName)}</span>${pipsHtml({value:set.count,max:set.total,label:set.setName+'套装件数',tone:'success'})}<b>${set.count}/${set.total}</b>`:'';setChip.hidden=!set;}
  const salvageValue=finite(quote.salvage?.material),salvageKnown=salvageValue!==null&&typeof quote.salvage?.allowed==='boolean';
  const forge=node.dataset.previewContext==='forge';node.innerHTML=forge?(quote.upgradeBlock?statusBadgeHtml(quote.upgradeBlock,'warning'):'')+gearUpgradeCostHtml(snapshot,quote):quote.equipBlock?statusBadgeHtml(quote.equipBlock,'warning'):'';node.insertAdjacentHTML('beforeend',hexPreviewHtml(quote.hexPreview??details.hexPreview));
  const equip=document.querySelector<HTMLButtonElement>('.bag-primary[data-action=equip]');if(equip)equip.disabled=options.busy||Boolean(quote.equipBlock);
  const costKnown=finite(quote.cost?.gold)!==null&&finite(quote.cost?.material)!==null&&finite(snapshot.gold)!==null&&finite(snapshot.material)!==null&&typeof quote.max==='boolean';
  node.dataset.state=costKnown&&salvageKnown?'ready':'partial';
  const upgrade=document.querySelector<HTMLButtonElement>('[data-gear-quote-operation=upgrade]');if(upgrade){upgrade.disabled=options.busy||Boolean(quote.upgradeBlock)||!costKnown||quote.max||snapshot.gold<quote.cost.gold||snapshot.material<quote.cost.material;const label=quote.max?'强化已满':'强化';const text=upgrade.querySelector('.ui-button__label');if(text)text.textContent=label;upgrade.setAttribute('aria-label',label);}
  const salvage=document.querySelector<HTMLButtonElement>('[data-gear-quote-operation=salvage]');if(salvage){salvage.disabled=options.busy||!salvageKnown||!quote.salvage.allowed;const allowed=salvageKnown&&quote.salvage.allowed,label=allowed?`分解，可得 ${salvageValue} 强化石`:'分解',reason=!salvageKnown?'分解所得待核对':quote.salvage.allowed?'':quote.salvage.blocked==='locked'?'已锁定，不能分解':quote.salvage.blocked==='equipped'?'已装备，不能分解':'不可分解';const text=salvage.querySelector('.ui-button__label');if(text)text.innerHTML=allowed?`分解 <span class="gear-salvage-yield">${currencyIconHtml('material')}${salvageValue}</span>`:'分解';salvage.setAttribute('aria-label',reason?label+'，'+reason:label);if(reason)salvage.title=reason;else salvage.removeAttribute('title');}
 }).catch(error=>{
  detailRequests.delete(key);
  if(!previewStillCurrent(token)){resume();return;}
  failQuote(gear.id,error instanceof Error&&error.message?error.message:'请稍后重试。');options.error(error);
 });
}
