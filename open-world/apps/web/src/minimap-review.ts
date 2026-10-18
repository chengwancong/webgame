import Phaser from 'phaser';
import './ui-entry.css';
import './minimap-review.css';
import {World} from '../../../packages/simulation/index.ts';
import {regionById} from '../../../packages/content/index.ts';
import {storyNpcs} from '../../../packages/content/story-campaign.ts';
import type {Snapshot,StoryView,TaskView,StoryObject} from '../../../packages/contracts/index.ts';
import {WorldScene,type ViewBridge} from './scene.ts';
import {mountHud,updateHud,type PresentationModel} from './presentation.ts';
import {loadWorldFont} from './ui/world-text.ts';
import {buttonHtml,esc,panelHeaderHtml} from './ui-components.ts';
import {paintReviewMinimap} from './minimap-review-drawing.ts';
import {HeroPreview} from './hero-appearance.ts';
async function start(){
 const read=async<T>(path:string):Promise<T>=>{const r=await fetch('/api/'+path,{credentials:'same-origin'});if(!r.ok)throw Error('请先在游戏主页登录。');return r.json();};
 const [snapshot,story,tasks]=await Promise.all([read<Snapshot>('character'),read<StoryView>('story'),read<TaskView>('tasks')]);
 const params=new URLSearchParams(location.search),variant=params.get('variant')==='radar'?'radar':'square';document.body.dataset.minimapReview=variant;
 let portraitURL='';if(snapshot.resolvedAppearance){const previewCanvas=Object.assign(document.createElement('canvas'),{width:256,height:256}),portrait=new HeroPreview(previewCanvas,{height:180,footX:.5,footY:.8,fitBounds:true});if(await portrait.setAppearance(snapshot.resolvedAppearance)){portrait.render({action:'idle',clock:.1,facing:-1});const head=Object.assign(document.createElement('canvas'),{width:96,height:96});portrait.drawPortrait(head);portraitURL=head.toDataURL();}portrait.destroy();}
 const region=regionById('town'),world=new World(region,snapshot.stats,snapshot.resolvedSkills,[],[],1);world.paused=true;
 const npcs=storyNpcs.filter(n=>story.campNpcs.includes(n.id));
 const objects=():StoryObject[]=>npcs.map(n=>({id:'npc:'+n.id,name:n.name,kind:'npc',npcId:n.id,position:n.camp,enabled:true,label:n.id===story.giver?'主线交谈':'交谈',reason:''}));
 const bridge:ViewBridge={world,rewards:[],panel:'minimap-preview',loggedIn:true,motionReduced:true,resolvedAppearance:snapshot.resolvedAppearance,storyObjects:objects,step(){},interact(){},cast(){},pause(){},open(){},pick(){},sound(){}};
 mountHud();updateHud({world,snapshot,portraitURL,story,taskData:tasks,loggedIn:true,panel:'',blocked:false,userPaused:false,processing:false,feed:[],reduced:true,bindings:{up:'KeyW',down:'KeyS',left:'KeyA',right:'KeyD',interact:'KeyE',pause:'Space',bag:'KeyB',skills:'KeyK'}} as unknown as PresentationModel);
 document.querySelector('#zoneBanner')!.replaceChildren();
 const map=document.querySelector<HTMLElement>('#minimapbox')!;map.dataset.action='review-map';map.removeAttribute('data-id');map.setAttribute('aria-label',region.name+'，'+(variant==='square'?'区域全图':'附近雷达')+'，点击展开示意');map.querySelector('.legend')!.remove();map.querySelector('small')!.textContent='N';
 const canvas=map.querySelector<HTMLCanvasElement>('canvas')!;const points=npcs.map(n=>({name:n.name,x:n.camp.x,y:n.camp.y,main:n.id===story.giver}));
 const draw=()=>paintReviewMinimap(canvas,world,variant,variant==='square'?152:144,points);draw();
 map.addEventListener('click',()=>{const host=document.querySelector('#modal')!;host.classList.add('open');host.innerHTML=`<section class="panel review-map-detail" role="dialog" aria-label="区域地图示意">${panelHeaderHtml('归途营地',{closeAction:'review-close-map',closeLabel:'关闭地图'})}<canvas id="review-map-large" aria-label="本区域全图"></canvas><div class="review-map-legend"><span>△ 当前位置</span><span>● 营地同伴</span><span>◎ 主线同伴</span><span>◎ 区域入口</span><span>▰ 锻造</span></div><p class="ui-caption">仅演示展开后的图例，不发送移动、远行或副本命令。</p></section>`;paintReviewMinimap(host.querySelector('canvas')!,world,'square',320,points);host.querySelector('[data-action=review-close-map]')!.addEventListener('click',()=>{host.innerHTML='';host.classList.remove('open');map.focus();});});
 await loadWorldFont();new Phaser.Game({type:Phaser.WEBGL,parent:'game',width:innerWidth,height:innerHeight,scale:{mode:Phaser.Scale.RESIZE},scene:[new WorldScene(bridge)],render:{antialias:true},audio:{noAudio:true}});
 // Repaint only local illustrative data while atlas textures finish loading.
 const timer=setInterval(draw,500);setTimeout(()=>clearInterval(timer),6000);document.title=variant==='square'?'方案 A · 圆角方形全图':'方案 B · 圆形近域雷达';document.body.dataset.previewReady='true';
}
void start().catch(e=>{document.querySelector('#toast')!.textContent=e.message;});
