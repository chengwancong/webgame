import Phaser from 'phaser';
import type {Region} from '../../../packages/content/index.ts';
import {mapRoads} from './map-layout.ts';
import environment from '../../../packages/asset-manifest/environment.v2.json';
import {pixelRuntime} from './pixel-texture.ts';
import {pixelTerrainBank,bakePixelGround} from './pixel-ground.ts';
const placements=new WeakMap<object,Map<string,{x:number;y:number;scale:number}>>();
export const groundTexturePlacement=(scene:Phaser.Scene,key:string)=>placements.get(scene)?.get(key);

// Appearance is baked per streamed chunk; navigation remains owned by the map.
export function groundTexture(scene:Phaser.Scene,r:Region,cx:number,cy:number){
 const key=`ground:${r.id}:${cx}:${cy}`;
 if(scene.textures.exists(key))scene.textures.remove(key);
 const texture=scene.textures.createCanvas(key,2562,1442)!;
 const c=texture.context;
 c.setTransform(32,18,-32,18,1281,145);
 c.translate(-cx*32,-cy*32);
 c.beginPath();c.rect(cx*32-4,cy*32-4,40,40);c.clip();
 const chapter=['tundra','abyss','dragonbone'].includes(r.theme);
 const ground=environment.groundByTheme[r.theme as keyof typeof environment.groundByTheme]??'grass';
 const grass=scene.textures.get(ground==='grass'?'meadow-ground':'chapter-ground-'+ground).getSourceImage() as HTMLImageElement;
 const pattern=c.createPattern(grass,'repeat')!;pattern.setTransform(new DOMMatrix().scale(16/grass.width));c.fillStyle=pattern;c.fillRect(cx*32-4,cy*32-4,40,40);
 // A low-contrast cool wash preserves threat and character readability.
 c.fillStyle=chapter?'#00000000':r.theme==='forest'?'#123c583b':r.theme==='rift'?'#7b353422':'#144e4920';c.fillRect(cx*32-4,cy*32-4,40,40);
 const road=scene.textures.get('road-ground').getSourceImage() as HTMLImageElement;const paving=c.createPattern(road,'repeat')!;paving.setTransform(new DOMMatrix().scale(4/road.width));
 const routes=mapRoads(r);
 c.lineJoin='round';c.lineCap='round';
 const theme=environment.themes[r.theme as keyof typeof environment.themes];
 for(const [width,color] of [[2.75,theme?.roadEdge??'#33552b55'],[2.45,'#88723d88'],[2.2,paving]] as const){
 c.strokeStyle=color;c.lineWidth=width;
 c.beginPath();for(const path of routes)path.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.stroke();
 }
 if(theme?.roadWash){c.strokeStyle=theme.roadWash;c.lineWidth=2.2;c.beginPath();for(const path of routes)path.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.stroke();}
 // Small stones follow paths rather than exposing the navigation grid.
 for(const path of routes)for(let i=1;i<path.length;i+=2){const p=path[i],n=(Math.floor(p.x)*73+Math.floor(p.y)*31)%13;
 c.fillStyle=n%2?'#eee0ac88':'#90733e88';c.beginPath();c.ellipse(p.x+(n%3-1)*.35,p.y,.21,.13,n,0,Math.PI*2);c.fill();}
 for(const o of r.obstacles){c.fillStyle='#153e3a44';c.beginPath();c.ellipse(o.x+o.w/2,o.y+o.h/2,o.w*.53,o.h*.53,0,0,Math.PI*2);c.fill();}
 if(r.id==='town'){
 c.fillStyle=paving;c.beginPath();c.ellipse(r.safe.x,r.safe.y,3.3,3.3,0,0,Math.PI*2);c.fill();
 c.strokeStyle='#f2dfaa';c.lineWidth=.13;c.beginPath();c.arc(r.safe.x,r.safe.y,2.8,0,Math.PI*2);c.stroke();
 }
 c.setTransform(1,0,0,1,0,0);
 let positions=placements.get(scene);if(!positions){positions=new Map();placements.set(scene,positions);}positions.delete(key);
 if(pixelRuntime.cellStage>0){
  const ready=()=>scene.events.emit('pixel-ground-ready'),chapterFiles=environment.chapterGround as Record<string,string>,baseFile=ground==='grass'?environment.textures.grass:chapterFiles[ground],base=pixelTerrainBank(baseFile,grass,r.theme+':ground-main',0,ready),roadBank=pixelTerrainBank(environment.textures.road,road,r.theme+':road',1,ready);
  if(base&&roadBank){
   const tags=document.createElement('canvas');tags.width=2562;tags.height=1442;const tag=tags.getContext('2d')!;tag.setTransform(32,18,-32,18,1281,145);tag.translate(-cx*32,-cy*32);tag.beginPath();tag.rect(cx*32-4,cy*32-4,40,40);tag.clip();tag.fillStyle=`rgb(${base.tag.join(',')})`;tag.fillRect(cx*32-4,cy*32-4,40,40);tag.lineJoin='round';tag.lineCap='round';tag.lineWidth=2.2;tag.strokeStyle=`rgb(${roadBank.tag.join(',')})`;tag.beginPath();for(const path of routes)path.forEach((p,i)=>i?tag.lineTo(p.x,p.y):tag.moveTo(p.x,p.y));tag.stroke();if(r.id==='town'){tag.fillStyle=`rgb(${roadBank.tag.join(',')})`;tag.beginPath();tag.ellipse(r.safe.x,r.safe.y,3.3,3.3,0,0,Math.PI*2);tag.fill();}
   const worldX=(cx-cy)*1024-1281,worldY=(cx+cy)*576-145,steps=bakePixelGround(texture.canvas,[base,roadBank],worldX,worldY,r.id,tags);let result=steps.next();while(!result.done)result=steps.next();const output=result.value;
   scene.textures.remove(key);const finished=scene.textures.create(key,output.canvas,output.canvas.width,output.canvas.height)!;finished.add('__BASE',0,0,0,output.canvas.width,output.canvas.height);finished.setFilter(1);positions.set(key,{x:output.x-worldX,y:output.y-worldY,scale:2});return key;
  }
 }
 texture.refresh();return key;
}
