import {seaDifficultyHtml,type SeaDifficultyView} from './sea-difficulty-view.ts';
import {bountyHtml,type BountyView} from './bounty-view.ts';
import {ShieldBarTracker} from './shield-feedback.ts';
const hudShield=new ShieldBarTracker();
import {paintMinimap,radarRadius,RADAR_ZOOMS,type MapMarker} from './ui/minimap.ts';
import type {FieldMapView} from './field-controller.ts';
import {storyNpcs} from '../../../packages/content/story-campaign.ts';
import {renderItemTip,type ItemTipData} from './ui/item-tip.ts';
import {hudContext,combatModeHtml,hudStatusHtml,questTrackerHtml,hudExitIcon} from './hud-context.ts';
import {trackerGoals} from './growth-cards.ts';
import {settings} from '../../../packages/content/index.ts';
import {settingsPanelHtml,autoSettingsHtml,keyLabel} from './ui/settings-panel.ts';
import {loginPanelHtml,createCharacterPanelHtml,takeoverPanelHtml} from './ui/auth-panels.ts';
import {panelHeaderHtml,confirmationHtml,buttonHtml,resourceAmountHtml,statusBadgeHtml,stateBlockHtml} from './ui-components.ts';
import type {Snapshot,GrowthPreview,Gear,Skill,GearTip,GearQuality,StoryView,TaskView} from '../../../packages/contracts/index.ts';
import type {World} from '../../../packages/simulation/index.ts';
import {distance} from '../../../packages/simulation/index.ts';
import {regions,regionById,skillCatalog,effectText,type SkillSchool} from '../../../packages/content/index.ts';
import {invalidatePreviews} from './preview-guard.ts';
import {renderSkills} from './skills-panel.ts';
import {renderProgression} from './progression-panel.ts';
import {featureOpen,featureReason} from './story-gates.ts';
import {renderAppearance} from './appearance-panel.ts';
import type {AppearanceUI} from './appearance-controller.ts';
import type {ProgressionUI} from './progression-controller.ts';
import type {ChallengeUI} from './progression-challenges.ts';
import {art,skillArt} from './ui-assets.ts';
import {hudIcon,hudMenuIcon} from './hud-icons.ts';
import {nativeCoinHtml,updateNativeCoin} from './ui/native-coin.ts';
import {TooltipController} from './tooltip-controller.ts';
import {GearCard} from './components/GearCard.ts';
import {qualityLabels as qualityName} from './components/gear-metadata.ts';
import {virtualizeInventory} from './components/virtual-inventory.ts';
import {GearFilter,filterGear} from './components/GearFilter.ts';
import {BagPanel,bagHeader} from './components/BagPanel.ts';
import {CharacterPanel,characterSelection} from './components/CharacterPanel.ts';
import {ForgePanel,forgeSelection} from './components/ForgePanel.ts';
import {CraftingPanel,craftingTabsHtml} from './components/CraftingPanel.ts';
import type {CraftingUI} from './crafting-controller.ts';
import {loadGearDetails} from './components/GearDetails.ts';
import {bagSelection} from './bag-model.ts';
import type {BagUI} from './bag-controller.ts';
import {gearSlotLabels as slotName,equipmentPartLabels,type GearSlotFilter} from './equipment-slots.ts';
import {gearAffixes,gearSetLabel,gearSetDetails,gearQuality,qualityLabels} from './components/gear-metadata.ts';
import {renderTravel,travelHeader,initialTravelState,type TravelState,type TravelDropView} from './travel-browser.ts';

export type PresentationModel={autoPreferences?:Pick<World,'radius'|'targetPriority'|'avoidElite'|'autoSkills'>;bounty?:BountyView;fieldMap?:FieldMapView;seaDifficulty?:SeaDifficultyView;seaTierPick?:number;hudModeOpen?:boolean;story?:StoryView;taskData?:TaskView;dungeonId?:string;dungeonBusy?:boolean;allyTarget?:{hp:number;maxHp:number;shield:number;position:{x:number;y:number};range:number};portraitURL?:string;figureURL?:string;appearance?:AppearanceUI;appearanceDirty?:boolean;accountOnly?:boolean;authReady?:boolean;authConnecting?:boolean;authError?:string;authReload?:boolean;world:World;snapshot?:Snapshot;loggedIn:boolean;panel:string;confirm:''|'salvage'|'dungeon-exit';confirmId:string;feed:string[];blocked:boolean;userPaused:boolean;processing:boolean;selected:string;skillFocus:string;skillCategory:SkillSchool|'all';skillTags?:string[];skillQuery?:string;skillFilter?:'all'|'active'|'eligible';skillLocked?:boolean;frozenSkills?:Skill[];skillOperation:''|'activate'|'upgrade'|'equip'|'unequip';skillOperationId:string;skillStatus:''|'success'|'error'|'pending';skillMessage:string;lastError:string;volume:number;reduced:boolean;autoPickup?:boolean;fieldReturnRegion?:string;dungeonRunning?:boolean;dungeonConnected?:boolean;binding?:string;bindingMessage?:string;bagTab:'bag'|'rewards';bag:BagUI;characterPart:Exclude<GearSlotFilter,''>;characterChooserOpen:boolean;characterDetailsOpen:boolean;slotFilter:GearSlotFilter;qualityFilter:GearQuality|'';trackerOpen:boolean;bindings:Record<string,string>;onSelect(id:string):void;previewGear(id:string):Promise<GrowthPreview>;previewGearTip(id:string):Promise<GearTip>;noticeError(e:unknown):void;onConfirm(action:string,id:string):void;onCancelConfirm():void};

const $=(selector:string)=>document.querySelector(selector) as HTMLElement;
const esc=(s:unknown)=>String(s).replace(/[&<>"']/g,v=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[v]!));
const effectName=effectText;
const skillIcon=(id:string)=>skillArt(id);
const gearIcon=(base:string)=>art('gear-'+base);
const hasSkillIcon=(id:string)=>Boolean(skillCatalog.find(s=>s.id===id));
const hasGearIcon=(base:string)=>true;
const iconOrFallback=(kind:'skill'|'gear',key:string,alt:string)=>kind==='skill'&&hasSkillIcon(key)
  ?`<img src="${skillIcon(key)}" alt="${esc(alt)}" draggable="false">`
  :kind==='gear'&&hasGearIcon(key)?`<img src="${gearIcon(key)}" alt="${esc(alt)}" draggable="false">`
  :`<span class="noicon">${esc(alt)}</span>`;

let lastRegionId='';
let lastFeedKey='';
const hudMarkup=new WeakMap<Element,string>();
function setHudMarkup(node:Element,html:string){if(hudMarkup.get(node)===html)return;node.innerHTML=html;hudMarkup.set(node,html);}


type TipData=ItemTipData;
const tooltipController=new TooltipController((target,tip)=>{
 const raw=target.dataset.tip;if(!raw)return;
 let data:TipData;try{data=JSON.parse(raw);}catch{tip.style.display='none';return;}
 if(data.item){tip.className='item-tip';tip.innerHTML=renderItemTip(target,data);return;}
 tip.innerHTML=`<b>${esc(data.title)}</b>${(data.rows??[]).map(([label,value])=>`<div class="row"><span>${esc(label)}</span><span class="num">${esc(value)}</span></div>`).join('')}`
  +(data.note?`<div class="dim">${esc(data.note)}</div>`:'')+(data.why?`<div class="why">${esc(data.why)}</div>`:'');
});
export const showTip=(target:HTMLElement)=>tooltipController.show(target);
export const hideTip=()=>tooltipController.hide();
export const refreshTips=()=>tooltipController.refresh();
export const dismissTip=(target?:HTMLElement)=>tooltipController.dismiss(target);
export const configureEquipmentTips=(loader:(id:string)=>Promise<GearTip>)=>tooltipController.configure(loader);
export function bindTips(_root:ParentNode){tooltipController.bind();}

export function mountHud(){
  if($('#hud').dataset.mounted)return;
  $('#hud').dataset.mounted='1';
  $('#hud').innerHTML=`
  <div id="leftColumn">
   <section class="vitals plate" id="vitals" aria-label="角色状态"></section>
   <section class="tracker plate" id="tracker" aria-label="目标追踪"></section>
  </div>
  <section class="minimap plate" id="minimapbox" aria-label="小地图">
   <div class="minimap-heading"><span id="minimap-name"></span></div><canvas id="minimap" width="280" height="280"></canvas>

  </section>
  <div id="zoneBanner"></div>
  <div id="bossBox"></div>
  <div id="bottomLeft"><div class="modebar plate" id="modebar" aria-label="操作模式"></div></div>
  <div class="skillbar" id="skillbar" role="toolbar" aria-label="技能快捷栏"></div>
  <aside id="hud-status" role="status"></aside><div class="hud-dungeon-exit" id="hud-dungeon-exit"></div><div class="hud-wallet" aria-label="金币"><span class="coin-art">${nativeCoinHtml()}</span><span id="hud-gold" class="num">0</span></div>
  <div class="sysbar" id="sysbar" role="toolbar" aria-label="系统入口"></div>
  <div class="feed" id="feed"></div>
  <div id="hintbox"></div>
  <div id="pausebox"></div>`;
  document.body.insertAdjacentHTML('beforeend','<div id="tooltip" role="tooltip"></div>');
  const mini=$('#minimapbox');mini.classList.add('clickable');mini.dataset.action='panel';mini.dataset.id='region-map';mini.setAttribute('role','button');mini.setAttribute('aria-label','展开区域地图');mini.tabIndex=0;mini.addEventListener('wheel',event=>{event.preventDefault();stepRadarZoom(event.deltaY<0?1:-1);},{passive:false});mini.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();mini.click();}});
  bindTips(document.body);
}

function skillState(w:World,skillId:string,view?:PresentationModel):{cd:number;why:string;cls:string}{
  const s=w.skills.find(s=>s.id===skillId)!;
  if(view?.dungeonRunning&&view.dungeonConnected===false)return {cd:0,why:'连接中',cls:'is-blocked'};
  const cd=Math.max(0,(w.cooldowns[skillId]??0)-w.tick)/30;
  if(cd>0)return {cd,why:'',cls:'is-cd'};
  if(w.hero.hp<=0)return {cd:0,why:'倒下',cls:'is-dead'};
  if(w.paused)return {cd:0,why:'暂停',cls:'is-blocked'};
  const readiness=w.skillReadiness(skillId);if(readiness.busy)return {cd:0,why:'施法中',cls:''};if(readiness.controlled)return {cd:0,why:'受控制',cls:'is-blocked'};
  if(w.hero.mana<s.cost)return {cd:0,why:'缺能量',cls:'is-mana'};
  const target=w.closest();
  const need=s.kind==='area'?s.radius:s.range;
  const hasTarget=s.mechanics?s.mechanics.targeting==='enemy':['single','projectile','chain','dash','zone','area'].includes(s.kind);
  if(hasTarget&&!target)return {cd:0,why:'无目标',cls:'is-idle'};
  if(hasTarget&&target&&distance(w.hero.position,target.position)>need)return {cd:0,why:'超射程',cls:'is-range'};
  const ally=['heal','shield'].includes(s.kind)?view?.allyTarget:undefined;
  if(ally&&ally.hp<=0)return {cd:0,why:'需要救援',cls:'is-idle'};
  if(ally&&distance(w.hero.position,ally.position)>ally.range)return {cd:0,why:'超射程',cls:'is-range'};
  if(s.kind==='heal'&&!s.mechanics?.cleanse&&(ally?ally.hp>=ally.maxHp:w.hero.hp>=w.stats.hp)&&(!s.mechanics?.restoreMana||w.hero.mana>=w.stats.mana))return {cd:0,why:'生命充足',cls:'is-idle'};
  if(s.kind==='shield'&&s.damage>0&&(ally?ally.shield>0:w.hero.shield>0))return {cd:0,why:'护盾中',cls:'is-idle'};
  return {cd:0,why:'',cls:''};
}

/** Cooldowns shorter than this (basic attacks) get no ring. */
const SHORT_COOLDOWN=1;
/** Calm skill bar (user 2026-10-11: the blinking icons are hard to look at). Skills auto-cast, so range / no-target / casting /
 * cooldown never recolour the icon (the tooltip still names the reason). Only lasting states tint: mana after 600 ms held,
 * and it clears after 600 ms too, so mana hovering at the cost cannot pulse; blocked/dead apply at once. */
function slotTint(slot:HTMLElement,cls:string){
  const want=['is-mana','is-blocked','is-dead'].includes(cls)?cls:'',now=performance.now();
  if(slot.dataset.tintWant!==want){slot.dataset.tintWant=want;slot.dataset.tintSince=String(now);}
  const shown=slot.dataset.tintShown??'';
  if(want!==shown&&(want==='is-blocked'||want==='is-dead'||shown==='is-blocked'||shown==='is-dead'||now-Number(slot.dataset.tintSince)>=600))slot.dataset.tintShown=want;
  return slot.dataset.tintShown?' '+slot.dataset.tintShown:'';
}

function skillTip(w:World,view:PresentationModel,i:number,sk:Skill):string{
  const {why}=skillState(w,sk.id,view);
  const key=view.bindings['skill'+(i+1)]??String(i+1);
  return JSON.stringify({title:`${sk.name}（${keyLabel(key)}）`,rows:[
    ['作用',sk.description],['消耗',`${sk.cost} 能量`],['冷却',`${(sk.cooldown/30).toFixed(1)} 秒`],
    ['射程',sk.kind==='area'?`自身 ${sk.radius}`:sk.range>0?`${sk.range}`:'自身'],
  ],why:why||undefined});
}

function mapMarkers(h:PresentationModel):MapMarker[]{const v=h.snapshot?.starseaView;if(v){const points=v.step?.map===h.world.region.id?v.step.points:[];return [...(h.fieldMap?.activities??[]),...v.markers.filter(m=>m.map===h.world.region.id).map(m=>({name:'？ '+m.label,x:m.x,y:m.y,main:false,question:true})),...(h.world.region.id==='ss-map-port'?v.port.map(n=>({id:n.npc,name:n.name,x:n.x,y:n.y,main:points.some(p=>p.npc===n.npc)})):[]),...points.filter(p=>!p.npc||h.world.region.id!=='ss-map-port').map(p=>({name:p.label,x:p.x,y:p.y,main:true}))];}return h.world.region.id==='town'&&!h.dungeonRunning?storyNpcs.filter(n=>h.story?.campNpcs.includes(n.id)).map(n=>({name:n.name,x:n.camp.x,y:n.camp.y,main:n.id===h.story?.giver})):[];}
const radarZoomKey='openWorld.radarZoom';
const radarZoom=()=>{const v=Number(localStorage.getItem(radarZoomKey));return (RADAR_ZOOMS as readonly number[]).includes(v)?v:1;};
function stepRadarZoom(dir:number){const i=(RADAR_ZOOMS as readonly number[]).indexOf(radarZoom()),n=Math.max(0,Math.min(RADAR_ZOOMS.length-1,i+dir));localStorage.setItem(radarZoomKey,String(RADAR_ZOOMS[n]));}
function drawMinimap(h:PresentationModel){
 const canvas=document.querySelector<HTMLCanvasElement>('#minimap');if(!canvas)return;
 const name=document.querySelector('#minimap-name');if(name){name.textContent=h.world.region.name;name.setAttribute('title',h.world.region.name);}
 const npcs=mapMarkers(h);paintMinimap(canvas,h.world,{mode:'radar',npcs,field:h.fieldMap,radius:radarRadius(radarZoom())});
 const expanded=document.querySelector<HTMLCanvasElement>('#region-map-canvas');if(h.panel==='region-map'&&expanded)paintMinimap(expanded,h.world,{mode:'full',npcs,field:h.fieldMap});
}

export function updateHud(h:PresentationModel) {
    const t = $("#hud");
    if (!h.loggedIn || !h.snapshot) {
        t.style.visibility = "hidden", hideTip();
        return;
    }
    t.style.visibility = "visible";
    const e = h.snapshot, i = h.world, d = Math.max(0, Math.min(1, i.hero.hp / i.stats.hp)), n = $("#vitals");
    n.querySelector<HTMLElement>(".who") || (n.innerHTML = `<button class="who character-entry" type="button" data-action="panel" data-id="character" aria-label="打开人物"><img src="${h.portraitURL || art("portrait-bust")}" alt="角色外观"><div class="identity"><b class="hero-name"></b><small>Lv. <span class="num hero-level"></span></small></div></button><div class="bars"><div class="meter hp" role="meter" aria-label="生命" aria-valuemin="0"><i></i><span class="shield-band"></span><span class="numv num"></span></div><div class="meter mp" role="meter" aria-label="能量" aria-valuemin="0"><i></i><span class="numv num"></span></div></div><div class="chips"><span class="chip shield" data-tip='{"title":"护盾","note":"优先于生命承受伤害"}'></span></div>`);
    const r = n.querySelector<HTMLElement>(".hero-name")!;
    r.textContent = e.name, r.title = e.name, n.querySelector<HTMLElement>(".hero-level")!.textContent = String(e.level);
    for (const [P, I, D] of [["hp", Math.ceil(i.hero.hp), i.stats.hp], ["mp", Math.floor(i.hero.mana), i.stats.mana]] as const) {
        const G = n.querySelector<HTMLElement>(".meter." + P)!;
        G.querySelector<HTMLElement>("i")!.style.transform = `scaleX(${Math.max(0, Math.min(1, I / D))})`, G.querySelector<HTMLElement>(".numv")!.textContent = `${I} / ${D}`, G.setAttribute("aria-valuenow", String(I)), G.setAttribute("aria-valuemax", String(D)), G.dataset.tip = JSON.stringify({ title: P === "hp" ? d <= .3 ? "生命过低" : "生命" : "能量", rows: [["当前", `${I} / ${D}`], ...P === "hp" && i.hero.shield ? [["护盾", String(i.hero.shield)]] : []], ...P === "hp" && d <= .3 ? { why: "寻找安全点或使用回复手段" } : {} });
    }
    const a = n.querySelector<HTMLElement>(".shield-band")!;
    const shieldRatio=hudShield.ratio('hero',i.hero.shield);a.style.width=`${shieldRatio*100}%`;a.classList.toggle('is-on',shieldRatio>0);
    const s = n.querySelector<HTMLElement>(".chip.shield")!;
    s.textContent = `护盾 ${Math.ceil(i.hero.shield)}`, s.style.visibility = i.hero.shield > 0 ? "visible" : "hidden";
    const context=hudContext(i.region,Boolean(h.dungeonRunning),['battle-result','dungeon-result'].includes(h.panel));
    t.dataset.context=context;
    const f=$('#tracker');f.setAttribute('aria-label','任务追踪');setHudMarkup(f,questTrackerHtml(h.taskData,trackerGoals(e)));
    if(lastRegionId!==i.region.id){lastRegionId=i.region.id;$('#zoneBanner').innerHTML=`<div class="zone-banner"><h1>${esc(i.region.name)}</h1><small>${esc(i.region.subtitle)}</small></div>`;}
    const T = i.enemies.find(P => P.boss && P.alive);
    $("#bossBox").innerHTML = T ? `<div class="bossbar plate"><div class="head"><b>${esc(T.name)}</b> <span class="num small">${Math.ceil(T.hp)} / ${T.maxHp}</span></div><div class="meter"><i style="transform:scaleX(${Math.max(0, T.hp / T.maxHp)})"></i></div></div>` : "";
    // 封存的招牌技在技能栏占位：灰色、带锁、写「待找回」（docs/progression-goal-plan.md §4.1）。
    const sealed = e.skills.filter(id => e.skillRecovery?.sealed.includes(id)).map(id => ({ id, name: skillCatalog.find(k => k.id === id)?.name ?? id, task: (a => a?.type === "recovery" ? a.name : "")(e.skillAccess.find(k => k.id === id)?.activation) }));
    const b = $("#skillbar"), S = i.skills.map((P, I) => P.id + ":" + h.bindings["skill" + (I + 1)]).join(",") + "|" + sealed.map(x => x.id).join(",");
    b.dataset.loadout !== S && (b.dataset.loadout = S, b.innerHTML = i.skills.map((P, I) => `
      <button class="skill-slot" data-action="cast" data-id="${I}" aria-label="${esc(P.name)}">
        ${iconOrFallback("skill", P.id, P.name)}
        <span class="key num">${keyLabel(h.bindings["skill" + (I + 1)] ?? "Digit" + (I + 1))}</span>
      </button>`).join("") + sealed.map(x => `
      <span class="skill-slot is-sealed" role="img" aria-label="${esc(x.name + "，待找回")}" data-tip="${esc(x.name + " · 待找回" + (x.task ? "：完成「" + x.task + "」" : ""))}">
        ${iconOrFallback("skill", x.id, x.name)}<span class="state">待找回</span>
      </span>`).join("")), i.skills.forEach((P, I) => { const D = b.children[I] as HTMLElement, G = skillState(i, P.id, h); D.dataset.tip = skillTip(i, h, I, P), D.className = "skill-slot" + slotTint(D, G.cls), D.setAttribute("aria-disabled", String(G.why !== "" || G.cd > 0)); let U = D.querySelector<HTMLElement>(".cd,.state"); if (U?.classList.contains("state")) U.remove(), U = null; const total = G.cd > 0 ? Math.max(G.cd, Number(D.dataset.cdTotal) || 0) : 0; if (G.cd > 0) D.dataset.cdTotal = String(total); if (total >= SHORT_COOLDOWN) { if (!U) D.insertAdjacentHTML("beforeend", `<span class="cd num"></span>`), U = D.querySelector<HTMLElement>(".cd"); const sec = String(Math.ceil(G.cd)); if (U!.textContent !== sec) U!.textContent = sec; U!.style.setProperty("--cd-left", (G.cd / total * 100).toFixed(1) + "%"); } else { if (G.cd <= 0) delete D.dataset.cdTotal; U?.remove(); } });
    const options={blocked:h.blocked,processing:h.processing,hp:i.hero.hp,full:e.gear.length>=e.capacity,context};
    setHudMarkup($('#modebar'),combatModeHtml(i.mode,Boolean(h.hudModeOpen),options));
    setHudMarkup($('#hud-status'),hudStatusHtml(e,context,h.processing,h.blocked?'':i.stopReason));
    setHudMarkup($('#hud-dungeon-exit'),context==='dungeon'?buttonHtml('退出副本',{action:'hud-dungeon-exit',id:h.dungeonId,iconHtml:hudExitIcon,size:'icon',variant:'secondary',disabled:h.processing||h.dungeonBusy,attributes:{title:'退出副本'}}):'');
    const M = $("#sysbar");
    M.dataset.ready !== "1" && (M.dataset.ready = "1", M.innerHTML = [["bag", "背包", "行囊", "bag"], ["skills", "技能", "技能", "build"], ["progression", "养成", "养成", "growth"], ["appearance", "外观", "外观", "appearance"], ["tasks", "任务", "任务", "goal"], ["settings", "设置", "设置", "settings"]].map(([P, I, D, G]) => `<button class="entry" data-action="panel" data-id="${P}" aria-label="${I}"><span class="entry-orb">${hudMenuIcon(G as Parameters<typeof hudMenuIcon>[0])}</span><span class="entry-name">${D}</span>${P === "bag" ? '<span class="badge num" hidden></span>' : ""}</button>`).join(""));
    const A = M.querySelector<HTMLElement>(".badge")!;
    A.hidden = e.rewards.length === 0, A.textContent = String(e.rewards.length); A.setAttribute('aria-label',`待领取装备 ${e.rewards.length} 件`); M.querySelector<HTMLElement>('[data-id=bag]')!.setAttribute('aria-label',`背包，装备 ${e.gear.length}/${e.capacity}，待领取 ${e.rewards.length} 件`);
    const F = $("#hud-gold");
    F.textContent !== String(e.gold) && (F.textContent = String(e.gold)), updateNativeCoin(F.parentElement!, e.gold, h.reduced);
    const B:Record<string,string> = { bag: keyLabel(h.bindings.bag), skills: keyLabel(h.bindings.skills) };
    M.querySelectorAll<HTMLButtonElement>(".entry").forEach(P => { const I = B[P.dataset.id!]; P.title = P.getAttribute("aria-label") + (I ? `（${I}）` : ""), P.setAttribute("aria-expanded", String(h.panel === P.dataset.id)), P.disabled = h.processing, I && P.setAttribute("aria-keyshortcuts", I); }), lastFeedKey !== JSON.stringify(h.feed) && (lastFeedKey = JSON.stringify(h.feed), $("#feed").innerHTML = h.feed.map(P => `<div class="num">${esc(P)}</div>`).join(""));
    let L = "";
    const O = (P:{x:number;y:number}|undefined|null, I = 4) => P && distance(i.hero.position, P) < I;
    h.fieldMap?.waypoints.some(P => !P.unlocked && O(P)) ? L = `按 ${keyLabel(h.bindings.interact)} 激活航标` : O(i.region.portal) ? L = i.region.id === "town" ? `按 ${keyLabel(h.bindings.interact)} 打开远行地图` : `按 ${keyLabel(h.bindings.interact)} 返回营地` : O(i.region.bossPortal) ? L = featureOpen(e, 'trial') ? `按 ${keyLabel(h.bindings.interact)} 打开首领试炼` : featureReason(e, 'trial') : e.rewards.some(P => P.region === i.region.id && O(P.position, settings.pickupRadius)) ? L = e.gear.length >= e.capacity ? "背包满了，装备留在待领取" : h.autoPickup !== !1 ? "靠近自动拾取附近装备" : `按 ${keyLabel(h.bindings.interact)} 拾取附近装备` : i.region.landmarks.some(P => P.kind === "safe" && O(P, 3)) ? L = `按 ${keyLabel(h.bindings.interact)} 记录据点` : i.region.landmarks.some(P => P.kind === "forge" && O(P, 5)) && (L = `按 ${keyLabel(h.bindings.interact)} 打开锻造台 · 强化装备`);if(h.dungeonRunning)L="";if(i.region.id.startsWith("ss-map-")&&!/拾取|背包/.test(L))L="";$("#hintbox").innerHTML = L ? `<div class="hint">${L.startsWith("按") ? `<kbd>${keyLabel(h.bindings.interact)}</kbd> ` : ""}${esc(L.replace(/^按\s+\S+\s*/, ""))}</div>` : "";
    const R = h.blocked ? `<div class="paused">${statusBadgeHtml("连接待恢复，战斗已暂停", "warning")}${buttonHtml("恢复连接", { action: "recover", variant: "secondary", busy: h.processing, busyLabel: "正在恢复…" })}</div>` : h.userPaused && !h.panel ? `<div class="paused">${statusBadgeHtml("已暂停", "neutral")}${buttonHtml("继续", { action: "pause", variant: "primary" })}</div>` : "";
    setHudMarkup($("#pausebox"), R), drawMinimap(h);
}

export function renderPanel(view:PresentationModel&{crafting?:CraftingUI;travel?:TravelState;travelDrops?:TravelDropView;progression?:ProgressionUI;challenges?:ChallengeUI;progressionGroup?:string}){
  const host=$('#modal');
  const seaScroll=host.querySelector<HTMLElement>('.sea-list')?.scrollTop;
  const settingsNode=['settings','auto'].includes(view.panel)?host.querySelector<HTMLElement>('[data-settings-scroll]'):null,settingsScroll=settingsNode?.scrollTop??0;
  const settingsActive=settingsNode?.contains(document.activeElement)?document.activeElement as HTMLElement:null;
  const settingsFocus=settingsActive?{id:settingsActive.id,action:settingsActive.dataset.action,key:settingsActive.dataset.id}:null;
  const characterScroll=view.panel==='character'?Array.from(host.querySelectorAll<HTMLElement>('[data-character-scroll]')).map(node=>({key:node.dataset.characterScroll,top:node.scrollTop,left:node.scrollLeft})):[];
  const characterActive=view.panel==='character'&&host.contains(document.activeElement)?document.activeElement as HTMLElement:null;
  const characterFocus=characterActive?{action:characterActive.dataset.action,id:characterActive.dataset.id}:null;
  const appearanceScroll=view.panel==='appearance'?Array.from(host.querySelectorAll<HTMLElement>('[data-appearance-scroll]')).map(el=>({key:el.dataset.appearanceScroll,top:el.scrollTop,left:el.scrollLeft})):[];
  const appearanceActive=view.panel==='appearance'&&host.contains(document.activeElement)?document.activeElement as HTMLElement:null;
  const appearanceFocus=appearanceActive?{action:appearanceActive.dataset.action,id:appearanceActive.dataset.id}:null;
  const progressScroll=view.panel==='progression'?Array.from(host.querySelectorAll<HTMLElement>('[data-progress-scroll]')).map(el=>({key:el.dataset.progressScroll,top:el.scrollTop,left:el.scrollLeft})):[];
  const active=view.panel==='progression'&&host.contains(document.activeElement)?document.activeElement as HTMLElement:null;
  const progressFocus=active?{action:active.dataset.action,id:active.dataset.id,elementId:active.id,tier:active.dataset.challengeTier,role:active.dataset.challengeRole}:null;
  const craftScroll=view.panel==='forge'?Array.from(host.querySelectorAll<HTMLElement>('[data-craft-scroll]')).map(el=>({key:el.dataset.craftScroll,top:el.scrollTop})):[];
  const travelScroll=view.panel==='travel'?['.travel-browser','.travel-region-scroll','.travel-destinations','.travel-detail-scroll'].map(selector=>({selector,top:host.querySelector<HTMLElement>(selector)?.scrollTop??0,left:host.querySelector<HTMLElement>(selector)?.scrollLeft??0})):[];
  const skillFocus=host.querySelector<HTMLElement>('.skill-detail')?.dataset.skill,skillRegions=view.panel==='skills'?['.skill-book','.skill-detail-body','.skill-training'].map(selector=>({selector,top:host.querySelector<HTMLElement>(selector)?.scrollTop??0})):[];
  const skillPage=host.querySelector<HTMLElement>(`.skill-book #skill-page-${view.skillCategory}`);
  const skillScroll=view.panel==='skills'&&skillPage?skillPage.scrollTop:null;
  if(view.confirm==='dungeon-exit'){host.classList.add('open');host.innerHTML=confirmationHtml({title:'退出本次副本？',description:'退出后保留已确认收益，不能重新加入本场。',confirmLabel:'确认退出',confirmAction:'hud-dungeon-exit-confirm',confirmId:view.confirmId,cancelAction:'hud-dungeon-exit-cancel',cancelLabel:'继续挑战',danger:true,busy:view.dungeonBusy,disabled:view.dungeonBusy||view.dungeonId!==view.confirmId});return;}
  if(!view.panel){host.classList.remove('open');host.innerHTML='';invalidatePreviews();return;}
  host.classList.add('open');
  let title='',body='';let gearToPreview:Gear|undefined;const s=view.snapshot;
  if(view.panel==='login'){host.innerHTML=loginPanelHtml(Boolean(view.accountOnly),{ready:Boolean(view.authReady),connecting:Boolean(view.authConnecting),error:view.authError??'',reload:Boolean(view.authReload)});return;}
  if(view.panel==='create'){host.innerHTML=createCharacterPanelHtml();return;}
  if(view.panel==='takeover'){host.innerHTML=takeoverPanelHtml();return;}
  if(!s)return;
  
  // 先确定各页面的 title 和 body
  if(view.panel==='region-map'){title=view.world.region.name;body=`<canvas id="region-map-canvas" aria-label="本区域全图"></canvas><div class="region-map-legend"><span class="map-key hero">● 当前位置</span>${view.snapshot?.starseaView?'<span class="map-key safe">？ 待调查</span>':''}<span class="map-key npc">● 营地同伴</span><span class="map-key main">◎ 追踪目标</span><span class="map-key portal">◎ 区域入口</span><span class="map-key safe">■ 记录据点</span><span class="map-key forge">▰ 锻造</span><span class="map-key enemy">● 敌人</span><span class="map-key elite">▲ 精英</span><span class="map-key boss">◆ 首领</span>${view.fieldMap?'<span class="map-key portal">◆ 已激活航标</span><span class="map-key">◇ 未激活航标</span>':''}</div>${view.fieldMap?.replay?`<div class='region-map-actions' aria-label='沉星可选走访'>${buttonHtml((view.fieldMap.replay.done?'已走访 · ':'')+view.fieldMap.replay.label,{action:'replay-goto',variant:'secondary',disabled:view.processing||view.blocked||view.fieldMap.replay.done})}</div>`:''}${view.fieldMap?.replayError?`<p class='ui-caption'>${esc(view.fieldMap.replayError)}</p>`:''}${view.fieldMap?.waypoints.some(w=>w.unlocked)?`<div class="region-map-actions" aria-label="航标传送">${view.fieldMap.waypoints.filter(w=>w.unlocked).map(w=>buttonHtml('传送 · '+w.name,{action:'waypoint-travel',id:w.id,variant:'secondary',disabled:view.processing||view.blocked})).join('')}</div>`:''}${view.dungeonRunning?'':`<div class="region-map-actions">${buttonHtml('远行地图',{action:'panel',id:'travel',variant:'primary'})}${buttonHtml('副本目录',{action:'panel',id:'dungeons',variant:'secondary'})}</div>`}`;}
  else if(view.panel==='bounty'&&view.bounty){title='悬赏板 · '+view.bounty.zone;body=bountyHtml(view.bounty,Boolean(view.processing));}
  else if(view.panel==='sea-difficulty'){title='海域难度';body=view.seaDifficulty?seaDifficultyHtml(view.seaDifficulty,view.seaTierPick??view.seaDifficulty.current,Boolean(view.processing||view.blocked)):'<p class="ui-caption">远航开启后，这里可以选要走多深的海。</p>';}
  else if(view.panel==='travel'){title='远行目的地';body=renderTravel(view.travel??initialTravelState(),s,view.processing,undefined,view.travelDrops);}
  else if(view.panel==='bag'||view.panel==='rewards'){
    title=view.bagTab==='rewards'?'待领取战利品':view.bag.warehouseOpen?'仓库':'背包';
    if(view.bagTab==='bag'){
      const selection=bagSelection(s,view.bag,view.qualityFilter,view.slotFilter,view.bag.metadata);
      gearToPreview=selection.selected?.kind==='equipment'?selection.selected.gear:undefined;
      body=BagPanel({snapshot:s,ui:view.bag,quality:view.qualityFilter,slot:view.slotFilter,busy:view.processing,blocked:view.blocked,inTown:view.world.region.id==='town'||view.world.region.id==='ss-map-port',returnRegion:view.fieldReturnRegion});
    }else body=`<div class="bag-reward-toolbar">${buttonHtml('返回背包',{action:'bag-tab',id:'bag',size:'compact'})}<span>装备 ${s.gear.length} / ${s.capacity}</span></div><div class="gear-reward-list">${s.rewards.length?s.rewards.map(reward=>`<div class="gear-reward-row">${GearCard(reward.gear,{revision:s.revision,pending:true})}<div class="gear-reward-action"><span>${esc(regionById(reward.region).name)}</span>${buttonHtml('领取到背包',{action:'claim',id:reward.id,variant:'primary',disabled:s.gear.length>=s.capacity||view.blocked,busy:view.processing,busyLabel:'正在领取…'})}</div></div>`).join(''):stateBlockHtml({kind:'empty',title:'暂无待领取装备',message:'背包满时获得的装备会暂存于此。'})}</div>`;
  }
  else if(view.panel==='character'){
    title='人物';const selection=characterSelection(s,view.characterPart,view.selected);gearToPreview=view.characterChooserOpen?selection.selected:undefined;if(gearToPreview)view.onSelect(gearToPreview.id);
    body=CharacterPanel(s,view.characterPart,view.selected,view.figureURL,view.processing||view.blocked,{chooserOpen:view.characterChooserOpen,detailsOpen:view.characterDetailsOpen,blocked:view.blocked,recovering:view.processing,damage:{stats:view.world.enemies.length>0?view.world.stats:s.stats,skills:view.world.enemies.length>0?view.world.skills:s.resolvedSkills,telemetry:view.world.enemies.length>0?view.world.effectStats:null}});
  }
  else if(view.panel==='forge'){title='拾星港工坊';const craft=view.crafting,tabs=craft?craftingTabsHtml(craft):'';if(!craft||craft.tab==='upgrade'){const gear=forgeSelection(s,view.selected);gearToPreview=gear;if(gear)view.onSelect(gear.id);body=tabs+ForgePanel(s,gear,Boolean(view.processing||view.blocked));}else body=tabs+CraftingPanel(s,craft,Boolean(view.processing||view.blocked));}
  else if(view.panel==='skills'){title='技能';body=renderSkills({...view,snapshot:s});}
  else if(view.panel==='appearance'&&view.appearance){title='外观装配';body=renderAppearance(view.appearance,Boolean(view.appearanceDirty),view.blocked);}
  else if(view.panel==='progression'&&view.progression&&view.challenges){title='养成';body=renderProgression(view.progression,view.challenges,view.progressionGroup??'grid',view.blocked,view.snapshot?.gear??[],view.snapshot);}
  else if(view.panel==='auto'){title='自动战斗设置';body=`<div class="settings-auto-only" data-settings-scroll>${autoSettingsHtml(view)}</div>`;}
  else if(view.panel==='boss'){
    const bossRegion=regionById(view.world.region.id+'-boss');
    const access=s.bossAccess?.[bossRegion.id];
    title='进入首领试炼';body=`<section class="system-summary"><h3>${esc(bossRegion.name)}</h3><p>${esc(bossRegion.subtitle)}</p>${statusBadgeHtml(access?.eligible?'准入条件已达成':access?'尚未满足准入条件':'准入信息待核对',access?.eligible?'success':'warning')}<p class="system-condition">${esc(access?.message??'首领准入信息未就绪，请恢复连接。')}</p><p class="ui-caption">首次挑战需完成本地区清剿；解锁后可以重试，不消耗门票。</p></section><div class="system-actions">${buttonHtml('返回准备',{action:'close'})}${buttonHtml('进入试炼',{action:'boss',variant:'primary',disabled:!access?.eligible||view.blocked,busy:view.processing,busyLabel:'正在进入…'})}</div>`;}
  else if(view.panel==='settings'){title='游戏设置';body=settingsPanelHtml(view);}

  // 所有页面内容确定后，生成 head
  const headerActions=view.panel==='bag'?bagHeader(s):view.panel==='forge'?`<div class="bag-header-tools"><span class="bag-wallet">${resourceAmountHtml('gold',s.gold,{compact:true})}${resourceAmountHtml('material',s.material,{compact:true})}</span></div>`:view.panel==='character'?`<div class="bag-header-tools"><span class="bag-wallet">${resourceAmountHtml('gold',s.gold,{compact:true})}${resourceAmountHtml('material',s.material,{compact:true})}</span>${buttonHtml('返回背包',{action:'bag-return',size:'compact'})}${buttonHtml('外观',{action:'panel',id:'appearance',size:'compact'})}</div>`:'';
  const head=view.panel==='travel'?travelHeader(view.travel??initialTravelState(),view.processing):panelHeaderHtml(title,{actionsHtml:headerActions,closeLabel:'关闭',closeDisabled:view.processing});
  
  if(view.confirm==='salvage'&&view.confirmId){
    const g=s.gear.find(v=>v.id===view.confirmId);
    if(g){
      body+=confirmationHtml({title:'确认分解',description:'分解后无法恢复，获得的材料将放入背包。',detailsHtml:`<p><b>${esc(g.name)}${g.rank?' +'+g.rank:''}</b></p><p class="small">${slotName[g.slot]} · ${effectName[g.effect]}${g.rank?' · 已强化':''}</p>`,confirmLabel:'确认分解',confirmAction:'salvage',confirmId:g.id,cancelAction:'cancel-confirm',danger:true,busy:view.processing,disabled:view.blocked});
    }
  }
  if(view.bag.batch&&view.panel==='bag'){const quote=view.bag.batch;body+=confirmationHtml({title:'确认批量分解',description:'分解后无法恢复。已装备、锁定、强化、传奇、威能和武器盘装备均已排除。',detailsHtml:`<p>将分解 <b>${quote.gear.length}</b> 件普通、魔法或稀有装备，获得 <b>${quote.material}</b> 强化石；保护 ${quote.protectedCount} 件。</p><div class="batch-salvage-list" tabindex="0" aria-label="待分解装备清单">${quote.gear.map(g=>`<p>${esc(g.name)} · ${qualityName[g.quality]}</p>`).join('')||'<p>没有可批量分解的装备。</p>'}</div>`,confirmLabel:'确认分解 '+quote.gear.length+' 件',confirmAction:'bag-batch-salvage',cancelAction:'bag-batch-cancel',danger:true,busy:view.processing||view.bag.busy,disabled:view.blocked||!quote.gear.length||quote.revision!==s.revision});}
  host.innerHTML=`<section data-panel="${esc(view.panel)}" class="panel${view.panel==='bag'||view.panel==='skills'||view.panel==='character'||view.panel==='forge'||view.panel==='sea-difficulty'?' panel-wide':''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">${head}${body}<div class="error" role="alert">${esc(view.lastError)}</div></section>`;
  if(view.panel==='region-map'){const canvas=host.querySelector<HTMLCanvasElement>('#region-map-canvas');if(canvas)paintMinimap(canvas,view.world,{mode:'full',npcs:mapMarkers(view),field:view.fieldMap});}
  if(view.panel==='sea-difficulty'&&seaScroll!==undefined){const list=host.querySelector<HTMLElement>('.sea-list');if(list)list.scrollTop=seaScroll;}
  if(settingsNode){const node=host.querySelector<HTMLElement>('[data-settings-scroll]');if(node)node.scrollTop=settingsScroll;}
  if(settingsFocus){const node=settingsFocus.id?host.querySelector<HTMLElement>('#'+settingsFocus.id):Array.from(host.querySelectorAll<HTMLElement>('[data-action]')).find(el=>el.dataset.action===settingsFocus.action&&el.dataset.id===settingsFocus.key);node?.focus({preventScroll:true});}
  for(const saved of appearanceScroll){const node=Array.from(host.querySelectorAll<HTMLElement>('[data-appearance-scroll]')).find(el=>el.dataset.appearanceScroll===saved.key);if(node){node.scrollTop=saved.top;node.scrollLeft=saved.left;}}
  if(appearanceFocus){const node=Array.from(host.querySelectorAll<HTMLElement>('button,input,select')).find(el=>el.dataset.action===appearanceFocus.action&&el.dataset.id===appearanceFocus.id);node?.focus({preventScroll:true});}
  for(const saved of travelScroll){const node=host.querySelector<HTMLElement>(saved.selector);if(node){node.scrollTop=saved.top;node.scrollLeft=saved.left;}}
  for(const saved of skillRegions){const region=host.querySelector<HTMLElement>(saved.selector);if(saved.selector==='.skill-detail-body'&&host.querySelector<HTMLElement>('.skill-detail')?.dataset.skill!==skillFocus)continue;if(region)region.scrollTop=saved.top;}
  if(skillScroll!==null){const library=host.querySelector<HTMLElement>('.skill-book .library');if(library)library.scrollTop=skillScroll;}
  for(const saved of craftScroll){const node=Array.from(host.querySelectorAll<HTMLElement>('[data-craft-scroll]')).find(el=>el.dataset.craftScroll===saved.key);if(node)node.scrollTop=saved.top;}
  for(const saved of progressScroll){const node=Array.from(host.querySelectorAll<HTMLElement>('[data-progress-scroll]')).find(el=>el.dataset.progressScroll===saved.key);if(node){node.scrollTop=saved.top;node.scrollLeft=saved.left;}}
  if(progressFocus){const node=Array.from(host.querySelectorAll<HTMLElement>('button,input,select')).find(el=>progressFocus.elementId?el.id===progressFocus.elementId:progressFocus.tier?el.dataset.challengeTier===progressFocus.tier:progressFocus.role?el.dataset.challengeRole===progressFocus.role:el.dataset.action===progressFocus.action&&el.dataset.id===progressFocus.id);node?.focus({preventScroll:true});}
  if(view.panel==='bag'&&view.bagTab==='bag'){const list=host.querySelector<HTMLElement>('[data-bag-scroll=list]');if(list)list.scrollTop=view.bag.scrollTop;}
  invalidatePreviews();
  if(gearToPreview)loadGearDetails(gearToPreview,s,{busy:view.processing||view.blocked,preview:view.previewGear,tip:view.previewGearTip,error:view.noticeError});
  if(characterFocus){const target=Array.from(host.querySelectorAll<HTMLElement>('[data-action]')).find(node=>node.dataset.action===characterFocus.action&&node.dataset.id===characterFocus.id);target?.focus({preventScroll:true});}
  for(const saved of characterScroll){const node=Array.from(host.querySelectorAll<HTMLElement>('[data-character-scroll]')).find(node=>node.dataset.characterScroll===saved.key);if(node){node.scrollTop=saved.top;node.scrollLeft=saved.left;}}
}
