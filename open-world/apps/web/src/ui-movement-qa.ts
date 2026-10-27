/** Deterministic presentation fixtures, not live gameplay, network or FPS evidence. */
import type {Region} from '../../../packages/content/index.ts';
import type {Vec} from '../../../packages/contracts/index.ts';
import {LocalPrediction} from './local-prediction.ts';
import {AuthoritativeMotion} from './authoritative-motion.ts';
import {newFollow,stepFollow} from './camera-follow.ts';
import {project} from './iso.ts';
import {panelHeaderHtml,buttonHtml} from './ui-components.ts';

type Sample='steady'|'uneven'|'wall';
const titles:Record<Sample,string>={steady:'100ms 快照匀速',uneven:'快照到达间隔不齐',wall:'顶墙后松手'};
// Fixture input only: speed, command delay, snapshot delay and wall geometry do
// not alter production movement parameters or any saved character.
const SPEED=6,START={x:8,y:12},PRESS_MS=3000,CYCLE_MS=5200,RADIUS=.35;
const fixtureRegion=(wall:boolean):Region=>({id:'movement-qa-only',name:'表现样例',subtitle:'只读',width:48,height:32,theme:'qa',safe:START,portal:{x:3,y:3},boss:false,auto:false,spawns:[],landmarks:[],obstacles:wall?[{x:18,y:3,w:1,h:26}]:[]});
function render(sample:Sample){
 return `<section class="qa-primitives">${panelHeaderHtml('移动复验 · '+titles[sample])}<p>确定性表现样例，非实机 FPS。使用实际移动预测、快照插值和镜头跟随函数；无 API、存档或战斗。</p><canvas data-movement-canvas width="640" height="300" role="img" aria-label="移动预测与镜头跟随参考线示意"></canvas><p>实心圆：显示角色　空心圆：最新快照　方块：缓冲位置${sample==='wall'?'　红色区域：固定墙体':''}</p><p data-movement-state role="status" aria-live="off">正在准备样例…</p><div class="qa-primitives__resources">${buttonHtml('重播',{action:'movement-qa-replay',variant:'primary',size:'compact'})}${buttonHtml('暂停',{action:'movement-qa-pause',size:'compact',pressed:false})}</div><p>每轮前进 3 秒后松手，随后自动重播。这里只复验表现时序，不能替代真机行走与卡顿检查。</p></section>`;
}
function mount(root:HTMLElement,sample:Sample){
 const canvas=root.querySelector<HTMLCanvasElement>('[data-movement-canvas]')!,ctx=canvas.getContext('2d');if(!ctx)return;
 const output=root.querySelector<HTMLElement>('[data-movement-state]')!,style=getComputedStyle(root),color=(name:string)=>style.getPropertyValue(name).trim();
 const palette={background:color('--color-panel-inset'),grid:color('--color-border'),hero:color('--color-info'),server:color('--color-warning'),buffer:color('--color-text-secondary'),wall:color('--color-danger')};
 const region=fixtureRegion(sample==='wall'),prediction=new LocalPrediction(),motion=new AuthoritativeMotion();
 let follow=newFollow(),time=0,nextPacket=100,packet=0,latest:Vec={...START},last=performance.now(),frame=0,paused=false,disposed=false,lastOutput=-Infinity;
 const arrival=(tickMs:number,index:number)=>tickMs+60+(sample==='uneven'?[0,35,-20,50,0,-10][index%6]:0);
 const truth=(at:number):Vec=>({x:Math.min(sample==='wall'?18-RADIUS:Infinity,START.x+SPEED*Math.max(0,Math.min(PRESS_MS,at-60))/1000),y:START.y});
 const reset=()=>{prediction.reset();prediction.setEnabled(true);motion.reset();follow=newFollow();time=0;nextPacket=100;packet=0;latest={...START};lastOutput=-Infinity;prediction.accept(latest,0);motion.accept(0,[['hero',latest]],0);};
 reset();
 const path=(points:Vec[],close=false)=>{ctx.beginPath();points.forEach((point,i)=>{const p=project(point);if(i)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);});if(close)ctx.closePath();};
 const paint=(shown:Vec,buffered:Vec,delta:number)=>{
  const position=project(shown),camera=stepFollow(follow,position.x,position.y-15,delta,{reduced:document.documentElement.dataset.motionReduced==='true',bossNear:false});
  ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle=palette.background;ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.translate(canvas.width/2-camera.x,canvas.height/2-camera.y);ctx.lineWidth=1;ctx.strokeStyle=palette.grid;
  for(let x=2;x<=42;x+=2){path([{x,y:2},{x,y:30}]);ctx.stroke();}
  for(let y=2;y<=30;y+=2){path([{x:2,y},{x:42,y}]);ctx.stroke();}
  if(sample==='wall'){path([{x:18,y:3},{x:19,y:3},{x:19,y:29},{x:18,y:29}],true);ctx.globalAlpha=.25;ctx.fillStyle=palette.wall;ctx.fill();ctx.globalAlpha=1;ctx.strokeStyle=palette.wall;ctx.stroke();}
  const server=project(latest),buffer=project(buffered);ctx.fillStyle=palette.buffer;ctx.fillRect(buffer.x-4,buffer.y-4,8,8);
  ctx.lineWidth=2;ctx.strokeStyle=palette.server;ctx.beginPath();ctx.arc(server.x,server.y,9,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle=palette.hero;ctx.beginPath();ctx.arc(position.x,position.y,5,0,Math.PI*2);ctx.fill();
  ctx.setTransform(1,0,0,1,0,0);
  if(time-lastOutput>=100){lastOutput=time;output.textContent=`${(time/1000).toFixed(1)} 秒 · ${time<PRESS_MS?'按住前进':'已松手'} · 快照 ${packet} 次 · 显示位置 ${shown.x.toFixed(2)} · 最新位置 ${latest.x.toFixed(2)}`;}
 };
 const animate=(now:number)=>{
  if(disposed)return;const delta=Math.max(0,Math.min(100,now-last));last=now;
  if(!paused){time+=delta;if(time>=CYCLE_MS)reset();
   while(arrival(nextPacket,packet)<=time){const receivedAt=arrival(nextPacket,packet);latest=truth(nextPacket);prediction.accept(latest,receivedAt);motion.accept(nextPacket*30/1000,[['hero',latest]],receivedAt);nextPacket+=100;packet++;}
   prediction.setInput(time<PRESS_MS?1:0,0);const buffered=motion.position('hero',latest,time),shown=prediction.position(SPEED,region,time,buffered,RADIUS);paint(shown,buffered,delta);
  }
  frame=requestAnimationFrame(animate);
 };
 const click=(event:MouseEvent)=>{const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(!button)return;
  if(button.dataset.action==='movement-qa-replay'){reset();last=performance.now();const buffered={...START};paint(buffered,buffered,0);}
  if(button.dataset.action==='movement-qa-pause'){paused=!paused;button.setAttribute('aria-pressed',String(paused));button.setAttribute('aria-label',paused?'继续':'暂停');const label=button.querySelector('.ui-button__label');if(label)label.textContent=paused?'继续':'暂停';}
 };
 root.addEventListener('click',click);paint(START,START,0);frame=requestAnimationFrame(animate);
 return()=>{disposed=true;cancelAnimationFrame(frame);root.removeEventListener('click',click);};
}
export const movementQaCases=(['steady','uneven','wall'] as const).map(sample=>({id:'movement-'+sample,label:'移动 · '+titles[sample],render:()=>render(sample),mount:(root:HTMLElement)=>mount(root,sample)}));
