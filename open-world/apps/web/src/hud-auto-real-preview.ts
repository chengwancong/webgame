import Phaser from 'phaser';
import './ui-entry.css';
import './hud-auto-real-preview.css';
import {World} from '../../../packages/simulation/index.ts';
import {regionById,skillCatalog} from '../../../packages/content/index.ts';
import type {Snapshot} from '../../../packages/contracts/index.ts';
import {WorldScene,type ViewBridge} from './scene.ts';
import {mountHud,updateHud,type PresentationModel} from './presentation.ts';
import {buttonHtml,esc} from './ui-components.ts';
import {loadWorldFont} from './ui/world-text.ts';
import {HeroPreview} from './hero-appearance.ts';

type Context='town'|'field'|'dungeon';
// Independent preview: GET only. Fixture counts illustrate layout, never grant skills or rewards.
async function start(){
 const response=await fetch('/api/character',{credentials:'same-origin'});if(!response.ok)throw Error('请先在游戏主页登录，再打开本示意页。');
 const snapshot:Snapshot=structuredClone(await response.json());
 const existingGear=snapshot.gear;snapshot.gear=Array.from({length:24},(_,i)=>({...structuredClone(existingGear[i%existingGear.length]),id:crypto.randomUUID()}));
 snapshot.rewards=Array.from({length:49},(_,i)=>({id:crypto.randomUUID(),source_id:'preview-loot-'+i,region:'meadow',position:{x:20+i%5,y:20},gear:structuredClone(snapshot.gear[i%24])}));
 snapshot.level=9;snapshot.gold=2668;snapshot.stats.hp=342;
 let context:Context='dungeon',slots=8,autoOn=true;
 function makeWorld(){const region=regionById(context==='town'?'town':'meadow'),skills=skillCatalog.slice(0,slots);snapshot.resolvedSkills=skills;const w=new World(region,snapshot.stats,skills,context==='town'?[]:region.spawns,[],1);w.hero.position=context==='town'?{...region.safe}:{x:16,y:14};w.anchor={...w.hero.position};w.mode=autoOn?'auto':'manual';w.hero.hp=context==='town'?342:224;return w;}
 const bridge:ViewBridge={world:makeWorld(),rewards:[],panel:'preview',loggedIn:true,motionReduced:true,resolvedAppearance:snapshot.resolvedAppearance,step(){},interact(){},cast(){},pause(){},open(){},pick(){},sound(){}};
 const view={world:bridge.world,snapshot,loggedIn:true,panel:'',blocked:false,userPaused:false,processing:false,reduced:false,dungeonRunning:true,trackerOpen:false,feed:[],bindings:{up:'KeyW',down:'KeyS',left:'KeyA',right:'KeyD',interact:'KeyE',pause:'Space',bag:'KeyB',skills:'KeyK',...Object.fromEntries(Array.from({length:8},(_,i)=>['skill'+(i+1),'Digit'+(i+1)]))}} as unknown as PresentationModel;
 mountHud();updateHud(view);
 let nativeHead:HTMLCanvasElement|undefined;
 const portraitCanvas=Object.assign(document.createElement('canvas'),{width:256,height:256}),portrait=new HeroPreview(portraitCanvas,{height:180,footX:.5,footY:.8,fitBounds:true});
 if(snapshot.resolvedAppearance&&await portrait.setAppearance(snapshot.resolvedAppearance)){portrait.render({action:'idle',clock:.1,facing:-1});const head=Object.assign(document.createElement('canvas'),{width:96,height:96});nativeHead=head;head.className='preview-native-portrait';head.setAttribute('aria-label','角色头像');portrait.drawPortrait(head);document.querySelector('#vitals .who img')!.replaceWith(head);}portrait.destroy();
 document.querySelector('#hud')!.insertAdjacentHTML('beforeend',`<aside class="preview-bag-notice plate"><strong>背包已满 · 24 / 24</strong><span id="preview-bag-context"></span></aside><section class="preview-auto-control plate"><button id="preview-auto" type="button" class="preview-auto is-on" aria-pressed="true"><svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M26 13a10 10 0 0 0-17-5L5 12m0-7v7h7M6 19a10 10 0 0 0 17 5l4-4m0 7v-7h-7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg><b>AUTO</b><small>开启</small></button></section><section class="preview-camp-actions plate">${buttonHtml('整理行囊',{action:'preview-bag',size:'compact'})}${buttonHtml('前往远行之门',{action:'preview-travel',size:'compact'})}</section><nav class="preview-caption plate" aria-label="HUD场景预览">${(['town','field','dungeon'] as const).map(c=>buttonHtml({town:'营地',field:'野外',dungeon:'副本'}[c],{action:'preview-context',id:c,size:'compact',pressed:c===context})).join('')}<label>技能槽示意 <select id="preview-slots" aria-label="技能槽数量"><option value="4">4</option><option value="6">6</option><option value="8" selected>8</option></select></label><small>独立预览 · 槽位和数值为示例</small></nav>`);
 const auto=document.querySelector<HTMLButtonElement>('#preview-auto')!;
 function drawAuto(){auto.setAttribute('aria-pressed',String(autoOn));auto.classList.toggle('is-on',autoOn);auto.setAttribute('aria-label',`自动战斗已${autoOn?'开启':'关闭'}，点击${autoOn?'关闭':'开启'}`);auto.querySelector('small')!.textContent=autoOn?'开启':'关闭';}
 function drawContext(){
  bridge.world=makeWorld();view.world=bridge.world;view.dungeonRunning=context==='dungeon';updateHud(view);if(nativeHead)document.querySelector('#vitals .who img')?.replaceWith(nativeHead);document.querySelector<HTMLElement>('#hud')!.dataset.context=context;
  const labels={town:['归途营地','整备与出发','与营地同伴交谈，调整装备与技能。'],field:['苍风原野 · 野外','探索与清剿','清剿 5 / 6 · 可自行选择探索路线。'],dungeon:['苍风原野 · 副本','清剿敌人','敌人 5 / 6　精英 1 / 1']}[context];
  document.querySelector('#tracker')!.innerHTML=`<div class="preview-instance-heading"><strong>${labels[0]}</strong><span>${context==='dungeon'?'24:18':context==='field'?'探索中':'安全区域'}</span></div><h3>${labels[1]}</h3><p>${labels[2]}</p>${context==='dungeon'?'<div class="preview-objective-progress"><i></i></div>':''}<div class="preview-instance-actions">${buttonHtml(context==='town'?'营地同伴':context==='field'?'区域地图':'副本详情',{action:'preview-details',size:'compact'})}${buttonHtml(context==='dungeon'?'放弃本次挑战':context==='field'?'返回营地':'选择目的地',{action:context==='dungeon'?'preview-abandon':'preview-details',size:'compact',variant:context==='dungeon'?'danger':'secondary'})}</div>`;
  document.querySelector('#preview-bag-context')!.textContent={town:'待领取 49 件 · 整理后领取并重新出发',field:'待领取 49 件 · 停止拾取，战斗仍可继续',dungeon:'待领取 49 件 · 副本继续，结束后整理'}[context];
  document.querySelectorAll<HTMLElement>('[data-action=preview-context]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.id===context)));drawAuto();
 }
 auto.onclick=()=>{autoOn=!autoOn;drawAuto();};
 document.querySelector<HTMLSelectElement>('#preview-slots')!.onchange=e=>{slots=Number((e.target as HTMLSelectElement).value);drawContext();};
 document.addEventListener('click',e=>{const b=(e.target as HTMLElement).closest<HTMLElement>('[data-action]');if(b?.dataset.action==='preview-context'){context=b.dataset.id as Context;drawContext();}if(b?.dataset.action==='preview-abandon'){const dialog=document.createElement('dialog');dialog.className='preview-exit-dialog';dialog.innerHTML=`<h2>放弃本次挑战？</h2><p>已获得的收益保留，放弃后不能重新加入本场。</p><p class="ui-caption">仅展示确认流程，不操作 ${esc(snapshot.name)} 的真实副本。</p><footer>${buttonHtml('继续挑战',{action:'preview-cancel'})}${buttonHtml('确认放弃',{action:'preview-confirm',variant:'danger'})}</footer>`;dialog.addEventListener('click',event=>{if((event.target as HTMLElement).closest('[data-action]')){dialog.close();dialog.remove();}});document.body.append(dialog);dialog.showModal();}});
 drawContext();await loadWorldFont();new Phaser.Game({type:Phaser.WEBGL,parent:'game',width:window.innerWidth,height:window.innerHeight,scale:{mode:Phaser.Scale.RESIZE},scene:[new WorldScene(bridge)],render:{antialias:true,roundPixels:false},audio:{noAudio:true}});document.body.dataset.previewReady='true';
}
void start().catch(e=>{document.querySelector('#toast')!.textContent=e.message;});
