/** Read-only protocol illustration. No API, player save or device FPS claims. */
import {World} from '../../../packages/simulation/index.ts';
import type {Region} from '../../../packages/content/index.ts';
import type {ClientMovementReport,ClientMovementView} from '../../../packages/contracts/client-movement.ts';
import {ClientMovementDriver} from './client-movement-driver.ts';
import {clientMovementContext,clientMovementAvailability} from './client-movement-context.ts';
import {panelHeaderHtml,buttonHtml} from './ui-components.ts';

const START={x:4,y:12},FRAME_MS=1000/60,ONE_WAY_MS=100,CYCLE_MS=6000;
const region:Region={id:'client-movement-qa-only',name:'本地移动样例',subtitle:'只读协议示意',theme:'qa',width:48,height:24,safe:START,portal:{x:2,y:2},boss:false,auto:false,obstacles:[],spawns:[],landmarks:[]};
function render(){return `<section class="qa-primitives">${panelHeaderHtml('本地移动 · 慢回执')}<p>协议示意，非实机 FPS。模拟单程 100ms、来回 200ms；使用真实本地移动器和空 World 执行接收与步进。</p><canvas data-client-movement-canvas width="640" height="240" role="img" aria-label="本机位置与服务端位置的延迟对照"></canvas><p>上排实心圆：本机位置　下排空心圆：服务端当前位置。普通回执只确认，不把本机拉回旧坐标。</p><p data-client-movement-state role="status" aria-live="off">准备中…</p><div class="qa-primitives__resources">${buttonHtml('重播',{action:'client-movement-qa-replay',variant:'primary',size:'compact'})}${buttonHtml('暂停',{action:'client-movement-qa-pause',size:'compact',pressed:false})}</div><p>按住前进 3 秒后松手，等待 1.5 秒释放控制权；每 6 秒重播。无 API、存档、怪物或奖励。</p></section>`;}

function mount(root:HTMLElement){
 const canvas=root.querySelector<HTMLCanvasElement>('[data-client-movement-canvas]')!,ctx=canvas.getContext('2d');if(!ctx)return;
 const output=root.querySelector<HTMLElement>('[data-client-movement-state]')!,style=getComputedStyle(root),color=(name:string)=>style.getPropertyValue(name).trim();
 const palette={background:color('--color-panel-inset'),line:color('--color-border'),client:color('--color-info'),server:color('--color-warning')};
 const client=new ClientMovementDriver();let server:World,time=0,accumulator=0,nextSnapshot=100,reports=0,echoes=0,lastOutput=-Infinity,paused=false,disposed=false,frame=0,last=performance.now();
 let outgoing:{at:number;report:ClientMovementReport}[]=[],incoming:{at:number;view:ClientMovementView}[]=[];
 const reset=()=>{
  server=new World({...region,safe:{...START},obstacles:[]},{hp:100,attack:1,armor:0,speed:6,mana:100,regen:0,effects:[]},[],[],[],1);server.setMode('auto');
  const view=server.configureClientMovement('qa-local-movement');client.reset();client.sync(view!,view!.position,0,clientMovementAvailability(server,true));
  time=0;accumulator=0;nextSnapshot=100;reports=0;echoes=0;lastOutput=-Infinity;outgoing=[];incoming=[];
 };
 // Keep simulated clocks fixed; browser frame rate only controls presentation.
 const step=()=>{
  time+=FRAME_MS;
  while(outgoing.length&&outgoing[0].at<=time)server.receiveClientMovement(outgoing.shift()!.report);
  while((server.tick+1)*1000/30<=time)server.step();
  while(nextSnapshot<=time){incoming.push({at:nextSnapshot+ONE_WAY_MS,view:structuredClone(server.clientMovementView()!)});nextSnapshot+=100;}
  while(incoming.length&&incoming[0].at<=time){const message=incoming.shift()!;client.sync(message.view,message.view.position,time,clientMovementAvailability(server,true));echoes++;}
  client.direction({x:time<3000?1:0,y:0},time);client.advance(time,clientMovementContext(server));
  const report=client.takeReport(time);if(report){outgoing.push({at:time+ONE_WAY_MS,report});reports++;}
 };
 // Both rows use the same scale, so delayed echoes cannot hide behind a camera.
 const paint=()=>{
  ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle=palette.background;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.strokeStyle=palette.line;ctx.lineWidth=1;
  for(const y of [76,164]){ctx.beginPath();ctx.moveTo(40,y);ctx.lineTo(600,y);ctx.stroke();for(let x=40;x<=600;x+=56){ctx.beginPath();ctx.moveTo(x,y-8);ctx.lineTo(x,y+8);ctx.stroke();}}
  const x=(position:{x:number})=>40+(position.x-START.x)*28;ctx.fillStyle=palette.client;ctx.beginPath();ctx.arc(x(client.position),76,7,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle=palette.server;ctx.lineWidth=3;ctx.beginPath();ctx.arc(x(server.hero.position),164,9,0,Math.PI*2);ctx.stroke();
  if(time-lastOutput>=100){lastOutput=time;output.textContent=`${(time/1000).toFixed(1)} 秒 · ${time<3000?'按住前进':client.active?'已松手，等待释放':'已交回服务端'} · 上报 ${reports} 次 / 回执 ${echoes} 次 · 本机 ${client.position.x.toFixed(2)} / 服务端 ${server.hero.position.x.toFixed(2)}`;}
 };
 const animate=(now:number)=>{if(disposed)return;const delta=Math.max(0,Math.min(100,now-last));last=now;if(!paused){accumulator+=delta;while(accumulator>=FRAME_MS){accumulator-=FRAME_MS;step();if(time>=CYCLE_MS){reset();break;}}paint();}frame=requestAnimationFrame(animate);};
 const click=(event:MouseEvent)=>{const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(!button)return;
  if(button.dataset.action==='client-movement-qa-replay'){reset();last=performance.now();paint();}
  if(button.dataset.action==='client-movement-qa-pause'){paused=!paused;button.setAttribute('aria-pressed',String(paused));button.setAttribute('aria-label',paused?'继续':'暂停');const label=button.querySelector('.ui-button__label');if(label)label.textContent=paused?'继续':'暂停';}
 };
 reset();paint();root.addEventListener('click',click);frame=requestAnimationFrame(animate);
 return()=>{disposed=true;cancelAnimationFrame(frame);root.removeEventListener('click',click);outgoing=[];incoming=[];};
}
export const clientMovementQaCases=[{id:'client-movement-slow-ack',label:'本地移动 · 慢回执',render,mount}];
