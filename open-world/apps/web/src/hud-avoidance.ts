import type Phaser from 'phaser';
import {resolvedToken} from './ui/tokens.ts';
export type HudRect={x:number;y:number;width:number;height:number};
export const overlaps=(a:HudRect,b:HudRect,gap=0)=>a.x<b.x+b.width+gap&&a.x+a.width+gap>b.x&&a.y<b.y+b.height+gap&&a.y+a.height+gap>b.y;
/** One measured placement policy for notifications, world labels and quest guidance. */
export function placeHudRect(preferred:HudRect,reserved:HudRect[],viewport:HudRect,gap:number):HudRect|undefined{
 const clamp=(r:HudRect)=>({...r,x:Math.max(viewport.x,Math.min(viewport.x+viewport.width-r.width,r.x)),y:Math.max(viewport.y,Math.min(viewport.y+viewport.height-r.height,r.y))});
 if(preferred.width>viewport.width||preferred.height>viewport.height)return;
 const candidates=[preferred,...reserved.flatMap(r=>[
  {...preferred,x:r.x+r.width+gap},{...preferred,x:r.x-preferred.width-gap},
  {...preferred,y:r.y+r.height+gap},{...preferred,y:r.y-preferred.height-gap},
 ])].map(clamp).sort((a,b)=>Math.hypot(a.x-preferred.x,a.y-preferred.y)-Math.hypot(b.x-preferred.x,b.y-preferred.y));
 return candidates.find(c=>reserved.every(r=>!overlaps(c,r,gap)));
}
const selectors='#vitals,#tracker,#starsea-hud,#minimapbox,#skillbar,#sysbar,.hud-wallet,#feed,#pausebox,#toast,#dungeon-hud';
function occupied(except?:Element){return [...document.querySelectorAll<HTMLElement>(selectors)].filter(e=>e!==except&&(e.childElementCount>0||Boolean(e.textContent?.trim()))&&!e.hidden&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden'&&Number(getComputedStyle(e).opacity)!==0).map(e=>e.getBoundingClientRect()).filter(r=>r.width>0&&r.height>0).map(r=>({x:r.left,y:r.top,width:r.width,height:r.height}));}
const cache=new WeakMap<object,{at:number;rects:HudRect[]}>();
export function screenReservations(scene:Phaser.Scene){
 const now=performance.now(),hit=cache.get(scene);if(hit&&now-hit.at<100)return hit.rects;
 const canvas=scene.game.canvas.getBoundingClientRect(),sx=scene.scale.width/Math.max(1,canvas.width),sy=scene.scale.height/Math.max(1,canvas.height);
 const rects=occupied().map(r=>({x:(r.x-canvas.left)*sx,y:(r.y-canvas.top)*sy,width:r.width*sx,height:r.height*sy}));cache.set(scene,{at:now,rects});return rects;
}
export function placeWorldRect(scene:Phaser.Scene,bounds:HudRect,extra:HudRect[]=[],maxShift?:number){
 const camera=scene.cameras.main,z=camera.zoom,view=camera.worldView,screen={x:(bounds.x-view.x)*z,y:(bounds.y-view.y)*z,width:bounds.width*z,height:bounds.height*z};
 // Never clamp an off-screen item's name into the HUD (e.g. old loot at the top edge).
 if(screen.x+screen.width/2<0||screen.x+screen.width/2>camera.width||screen.y+screen.height/2<0||screen.y+screen.height/2>camera.height)return;
 const extraScreen=extra.map(r=>({x:(r.x-view.x)*z,y:(r.y-view.y)*z,width:r.width*z,height:r.height*z}));
 const placed=placeHudRect(screen,[...screenReservations(scene),...extraScreen],{x:0,y:0,width:camera.width,height:camera.height},parseFloat(resolvedToken('Space.2')));
 if(placed&&Math.hypot(placed.x-screen.x,placed.y-screen.y)>(maxShift??Math.max(screen.height*3,parseFloat(resolvedToken('Space.16')))))return;
 return placed?{x:view.x+placed.x/z,y:view.y+placed.y/z,width:bounds.width,height:bounds.height}:undefined;
}
export function placeNotification(node:HTMLElement){
 const rect=node.getBoundingClientRect(),canvas=document.querySelector('#game canvas')?.getBoundingClientRect();if(!rect.width||!canvas)return;
 const placed=placeHudRect({x:rect.left,y:rect.top,width:rect.width,height:rect.height},occupied(node),{x:canvas.left,y:canvas.top,width:canvas.width,height:canvas.height},parseFloat(resolvedToken('Space.2')));
 if(placed){node.style.left=placed.x+rect.width/2+'px';node.style.top=placed.y+'px';}
}
