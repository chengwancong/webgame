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
function occupied(elements:HTMLElement[]){return elements.filter(e=>{if(!(e.childElementCount>0||Boolean(e.textContent?.trim()))||e.hidden)return false;const style=getComputedStyle(e);return style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)!==0;}).map(e=>e.getBoundingClientRect()).filter(r=>r.width>0&&r.height>0).map(r=>({x:r.left,y:r.top,width:r.width,height:r.height}));}
const cache=new WeakMap<Phaser.Scene,HudReservationCache>();
/** Stable HUD geometry has no polling timer. Layout/content changes invalidate
 * the cache; measurement is deferred until labels actually need reservations. */
class HudReservationCache{
 private dirty=true;private disposed=false;private rects:HudRect[]=[];private elements:HTMLElement[]=[];private observed=new Set<Element>();
 private width=-1;private height=-1;private mutations?:MutationObserver;private resize?:ResizeObserver;
 private moving=new Set<EventTarget>();
 private mark=()=>{this.dirty=true;};
 private motionStart=(event:Event)=>{if(this.layoutTarget(event.target)){this.mark();const geometry=event.type==='transitionrun'?/^(transform|translate|scale|inset|top|left|right|bottom|width|height|margin|padding)/.test((event as TransitionEvent).propertyName):event.target instanceof Element&&!getComputedStyle(event.target).animationIterationCount?.split(',').some(n=>n.trim()==='infinite');if(geometry)this.moving.add(event.target!);}};
 private motionEnd=(event:Event)=>{if(this.moving.delete(event.target!))this.mark();};
 constructor(private scene:Phaser.Scene){
  if(typeof MutationObserver!=='undefined'){this.mutations=new MutationObserver(records=>this.changed(records));this.mutations.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','style','hidden']});}
  if(typeof ResizeObserver!=='undefined')this.resize=new ResizeObserver(this.mark);
  window.addEventListener('resize',this.mark);window.addEventListener('scroll',this.mark,true);
  document.fonts?.addEventListener('loadingdone',this.mark);
  for(const name of ['transitionrun','animationstart'])document.addEventListener(name,this.motionStart,true);
  for(const name of ['transitionend','transitioncancel','animationend','animationcancel'])document.addEventListener(name,this.motionEnd,true);
  scene.events.once('shutdown',this.dispose);scene.events.once('destroy',this.dispose);
 }
 private layoutTarget(target:EventTarget|null){return target===this.scene.game.canvas||target===document.documentElement||target===document.body||this.elements.some(e=>e===target||(target instanceof Element&&target.contains(e)));}
 private changed(records:MutationRecord[]){
  for(const record of records){
   if(record.type==='attributes'){
    // Descendant progress-bar widths and cooldown styles do not move the HUD's
    // outer reservation; actual size changes are reported by ResizeObserver.
    if(this.layoutTarget(record.target)){this.mark();return;}
   }else if(this.elements.some(e=>e===record.target||e.contains(record.target)||record.target.contains(e))||[...record.addedNodes,...record.removedNodes].some(n=>n instanceof Element&&(n.matches(selectors)||Boolean(n.querySelector(selectors))))){this.mark();return;}
  }
 }
 read(){
  this.changed(this.mutations?.takeRecords()??[]);
  if(this.scene.scale.width!==this.width||this.scene.scale.height!==this.height){this.width=this.scene.scale.width;this.height=this.scene.scale.height;this.mark();}
  if(!this.dirty&&!this.moving.size)return this.rects;
  this.dirty=false;this.elements=[...document.querySelectorAll<HTMLElement>(selectors)];
  const next=new Set<Element>([this.scene.game.canvas,...this.elements]);
  for(const element of this.observed)if(!next.has(element))this.resize?.unobserve(element);
  for(const element of next)if(!this.observed.has(element))this.resize?.observe(element);
  this.observed=next;
  const canvas=this.scene.game.canvas.getBoundingClientRect(),sx=this.width/Math.max(1,canvas.width),sy=this.height/Math.max(1,canvas.height);
  this.rects=occupied(this.elements).map(r=>({x:(r.x-canvas.left)*sx,y:(r.y-canvas.top)*sy,width:r.width*sx,height:r.height*sy}));return this.rects;
 }
 private dispose=()=>{
  if(this.disposed)return;this.disposed=true;this.mutations?.disconnect();this.resize?.disconnect();this.observed.clear();this.moving.clear();cache.delete(this.scene);
  window.removeEventListener('resize',this.mark);window.removeEventListener('scroll',this.mark,true);document.fonts?.removeEventListener('loadingdone',this.mark);
  for(const name of ['transitionrun','animationstart'])document.removeEventListener(name,this.motionStart,true);
  for(const name of ['transitionend','transitioncancel','animationend','animationcancel'])document.removeEventListener(name,this.motionEnd,true);
  this.scene.events.off('shutdown',this.dispose);this.scene.events.off('destroy',this.dispose);
 };
}
/** Live DOM HUD rectangles in camera pixels, remeasured only after a change. */
export function screenReservations(scene:Phaser.Scene){let hit=cache.get(scene);if(!hit){hit=new HudReservationCache(scene);cache.set(scene,hit);}return hit.read();}

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
