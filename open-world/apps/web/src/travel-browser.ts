import {featureOpen} from './story-gates.ts';
import {regions,effectText,fieldRegionInfo,dungeonRegionInfo,type Region} from '../../../packages/content/index.ts';
import type {Snapshot,LootPreview} from '../../../packages/contracts/index.ts';
import {destinationArtwork} from '../../../packages/asset-manifest/destination-artwork.ts';
export {destinationArtwork} from '../../../packages/asset-manifest/destination-artwork.ts';
import {art} from './ui-assets.ts';
import {gearSlotLabels} from './equipment-slots.ts';
import {marksHtml,iconHtml,statTilesHtml,sectionTitleHtml,buttonHtml,panelHeaderHtml,sealEmblem,fieldHtml,tabsHtml,statusBadgeHtml,stateBlockHtml,resourceAmountHtml,itemSlot,esc as escape} from './ui-components.ts';

export type TravelState={regionId:string;destinationId:string;mode:'explore'|'dungeon';filter:'all'|'available';query:string;page:number};
export const initialTravelState=():TravelState=>({regionId:'meadow',destinationId:'meadow',mode:'explore',filter:'all',query:'',page:0});
export type Destination={area:Region;region:Region;kind:TravelState['mode']};
export type TravelDropView={preview?:LootPreview;loading:boolean;error:string};
const pageSize=6;

export function destinationCatalog(content:Region[]=regions):Destination[]{
 const areas=content.filter(r=>r.id!=='town'&&!r.boss&&!r.rest&&!fieldRegionInfo(r.id)&&!dungeonRegionInfo(r.id)&&!r.id.startsWith('ss-map-'));
 return areas.flatMap(area=>[{area,region:area,kind:'explore' as const},...content.filter(r=>r.boss&&r.id===area.id+'-boss').map(region=>({area,region,kind:'dungeon' as const}))]);
}
export function destinationReady(destination:Destination,snapshot:Snapshot){return snapshot.progress.regions.includes(destination.area.id)&&(destination.kind==='explore'||snapshot.bossAccess?.[destination.region.id]?.eligible===true);}
export function destinationRequirement(destination:Destination,snapshot:Snapshot,content:Region[]=regions){
 if(!snapshot.progress.regions.includes(destination.area.id)){
  const predecessor=content.find(r=>r.id===destination.area.requireBoss);
  const boss=predecessor?.spawns.find(s=>s.boss)?.name;
  return boss?`击败${boss}后解锁`:'完成前一地区首领挑战后解锁';
 }
 if(destination.kind==='dungeon'&&!snapshot.bossAccess?.[destination.region.id]?.eligible)return snapshot.bossAccess?.[destination.region.id]?.message??'首领准入信息未就绪，请恢复连接。';
 return destination.kind==='dungeon'?'步行前往结界，按 E 确认挑战':'已开放，可以出发探索';
}
/** 首领试炼未解锁时只保留野外探索。 */
export const travelMode=(state:TravelState,snapshot:Snapshot)=>state.mode==='dungeon'&&!featureOpen(snapshot,'trial')?'explore':state.mode;
export function travelModel(state:TravelState,snapshot:Snapshot,content:Region[]=regions){
 const catalog=destinationCatalog(content),areas=[...new Map(catalog.map(destination=>[destination.area.id,destination.area])).values()],query=state.query.trim().toLocaleLowerCase();
 const area=areas.find(r=>r.id===state.regionId)??areas[0];
 const matches=(destination:Destination)=>[destination.area.name,destination.region.name,...destination.region.spawns.filter(s=>s.boss).map(s=>s.name)].some(text=>text.toLocaleLowerCase().includes(query));
 const visible=catalog.filter(d=>d.kind===travelMode(state,snapshot)&&(query?matches(d):d.area.id===area?.id)&&(state.filter==='all'||destinationReady(d,snapshot)));
 const pages=Math.max(1,Math.ceil(visible.length/pageSize)),page=Math.max(0,Math.min(state.page,pages-1));
 const selected=visible.find(d=>d.region.id===state.destinationId)??visible[page*pageSize];
 return {areas,area:selected?.area??area,visible,shown:visible.slice(page*pageSize,(page+1)*pageSize),selected,pages,page,catalog,query};
}

export const travelIconNames=['lock','search','arrow','left','right','check','compass','coin','xp','material'] as const;
export function travelIcon(name:typeof travelIconNames[number]){
 const paths={coin:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="6"/><path d="m12 7 2 5-2 5-2-5Z"/>',xp:'<path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"/>',material:'<path d="m12 2 9 7-9 13-9-13Z"/><path d="m3 9 9 4 9-4M12 2v20"/>',lock:'<path d="M7 10V7a5 5 0 0 1 10 0v3"/><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M12 14v3"/>',search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',arrow:'<path d="m3 10 18-7-7 18-3-8-8-3Z"/><path d="m11 13 10-10"/>',left:'<path d="m15 5-7 7 7 7"/>',right:'<path d="m9 5 7 7-7 7"/>',check:'<path d="m5 12 4 4 10-10"/>',compass:'<circle cx="12" cy="12" r="8"/><path d="m12 1 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z"/><path d="m12 5 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"/>'};
 return `<svg data-pixel-icon="inline:travel:${name}" class="travel-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;
}
export function travelCompass(){
 return '<svg data-pixel-icon="inline:travel-compass" class="travel-compass" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><circle cx="50" cy="50" r="33" fill="var(--color-panel-inset)" stroke="var(--color-highlight)" stroke-width="2"/><circle cx="50" cy="50" r="28" fill="none" stroke="var(--color-border)"/><path d="m50 1 8 35 25-19-19 25 35 8-35 8 19 25-25-19-8 35-8-35-25 19 19-25-35-8 35-8-19-25 25 19Z" fill="var(--color-primary-pressed)" stroke="var(--color-primary-border)" stroke-width="1.2"/><path d="m50 1 0 49 14-8ZM99 50H50l8 14ZM50 99V50l-14 8ZM1 50h49l-8-14Z" fill="var(--color-primary-top)"/><circle cx="50" cy="50" r="7" fill="var(--color-panel)" stroke="var(--color-text-primary)" stroke-width="2"/><circle cx="50" cy="50" r="3" fill="var(--color-highlight)"/></svg>';
}
export function travelHeader(state:TravelState,processing=false){return panelHeaderHtml('远行目的地',{closeDisabled:processing,className:'travel-head',emblemHtml:sealEmblem('compass'),actionsHtml:`${buttonHtml('副本目录',{action:'panel',id:'dungeons',size:'compact',variant:'secondary',disabled:processing})}<div class="travel-search">${fieldHtml({id:'travel-search',label:'搜索地区或副本',type:'search',placeholder:'搜索地区或副本',value:state.query,autocomplete:'off',compact:true,attributes:{'data-action':'travel-search'}})}</div>`});}

export function renderTravelDrops(view:TravelDropView|undefined,selectedId:string|undefined){
 const header=sectionTitleHtml('掉落预览');
 if(!selectedId)return `<section class="travel-drops">${header}${stateBlockHtml({kind:'empty',title:'选择目的地',message:'选择后可查看掉落信息。',compact:true})}</section>`;
 if(view?.error)return `<section class="travel-drops">${header}${stateBlockHtml({kind:'error',title:'掉落信息读取失败',message:view.error,action:{label:'重新读取',action:'travel-drop-retry'},compact:true})}</section>`;
 const preview=view?.preview;
 if(!preview||preview.region!==selectedId)return `<section class="travel-drops" aria-busy="true">${header}${stateBlockHtml({kind:'loading',title:'读取中…',message:'请稍候。',compact:true})}</section>`;
 const number=(value:{min:number;max:number})=>value.min===value.max?String(value.min):`${value.min}–${value.max}`;
 const slotNames=gearSlotLabels;
 return `<section class="travel-drops" aria-label="掉落预览">${sectionTitleHtml('掉落预览')}${statTilesHtml((['gold','xp','material'] as const).map(key=>({label:{gold:'金币',xp:'经验',material:'强化石'}[key],value:number(preview.rewards[key])})))}<div class="travel-drop-equipment" aria-label="可能掉落的装备">${preview.equipment.map(gear=>itemSlot({action:'travel-drop-info',id:gear.base,label:`可能掉落：${gear.name}，查看装备说明`,src:art('gear-'+gear.base),className:'travel-drop-item',tip:JSON.stringify({title:gear.name,rows:[['部位',slotNames[gear.slot]],...(gear.random_main?[['主属性','随机生成']]:[['攻击',String(gear.attack)],['护甲',String(gear.armor)]]),...(gear.effect==='none'?[]:[['特性',effectText[gear.effect]]])],note:preview.note})})).join('')}</div><small class="drop-note">${escape(preview.note)}</small></section>`;
}
export function renderTravel(state:TravelState,snapshot:Snapshot,processing=false,content:Region[]=regions,drops?:TravelDropView){
 const model=travelModel(state,snapshot,content),{selected,area}=model;
 if(!area)return stateBlockHtml({kind:'empty',title:'暂无可探索地区',message:'地区内容暂未开放。'});
 const unlocked=(id:string)=>snapshot.progress.regions.includes(id);
 const status=(destination:Destination)=>snapshot.progress.bosses.includes(destination.region.id)?'已通关':destinationReady(destination,snapshot)?'已开放':'未解锁';
 const catalogBoss=model.catalog.find(d=>d.area.id===area.id&&d.kind==='dungeon');
 const bossName=(selected?.kind==='dungeon'?selected:catalogBoss)?.region.spawns.find(s=>s.boss)?.name??'';
 const card=(destination:Destination)=>{
  const picked=destination.region.id===selected?.region.id,ready=destinationReady(destination,snapshot),complete=snapshot.progress.bosses.includes(destination.region.id);
  return `<button class="destination-card ui-card${picked?' is-selected':''}" data-state="${!ready?'locked':complete?'learned':'available'}" title="${escape(destination.region.name+'，'+destinationRequirement(destination,snapshot))}" data-action="travel-select" data-id="${escape(destination.region.id)}" aria-pressed="${picked}" aria-label="${escape(destination.region.name)}，${status(destination)}"><img class="destination-art" src="${destinationArtwork(destination.area)}" alt="" draggable="false"><span class="destination-kind">${destination.kind==='dungeon'?'首领试炼':'野外探索'}${model.query?` · ${escape(destination.area.name)}`:''}</span><span class="destination-caption"><strong>${escape(destination.region.name)}</strong>${!ready?marksHtml([{corner:'tr',kind:'lock',label:destinationRequirement(destination,snapshot)}]):complete?marksHtml([{corner:'tr',kind:'check',label:'已通关'}]):''}</span>${!ready?`<span class="destination-requirement">${escape(destinationRequirement(destination,snapshot))}</span>`:''}</button>`;
 };
 const ready=selected&&destinationReady(selected,snapshot);
 const next=content.find(r=>r.id===area.next),requirement=selected?destinationRequirement(selected,snapshot,content):'';
 const title=selected?.region.name??area.name;
 return `<div class="travel-browser">
  <nav class="travel-regions" aria-label="地区目录">${sectionTitleHtml('地区目录')}<div class="travel-region-scroll">${model.areas.map(region=>`<button class="travel-region${area.id===region.id?' is-selected':''}" data-action="travel-region" data-id="${escape(region.id)}" aria-pressed="${area.id===region.id}"><img src="${destinationArtwork(region)}" alt="" draggable="false"><span>${escape(region.name)}</span>${unlocked(region.id)?'':travelIcon('lock')}</button>`).join('')}</div></nav>
  <section class="travel-content" aria-label="目的地列表"><div class="travel-content-title">${travelIcon('compass')}<h3>${model.query?'搜索结果':escape(area.name)}</h3><span class="travel-line" aria-hidden="true"></span></div>
  <div class="travel-toolbar">${tabsHtml({label:'活动类型',action:'travel-mode',selected:travelMode(state,snapshot),className:'travel-modes',controls:'travel-destinations',items:[{id:'explore',label:'野外探索'},...(featureOpen(snapshot,'trial')?[{id:'dungeon',label:'副本挑战'}]:[])]})}<div class="travel-filters" role="group" aria-label="开放状态">${(['all','available'] as const).map(filter=>buttonHtml(filter==='all'?'全部':'可进入',{action:'travel-filter',id:filter,pressed:state.filter===filter,size:'compact',busyLabel:filter==='all'?'全部':'可进入'})).join('')}</div></div>
  <div id="travel-destinations" class="travel-destinations${model.shown.length===1?' is-single':''}" role="tabpanel" aria-label="${travelMode(state,snapshot)==='explore'?'野外探索':'副本挑战'}">${model.shown.length?model.shown.map(card).join(''):`<div class="travel-empty">${stateBlockHtml({kind:'empty',title:model.query?'没有找到相关目的地':state.mode==='explore'?'当前没有可进入的区域':'当前没有可进入的副本',message:model.query?'换个地区或首领名称试试。':!unlocked(area.id)?'完成前一地区的首领挑战后，再来探索。':'请查看对应首领的准入条件。',action:{label:model.query?'清除搜索':'查看全部',action:'travel-reset'}})}</div>`}</div>
  <div class="travel-pagination"><span>共 ${model.visible.length} 个${travelMode(state,snapshot)==='explore'?'探索区域':'副本'}</span><div>${buttonHtml('上一页',{action:'travel-page',id:String(model.page-1),size:'icon',iconHtml:travelIcon('left'),disabled:model.page===0})}<span>${model.page+1} / ${model.pages}</span>${buttonHtml('下一页',{action:'travel-page',id:String(model.page+1),size:'icon',iconHtml:travelIcon('right'),disabled:model.page+1===model.pages})}</div></div></section>
  <aside class="travel-detail" aria-label="目的地详情"><div class="travel-detail-art"><img src="${destinationArtwork(area)}" alt="${escape(area.name)}风景插画" draggable="false"><span>${selected?.kind==='dungeon'?'首领试炼':'地区探索'}</span></div><div class="travel-detail-heading"><h3>${escape(title)}</h3>${selected?iconHtml(ready?'compass':'lock',{size:20,label:status(selected)}):''}</div><div class="travel-detail-rule" aria-hidden="true">◇</div><div class="travel-detail-scroll">${renderTravelDrops(drops,selected?.region.id)}<div class="travel-detail-copy">${bossName?`<p class="travel-boss-label">首领：${escape(bossName)}</p>`:''}<p>${escape(selected?.region.subtitle??area.subtitle)}</p>${selected?.kind==='explore'&&next?`<p class="travel-unlock-next">击败首领，开放${escape(next.name)}</p>`:''}<p class="travel-entry-note">${escape(requirement)}</p></div></div><div class="travel-detail-action">${buttonHtml(selected?.kind==='dungeon'?'前往结界':'出发远行',{action:'travel-depart',id:selected?.region.id??'',variant:'primary',size:'action',className:'travel-depart',iconHtml:travelIcon(selected?.kind==='dungeon'?'compass':'arrow'),disabled:!ready||!selected,busy:processing,busyLabel:'正在出发…'})}${selected?.kind==='dungeon'?'<small>到达结界后，按 E 确认挑战</small>':'<small>选择目的地后出发，成长自动保存</small>'}</div></aside>
 </div>`;
}
