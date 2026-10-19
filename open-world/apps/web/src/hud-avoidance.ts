import type Phaser from 'phaser';
import {STAGE} from './stage.ts';
import {layoutWorldLabels,hudReservedRects} from './ui/world-label-layout.ts';
export type HudRect={x:number;y:number;width:number;height:number};
export const overlaps=(a:HudRect,b:HudRect,gap=0)=>a.x<b.x+b.width+gap&&a.x+a.width+gap>b.x&&a.y<b.y+b.height+gap&&a.y+a.height+gap>b.y;
/** One measured placement policy for screen-fixed HUD text (quest guide edge label). */
export function placeHudRect(preferred:HudRect,reserved:HudRect[],viewport:HudRect,gap:number):HudRect|undefined{
 const clamp=(r:HudRect)=>({...r,x:Math.max(viewport.x,Math.min(viewport.x+viewport.width-r.width,r.x)),y:Math.max(viewport.y,Math.min(viewport.y+viewport.height-r.height,r.y))});
 if(preferred.width>viewport.width||preferred.height>viewport.height)return;
 const candidates=[preferred,...reserved.flatMap(r=>[
  {...preferred,x:r.x+r.width+gap},{...preferred,x:r.x-preferred.width-gap},
  {...preferred,y:r.y+r.height+gap},{...preferred,y:r.y-preferred.height-gap},
 ])].map(clamp).sort((a,b)=>Math.hypot(a.x-preferred.x,a.y-preferred.y)-Math.hypot(b.x-preferred.x,b.y-preferred.y));
 return candidates.find(c=>reserved.every(r=>!overlaps(c,r,gap)));
}
const selectors='#vitals,#tracker,#starsea-hud,#minimapbox,#skillbar,#sysbar,.hud-wallet,#feed,#pausebox .paused,#toast,#dungeon-hud';
function occupied(except?:Element){return [...document.querySelectorAll<HTMLElement>(selectors)].filter(e=>e!==except&&(e.childElementCount>0||Boolean(e.textContent?.trim()))&&!e.hidden&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden'&&Number(getComputedStyle(e).opacity)!==0).map(e=>e.getBoundingClientRect()).filter(r=>r.width>0&&r.height>0).map(r=>({x:r.left,y:r.top,width:r.width,height:r.height}));}
const cache=new WeakMap<object,{at:number;rects:HudRect[]}>();
/** Live DOM HUD rectangles in camera pixels. */
export function screenReservations(scene:Phaser.Scene){
 const now=performance.now(),hit=cache.get(scene);if(hit&&now-hit.at<100)return hit.rects;
 const canvas=scene.game.canvas.getBoundingClientRect(),sx=scene.scale.width/Math.max(1,canvas.width),sy=scene.scale.height/Math.max(1,canvas.height);
 const rects=occupied().map(r=>({x:(r.x-canvas.left)*sx,y:(r.y-canvas.top)*sy,width:r.width*sx,height:r.height*sy}));cache.set(scene,{at:now,rects});return rects;
}

/** 一条世界标签申请：bounds 为世界坐标下的自然位置；apply 收到是否显示与需要上移的世界像素。 */
export type WorldLabelRequest={id:string;bounds:HudRect;priority:number;steps?:number;apply:(visible:boolean,lift:number)=>void};
/**
 * 世界标签每帧统一避让（docs/hud-arbitration-plan.md §2.3）：各渲染器只申请，场景在一帧末尾调用 flush。
 * 锚点不动、只在正上方让位；进入 HUD 保留区（方案 §1 固定区 + 实测 DOM 面板）或让不开就隐藏。
 */
class WorldLabelArbiter{
 private pending:WorldLabelRequest[]=[];
 constructor(private scene:Phaser.Scene){}
 submit(request:WorldLabelRequest){this.pending.push(request);}
 flush(){
  const requests=this.pending;this.pending=[];if(!requests.length)return;
  const camera=this.scene.cameras.main,view=camera.worldView,toStage=STAGE.width/Math.max(1,camera.width),f=camera.zoom*toStage;
  const reserved=[...hudReservedRects,...screenReservations(this.scene).map(r=>({x:r.x*toStage,y:r.y*toStage,width:r.width*toStage,height:r.height*toStage}))];
  const placed=layoutWorldLabels(requests.map(r=>({id:r.id,priority:r.priority,steps:r.steps,x:(r.bounds.x+r.bounds.width/2-view.x)*f,y:(r.bounds.y+r.bounds.height-view.y)*f,width:r.bounds.width*f,height:r.bounds.height*f})),{reserved,viewport:{x:0,y:0,width:STAGE.width,height:STAGE.height}});
  for(const [i,r] of requests.entries()){const p=placed[i];const lift=p.visible?((r.bounds.y+r.bounds.height-view.y)*f-p.y)/f:0;r.apply(p.visible,lift);}
 }
}
const arbiters=new WeakMap<Phaser.Scene,WorldLabelArbiter>();
export function worldLabels(scene:Phaser.Scene){let a=arbiters.get(scene);if(!a){a=new WorldLabelArbiter(scene);arbiters.set(scene,a);}return a;}
