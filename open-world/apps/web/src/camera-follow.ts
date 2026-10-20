/**
 * UX-A05 镜头跟随（纯渲染层，不读写世界状态）：移动前瞻 + 临界阻尼 + 首领推近。
 * 减弱动效时退回硬锁主角、不推近，与旧行为一致。
 */
export type FollowState={x:number;y:number;vx:number;vy:number;lookX:number;lookY:number;lookVx:number;lookVy:number;lastX:number;lastY:number;push:number;pushV:number;ready:boolean};
export type FollowOptions={reduced:boolean;bossNear:boolean};

const SMOOTH=0.14,LOOK_SMOOTH=0.28,LOOK_SECONDS=0.35,LOOK_MAX=70,SNAP_DISTANCE=420,PUSH_MAX=0.06,PUSH_SMOOTH=0.7;

export const newFollow=():FollowState=>({x:0,y:0,vx:0,vy:0,lookX:0,lookY:0,lookVx:0,lookVy:0,lastX:0,lastY:0,push:0,pushV:0,ready:false});

/** 临界阻尼弹簧（Unity SmoothDamp 形式），帧率无关。 */
export function smoothDamp(current:number,target:number,velocity:number,smoothTime:number,dt:number){
 const omega=2/Math.max(0.0001,smoothTime),x=omega*dt,exp=1/(1+x+0.48*x*x+0.235*x*x*x);
 const change=current-target,temp=(velocity+omega*change)*dt;
 const nextVelocity=(velocity-omega*temp)*exp;
 return {value:target+(change+temp)*exp,velocity:nextVelocity};
}

/** 返回本帧镜头中心与推近系数（zoom = baseZoom * (1 + push)）。目标 (tx,ty) 已含固定偏移，不含震屏。 */
export function stepFollow(state:FollowState,tx:number,ty:number,deltaMs:number,opt:FollowOptions){
 const dt=Math.min(0.1,Math.max(0.001,deltaMs/1000));
 if(opt.reduced){state.ready=false;state.lastX=tx;state.lastY=ty;state.push=0;state.pushV=0;return {x:tx,y:ty,push:0};}
 if(!state.ready||Math.hypot(tx-state.lastX,ty-state.lastY)>SNAP_DISTANCE){
  Object.assign(state,{x:tx,y:ty,vx:0,vy:0,lookX:0,lookY:0,lookVx:0,lookVy:0,lastX:tx,lastY:ty,push:0,pushV:0,ready:true});
  return {x:tx,y:ty,push:0};
 }
 // 主角屏幕速度 → 前瞻目标（只取最近的位移，停下时回正）
 const hvx=(tx-state.lastX)/dt,hvy=(ty-state.lastY)/dt;state.lastX=tx;state.lastY=ty;
 let wantX=hvx*LOOK_SECONDS,wantY=hvy*LOOK_SECONDS;const len=Math.hypot(wantX,wantY);if(len>LOOK_MAX){wantX*=LOOK_MAX/len;wantY*=LOOK_MAX/len;}
 const lx=smoothDamp(state.lookX,wantX,state.lookVx,LOOK_SMOOTH,dt),ly=smoothDamp(state.lookY,wantY,state.lookVy,LOOK_SMOOTH,dt);
 state.lookX=lx.value;state.lookVx=lx.velocity;state.lookY=ly.value;state.lookVy=ly.velocity;
 const px=smoothDamp(state.x,tx+state.lookX,state.vx,SMOOTH,dt),py=smoothDamp(state.y,ty+state.lookY,state.vy,SMOOTH,dt);
 state.x=px.value;state.vx=px.velocity;state.y=py.value;state.vy=py.velocity;
 const pu=smoothDamp(state.push,opt.bossNear?PUSH_MAX:0,state.pushV,PUSH_SMOOTH,dt);
 state.push=Math.max(0,pu.value);state.pushV=pu.velocity;
 return {x:state.x,y:state.y,push:state.push};
}
