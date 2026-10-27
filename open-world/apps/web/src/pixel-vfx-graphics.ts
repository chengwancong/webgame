/** Native-grid drawing for event-owned FX geometry. Never samples or alters a source image. */
import type Phaser from 'phaser';
import {pixelRuntime} from './pixel-texture.ts';import {pixelFeedbackTint} from './pixel-actor-view.ts';
type Point={x:number;y:number};
const cell=()=>pixelRuntime.cellStage===1?1:2,grid=(n:number)=>Math.round(n/cell()),stage=(n:number)=>n*cell();
export function wirePixelVfx(g:Phaser.GameObjects.Graphics){
 const raw=g as any,names=['fillStyle','lineStyle','fillRect','strokeRect','fillEllipse','strokeEllipse','fillCircle','strokeCircle','fillTriangle','strokeTriangle','beginPath','moveTo','lineTo','closePath','fillPath','strokePath','fillPoints','strokePoints','lineBetween'],original=Object.fromEntries(names.map(k=>[k,raw[k]?.bind(g)]));
 let fill={color:0xffffff,alpha:1},line={color:0xffffff,alpha:1,width:2},points:Point[]=[],closed=false,starts=new Set<number>();
 const color=(c:any)=>pixelFeedbackTint(typeof c==='number'?c:0xffffff);
 function rectangle(x:number,y:number,w:number,h:number,c:number,a:number){if(a<.25||!w||!h)return;original.fillStyle(color(c),1);original.fillRect(stage(x),stage(y),stage(w),stage(h));}
 function segment(a:Point,b:Point){let x=grid(a.x),y=grid(a.y),bx=grid(b.x),by=grid(b.y),dx=Math.abs(bx-x),dy=-Math.abs(by-y),sx=x<bx?1:-1,sy=y<by?1:-1,e=dx+dy;const width=Math.max(1,grid(line.width)),offset=Math.floor(width/2);let steps=0;
  while(steps++<4096){rectangle(x-offset,y-offset,width,width,line.color,line.alpha);if(x===bx&&y===by)break;const e2=e*2;if(e2>=dy){e+=dy;x+=sx;}if(e2<=dx){e+=dx;y+=sy;}}
 }
 function polygon(vertices:Point[]){if(vertices.length<3)return;const p=vertices.map(v=>({x:grid(v.x),y:grid(v.y)})),lo=Math.min(...p.map(v=>v.y)),hi=Math.max(...p.map(v=>v.y));
  const view=(g.scene?.cameras?.main as Phaser.Cameras.Scene2D.Camera|undefined)?.worldView,minY=view?Math.max(lo,grid(view.y)-8):lo,maxY=view?Math.min(hi,grid(view.bottom)+8):Math.min(hi,lo+2048);
  for(let y=minY;y<=maxY;y++){const cuts:number[]=[];for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a.y>y+.5)!==(b.y>y+.5))cuts.push(a.x+(y+.5-a.y)*(b.x-a.x)/(b.y-a.y));}cuts.sort((a,b)=>a-b);for(let n=0;n+1<cuts.length;n+=2){const x=Math.ceil(cuts[n]-.5),end=Math.ceil(cuts[n+1]-.5);rectangle(x,y,end-x,1,fill.color,fill.alpha);}}
 }
 function ellipse(cx:number,cy:number,w:number,h:number,stroke=false){const x=grid(cx),y=grid(cy),rx=Math.max(1,grid(w/2)),ry=Math.max(1,grid(h/2)),edge=Math.max(1,grid(line.width)),style=stroke?line:fill;const view=g.scene?.cameras?.main.worldView;
  for(let row=Math.max(-ry,view?grid(view.y)-y-8:-1024);row<=Math.min(ry,view?grid(view.bottom)-y+8:1024);row++){const outer=Math.floor(rx*Math.sqrt(Math.max(0,1-row*row/(ry*ry))));if(!stroke||Math.abs(row)>=ry-edge||rx<=edge){rectangle(x-outer,y+row,outer*2+1,1,style.color,style.alpha);continue;}const inner=Math.floor((rx-edge)*Math.sqrt(Math.max(0,1-row*row/((ry-edge)*(ry-edge)))));rectangle(x-outer,y+row,Math.max(1,outer-inner),1,style.color,style.alpha);rectangle(x+inner+1,y+row,Math.max(1,outer-inner),1,style.color,style.alpha);}
 }
 const operations:Record<string,(...args:any[])=>void>={
  fillStyle:(c:number,a=1)=>{fill={color:c,alpha:a};},lineStyle:(w=1,c=0xffffff,a=1)=>{line={width:w,color:c,alpha:a};},
  fillRect:(x:number,y:number,w:number,h:number)=>rectangle(grid(x),grid(y),Math.max(1,grid(w)),Math.max(1,grid(h)),fill.color,fill.alpha),
  strokeRect:(x:number,y:number,w:number,h:number)=>{segment({x,y},{x:x+w,y});segment({x:x+w,y},{x:x+w,y:y+h});segment({x:x+w,y:y+h},{x,y:y+h});segment({x,y:y+h},{x,y});},
  fillEllipse:(x:number,y:number,w:number,h:number)=>ellipse(x,y,w,h),strokeEllipse:(x:number,y:number,w:number,h:number)=>ellipse(x,y,w,h,true),fillCircle:(x:number,y:number,r:number)=>ellipse(x,y,r*2,r*2),strokeCircle:(x:number,y:number,r:number)=>ellipse(x,y,r*2,r*2,true),
  fillTriangle:(x1:number,y1:number,x2:number,y2:number,x3:number,y3:number)=>polygon([{x:x1,y:y1},{x:x2,y:y2},{x:x3,y:y3}]),
  strokeTriangle:(x1:number,y1:number,x2:number,y2:number,x3:number,y3:number)=>{const p=[{x:x1,y:y1},{x:x2,y:y2},{x:x3,y:y3}];for(let n=0;n<3;n++)segment(p[n],p[(n+1)%3]);},
  beginPath:()=>{points=[];closed=false;starts=new Set;},moveTo:(x:number,y:number)=>{starts.add(points.length);points.push({x,y});},lineTo:(x:number,y:number)=>{points.push({x,y});},closePath:()=>{closed=true;},fillPath:()=>polygon(points),strokePath:()=>{for(let n=1;n<points.length;n++)if(!starts.has(n))segment(points[n-1],points[n]);if(closed&&points.length>1)segment(points.at(-1)!,points[0]);},
  fillPoints:(p:Point[])=>polygon(p),strokePoints:(p:Point[],close=false)=>{for(let n=1;n<p.length;n++)segment(p[n-1],p[n]);if(close&&p.length>1)segment(p.at(-1)!,p[0]);},lineBetween:(x1:number,y1:number,x2:number,y2:number)=>segment({x:x1,y:y1},{x:x2,y:y2})
 };
 for(const name of names)raw[name]=(...args:any[])=>{if(!pixelRuntime.cellStage)return original[name]?.(...args)??g;operations[name](...args);return g;};return g;
}
