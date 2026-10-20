/**
 * UX-A04 开场演出（只管呈现，不碰对白原文与战斗逻辑）：
 * - 坠落：2D canvas 真「镜头下落」——云层视差上冲、速度线、地面逼近、落地柔光（半透明暖色，不做刺眼白闪）。
 * - 三选一悬停：卡片内一小块 1.5 秒技能预演（示意，不是真实战斗）。
 * 减弱动效时只画定格画面，不跑动画。
 */
import type {PrologueFamily} from '../../../packages/content/starsea/prologue.ts';

export const FALL_MS=8000;
/** 落地瞬间占坠落时长的比例；控制器据此在同一时刻震屏。 */
export const FALL_IMPACT=0.95;

const hash=(n:number)=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
const clamp=(v:number,a=0,b=1)=>Math.max(a,Math.min(b,v));
const ease=(t:number)=>t*t*(3-2*t);

type Cloud={x:number;y:number;r:number;depth:number;a:number};
const clouds:Cloud[]=Array.from({length:26},(_,i)=>({x:hash(i)*1.2-.1,y:hash(i+50),r:.08+hash(i+90)*.16,depth:.25+hash(i+130)*.75,a:.05+hash(i+170)*.09}));
const specks=Array.from({length:70},(_,i)=>({x:hash(i+300),y:hash(i+400),depth:.3+hash(i+500)*.7}));

/** 速度曲线：慢起步，越落越快。返回累计位移（画面高度的倍数）。 */
const travel=(t:number)=>2.2*Math.pow(t,2.2)+0.6*t;
const speedOf=(t:number)=>2.2*2.2*Math.pow(t,1.2)+0.6;

export function drawFall(ctx:CanvasRenderingContext2D,w:number,h:number,t:number){
 const d=travel(t),v=speedOf(t)/5.5,warm=clamp((t-.55)/.4);
 const sky=ctx.createLinearGradient(0,0,0,h);
 sky.addColorStop(0,`rgb(${20+warm*26},${30+warm*20},${52+warm*6})`);sky.addColorStop(1,`rgb(${52+warm*60},${74+warm*34},${100+warm*0})`);
 ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
 // 云层：越近越快越大，向上流过镜头
 for(const c of clouds){
  const y=((c.y-d*c.depth*.35)%1.4+1.4)%1.4-.2,x=c.x*w,r=c.r*w*(.7+c.depth*.6);
  const g=ctx.createRadialGradient(x,y*h,0,x,y*h,r);
  g.addColorStop(0,`rgba(214,226,236,${c.a*(.6+c.depth*.6)})`);g.addColorStop(1,'rgba(214,226,236,0)');
  ctx.save();ctx.translate(0,y*h);ctx.scale(1,.42+.2*v);ctx.translate(0,-y*h);ctx.fillStyle=g;ctx.fillRect(x-r,y*h-r,r*2,r*2);ctx.restore();
 }
 // 速度线 / 尘屑：拉成竖线，越快越长
 ctx.lineCap='round';
 for(const s of specks){
  const y=((s.y-d*s.depth*.9)%1+1)%1,len=(6+70*v*s.depth)*(h/540),x=s.x*w;
  ctx.strokeStyle=`rgba(240,236,214,${.1+.38*v*s.depth})`;ctx.lineWidth=1+s.depth*1.4;
  ctx.beginPath();ctx.moveTo(x,y*h);ctx.lineTo(x,y*h+len);ctx.stroke();
 }
 // 地面逼近：后段从下方升起暗色地貌，地平线带暖光
 const g1=clamp((t-.66)/(FALL_IMPACT-.66));
 if(g1>0){
  const top=h*(1-.62*ease(g1)),glow=ctx.createLinearGradient(0,top-h*.12,0,top+h*.08);
  glow.addColorStop(0,'rgba(246,210,122,0)');glow.addColorStop(.6,`rgba(246,210,122,${.28*g1})`);glow.addColorStop(1,'rgba(246,210,122,0)');
  ctx.fillStyle=glow;ctx.fillRect(0,top-h*.12,w,h*.2);
  const land=ctx.createLinearGradient(0,top,0,h);land.addColorStop(0,'#27333a');land.addColorStop(1,'#10171b');
  ctx.fillStyle=land;ctx.beginPath();ctx.moveTo(0,top+hash(1)*14);
  for(let i=1;i<=12;i++)ctx.lineTo(w*i/12,top+(hash(i+9)-.5)*26*(1-g1*.5));
  ctx.lineTo(w,h);ctx.lineTo(0,h);ctx.closePath();ctx.fill();
 }
 // 边缘暗角随速度加深
 const vg=ctx.createRadialGradient(w/2,h/2,h*.25,w/2,h/2,h*.95);vg.addColorStop(0,'rgba(8,12,18,0)');vg.addColorStop(1,`rgba(8,12,18,${.25+.4*v})`);
 ctx.fillStyle=vg;ctx.fillRect(0,0,w,h);
 // 落地柔光：暖色、半透明，峰值 0.5，很快回落
 if(t>=FALL_IMPACT){const k=(t-FALL_IMPACT)/(1-FALL_IMPACT),a=.5*Math.pow(1-k,1.6)+.1*(1-k);ctx.fillStyle=`rgba(255,240,205,${clamp(a,0,.5)})`;ctx.fillRect(0,0,w,h);}
}

export type FallHandle={stop():void};
/** 在 parent 里铺一块全屏 canvas 跑坠落动画；phase 结束后由控制器调用 stop()。 */
export function startFall(parent:HTMLElement,reduced:boolean):FallHandle{
 const canvas=document.createElement('canvas');canvas.id='prologue-fx';canvas.setAttribute('aria-hidden','true');canvas.width=960;canvas.height=540;
 parent.appendChild(canvas);const ctx=canvas.getContext('2d');
 if(!ctx)return {stop(){canvas.remove();}};
 if(reduced){drawFall(ctx,960,540,.5);return {stop(){canvas.remove();}};}
 const begin=performance.now();let raf=0,stopped=false;
 const frame=(now:number)=>{if(stopped)return;const t=clamp((now-begin)/FALL_MS);drawFall(ctx,960,540,t);if(t<1)raf=requestAnimationFrame(frame);};
 raf=requestAnimationFrame(frame);
 return {stop(){stopped=true;cancelAnimationFrame(raf);canvas.remove();}};
}

// ───────────── 三选一技能预演（示意） ─────────────
export const DEMO_W=224,DEMO_H=72;
const enemies=[{x:150,y:48},{x:174,y:44},{x:198,y:50}];
const GOLD='246,210,122';

function drawBase(ctx:CanvasRenderingContext2D,hit:(i:number)=>number){
 ctx.clearRect(0,0,DEMO_W,DEMO_H);
 const bg=ctx.createLinearGradient(0,0,0,DEMO_H);bg.addColorStop(0,'#1d2a36');bg.addColorStop(1,'#101820');ctx.fillStyle=bg;ctx.fillRect(0,0,DEMO_W,DEMO_H);
 ctx.fillStyle='rgba(255,255,255,.07)';ctx.fillRect(0,58,DEMO_W,1);
 ctx.fillStyle='#e8d9a8';ctx.beginPath();ctx.arc(34,48,6,0,Math.PI*2);ctx.fill();
 enemies.forEach((e,i)=>{const k=hit(i);ctx.fillStyle=k>0?`rgb(255,${Math.round(150-60*k)},${Math.round(110-40*k)})`:'#8fa3b5';ctx.beginPath();ctx.arc(e.x,e.y,5.5*(1+.35*k)*(k>.8?1-(k-.8)*2:1),0,Math.PI*2);ctx.fill();});
}
const pulse=(t:number,at:number)=>t<at?0:clamp(1-(t-at)/.25);

export function drawDemo(ctx:CanvasRenderingContext2D,family:PrologueFamily,t:number){
 if(family==='sword'){
  drawBase(ctx,i=>pulse(t,.45+i*.04));
  const k=clamp((t-.2)/.4);
  if(k>0&&t<.9){ctx.strokeStyle=`rgba(${GOLD},${.95*(1-clamp((t-.6)/.3))})`;ctx.lineWidth=5;ctx.lineCap='round';
   ctx.beginPath();ctx.arc(34,48,42,-1.0,-1.0+2.0*ease(k));ctx.stroke();
   ctx.strokeStyle=`rgba(255,255,255,${.7*(1-clamp((t-.6)/.3))})`;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(34,48,42,-1.0,-1.0+2.0*ease(k));ctx.stroke();}
 }else if(family==='staff'){
  drawBase(ctx,i=>pulse(t,.5));
  const k=clamp(t/.5);
  if(t<.5){const x=240-(240-174)*k,y=-20+(44+20)*k;ctx.strokeStyle=`rgba(${GOLD},.8)`;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x+24*(1-k),y-24*(1-k)*1.4);ctx.lineTo(x,y);ctx.stroke();
   ctx.fillStyle='#fff6d6';ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fill();}
  else if(t<1){const r=(t-.5)/.5;ctx.strokeStyle=`rgba(${GOLD},${.9*(1-r)})`;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(174,52,10+52*r,5+16*r,0,0,Math.PI*2);ctx.stroke();
   const g=ctx.createRadialGradient(174,48,0,174,48,34);g.addColorStop(0,`rgba(255,230,160,${.6*(1-r)})`);g.addColorStop(1,'rgba(255,230,160,0)');ctx.fillStyle=g;ctx.fillRect(130,10,90,60);}
 }else{
  drawBase(ctx,i=>pulse(t,.4+i*.06));
  const k=clamp((t-.12)/.5);
  if(k>0&&t<.95){ctx.strokeStyle=`rgba(${GOLD},${.95*(1-clamp((t-.65)/.3))})`;ctx.lineWidth=2;ctx.lineCap='round';
   for(let i=-3;i<=3;i++){const a=i*0.2,x0=40+Math.cos(a)*14+ease(k)*Math.cos(a)*150,y0=48+Math.sin(a)*14+ease(k)*Math.sin(a)*70*0.9;ctx.beginPath();ctx.moveTo(x0-Math.cos(a)*12,y0-Math.sin(a)*12);ctx.lineTo(x0,y0);ctx.stroke();}}
 }
}
/** 卡片里的小画布：静止时画定格，悬停/聚焦播 1.5 秒。 */
export function paintDemoStills(root:ParentNode){
 root.querySelectorAll<HTMLCanvasElement>('canvas.prologue-demo').forEach(c=>{const ctx=c.getContext('2d');if(ctx)drawDemo(ctx,c.dataset.family as PrologueFamily,.86);});
}
const runs=new WeakMap<HTMLCanvasElement,number>();
export function playDemo(canvas:HTMLCanvasElement,reduced:boolean){
 const ctx=canvas.getContext('2d');if(!ctx||reduced)return;
 const old=runs.get(canvas);if(old)cancelAnimationFrame(old);
 const begin=performance.now(),family=canvas.dataset.family as PrologueFamily;
 const frame=(now:number)=>{const t=clamp((now-begin)/1500);drawDemo(ctx,family,t);if(t<1)runs.set(canvas,requestAnimationFrame(frame));else{runs.delete(canvas);drawDemo(ctx,family,.86);}};
 runs.set(canvas,requestAnimationFrame(frame));
}
