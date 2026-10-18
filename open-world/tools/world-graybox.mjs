import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
/** Deterministic technical fixture. Authored production world rows belong to
 * 世界.xlsx; this fixture neither changes an island nor migrates a character. */
export function generateGraybox({seed=37,width=512,height=512,campsPerZone=25,rockCount=1500}={}){
 if(width!==512||height!==512)throw Error('M0 fixture requires 512 × 512');
 let state=seed>>>0;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const land=(p,margin=0)=>((p.x-256)/(224-margin))**2+((p.y-256)/(224-margin))**2<=1;
 const zones=Array.from({length:6},(_,i)=>({id:`m0-wind-z${i+1}`,name:`风栖灰盒分区${i+1}`,rect:{x:i%3*512/3,y:Math.floor(i/3)*256,w:512/3,h:256},levelBand:[1,3]}));
 const zoneAt=p=>zones.find(z=>p.x>=z.rect.x&&p.x<z.rect.x+z.rect.w&&p.y>=z.rect.y&&p.y<z.rect.y+z.rect.h);
 const safe={x:112,y:256};
 const waypoints=zones.map((z,i)=>({id:`m0-wind-w${i+1}`,zone:z.id,x:Math.round(z.rect.x+z.rect.w/2),y:Math.round(z.rect.y+z.rect.h/2)}));
 waypoints.push({id:'m0-wind-w7',zone:zoneAt(safe).id,...safe},{id:'m0-wind-w8',zone:zoneAt({x:400,y:256}).id,x:400,y:256});
 const camps=[];
 for(const zone of zones)for(let i=0;i<campsPerZone;i++){
  let p;for(let t=0;t<10000;t++){const candidate={x:Math.round(zone.rect.x+10+random()*(zone.rect.w-20)),y:Math.round(zone.rect.y+10+random()*(zone.rect.h-20))};if(land(candidate,10)&&Math.hypot(candidate.x-safe.x,candidate.y-safe.y)>12&&camps.every(c=>Math.hypot(c.x-candidate.x,c.y-candidate.y)>=12)&&waypoints.every(w=>Math.hypot(w.x-candidate.x,w.y-candidate.y)>7)){p=candidate;break;}}
  if(!p)throw Error('Cannot fit camp '+zone.id+' '+i);camps.push({id:`m0-wind-c${camps.length+1}`,zone:zone.id,...p,radius:4,respawnSeconds:90,pack:[{template:'ss-mon-wind-hound',rank:'normal',count:4,level:2}]});
 }
 const obstacles=[];for(let y=0;y<height;y++){
  const offset=y+.5-256,extent=Math.abs(offset)<224?Math.sqrt(224**2-offset**2):0,left=Math.max(0,Math.floor(256-extent)),right=Math.min(width,Math.ceil(256+extent));
  if(left>0)obstacles.push({x:0,y,w:left,h:1});if(right<width)obstacles.push({x:right,y,w:width-right,h:1});
 }
 const rocks=[],marks=[...camps,...waypoints,safe];
 for(let n=0;n<rockCount;n++){let p;for(let t=0;t<100;t++){const q={x:Math.round(32+random()*448),y:Math.round(32+random()*448)};if(land(q,6)&&Math.abs(q.x-256)>4&&Math.abs(q.y-256)>4&&marks.every(m=>Math.hypot(q.x-m.x,q.y-m.y)>7)&&rocks.every(m=>Math.hypot(q.x-m.x,q.y-m.y)>3)){p=q;break;}}if(!p)continue;rocks.push(p);obstacles.push({...p,w:1.4,h:1.4});}
 const spawns=camps.flatMap(c=>Array.from({length:4},(_,i)=>({id:`${c.id}:1:${i}`,template:c.pack[0].template,level:2,rank:'normal',x:c.x+(i%2?1.5:-1.5),y:c.y+(i<2?-1.5:1.5)})));
 const road=(horizontal)=>({resource:'ss-scene-road',widthCells:3,points:Array.from({length:449},(_,i)=>horizontal?[32+i,256]:[256,32+i])});
 return {meta:{kind:'technical-graybox',seed,version:1,production:false},zones,camps,waypoints,
  region:{id:'ow-graybox-wind',name:'风栖岛 · 技术灰盒',subtitle:'M0',width,height,theme:'starsea-wind',safe,portal:safe,boss:false,auto:true,roam:true,activationRadius:40,obstacles,spawns:[],landmarks:[]},
  placements:spawns,map:{id:'ow-graybox-wind',name:'风栖岛 · 技术灰盒',width,height,groundResource:'ss-scene-ground-wind',backdropResource:'ss-scene-sky',landmarks:waypoints,roads:[road(true),road(false)],decorations:rocks.map((p,i)=>({id:`m0-rock-${i}`,resourceId:'ss-scene-rocks',...p,displayWidth:70,depthMode:'y',occlusion:'foreground'})),boundary:{resourceId:'ss-scene-cliff',stepCells:4,thicknessCells:2}}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const options=process.argv.includes('--input')?JSON.parse(await readFile(process.argv[process.argv.indexOf('--input')+1],'utf8')):{};
 const fixture=generateGraybox(options),out=resolve(dirname(fileURLToPath(import.meta.url)),'../.design/open-world-m0/graybox.json');await mkdir(dirname(out),{recursive:true});await writeFile(out,JSON.stringify(fixture));
 // Geometry-only copy for the API and QA client field runtime. Camps, zones and
 // waypoints stay authored in 世界.xlsx; this file carries no spawns.
 const geometry=resolve(dirname(fileURLToPath(import.meta.url)),'../packages/content/open-world/ow-graybox-wind.json');await mkdir(dirname(geometry),{recursive:true});await writeFile(geometry,JSON.stringify({meta:fixture.meta,region:fixture.region,map:fixture.map}));console.log(JSON.stringify({output:out,seed:fixture.meta.seed,zones:fixture.zones.length,camps:fixture.camps.length,waypoints:fixture.waypoints.length,spawns:fixture.placements.length,obstacles:fixture.region.obstacles.length}));
}
