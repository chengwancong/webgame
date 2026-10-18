import Phaser from 'phaser';
import './ui-entry.css';
import './hud-auto-real-preview.css';
import './hud-clean-preview.css';
import './hud-controls-review.css';
import {World} from '../../../packages/simulation/index.ts';
import {regionById,skillCatalog} from '../../../packages/content/index.ts';
import type {Snapshot,TaskView} from '../../../packages/contracts/index.ts';
import {WorldScene,type ViewBridge} from './scene.ts';
import {mountHud,updateHud,type PresentationModel} from './presentation.ts';
import {buttonHtml,esc} from './ui-components.ts';
import {loadWorldFont} from './ui/world-text.ts';
import {HeroPreview} from './hero-appearance.ts';
import environment from '../../../packages/asset-manifest/environment.v2.json';

type Context='town'|'safe'|'field'|'dungeon';
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
 const readPreview=async<T>(path:string):Promise<T|undefined>=>{try{const r=await fetch('/api/'+path,{credentials:'same-origin'});return r.ok?await r.json():undefined;}catch{return undefined;}};
 const tasks=await readPreview<TaskView>('tasks');
 function homeQuest(){const other=(tasks?.current??[]).slice(0,2);return `<div class="review-task-list">${other.map(row=>`<button type="button" class="review-quest-row" data-action="review-all-tasks"><span class="review-quest-title"><small>${esc(row.typeName)}</small><b>${esc(row.title)}</b></span><span class="review-quest-goal">${esc(row.goal??row.note)}${row.current!==null&&row.total!==null?` <strong>${row.current}/${row.total}</strong>`:''}${row.state==='ready'?' · 可领取':''}</span></button>`).join('')}</div>`;}
 const existingGear=snapshot.gear;snapshot.gear=Array.from({length:24},(_,i)=>({...structuredClone(existingGear[i%existingGear.length]),id:crypto.randomUUID()}));
 snapshot.rewards=Array.from({length:49},(_,i)=>({id:crypto.randomUUID(),source_id:'preview-loot-'+i,region:'meadow',position:{x:20+i%5,y:20},gear:structuredClone(snapshot.gear[i%24])}));
 snapshot.level=9;snapshot.gold=2668;snapshot.stats.hp=342;
 const params=new URLSearchParams(location.search),layout='focus';document.body.dataset.cleanLayout=layout;document.body.dataset.previewMap='shown';document.body.dataset.previewExit='right';
 let context:Context=(['town','safe','field','dungeon'].includes(params.get('context')??'')?params.get('context'):'field') as Context,slots=[4,6,8].includes(Number(params.get('slots')))?Number(params.get('slots')):4,battleMode:'manual'|'semi'|'auto'='semi';
 function makeWorld(){const region=regionById(context==='town'?'town':'meadow'),skills=skillCatalog.slice(0,slots);snapshot.resolvedSkills=skills;const w=new World(region,snapshot.stats,skills,context==='town'||context==='safe'?[]:region.spawns,[],1);w.hero.position=context==='town'||context==='safe'?{...region.safe}:{x:16,y:14};w.anchor={...w.hero.position};w.mode=battleMode;w.hero.hp=context==='town'?342:224;return w;}
 const bridge:ViewBridge={world:makeWorld(),rewards:[],panel:'preview',loggedIn:true,motionReduced:true,resolvedAppearance:snapshot.resolvedAppearance,step(){},interact(){},cast(){},pause(){},open(){},pick(){},sound(){}};
 const view={world:bridge.world,snapshot,loggedIn:true,panel:'',blocked:false,userPaused:false,processing:false,reduced:false,dungeonRunning:true,trackerOpen:false,feed:[],bindings:{up:'KeyW',down:'KeyS',left:'KeyA',right:'KeyD',interact:'KeyE',pause:'Space',bag:'KeyB',skills:'KeyK',...Object.fromEntries(Array.from({length:8},(_,i)=>['skill'+(i+1),'Digit'+(i+1)]))}} as unknown as PresentationModel;
 mountHud();updateHud(view);
 let nativeHead:HTMLCanvasElement|undefined;
 const portraitCanvas=Object.assign(document.createElement('canvas'),{width:256,height:256}),portrait=new HeroPreview(portraitCanvas,{height:180,footX:.5,footY:.8,fitBounds:true});
 if((context==='town'||context==='safe')&&snapshot.resolvedAppearance&&await portrait.setAppearance(snapshot.resolvedAppearance)){portrait.render({action:'idle',clock:.1,facing:-1});const head=Object.assign(document.createElement('canvas'),{width:96,height:96});nativeHead=head;head.className='preview-native-portrait';head.setAttribute('aria-label','角色头像');portrait.drawPortrait(head);document.querySelector('#vitals .who img')!.replaceWith(head);}portrait.destroy();
 document.querySelector('#hud')!.insertAdjacentHTML('beforeend',`<aside class="preview-bag-notice plate"><strong>背包已满 · 24 / 24</strong><span id="preview-bag-context"></span></aside><section class="preview-auto-control plate"><button id="preview-auto" type="button" class="preview-auto is-on" aria-pressed="true"><svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M26 13a10 10 0 0 0-17-5L5 12m0-7v7h7M6 19a10 10 0 0 0 17 5l4-4m0 7v-7h-7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg><b>AUTO</b><small>开启</small></button></section><section class="preview-camp-actions" hidden></section><nav class="preview-caption plate" aria-label="HUD场景预览">${(['town','safe','field','dungeon'] as const).map(c=>buttonHtml({town:'营地',safe:'安全据点',field:'野外',dungeon:'副本'}[c],{action:'preview-context',id:c,size:'compact',pressed:c===context})).join('')}<label>技能槽示意 <select id="preview-slots" aria-label="技能槽数量"><option value="4" selected>4</option><option value="6">6</option><option value="8">8</option></select></label><small>独立预览 · 槽位和数值为示例</small></nav>`);
 const auto=document.querySelector<HTMLButtonElement>('#preview-auto')!;
 function drawAuto(){auto.classList.toggle('is-on',battleMode!=='manual');auto.setAttribute('aria-label','战斗模式：'+{manual:'手动',semi:'半自动',auto:'全自动'}[battleMode]);auto.setAttribute('aria-haspopup','menu');auto.querySelector('b')!.textContent={manual:'手动',semi:'半自动',auto:'全自动'}[battleMode];auto.querySelector('small')!.textContent='⌄';}
 function drawContext(){
  bridge.world=makeWorld();view.world=bridge.world;view.dungeonRunning=context==='dungeon';updateHud(view);if(nativeHead)document.querySelector('#vitals .who img')?.replaceWith(nativeHead);document.querySelector<HTMLElement>('#hud')!.dataset.context=context;document.querySelector<HTMLElement>('#hud')!.dataset.uiMode=context==='town'||context==='safe'?'home':'combat';const settings=document.querySelector<HTMLElement>('#sysbar [data-id=settings]')!;settings.querySelector('.entry-name')!.textContent=context==='town'||context==='safe'?'设置':'菜单';settings.setAttribute('aria-label',context==='town'||context==='safe'?'设置':'打开系统菜单');
  const labels={town:['归途营地','整备与出发','与营地同伴交谈，调整装备与技能。'],safe:['苍风原野 · 安全据点','整备与出发','查看装备和主线，准备继续探索。'],field:['苍风原野 · 野外','探索与清剿','清剿 5 / 6 · 可自行选择探索路线。'],dungeon:['苍风原野 · 副本','清剿敌人','敌人 5 / 6　精英 1 / 1']}[context];
  document.querySelector('#tracker')!.innerHTML=context==='dungeon'?`<div class="clean-goal">${buttonHtml('清剿 5/6',{action:'preview-details',size:'compact',attributes:{'aria-label':'查看副本目标详情'}})}<span class="clean-clock">24:18</span>${buttonHtml('放弃',{action:'preview-abandon',size:'compact',variant:'tertiary',attributes:{'aria-label':'放弃本次挑战'}})}</div>`:context==='field'?`<div class="clean-goal">${buttonHtml('苍风原野',{action:'preview-details',size:'compact',variant:'tertiary'})}${buttonHtml('回营地',{action:'preview-details',size:'compact',variant:'tertiary'})}</div>`:`<div class="clean-goal">${buttonHtml(context==='safe'?'苍风原野 · 安全据点':'主线 · 与岚交谈',{action:'preview-details',size:'compact',variant:'tertiary'})}</div>`;
  document.querySelector('.preview-bag-notice')!.innerHTML=`<div><strong>背包已满 <span>24/24</span></strong>${buttonHtml(context==='town'||context==='safe'?'整理':context==='field'?'回营地':'行囊',{action:'review-bag',size:'compact',variant:'secondary'})}</div><small>${context==='field'?'全自动已停止，整理后手动开启':context==='dungeon'?'副本继续，结束后整理':'整理装备后再出发'}</small>`;

  document.querySelector('.review-mode-menu')?.remove();if(context==='town'||context==='safe')document.querySelector('#tracker')!.innerHTML=homeQuest();
  document.querySelectorAll<HTMLElement>('[data-action=preview-context]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.id===context)));drawAuto();
 }
 auto.onclick=()=>{const existing=document.querySelector('.review-mode-menu');if(existing){existing.remove();auto.setAttribute('aria-expanded','false');return;}auto.setAttribute('aria-expanded','true');const menu=document.createElement('nav');menu.className='review-mode-menu plate';menu.setAttribute('aria-label','选择战斗模式');menu.innerHTML=(['manual','semi','auto'] as const).map(mode=>buttonHtml({manual:'手动',semi:'半自动',auto:'全自动'}[mode],{action:'review-mode',id:mode,variant:mode===battleMode?'primary':'tertiary',disabled:context!=='dungeon'&&mode==='auto'})).join('')+(context!=='dungeon'?'<small>背包已满，暂不可开启全自动</small>':'');menu.addEventListener('click',e=>{const button=(e.target as HTMLElement).closest<HTMLElement>('[data-action=review-mode]');if(button&&!button.hasAttribute('disabled')){battleMode=button.dataset.id as typeof battleMode;menu.remove();auto.setAttribute('aria-expanded','false');drawAuto();}});document.querySelector('#hud')!.append(menu);};
 document.querySelector<HTMLSelectElement>('#preview-slots')!.onchange=e=>{slots=Number((e.target as HTMLSelectElement).value);drawContext();};
 document.addEventListener('click',e=>{const b=(e.target as HTMLElement).closest<HTMLElement>('[data-action]');if(b?.dataset.action==='preview-context'){context=b.dataset.id as Context;drawContext();}if(b?.dataset.action==='preview-abandon'){const dialog=document.createElement('dialog');dialog.className='preview-exit-dialog';dialog.innerHTML=`<h2>放弃本次挑战？</h2><p>已获得的收益保留，放弃后不能重新加入本场。</p><p class="ui-caption">仅展示确认流程，不操作 ${esc(snapshot.name)} 的真实副本。</p><footer>${buttonHtml('继续挑战',{action:'preview-cancel'})}${buttonHtml('确认放弃',{action:'preview-confirm',variant:'danger'})}</footer>`;dialog.addEventListener('click',event=>{if((event.target as HTMLElement).closest('[data-action]')){dialog.close();dialog.remove();}});document.body.append(dialog);dialog.showModal();}});

 const hud=document.querySelector('#hud')!;
 hud.insertAdjacentHTML('beforeend',`<button class="clean-map-toggle" type="button" aria-label="展开区域地图">地图</button>${buttonHtml('退出本次副本',{action:'preview-abandon',variant:'secondary',size:'icon',iconHtml:exitIcon,className:'clean-exit-right',attributes:{title:'退出副本'}})}`);
 const menu=document.querySelector<HTMLElement>('#sysbar [data-id=settings]')!;menu.querySelector('.entry-name')!.textContent='菜单';menu.setAttribute('aria-label','打开系统菜单');
 document.querySelector('#sysbar [data-id=bag]')!.setAttribute('title','背包已满，点击查看库存与待领取装备');
 function details(title:string,html:string){document.querySelector('.clean-drawer')?.remove();const d=document.createElement('dialog');d.className='preview-exit-dialog clean-drawer';d.innerHTML=`<header><h2>${title}</h2>${buttonHtml('关闭',{action:'clean-close',size:'compact',variant:'tertiary'})}</header>${html}`;d.addEventListener('click',e=>{if((e.target as HTMLElement).closest('[data-action=clean-close]')){d.close();d.remove();}});document.body.append(d);d.showModal();}
 const menuLabels=['人物','技能','养成','外观','任务','设置'];
 menu.onclick=()=>details(context==='town'||context==='safe'?'设置':'菜单',`<nav class="clean-menu">${menuLabels.map(label=>buttonHtml(label,{action:'clean-page',id:label,variant:'tertiary'})).join('')}</nav>`);
 document.querySelector('#sysbar [data-id=bag]')!.addEventListener('click',()=>details('行囊',`<p>装备 24 / 24 · 待领取 49 件</p><p>野外满包停止全自动，手动与半自动保留；副本结束后整理。</p>`));
 document.querySelectorAll<HTMLElement>('#sysbar .entry:not([data-id=bag]):not([data-id=settings])').forEach(button=>button.addEventListener('click',()=>details(button.querySelector('.entry-name')!.textContent!, '<p>正式接入时打开对应功能页，此处仅展示入口。</p>')));
 document.querySelector<HTMLElement>('#vitals .who')?.addEventListener('click',()=>details('人物','<p>正式接入时打开人物与装备属性页。</p>'));
 const mini=document.querySelector<HTMLElement>('#minimapbox')!;mini.tabIndex=0;mini.setAttribute('role','button');mini.setAttribute('aria-label','查看区域地图');
 function openMap(){details('区域地图','<div id="clean-map"></div><p>● 敌人　▲ 精英　◇ 首领　◎ 入口</p>');const canvas=document.createElement('canvas');canvas.width=280;canvas.height=280;canvas.getContext('2d')!.drawImage(document.querySelector<HTMLCanvasElement>('#minimap')!,0,0);document.querySelector('#clean-map')!.append(canvas);}
 mini.onclick=openMap;mini.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();openMap();}};document.querySelector<HTMLElement>('.clean-map-toggle')!.onclick=openMap;
 document.addEventListener('click',e=>{const action=(e.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;if(action==='review-all-tasks')details('全部任务','<p>正式接入时打开已有任务页，预览不提交领奖或进度。</p>');if(action==='review-bag')details(context==='field'?'回营地整理':context==='town'||context==='safe'?'整理背包':'行囊',context==='field'?'<p>正式接入时执行现有回营地操作；这里只展示入口，不离开真实区域。</p>':'<p>正式接入时打开行囊；这里只展示说明。</p>');if(action==='preview-details')details(context==='dungeon'?'副本详情':context==='field'?'探索目标':'当前任务',context==='dungeon'?'<p>苍风原野 · 清剿敌人</p><p>普通敌人 5 / 6 · 精英 1 / 1</p><p>剩余时间 24:18。放弃后保留已获得收益，不能重新加入本场。</p>':context==='field'?'<p>清剿进度 5 / 6，沿主路前往首领结界。</p>':'<p>按追踪的任务前往下一个目标。</p>');});
 document.addEventListener('keydown',e=>{if(e.key==='F2'){e.preventDefault();document.body.classList.toggle('clean-tools-open');}});
 drawContext();await renderExitStyle(params.get('exitStyle')??'original');await loadWorldFont();new Phaser.Game({type:Phaser.WEBGL,parent:'game',width:window.innerWidth,height:window.innerHeight,scale:{mode:Phaser.Scale.RESIZE},scene:[new WorldScene(bridge)],render:{antialias:true,roundPixels:false},audio:{noAudio:true}});document.body.dataset.previewReady='true';document.title='主界面分区方案 · 仅视觉预览';
}
void start().catch(e=>{document.querySelector('#toast')!.textContent=e.message;});
