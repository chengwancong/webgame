import './ui-entry.css';
import './starsea-art-qa.css';
import {buttonHtml,esc} from './ui-components.ts';
import {loadStarsea,loadJSON,type Asset,type StarseaPackage,type StarseaGroup} from './starsea-assets.ts';
import {StarseaActorPreview} from './starsea-actor-preview.ts';
import {StarseaPropPreview} from './starsea-prop-preview.ts';
import {StarseaVfxPreview} from './starsea-vfx-preview.ts';
const root=document.getElementById('starsea-art-qa')!,params=new URLSearchParams(location.search);
const labels:Record<StarseaGroup,string>={npc:'NPC与伙伴',monsters:'普通与精英',bosses:'六章首领',vfx:'怪物技能',scenes:'地图与环境',props:'任务物件与航图'};
let pack:StarseaPackage,group:StarseaGroup=(params.get('group') as StarseaGroup)||'npc',chapter=0,query='',asset:Asset,action='idle',state='default',facing=-1,paused=false,clock=0,last=performance.now(),generation=0,ready=false,error='',debug=false;
const canvas=document.createElement('canvas');canvas.width=720;canvas.height=420;canvas.setAttribute('aria-label','所选资源的真实动态预览');
const actor=new StarseaActorPreview(),prop=new StarseaPropPreview();let vfx:StarseaVfxPreview|undefined,scene:any;
const sceneRendererURL=new URL('/art/starsea/scenes/preview/renderer.js',location.origin).href;
root.innerHTML=`<header><div><h1>裂星远航 · 美术资源验收</h1><p>读取六组实际交付 · 固定实机比例 · 当前正式主线继续运行</p></div><output class="ss-status" id="ss-package">加载中</output></header><div class="ss-layout"><aside class="ss-browser"><label>资源分组<select id="ss-group">${Object.entries(labels).map(([id,name])=>`<option value="${id}">${name}</option>`).join('')}</select></label><label>章节<select id="ss-chapter"><option value="0">全部六章</option>${[1,2,3,4,5,6].map(n=>`<option value="${n}">第${n}章</option>`).join('')}</select></label><label>查找<input id="ss-search" type="search" placeholder="名字或资源ID"></label><nav class="ss-list" id="ss-list" aria-label="资源列表"></nav></aside><section class="ss-preview"><div class="ss-toolbar"><label>动作<select id="ss-action"></select></label><label>状态／阶段<select id="ss-state"></select></label>${buttonHtml('左右朝向',{action:'ss-facing'})}${buttonHtml('暂停',{action:'ss-pause'})}</div><div class="ss-stage" id="ss-stage"></div><div class="ss-toolbar">${buttonHtml('重新播放',{action:'ss-replay'})}${buttonHtml('挂点／导航',{action:'ss-debug'})}${buttonHtml('全图',{action:'ss-map-fit'})}${buttonHtml('原比例',{action:'ss-map-focus'})}</div><output class="ss-status" id="ss-status" role="status">加载资源清单…</output><p class="ss-annotations" id="ss-annotations"></p></section><aside class="ss-detail"><h2 id="ss-name">资源详情</h2><dl id="ss-meta"></dl><p class="ss-risk" id="ss-risk"></p><details><summary>运行诊断</summary><pre id="ss-diagnostics"></pre></details></aside></div><footer>本页只展示资源与规则参考事件，不写玩家钱包、任务、奖励或章节解锁。新故事与新演员战斗绑定待后续工程接入；主代理独立验收另记。</footer>`;
document.getElementById('ss-stage')!.append(canvas);const ctx=canvas.getContext('2d')!;
const el=<T extends HTMLElement>(id:string)=>document.getElementById(id)! as T;
const filtered=()=>pack.assets.filter(a=>a.group===group&&(!chapter||a.chapters.includes(chapter))&&(!query||(a.name+' '+a.id).toLowerCase().includes(query.toLowerCase())));
function list(){const items=filtered();el('ss-list').innerHTML=items.length?items.map(a=>buttonHtml(a.name,{action:'ss-select',id:a.id,pressed:a.id===asset?.id,attributes:{title:a.id}})).join(''):'<p>此筛选下没有资源。</p>';
 el<HTMLSelectElement>('ss-group').value=group;el('ss-package').textContent=`${pack.total}/129 项登记 · ${pack.designVersion} · ${pack.acceptance==='resource-accepted'?'资源验收通过':'独立验收待确认'}`;
}
function options(){const actorKind=['native','atlas'].includes(asset.runtime.kind),boss=asset.group==='bosses';
 const actions=boss?['idle','move','attack','hurt','death',...Object.keys(asset.actions.skills??{})]:actorKind?Object.keys(asset.runtime.actions??asset.actions).filter(a=>a!=='skills'):['展示'];
 const states=boss?['default','phase-enter','phase-active','phase-end']:asset.group==='vfx'?['normal',...(asset.runtime.secondaryClips?.phase_exhaust?['phase-active','phase-end']:[]),'death','interrupt']:asset.group==='props'?Object.keys(asset.runtime.states??{}):['default'];
 if(!actions.includes(action))action=actions[0];if(!states.includes(state))state=states[0];
 el<HTMLSelectElement>('ss-action').innerHTML=actions.map(a=>`<option value="${esc(a)}">${esc(a)}</option>`).join('');el<HTMLSelectElement>('ss-action').value=action;
 el<HTMLSelectElement>('ss-state').innerHTML=states.map(a=>`<option value="${esc(a)}">${esc(a)}</option>`).join('');el<HTMLSelectElement>('ss-state').value=state;
 el('ss-name').textContent=asset.name;const entries=[['资源ID',asset.id],['所属章节',asset.chapters.join('、')],['资源状态',asset.status],['主代理检查',asset.rootReview?.status??'root-pending'],['剧情／机制','待新主线接入；资源验收页'],['原始来源',asset.source.path],['来源方式',asset.source.mode+(asset.source.nativeVersion?' · '+asset.source.nativeVersion:'')],['源SHA256',asset.source.sha256],['运行资源',asset.runtime.profile??asset.runtime.image??asset.runtime.file??asset.runtime.renderer??'特效清单内独立片段'],['依赖',JSON.stringify(asset.dependencies)],['说明',(asset.notes??[]).join('\n')]];
 el('ss-meta').innerHTML=entries.map(([name,value])=>`<div><dt>${esc(name)}</dt><dd>${esc(String(value))}</dd></div>`).join('');
 el('ss-risk').textContent=asset.rootReview?.issues?.length?'待处理问题：'+asset.rootReview.issues.join('、'):'';
}
async function select(id:string){const next=pack.assets.find(a=>a.id===id);if(!next)return;canvas.width=720;canvas.height=420;asset=next;group=next.group;clock=0;ready=false;error='';const token=++generation;options();list();
 history.replaceState(null,'',`${location.pathname}?group=${group}&id=${asset.id}&action=${encodeURIComponent(action)}&state=${state}`);
 try{vfx?.destroy();vfx=undefined;
  if(['native','atlas'].includes(asset.runtime.kind)){await actor.load(asset,action,state);vfx=undefined;}
  else if(asset.group==='vfx'){const player=new StarseaVfxPreview(canvas,pack);vfx=player;await player.load(asset,state);if(token!==generation)player.destroy();}
  else if(asset.runtime.kind==='map'){const module=await import(/* @vite-ignore */ sceneRendererURL);if(token!==generation)return;const painter=new module.SceneRenderer(canvas,pack.assets.filter(a=>a.group==='scenes'));const map=await loadJSON(asset.runtime.file!);await painter.loadMap(map);if(token===generation){scene=painter;scene.debug=debug;}}
  else if(asset.runtime.kind==='effect'&&asset.group==='scenes'){const module=await import(/* @vite-ignore */ sceneRendererURL);if(token!==generation)return;const painter=new module.SceneRenderer(canvas,pack.assets.filter(a=>a.group==='scenes'));const map=await loadJSON<any>('/art/starsea/scenes/maps/ss-map-port.json');map.ambient=[{resourceId:asset.id,position:{x:16,y:16}}];await painter.loadMap(map);painter.focus(16,16,1);if(token===generation){scene=painter;scene.debug=debug;}}
  else await prop.load(asset,state);
  if(token===generation)ready=true;
 }catch(e){if(token===generation){error=String(e);el('ss-status').textContent=error;}}
}
root.addEventListener('click',event=>{const b=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(!b)return;
 if(b.dataset.action==='ss-select')void select(b.dataset.id!);
 if(b.dataset.action==='ss-facing'){facing*=-1;}
 if(b.dataset.action==='ss-pause'){paused=!paused;b.setAttribute('aria-pressed',String(paused));b.querySelector('.ui-button__label')!.textContent=paused?'继续':'暂停';b.setAttribute('aria-label',paused?'继续':'暂停');}
 if(b.dataset.action==='ss-replay'){clock=0;vfx?.reset();}
 if(b.dataset.action==='ss-debug'){debug=!debug;if(scene)scene.debug=debug;b.setAttribute('aria-pressed',String(debug));}
 if(b.dataset.action==='ss-map-fit'&&scene&&asset?.runtime.kind==='map')scene.fit();
 if(b.dataset.action==='ss-map-focus'&&scene&&asset?.runtime.kind==='map'){const first=scene.map.landmarks[0];scene.focus(first.x,first.y,1);}
});
el<HTMLSelectElement>('ss-group').onchange=e=>{group=(e.target as HTMLSelectElement).value as StarseaGroup;list();const first=filtered()[0];if(first)void select(first.id);};
el<HTMLSelectElement>('ss-chapter').onchange=e=>{chapter=Number((e.target as HTMLSelectElement).value);list();const first=filtered()[0];if(first)void select(first.id);};
el<HTMLInputElement>('ss-search').oninput=e=>{query=(e.target as HTMLInputElement).value;list();};
el<HTMLSelectElement>('ss-action').onchange=e=>{action=(e.target as HTMLSelectElement).value;void select(asset.id);};
el<HTMLSelectElement>('ss-state').onchange=e=>{state=(e.target as HTMLSelectElement).value;void select(asset.id);};
canvas.onclick=e=>{const rect=canvas.getBoundingClientRect(),node=prop.selectAt((e.clientX-rect.left)*canvas.width/rect.width,(e.clientY-rect.top)*canvas.height/rect.height);if(node&&asset?.runtime.chartNodes)el('ss-annotations').textContent=`航图选择：${node.name}。此页为静态节点演示，未写入解锁与旅行状态。`;};
let sampled=0,diagnostic:any={};
function frame(now:number){if(!paused)clock+=Math.min(.1,(now-last)/1000);last=now;
 if(ready){try{
  if(asset.runtime.kind==='map'||asset.group==='scenes'&&asset.runtime.kind==='effect'){diagnostic={...scene.render(clock),errors:scene.errors};}
  else {ctx.clearRect(0,0,canvas.width,canvas.height);
   if(['native','atlas'].includes(asset.runtime.kind)){actor.render(action,clock,facing,state);ctx.drawImage(actor.canvas,0,0);diagnostic=actor.diagnostics();}
   else if(asset.group==='vfx'&&vfx){vfx.render(clock,facing,paused);diagnostic=vfx.diagnostics();}
   else {prop.render(ctx,clock,facing);diagnostic=prop.diagnostics();}
   if(debug&&['native','atlas'].includes(asset.runtime.kind)){ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--color-info');for(const [name,p]of Object.entries(diagnostic.sockets??{})){const point=p as {x:number;y:number}|undefined;if(point){ctx.beginPath();ctx.arc(point.x,point.y,3,0,Math.PI*2);ctx.fill();ctx.fillText(name,point.x+5,point.y);}}}
  }
 }catch(e){error=String(e);ready=false;}}
 if(sampled++%15===0){el('ss-status').textContent=error||`${asset?.id??'清单'} · ${ready?'已加载':'加载中'} · ${paused?'已暂停':'持续播放'} · ${clock.toFixed(2)}秒 · 朝向${facing===-1?'左':'右'}`;el('ss-diagnostics').textContent=JSON.stringify(diagnostic,null,2);if(!asset?.runtime.chartNodes)el('ss-annotations').textContent=asset?.runtime.states?.[state]?.annotation??(asset?.runtime.kind==='map'?'全图可切到原比例查看导航与摆件。碰撞/剧情触发消费地图配置，不用贴图边缘判断。':asset?.group==='vfx'?'真实素材＋规则参考事件演示；这里的事件未写入战斗或任务。':'实际源动画完整播放，角色显示比例与固定足点由manifest决定。');}
 requestAnimationFrame(frame);
}
void (async()=>{try{pack=await loadStarsea();action=params.get('action')??'idle';state=params.get('state')??'default';if(!labels[group])group='npc';list();root.setAttribute('aria-busy','false');await select(params.get('id')??filtered()[0].id);requestAnimationFrame(frame);}catch(e){root.setAttribute('aria-busy','false');el('ss-status').textContent='加载失败：'+String(e);error=String(e);}})();
Object.assign(window,{starseaQA:{select:(id:string)=>select(id),setAction:(value:string)=>{action=value;return select(asset.id);},setState:(value:string)=>{state=value;return select(asset.id);},setFacing:(value:number)=>{facing=value;},setPaused:(value:boolean)=>{paused=value;const b=root.querySelector<HTMLButtonElement>('[data-action=ss-pause]')!;b.setAttribute('aria-pressed',String(paused));b.querySelector('.ui-button__label')!.textContent=paused?'继续':'暂停';b.setAttribute('aria-label',paused?'继续':'暂停');},seek:(value:number)=>{clock=value;vfx?.reset();},inspect:()=>({id:asset?.id,group,chapter,action,state,facing,paused,clock,ready,error,diagnostic,package:pack?.version,total:pack?.total,canvas:{width:canvas.width,height:canvas.height,cssWidth:canvas.getBoundingClientRect().width,cssHeight:canvas.getBoundingClientRect().height},scene:scene?{map:scene.map?.id,zoom:scene.zoom,errors:scene.errors}:null}),assets:()=>pack?.assets.map(a=>({id:a.id,group:a.group,type:a.type,states:a.states,actions:a.actions}))}});
addEventListener('pagehide',()=>{actor.destroy();vfx?.destroy();},{once:true});
