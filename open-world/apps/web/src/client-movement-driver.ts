import type {Vec} from '../../../packages/contracts/index.ts';
import {clientMovementTiming,type ClientMovementReport,type ClientMovementView} from '../../../packages/contracts/client-movement.ts';
import type {Region} from '../../../packages/content/index.ts';
import {findPath,walkable} from '../../../packages/simulation/navigation.ts';
import {moveBody,type Body} from '../../../packages/simulation/collision.ts';

export type ClientMovementContext={region:Region;speed:number;radius:number;bodies?:(position:Vec,reach:number)=>Body[]};
type Conditions={alive:boolean;blocked:boolean;connected?:boolean};
const KEEPALIVE_MS=clientMovementTiming.keepaliveMs,RELEASE_MS=clientMovementTiming.stopGraceTicks*1000/30,EPSILON=1e-5,DIRECTION_EPSILON=1e-4;
const copy=(point:Vec):Vec=>({x:point.x,y:point.y});
const finite=(point:Vec)=>Number.isFinite(point.x)&&Number.isFinite(point.y);
const different=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y)>DIRECTION_EPSILON;
const cloneReport=(report:ClientMovementReport):ClientMovementReport=>({...report,position:copy(report.position),direction:copy(report.direction)});

/** Local movement only. Ordinary snapshots acknowledge reports, never pull the
 * owned position backwards. No combat, rewards, networking or DOM work lives here. */
export class ClientMovementDriver{
 private view?:ClientMovementView;
 private server:Vec={x:0,y:0};private own:Vec={x:0,y:0};
 private allowed=false;private owned=false;private input:Vec={x:0,y:0};
 private path:Vec[]=[];private destination?:Vec;private mode:'keys'|'path'|'hold'='hold';
 private actualDirection:Vec={x:0,y:0};private isMoving=false;private look=1;
 private lastAt?:number;private stoppedAt?:number;private lastReportAt=-Infinity;
 private dirty=false;private nextSeq=0;private releaseReport?:ClientMovementReport;
 private retry?:ClientMovementReport;private handoff?:Vec;

 get active(){return this.owned;}
 get ready(){return Boolean(this.view);}
 get moving(){return this.isMoving;}
 get facing(){return this.look;}
 get position(){return copy(this.own);}
 /** Read once when active changes to false, to rebase only the hero's display buffer. */
 get handoffPosition(){return this.handoff?copy(this.handoff):undefined;}

 reset(){
  this.view=undefined;this.server={x:0,y:0};this.own={x:0,y:0};this.allowed=false;
  this.cancel();this.nextSeq=0;this.lastAt=undefined;this.lastReportAt=-Infinity;this.handoff=undefined;
 }

 sync(view:ClientMovementView,serverPosition:Vec,now:number,conditions:Conditions){
  if(!finite(serverPosition)||!Number.isFinite(now))return;
  // A delayed confirmation from an older correction revision cannot undo a reset.
  if(this.view?.epoch===view.epoch&&view.revision<this.view.revision)return;
  if(this.view?.epoch===view.epoch&&view.revision===this.view.revision&&view.ack<this.view.ack)return;
  const changed=!this.view||this.view.epoch!==view.epoch||this.view.revision!==view.revision;
  const sameEpoch=this.view?.epoch===view.epoch;
  this.allowed=conditions.alive&&!conditions.blocked&&conditions.connected!==false;
  this.server=copy(serverPosition);
  if(changed){
   this.cancel();this.own=copy(serverPosition);this.lastAt=now;this.lastReportAt=-Infinity;this.handoff=undefined;
   this.nextSeq=sameEpoch?Math.max(this.nextSeq,view.ack):view.ack;
   this.view={...view};
   // Restore a retained client lease without reviving its stale direction/path.
   if(this.allowed&&view.owner==='client'){this.owned=true;this.stoppedAt=now;this.dirty=true;}
   return;
  }
  this.view={...view};this.nextSeq=Math.max(this.nextSeq,view.ack);
  if(!this.allowed){this.cancel();this.own=copy(serverPosition);this.lastAt=now;this.handoff=undefined;return;}
  if(this.owned&&this.releaseReport&&view.owner==='server'&&view.ack>=this.releaseReport.seq){
   this.handoff=copy(this.own);this.cancel();
   // Preserve own until the caller has consumed handoffPosition. The next
   // advance in server mode returns the freshly received authoritative pose.
   this.lastAt=now;
  }else if(!this.owned){this.own=copy(serverPosition);}
 }

 direction(value:Vec,now:number){
  if(!this.view||!this.allowed||!Number.isFinite(now))return;
  const length=finite(value)?Math.hypot(value.x,value.y):0;
  const next=length>EPSILON?{x:value.x/Math.max(1,length),y:value.y/Math.max(1,length)}:{x:0,y:0};
  const pressed=next.x!==0||next.y!==0;
  // The scene supplies zero keyboard input while a click-to-walk path is active.
  if(!pressed&&this.mode==='path')return;
  if(!pressed&&this.mode!=='keys')return;
  if(pressed&&this.owned&&this.mode==='keys'&&!different(next,this.input))return;
  if(pressed){this.claim(now);this.mode='keys';this.input=next;this.path=[];this.destination=undefined;this.stoppedAt=undefined;this.dirty=true;}
  else{this.input={x:0,y:0};this.mode='hold';this.path=[];this.destination=undefined;this.stop(now);}
 }

 go(target:Vec,context:ClientMovementContext,now:number):boolean{
  if(!this.view||!this.allowed||!finite(target)||!Number.isFinite(now)||!walkable(context.region,target,context.radius))return false;
  const origin=this.owned?this.own:this.server;
  if(this.mode==='path'&&this.destination&&!different(target,this.destination))return true;
  const near=Math.hypot(target.x-origin.x,target.y-origin.y)<=EPSILON;
  const path=near?[]:findPath(context.region,origin,target,context.radius);
  if(!near&&!path.length)return false;
  this.claim(now);this.input={x:0,y:0};this.path=path.map(copy);this.destination=copy(target);
  this.mode=path.length?'path':'hold';this.stoppedAt=path.length?undefined:now;this.dirty=true;
  if(!path.length)this.setActual({x:0,y:0});
  return true;
 }

 advance(now:number,context:ClientMovementContext):Vec{
  if(!Number.isFinite(now))return this.position;
  const dt=this.lastAt===undefined?0:Math.max(0,Math.min(100,now-this.lastAt));this.lastAt=now;
  if(!this.owned){this.own=copy(this.server);return this.position;}
  if(!this.allowed)return this.position;
  const speed=Number.isFinite(context.speed)?Math.max(0,context.speed):0;
  const amount=speed*dt/1000;
  if(amount<=EPSILON)return this.position;
  const bodies=context.bodies?.(this.own,amount)??[];
  if(this.mode==='keys'){
   const before=this.own,target={x:before.x+this.input.x*amount,y:before.y+this.input.y*amount};
   this.own=moveBody(context.region,before,target,amount,context.radius,bodies);
   this.setActual({x:(this.own.x-before.x)/amount,y:(this.own.y-before.y)/amount});
  }else if(this.mode==='path'){
   let remaining=amount,actual:Vec={x:0,y:0};
   while(remaining>EPSILON&&this.path.length){
    const target=this.path[0],before=this.own,distance=Math.hypot(target.x-before.x,target.y-before.y);
    if(distance<=EPSILON){this.path.shift();this.dirty=true;continue;}
    const step=Math.min(remaining,distance);this.own=moveBody(context.region,before,target,step,context.radius,bodies);
    const moved=Math.hypot(this.own.x-before.x,this.own.y-before.y);
    actual={x:(this.own.x-before.x)/step,y:(this.own.y-before.y)/step};
    remaining-=step;
    if(Math.hypot(this.own.x-target.x,this.own.y-target.y)<=EPSILON){this.path.shift();this.dirty=true;}
    // A new dynamic blocker may invalidate a previously reachable path. Hold
    // here instead of sending a velocity that would move the server through it.
    else if(moved<=EPSILON){this.path=[];break;}
   }
   this.setActual(actual);
   if(!this.path.length){this.mode='hold';this.destination=undefined;this.stop(now);}
  }else this.setActual({x:0,y:0});
  return this.position;
 }

 takeReport(now:number,force=false):ClientMovementReport|undefined{
  if(!this.view||!this.allowed||!this.owned||!Number.isFinite(now))return;
  if(this.releaseReport){
   if(this.retry||force||now-this.lastReportAt>=KEEPALIVE_MS){this.retry=undefined;this.lastReportAt=now;return cloneReport(this.releaseReport);}
   return;
  }
  const release=this.mode==='hold'&&this.stoppedAt!==undefined&&now-this.stoppedAt>=RELEASE_MS;
  if(!release&&!this.dirty&&this.retry){const report=this.retry;this.retry=undefined;this.lastReportAt=now;return cloneReport(report);}
  if(!release&&!force&&!this.dirty&&now-this.lastReportAt<KEEPALIVE_MS)return;
  const report:ClientMovementReport={epoch:this.view.epoch,revision:this.view.revision,seq:++this.nextSeq,position:copy(this.own),direction:release?{x:0,y:0}:copy(this.actualDirection),active:!release&&this.isMoving,...(release?{release:true}:{})};
  this.retry=undefined;this.lastReportAt=now;this.dirty=false;
  if(release)this.releaseReport=cloneReport(report);
  return report;
 }

 /** Keep at most the newest failed report. A newer intent supersedes stale data. */
 reportFailed(report:ClientMovementReport){
  if(this.owned&&this.view?.epoch===report.epoch&&this.view.revision===report.revision&&report.seq===this.nextSeq)this.retry=cloneReport(report);
 }

 private claim(now:number){
  if(!this.owned){this.owned=true;this.own=copy(this.server);this.lastAt=now;}
  else if(this.mode==='hold'||this.releaseReport)this.lastAt=now;
  this.releaseReport=undefined;this.retry=undefined;this.handoff=undefined;
 }
 private stop(now:number){this.stoppedAt=now;this.setActual({x:0,y:0});this.dirty=true;}
 private setActual(direction:Vec){
  const length=Math.hypot(direction.x,direction.y);
  direction=length<=EPSILON?{x:0,y:0}:{x:direction.x/Math.max(1,length),y:direction.y/Math.max(1,length)};
  if(different(direction,this.actualDirection))this.dirty=true;
  this.actualDirection=direction;this.isMoving=Math.hypot(direction.x,direction.y)>EPSILON;
  if(this.isMoving&&Math.abs(direction.x-direction.y)>EPSILON)this.look=direction.x-direction.y>0?1:-1;
 }
 private cancel(){
  this.owned=false;this.input={x:0,y:0};this.path=[];this.destination=undefined;this.mode='hold';this.actualDirection={x:0,y:0};this.isMoving=false;
  this.stoppedAt=undefined;this.releaseReport=undefined;this.retry=undefined;this.dirty=false;
 }
}
