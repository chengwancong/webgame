import type {World} from '../../../packages/simulation/index.ts';
import environment from '../../../packages/asset-manifest/environment.v2.json';
import {mapRoads} from './map-layout.ts';
import {resolvedToken} from './ui/tokens.ts';
const groundImages=new Map<string,HTMLImageElement>();
const ink=(name:Parameters<typeof resolvedToken>[0])=>resolvedToken(name);
export function paintReviewMinimap(canvas:HTMLCanvasElement,world:World,variant:'square'|'radar',size=152,npcs:{name:string;x:number;y:number;main:boolean}[]=[]){
 const density=2;if(canvas.width!==size*density||canvas.height!==size*density){canvas.width=size*density;canvas.height=size*density;}
 const ctx=canvas.getContext('2d')!;ctx.setTransform(density,0,0,density,0,0);ctx.clearRect(0,0,size,size);
 const region=world.region,scale=variant==='square'?(size-16)/Math.max(region.width,region.height):(size/2-8)/12;
 const projection=variant==='square'?{x:(size-region.width*scale)/2,y:(size-region.height*scale)/2}:{x:size/2-world.hero.position.x*scale,y:size/2-world.hero.position.y*scale};
 const point=(x:number,y:number)=>({x:projection.x+x*scale,y:projection.y+y*scale});
 ctx.save();ctx.beginPath();if(variant==='square')ctx.roundRect(1,1,size-2,size-2,8);else ctx.arc(size/2,size/2,size/2-2,0,Math.PI*2);ctx.clip();
 ctx.fillStyle=ink('Color.Minimap.Background');ctx.fillRect(0,0,size,size);
 ctx.fillStyle=ink('Color.Minimap.Terrain');ctx.fillRect(0,0,size,size);
 const chapter=['tundra','abyss','dragonbone'].includes(region.theme);
 const textureUrl=chapter?'/art/chapters/'+region.theme+'-ground.png':environment.textures.grass;let texture=groundImages.get(textureUrl);if(!texture){texture=new Image();texture.src=textureUrl;groundImages.set(textureUrl,texture);}
 if(texture.complete&&texture.naturalWidth){ctx.globalAlpha=chapter ? .9 : .22;ctx.drawImage(texture,0,0,size,size);ctx.globalAlpha=1;}
 // Quiet, deterministic color patches suggest painted ground rather than a debug grid.
 ctx.fillStyle=ink('Color.Minimap.TerrainLight');ctx.globalAlpha=.22;
 for(let i=0;i<12;i++){ctx.beginPath();ctx.ellipse((i*37+17)%size,(i*53+24)%size,14+(i%3)*5,8+(i%4)*3,i*.4,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
 ctx.lineJoin='round';ctx.lineCap='round';
 const routes=mapRoads(region);
 for(const [width,color] of [[2.6,'Color.Minimap.RoadEdge'],[1.8,'Color.Minimap.Road']] as const){
  ctx.strokeStyle=ink(color);ctx.lineWidth=Math.max(2,width*scale);
  for(const route of routes){ctx.beginPath();route.forEach((p,i)=>{const q=point(p.x,p.y);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);});ctx.stroke();}
 }
 for(const obstacle of region.obstacles){
  const p=point(obstacle.x,obstacle.y),w=obstacle.w*scale,h=obstacle.h*scale;
  ctx.fillStyle=ink('Color.Minimap.Obstacle');ctx.beginPath();ctx.roundRect(p.x,p.y,w,h,Math.min(4,w/3,h/3));ctx.fill();
  if(region.theme==='town'){
   ctx.fillStyle=ink('Color.Minimap.Road');ctx.fillRect(p.x+2,p.y+h*.4,Math.max(1,w-4),h*.5);
   ctx.fillStyle=ink('Color.Minimap.Roof');ctx.beginPath();ctx.moveTo(p.x-1,p.y+h*.45);ctx.lineTo(p.x+w*.5,p.y);ctx.lineTo(p.x+w+1,p.y+h*.45);ctx.closePath();ctx.fill();
   ctx.strokeStyle=ink('Color.Minimap.RoofEdge');ctx.lineWidth=1;ctx.stroke();
  }else{ctx.fillStyle=ink(chapter?'Color.TextSecondary':'Color.Minimap.Canopy');ctx.beginPath();ctx.ellipse(p.x+w*.5,p.y+h*.45,w*.47,h*.43,0,0,Math.PI*2);ctx.fill();}
 }
 for(const landmark of region.landmarks){
  const p=point(landmark.x,landmark.y);ctx.lineWidth=1.8;
  if(landmark.kind==='portal'||landmark.kind==='next'||landmark.kind==='boss'){
   ctx.strokeStyle=ink(landmark.kind==='boss'?'Color.Minimap.Boss':'Color.Minimap.Portal');ctx.fillStyle=ink('Color.Minimap.Background');ctx.beginPath();ctx.arc(p.x,p.y,4.4,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.arc(p.x,p.y,1.4,0,Math.PI*2);ctx.fillStyle=ctx.strokeStyle;ctx.fill();
  }else if(landmark.kind==='forge'){ctx.fillStyle=ink('Color.Minimap.Road');ctx.fillRect(p.x-4,p.y-2,8,3);ctx.fillRect(p.x-2,p.y+1,4,3);}else{ctx.fillStyle=ink('Color.Minimap.Safe');ctx.beginPath();ctx.roundRect(p.x-3,p.y-3,6,6,2);ctx.fill();}
 }
 for(const enemy of world.enemies){if(!enemy.alive)continue;const p=point(enemy.position.x,enemy.position.y);
  ctx.fillStyle=ink(enemy.boss?'Color.Minimap.Boss':'Color.Minimap.Enemy');ctx.strokeStyle=ink('Color.Minimap.Background');ctx.lineWidth=1;
  ctx.beginPath();if(enemy.boss){ctx.moveTo(p.x,p.y-4);ctx.lineTo(p.x+4,p.y);ctx.lineTo(p.x,p.y+4);ctx.lineTo(p.x-4,p.y);ctx.closePath();}else if(enemy.elite){ctx.moveTo(p.x,p.y-3);ctx.lineTo(p.x+3,p.y+3);ctx.lineTo(p.x-3,p.y+3);ctx.closePath();}else ctx.arc(p.x,p.y,2.1,0,Math.PI*2);ctx.fill();ctx.stroke();
 }
 for(const npc of npcs){const p=point(npc.x,npc.y);ctx.fillStyle=ink(npc.main?'Color.Minimap.Safe':'Color.Minimap.Roof');ctx.strokeStyle=ink('Color.Minimap.Background');ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(p.x,p.y,3.4,0,Math.PI*2);ctx.fill();ctx.stroke();if(npc.main){ctx.strokeStyle=ink('Color.Minimap.Hero');ctx.beginPath();ctx.arc(p.x,p.y,5.4,0,Math.PI*2);ctx.stroke();}}
 const hero=point(world.hero.position.x,world.hero.position.y);ctx.fillStyle=ink('Color.Minimap.Background');ctx.beginPath();ctx.arc(hero.x,hero.y,5.4,0,Math.PI*2);ctx.fill();
 ctx.fillStyle=ink('Color.Minimap.Hero');ctx.beginPath();ctx.moveTo(hero.x,hero.y-4);ctx.lineTo(hero.x+3.6,hero.y+3);ctx.lineTo(hero.x,hero.y+1.5);ctx.lineTo(hero.x-3.6,hero.y+3);ctx.closePath();ctx.fill();ctx.restore();
 ctx.strokeStyle=ink('Color.Minimap.Frame');ctx.lineWidth=2;ctx.beginPath();if(variant==='square')ctx.roundRect(1,1,size-2,size-2,8);else ctx.arc(size/2,size/2,size/2-2,0,Math.PI*2);ctx.stroke();
}
