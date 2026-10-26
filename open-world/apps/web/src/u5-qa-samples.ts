import {skillCatalog,getEquipmentItem} from '../../../packages/content/index.ts';
import type {Gear,Snapshot} from '../../../packages/contracts/index.ts';
import type {LoadoutView} from '../../../packages/contracts/zhangjian.ts';
import {npcs} from '../../../packages/content/task-tables.ts';
import {skillArt} from './ui-assets.ts';
import {buttonHtml,escapeHtml,panelHeaderHtml} from './ui/primitives.ts';
import {sealEmblem} from './ui/icons.ts';
import {loginPanelHtml,createCharacterPanelHtml} from './ui/auth-panels.ts';
import {settingsPanelHtml} from './ui/settings-panel.ts';
import {ToastQueue,toastHtml} from './ui/toast-queue.ts';
import {installTitleScreen} from './ui/title-screen.ts';
import {installDialogueBar} from './ui/dialogue-bar.ts';
import {CharacterPanel} from './components/CharacterPanel.ts';
import {u4SkillSnapshot} from './u4-qa-samples.ts';

type QaCase={id:string;label:string;render:()=>string;mount?:(root:HTMLElement)=>void|(()=>void);presentation?:'modal'|'stage'};
const bindings={up:'KeyW',down:'KeyS',left:'KeyA',right:'KeyD',interact:'KeyE',pause:'Space',bag:'KeyB',skills:'KeyK',skill1:'Digit1',skill2:'Digit2',skill3:'Digit3',skill4:'Digit4'};
const toastSamples=()=>{const q=new ToastQueue();q.push('获得奖励，已存入背包。',0,{kind:'loot',ttl:6000});q.push('设置已保存。',0,{kind:'success',ttl:7500});q.push('连接正在恢复，已确认的进度会保留。',0,{kind:'error',sticky:true});return q.visible(0).map(t=>toastHtml(t,0)).join('');};
const titleMount=(root:HTMLElement)=>installTitleScreen(root.querySelector<HTMLElement>('#modal')??root);

export function u5CharacterSnapshot():Snapshot{
 const snapshot=u4SkillSnapshot();
 const pieces=[['weapon','weapon'],['armor','armor'],['helmet','helmet'],['boots','boots'],['necklace','accessory'],['ring','ring']] as const;
 const gear:Gear[]=pieces.map(([part,slot])=>{const item=getEquipmentItem('standard-sword-t1-'+part)!;return {id:'u5-qa-'+part,base:item.id,name:item.name,slot,attack:slot==='weapon'?24:0,armor:slot==='armor'?18:0,effect:'none',rank:0,locked:false,quality:'magic',affixes:[]};});
 const candidate=getEquipmentItem('standard-sword-t2-weapon')!;
 snapshot.gear=[...gear,{id:'u5-qa-candidate',base:candidate.id,name:candidate.name,slot:'weapon',attack:35,armor:0,effect:'none',rank:0,locked:false,quality:'rare',affixes:[]}];
 snapshot.equipment=Object.fromEntries(gear.map(piece=>[piece.slot,piece.id]));
 snapshot.name='静态换装验收';
 snapshot.stats={hp:280,attack:35,armor:28,speed:4,mana:100,regen:4,effects:[],weapon:'sword',combos:[]};
 snapshot.resolvedSkills=skillCatalog.filter(skill=>snapshot.skills.includes(skill.id));
 return snapshot;
}
const characterLoadouts:LoadoutView={active:0,dirty:true,canSwitch:false,switchBlock:'只读样例',current:{elements:['physical'],resist:{}},slots:['方案一','方案二','方案三'].map((name,index)=>({index,name,empty:index===2,elements:[],skills:[],pet:null}))};
const characterSample=(chooserOpen:boolean)=>`<section class="panel panel-wide" data-panel="character" role="dialog" aria-label="人物与出战方案">${panelHeaderHtml('人物',{emblemHtml:sealEmblem('people')})}${CharacterPanel(u5CharacterSnapshot(),'weapon','u5-qa-candidate',undefined,false,{chooserOpen,detailsOpen:true,blocked:false,loadoutView:characterLoadouts,petsEntry:true})}</section>`;

// Same markup as Story/Starsea controllers, then the real production enhancer.
// Do not handwrite data-bar/dlg-head: doing so previously missed header collisions.
const dialogueNpc=npcs.find(n=>n.name.includes('米洛'))??npcs.find(n=>n.id==='ss-npc-tongling')!;
const dialogueSample=(long=false,narrator=false)=>`<section class="panel story-dialogue" role="dialog" aria-modal="true" aria-label="落岛求生">${panelHeaderHtml(long?'落岛求生 · 航线与回港对白长标题换行检查':'落岛求生',{emblemHtml:sealEmblem('book')})}<div class="story-spoken">${narrator?'':`<strong>${escapeHtml(dialogueNpc.name)}</strong>`}<p>${escapeHtml(long?'又来两只巡猎兽，是被那道光引来的。请沿着标记继续前进，抵达安全地点后再整理装备和补给。'.repeat(5):'又来两只巡猎兽，是被那道光引来的。')}</p></div><p class="ui-caption">4 / 5</p><div class="story-dialogue-actions">${buttonHtml('继续',{variant:'primary',action:'qa-dialogue-next'})}${buttonHtml('跳过',{action:'qa-dialogue-skip'})}</div></section>`;
const dialogueMount=(root:HTMLElement)=>{const host=root.querySelector<HTMLElement>('#modal')??root,final=host.innerHTML;host.innerHTML=dialogueSample().replace('4 / 5','3 / 5');const dispose=installDialogueBar(host);host.innerHTML=final;return dispose;};

export const u5QaCases:QaCase[]=[
 {id:'u5-hud',label:'U5 · 安静技能栏与提示',presentation:'stage',render:()=>`<div id="hud" data-context="field"><div id="skillbar" class="skillbar">${skillCatalog.slice(0,4).map((skill,index)=>`<button class="skill-slot${index===1?' is-mana':index===2?' is-blocked':''}" aria-label="${escapeHtml(skill.name)}" aria-disabled="${index>0}" data-tip="${escapeHtml(skill.name)}"><img src="${skillArt(skill.id)}" alt=""><span class="key">${index+1}</span>${index===3?'<span class="cd num" style="--cd-left:60%">4</span>':''}</button>`).join('')}</div></div><div id="toast">${toastSamples()}</div>`},
 {id:'u5-login',label:'U5 · 标题与登录',render:()=>loginPanelHtml(true),mount:titleMount},
 {id:'u5-login-error',label:'U5 · 连接失败',render:()=>loginPanelHtml(true,{ready:false,connecting:false,error:'连接暂时不可用，请稍后重试。',reload:false,muted:true}),mount:titleMount},
 {id:'u5-create',label:'U5 · 创建角色',render:createCharacterPanelHtml,mount:titleMount},
 {id:'u5-settings',label:'U5 · 设置',render:()=>`<section class="panel" data-panel="settings">${panelHeaderHtml('游戏设置',{emblemHtml:sealEmblem('auto')})}${settingsPanelHtml({volume:.8,reduced:false,autoPickup:true,bindings,world:{radius:8,targetPriority:'near',avoidElite:true,autoSkills:true}})}</section>`},
 {id:'u5-dialogue',label:'U5 · 真实对白结构',render:()=>dialogueSample(),mount:dialogueMount},
 {id:'u5-dialogue-long',label:'U5 · 长标题与长对白',render:()=>dialogueSample(true),mount:dialogueMount},
 {id:'u5-dialogue-narrator',label:'U5 · 无头像旁白',render:()=>dialogueSample(false,true),mount:dialogueMount},
 {id:'u5-loadout',label:'U5 · 人物与方案',render:()=>characterSample(false)},
 {id:'u5-loadout-swap',label:'U5 · 方案与换装',render:()=>characterSample(true)}
];
