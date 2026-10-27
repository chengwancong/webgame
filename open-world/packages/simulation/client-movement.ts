import type {ClientMovementPoint as Point,ClientMovementReport,ClientMovementView} from '../contracts/client-movement.ts';
import {clientMovementTiming,clientMovementViewSchema} from '../contracts/client-movement.ts';
import type {Region} from '../content/index.ts';
import {navigationGrid,walkable} from './navigation.ts';

export type ClientMovementState=Omit<ClientMovementView,'position'>&{direction:Point;active:boolean;until:number;lastTick:number;speed:number;expected:Point;reports:number;auditPosition:Point;auditDistance:number;auditAllowance:number;trail:Point[]};
export const movementView=(state:ClientMovementState|null|undefined,position=state?.expected):ClientMovementView|undefined=>state?{epoch:state.epoch,revision:state.revision,ack:state.ack,owner:state.owner,position:{...position!},...state.reason?{reason:state.reason}:{}}:undefined;
export function newClientMovement(epoch:string,position:Point,tick:number):ClientMovementState{return{epoch,revision:0,ack:0,owner:'server',direction:{x:0,y:0},active:false,until:tick,lastTick:tick,speed:0,expected:{...position},reports:0,auditPosition:{...position},auditDistance:0,auditAllowance:0,trail:[{...position}]};}
export function correctClientMovement(state:ClientMovementState,position:Point,tick:number,reason:string){state.revision++;state.owner='server';state.reason=reason;state.active=false;state.direction={x:0,y:0};state.until=tick;state.lastTick=tick;state.expected={...position};state.auditPosition={...position};state.auditDistance=0;state.auditAllowance=0;state.trail=[{...position}];}

/** Accept ordinary reports cheaply. Only obvious disagreement or every sixteenth
 * received report triggers a bounded trajectory audit; no per-player polling timer. */
export function acceptClientMovement(state:ClientMovementState,report:ClientMovementReport,position:Point,tick:number,speed:number,region:Region,radius:number,blocked:boolean):{position:Point;accepted:boolean;corrected:boolean}{
 const unchanged=()=>({position,accepted:false,corrected:false});
 if(report.epoch!==state.epoch||report.revision!==state.revision||!Number.isSafeInteger(report.seq)||report.seq<=state.ack)return unchanged();
 state.ack=report.seq;
 const invalid=![report.position.x,report.position.y,report.direction.x,report.direction.y].every(Number.isFinite)||Math.hypot(report.direction.x,report.direction.y)>1.000001||report.position.x<1||report.position.y<1||report.position.x>=region.width-1||report.position.y>=region.height-1;
 if(invalid||blocked){correctClientMovement(state,position,tick,blocked?'controlled':'invalid-position');return{position,accepted:false,corrected:true};}
 const previous=state.trail.at(-1)??state.auditPosition,elapsed=Math.max(0,tick-state.lastTick)/30,travel=Math.hypot(report.position.x-previous.x,report.position.y-previous.y);
 if(state.owner==='server'){state.auditPosition={...position};state.trail=[{...position}];state.auditDistance=0;state.auditAllowance=0;}
 state.auditDistance+=state.owner==='server'?Math.hypot(report.position.x-position.x,report.position.y-position.y):travel;
 state.auditAllowance+=Math.max(speed,state.speed)*Math.min(2.25,elapsed);
 state.trail.push({...report.position});state.reports++;
 const gross=Math.hypot(report.position.x-position.x,report.position.y-position.y)>Math.max(3,speed*2.25),sample=state.reports%16===0;
 if(gross||sample){
  const grid=navigationGrid(region,radius),bad=state.auditDistance>state.auditAllowance+Math.max(2,speed*.4)||!walkable(region,report.position,radius)||state.trail.some((p,i)=>i>0&&!grid.clear(state.trail[i-1],p));
  if(bad){const rollback={...state.auditPosition};correctClientMovement(state,rollback,tick,'movement-rejected');return{position:rollback,accepted:false,corrected:true};}
  state.auditPosition={...report.position};state.auditDistance=0;state.auditAllowance=0;state.trail=[{...report.position}];
 }
 if(state.trail.length>17)state.trail.splice(1,state.trail.length-17);
 state.lastTick=tick;state.speed=speed;state.expected={...report.position};state.active=report.active&&!report.release;state.direction=state.active?{...report.direction}:{x:0,y:0};state.owner=report.release?'server':'client';state.reason=report.release?'released':undefined;state.until=tick+clientMovementTiming.leaseTicks;
 return{position:{...report.position},accepted:true,corrected:false};
}

export function validateClientMovement(state:unknown,tick:number){
 if(state==null)return;
 const s=state as ClientMovementState;clientMovementViewSchema.parse(movementView(s));
 if(!['direction','expected','auditPosition'].every(k=>{const p=(s as any)[k];return p&&Number.isFinite(p.x)&&Number.isFinite(p.y);})||typeof s.active!=='boolean'||![s.until,s.lastTick,s.reports].every(n=>Number.isSafeInteger(n)&&n>=0)||s.lastTick>tick||![s.speed,s.auditDistance,s.auditAllowance].every(n=>Number.isFinite(n)&&n>=0)||!Array.isArray(s.trail)||s.trail.length>17||s.trail.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))throw Error('Invalid client movement checkpoint');
}
