import Phaser from 'phaser';
import './ui-entry.css';
import './hud-auto-real-preview.css';
import './hud-clean-preview.css';
import {World} from '../../../packages/simulation/index.ts';
import {regionById,skillCatalog} from '../../../packages/content/index.ts';
import type {Snapshot} from '../../../packages/contracts/index.ts';
import {WorldScene,type ViewBridge} from './scene.ts';
import {mountHud,updateHud,type PresentationModel} from './presentation.ts';
import {buttonHtml,esc} from './ui-components.ts';
import {loadWorldFont} from './ui/world-text.ts';
import {HeroPreview} from './hero-appearance.ts';
import environment from '../../../packages/asset-manifest/environment.v2.json';

type Context='town'|'field'|'dungeon';
// Standard exit symbol from the user's reference: open door frame + outward arrow.
const exitIcon='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h4"/><path d="M10 12h10m-4-4 4 4-4 4"/></svg>';

const returnIcon='<svg class="hud-menu-illustration" viewBox="0 0 50 52" aria-hidden="true" stroke="var(--color-chrome-ink)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m18 11-14 13 14 13v-8h12q10 0 10 12v3h6v-4q0-18-16-18H18Z" fill="var(--color-icon-paper)"/><path d="M18 23h12q12 0 14 12" fill="none" stroke="var(--color-icon-orange)" stroke-width="4"/><path d="m7 24 9-9" fill="none" stroke="var(--color-icon-leather-light)" stroke-width="2"/></svg>';
async function renderExitStyle(style:string){
 const button=document.querySelector<HTMLButtonElement>('.clean-exit-right')!;button.dataset.exitStyle=style;
 if(style==='return'){button.querySelector('.ui-button__icon')!.innerHTML=returnIcon;return;}
 if(!['portal','portal-bare'].includes(style))return;
 const atlas=new Image();atlas.src=environment.textures.props;await atlas.decode();
 const f=environment.frames.portal,canvas=Object.assign(document.createElement('canvas'),{width:f[2],height:f[3]});
 canvas.getContext('2d')!.drawImage(atlas,f[0],f[1],f[2],f[3],0,0,f[2],f[3]);canvas.setAttribute('aria-hidden','true');
 const holder=button.querySelector('.ui-button__icon')!;holder.replaceChildren(canvas);
}
// Independent preview: GET only. Fixture counts illustrate layout, never grant skills or rewards.
async function start(){
 const response=await fetch('/api/character',{credentials:'same-origin'});if(!response.ok)throw Error('请先在游戏主页登录，再打开本示意页。');
 const snapshot:Snapshot=structuredClone(await response.json());
 const existingGear=snapshot.gear;snapshot.gear=Array.from({length:24},(_,i)=>({...structuredClone(existingGear[i%existingGear.length]),id:crypto.randomUUID()}));
 snapshot.rewards=Array.from({length:49},(_,i)=>({id:crypto.randomUUID(),source_id:'preview-loot-'+i,region:'meadow',position:{x:20+i%5,y:20},gear:structuredClone(snapshot.gear[i%24])}));
 snapshot.level=9;snapshot.gold=2668;snapshot.stats.hp=342;
 const params=new URLSearchParams(location.search),layout=params.get('layout')==='focus'?'focus':'clear';document.body.dataset.cleanLayout=layout;document.body.dataset.previewMap=params.get('map')==='1'?'shown':'default';document.body.dataset.previewExit=params.get('exit')==='right'?'right':'default';
 let context:Context=(['town','field','dungeon'].includes(params.get('context')??'')?params.get('context'):'dungeon') as Context,slots=[4,6,8].includes(Number(params.get('slots')))?Number(params.get('slots')):8,autoOn=true;
 function makeWorld(){const region=regionById(context==='town'?'town':'meadow'),skills=skillCatalog.slice(0,slots);snapshot.resolvedSkills=skills;const w=new World(region,snapshot.stats,skills,context==='town'?[]:region.spawns,[],1);w.hero.position=context==='town'?{...region.safe}:{x:16,y:14};w.anchor={...w.hero.position};w.mode=autoOn?'auto':'manual';w.hero.hp=context==='town'?342:224;return w;}
 const bridge:ViewBridge={world:makeWorld(),rewards:[],panel:'preview',loggedIn:true,motionReduced:true,resolvedAppearance:snapshot.resolvedAppearance,step(){},interact(){},cast(){},pause(){},open(){},pick(){},sound(){}};
 const view={world:bridge.world,snapshot,loggedIn:true,panel:'',blocked:false,userPaused:false,processing:false,reduced:false,dungeonRunning:true,trackerOpen:false,feed:[],bindings:{up:'KeyW',down:'KeyS',left:'KeyA',right:'KeyD',interact:'KeyE',pause:'Space',bag:'KeyB',skills:'KeyK',...Object.fromEntries(Array.from({length:8},(_,i)=>['skill'+(i+1),'Digit'+(i+1)]))}} as unknown as PresentationModel;
 mountHud();updateHud(view);
 let nativeHead:HTMLCanvasElement|undefined;
 const portraitCanvas=Object.assign(document.createElement('canvas'),{width:256,height:256}),portrait=new HeroPreview(portraitCanvas,{height:180,footX:.5,footY:.8,fitBounds:true});
 if(layout!=='focus'&&snapshot.resolvedAppearance&&await portrait.setAppearance(snapshot.resolvedAppearance)){portrait.render({action:'idle',clock:.1,facing:-1});const head=Object.assign(document.createElement('canvas'),{width:96,height:96});nativeHead=head;head.className='preview-native-portrait';head.setAttribute('aria-label','角色头像');portrait.drawPortrait(head);document.querySelector('#vitals .who img')!.replaceWith(head);}portrait.destroy();
 document.querySelector('#hud')!.insertAdjacentHTML('beforeend',`<aside class="preview-bag-notice plate"><strong>背包已满 · 24 / 24</strong><span id="preview-bag-context"></span></aside><section class="preview-auto-control plate"><button id="preview-auto" type="button" class="preview-auto is-on" aria-pressed="true"><svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M26 13a10 10 0 0 0-17-5L5 12m0-7v7h7M6 19a10 10 0 0 0 17 5l4-4m0 7v-7h-7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg><b>AUTO</b><small>开启</small></button></section><section class="preview-camp-actions plate">${buttonHtml('出发',{action:'preview-travel',size:'compact'})}</section><nav class="preview-caption plate" aria-label="HUD场景预览">${(['town','field','dungeon'] as const).map(c=>buttonHtml({town:'营地',field:'野外',dungeon:'副本'}[c],{action:'preview-context',id:c,size:'compact',pressed:c===context})).join('')}<label>技能槽示意 <select id="preview-slots" aria-label="技能槽数量"><option value="4">4</option><option value="6">6</option><option value="8" selected>8</option></select></label><small>独立预览 · 槽位和数值为示例</small></nav>`);
 const auto=document.querySelector<HTMLButtonElement>('#preview-auto')!;
 function drawAuto(){auto.setAttribute('aria-pressed',String(autoOn));auto.classList.toggle('is-on',autoOn);auto.setAttribute('aria-label',`自动战斗已${autoOn?'开启':'关闭'}，点击${autoOn?'关闭':'开启'}`);auto.querySelector('small')!.textContent=autoOn?'开启':'关闭';}
 function drawContext(){
  bridge.world=makeWorld();view.world=bridge.world;view.dungeonRunning=context==='dungeon';updateHud(view);if(nativeHead)document.querySelector('#vitals .who img')?.replaceWith(nativeHead);document.querySelector<HTMLElement>('#hud')!.dataset.context=context;
  const labels={town:['归途营地','整备与出发','与营地同伴交谈，调整装备与技能。'],field:['苍风原野 · 野外','探索与清剿','清剿 5 / 6 · 可自行选择探索路线。'],dungeon:['苍风原野 · 副本','清剿敌人','敌人 5 / 6　精英 1 / 1']}[context];
  document.querySelector('#tracker')!.innerHTML=context==='dungeon'?`<div class="clean-goal">${buttonHtml('清剿 5/6',{action:'preview-details',size:'compact',attributes:{'aria-label':'查看副本目标详情'}})}<span class="clean-clock">24:18</span>${buttonHtml('放弃',{action:'preview-abandon',size:'compact',variant:'tertiary',attributes:{'aria-label':'放弃本次挑战'}})}</div>`:context==='field'?`<div class="clean-goal">${buttonHtml('苍风原野',{action:'preview-details',size:'compact',variant:'tertiary'})}${buttonHtml('回营地',{action:'preview-details',size:'compact',variant:'tertiary'})}</div>`:`<div class="clean-goal">${buttonHtml('主线 · 与岚交谈',{action:'preview-details',size:'compact',variant:'tertiary'})}</div>`;
  document.querySelector('#preview-bag-context')!.textContent={town:'待领取 49 件 · 整理后领取并重新出发',field:'待领取 49 件 · 停止拾取，战斗仍可继续',dungeon:'待领取 49 件 · 副本继续，结束后整理'}[context];
  document.querySelectorAll<HTMLElement>('[data-action=preview-context]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.id===context)));drawAuto();
 }
 auto.onclick=()=>{autoOn=!autoOn;drawAuto();};
 document.querySelector<HTMLSelectElement>('#preview-slots')!.onchange=e=>{slots=Number((e.target as HTMLSelectElement).value);drawContext();};
 document.addEventListener('click',e=>{const b=(e.target as HTMLElement).closest<HTMLElement>('[data-action]');if(b?.dataset.action==='preview-context'){context=b.dataset.id as Context;drawContext();}if(b?.dataset.action==='preview-abandon'){const dialog=document.createElement('dialog');dialog.className='preview-exit-dialog';dialog.innerHTML=`<h2>放弃本次挑战？</h2><p>已获得的收益保留，放弃后不能重新加入本场。</p><p class="ui-caption">仅展示确认流程，不操作 ${esc(snapshot.name)} 的真实副本。</p><footer>${buttonHtml('继续挑战',{action:'preview-cancel'})}${buttonHtml('确认放弃',{action:'preview-confirm',variant:'danger'})}</footer>`;dialog.addEventListener('click',event=>{if((event.target as HTMLElement).closest('[data-action]')){dialog.close();dialog.remove();}});document.body.append(dialog);dialog.showModal();}});

 const hud=document.querySelector('#hud')!;
 hud.insertAdjacentHTML('beforeend',`<button class="clean-map-toggle" type="button" aria-label="展开区域地图">地图</button>${buttonHtml('退出本次副本',{action:'preview-abandon',variant:'secondary',size:'icon',iconHtml:exitIcon,className:'clean-exit-right',attributes:{title:'退出副本'}})}`);
 const menu=document.querySelector<HTMLElement>('#sysbar [data-id=settings]')!;menu.querySelector('.entry-name')!.textContent='菜单';menu.setAttribute('aria-label','打开系统菜单');
 document.querySelector('#sysbar [data-id=bag]')!.setAttribute('title','背包已满，点击查看库存与待领取装备');
 function details(title:string,html:string){document.querySelector('.clean-drawer')?.remove();const d=document.createElement('dialog');d.className='preview-exit-dialog clean-drawer';d.innerHTML=`<header><h2>${title}</h2>${buttonHtml('关闭',{action:'clean-close',size:'compact',variant:'tertiary'})}</header>${html}`;d.addEventListener('click',e=>{if((e.target as HTMLElement).closest('[data-action=clean-close]')){d.close();d.remove();}});document.body.append(d);d.showModal();}
 const menuLabels=['人物','技能','养成','外观','任务','设置'];
 menu.onclick=()=>details('菜单',`<nav class="clean-menu">${menuLabels.map(label=>buttonHtml(label,{action:'clean-page',id:label,variant:'tertiary'})).join('')}</nav>`);
 document.querySelector('#sysbar [data-id=bag]')!.addEventListener('click',()=>details('行囊',`<p>装备 24 / 24 · 待领取 49 件</p><p>背包已满。当前战斗可以继续；回营地后整理装备。</p>`));
 const mini=document.querySelector<HTMLElement>('#minimapbox')!;mini.tabIndex=0;mini.setAttribute('role','button');mini.setAttribute('aria-label','查看区域地图');
 function openMap(){details('区域地图','<div id="clean-map"></div><p>● 敌人　▲ 精英　◇ 首领　◎ 入口</p>');const canvas=document.createElement('canvas');canvas.width=280;canvas.height=280;canvas.getContext('2d')!.drawImage(document.querySelector<HTMLCanvasElement>('#minimap')!,0,0);document.querySelector('#clean-map')!.append(canvas);}
 mini.onclick=openMap;mini.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();openMap();}};document.querySelector<HTMLElement>('.clean-map-toggle')!.onclick=openMap;
 document.addEventListener('click',e=>{const action=(e.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;if(action==='preview-details')details(context==='dungeon'?'副本详情':context==='field'?'探索目标':'当前主线',context==='dungeon'?'<p>苍风原野 · 清剿敌人</p><p>普通敌人 5 / 6 · 精英 1 / 1</p><p>剩余时间 24:18。放弃后保留已获得收益，不能重新加入本场。</p>':context==='field'?'<p>清剿进度 5 / 6，沿主路前往首领结界。</p>':'<p>与守灯人·岚交谈，继续当前主线。</p>');});
 document.addEventListener('keydown',e=>{if(e.key==='F2'){e.preventDefault();document.body.classList.toggle('clean-tools-open');}});
 drawContext();await renderExitStyle(params.get('exitStyle')??'original');await loadWorldFont();new Phaser.Game({type:Phaser.WEBGL,parent:'game',width:window.innerWidth,height:window.innerHeight,scale:{mode:Phaser.Scale.RESIZE},scene:[new WorldScene(bridge)],render:{antialias:true,roundPixels:false},audio:{noAudio:true}});document.body.dataset.previewReady='true';document.title=layout==='clear'?'方案 A · 精简常驻 HUD':'方案 B · 沉浸 HUD';
}
void start().catch(e=>{document.querySelector('#toast')!.textContent=e.message;});
