import type {Vec} from '../../../packages/contracts/index.ts';
import type {Region} from '../../../packages/content/index.ts';
import {move as navMove} from '../../../packages/simulation/navigation.ts';

/** FP6 副本内本机角色客户端预测位置。
 *  纯表现层：不改战斗判定、不改发给服务端的命令格式；他人与怪物仍走 AuthoritativeMotion 缓冲。
 *  三种模式：
 *  - follow：没有手动输入（含全自动、击退、冲刺等服务端驱动的移动）→ 原样返回缓冲插值位置，与改动前一致。
 *  - predict：有方向输入 → 按输入先走；向「最新快照位置 + 方向 × 移速 × LEAD」慢速校正，
 *    最新快照天然落后于输入约 LEAD，只向它校正会把预测拉回到无预测的延迟。
 *  - settle：松手后先原地等服务端追上（快照位置停止变化），再快速收敛到最新快照位置，
 *    与缓冲位置重合后回到 follow；服务端一直在动（自动模式接管）超时后让与缓冲位置的差值衰减到 0（跟得上移动中的目标）。
 *  偏差超过 SNAP_DIST + 提前量（瞬移、击退、传送）直接采用服务端位置。死亡/被控/断线/切区回到 follow。 */

/** 超出预期提前量后再多多少格就直接采用服务端位置。 */
const SNAP_DIST=1.5;
/** 最新快照相对本地输入的预估滞后（秒）：单程网络 + 等服务端帧与快照间隔。只决定校正目标，估错只是一个小的恒定偏差。 */
const LEAD=.12;
/** 移动中向校正目标收敛的时间常数（ms）。 */
const TAU_MOVING=300;
/** 松手后服务端已停：收敛时间常数（ms）。 */
const TAU_SETTLE=60;
/** 快照位置多久没变算服务端已停（ms）；须大于快照间隔加网络滞后，否则会在服务端还没追上时就往回拉。 */
const STILL_MS=200;
/** 松手后最多等服务端多久（ms），超时向缓冲位置收敛。 */
const SETTLE_TIMEOUT=500;
/** 与缓冲位置相差小于此值即回到 follow。 */
const JOIN_DIST=.03;

export class LocalPrediction {
 private pos:Vec={x:0,y:0};
 /** 最新服务端快照英雄位置（非缓冲延迟后的位置）。 */
 private server:Vec={x:0,y:0};
 private serverMovedAt=-Infinity;
 private inputX=0;private inputY=0;
 private lastAt=-1;private settleAt=0;private speed=0;
 private enabled=false;private initialized=false;
 private mode:'follow'|'predict'|'settle'='follow';
 /** 超时跟随时相对缓冲位置的偏移，按 TAU_SETTLE 衰减。 */
 private offset?:Vec;

 reset(){this.initialized=false;this.inputX=0;this.inputY=0;this.lastAt=-1;this.mode='follow';this.serverMovedAt=-Infinity;}

 /** 每帧传入已归一化的等距移动方向（无输入时传 0,0）。 */
 setInput(x:number,y:number){this.inputX=x;this.inputY=y;}

 /** 死亡/被控/断线时 false：立即回到 follow（显示缓冲位置）。 */
 setEnabled(v:boolean){this.enabled=v;if(!v)this.mode='follow';}

 /** 每帧传入最新快照英雄位置（直接，不经缓冲延迟）。now: performance.now() */
 accept(serverPos:Vec,now:number){
  if(!this.initialized||Math.hypot(serverPos.x-this.server.x,serverPos.y-this.server.y)>1e-3)this.serverMovedAt=now;
  this.server={...serverPos};
  if(!this.initialized){this.pos={...serverPos};this.initialized=true;this.lastAt=now;return;}
  if(this.mode!=='follow'&&Math.hypot(this.pos.x-serverPos.x,this.pos.y-serverPos.y)>SNAP_DIST+this.speed*LEAD)this.pos={...serverPos};
 }

 /** 返回本帧应渲染的英雄显示位置。
  *  speedPerSec: world.stats.speed（格/秒）；region: 当前区域做可走判定（null 不做，仅单测）；
  *  buffered: AuthoritativeMotion 给本机角色算出的缓冲插值位置。 */
 position(speedPerSec:number,region:Region|null,now:number,buffered:Vec):Vec{
  const dt=this.lastAt<0?0:Math.max(0,Math.min(100,now-this.lastAt));this.lastAt=now;this.speed=speedPerSec;
  const hasInput=this.inputX!==0||this.inputY!==0;
  if(!this.initialized||!this.enabled){this.mode='follow';return {...buffered};}
  if(hasInput&&this.mode==='follow'){this.mode='predict';this.pos={...buffered};}
  if(this.mode==='follow')return {...buffered};
  if(hasInput){
   this.mode='predict';
   if(dt>0){
    const amount=speedPerSec/1000*dt,target={x:this.pos.x+this.inputX*amount,y:this.pos.y+this.inputY*amount};
    this.pos=region?navMove(region,this.pos,target,amount):target;
    const lead=speedPerSec*LEAD,goal={x:this.server.x+this.inputX*lead,y:this.server.y+this.inputY*lead};
    this.blend(goal,dt,TAU_MOVING);
   }
   return {...this.pos};
  }
  if(this.mode==='predict'){this.mode='settle';this.settleAt=now;this.offset=undefined;}
  if(now-this.serverMovedAt>=STILL_MS){this.offset=undefined;if(dt>0)this.blend(this.server,dt,TAU_SETTLE);}
  else if(now-this.settleAt>=SETTLE_TIMEOUT){this.offset??={x:this.pos.x-buffered.x,y:this.pos.y-buffered.y};const k=Math.exp(-dt/TAU_SETTLE);this.offset={x:this.offset.x*k,y:this.offset.y*k};this.pos={x:buffered.x+this.offset.x,y:buffered.y+this.offset.y};}
  if(Math.hypot(this.pos.x-buffered.x,this.pos.y-buffered.y)<JOIN_DIST){this.mode='follow';this.offset=undefined;return {...buffered};}
  return {...this.pos};
 }

 private blend(goal:Vec,dt:number,tau:number){const k=1-Math.exp(-dt/tau);this.pos={x:this.pos.x+(goal.x-this.pos.x)*k,y:this.pos.y+(goal.y-this.pos.y)*k};}
}
