import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {findPath,walkable,distance} from '../packages/simulation/navigation.ts';
import type {Region} from '../packages/content/index.ts';
import type {Vec} from '../packages/contracts/index.ts';

export const corridorHalfWidth=6;
const bodyPadding=.55; // Same as the existing findPath default.
type Origin={id:string;point:Vec};
export type FieldCorridor={id:string;region:string;width:number;height:number;halfWidth:number;bodyPadding:number;target:Vec;returnPoint:Vec;
 sources:{id:string;point:Vec;referencePath:Vec[];path:Vec[]}[];runs:[number,number,number][];cells:number};
const point=(p:Vec)=>({x:p.x,y:p.y});
function segmentDistance(p:Vec,a:Vec,b:Vec){
 const dx=b.x-a.x,dy=b.y-a.y,n=dx*dx+dy*dy,t=n?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/n)):0;
 return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
}
export function corridorContains(c:Pick<FieldCorridor,'runs'|'width'|'height'>,p:Vec){
 if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.y<0||p.x>=c.width||p.y>=c.height)return false;
 const x=Math.floor(p.x),y=Math.floor(p.y);return c.runs.some(([row,start,end])=>row===y&&x>=start&&x<end);
}
/** Authoring-only derivation. Does not mutate maps, permissions, progress or rewards. */
export function buildFieldCorridor(region:Region,id:string,origins:Origin[],target:Vec,returnPoint:Vec):FieldCorridor{
 if(!id||!origins.length||new Set(origins.map(s=>s.id)).size!==origins.length)throw Error('Invalid corridor identity/origins');
 for(const p of [target,returnPoint,...origins.map(s=>s.point)])if(!walkable(region,p,bodyPadding))throw Error('Unwalkable corridor endpoint: '+id);
 const sources=origins.map(s=>{
  const path=distance(s.point,target)<1e-8?[point(target)]:findPath(region,s.point,target,bodyPadding).map(point);
  if(!path.length||distance(path.at(-1)!,target)>1e-6)throw Error('Unreachable corridor target: '+id+'/'+s.id);
  return {id:s.id,point:point(s.point),referencePath:[point(s.point),...path],path:[point(s.point),...path]};
 }).sort((a,b)=>a.id.localeCompare(b.id));
 const W=region.width,H=region.height,mask=new Uint8Array(W*H);
 for(const source of sources)for(let i=1;i<source.path.length;i++){
  const a=source.path[i-1],b=source.path[i],r=corridorHalfWidth;
  for(let y=Math.max(0,Math.floor(Math.min(a.y,b.y)-r));y<Math.min(H,Math.ceil(Math.max(a.y,b.y)+r));y++)
   for(let x=Math.max(0,Math.floor(Math.min(a.x,b.x)-r));x<Math.min(W,Math.ceil(Math.max(a.x,b.x)+r));x++){
    const p={x:x+.5,y:y+.5};
    if(segmentDistance(p,a,b)<=r+1e-9&&walkable(region,p,bodyPadding))mask[y*W+x]=1;
   }
 }
 const runs:[number,number,number][]=[];
 for(let y=0;y<H;y++)for(let x=0;x<W;){if(!mask[y*W+x]){x++;continue;}const start=x;while(x<W&&mask[y*W+x])x++;runs.push([y,start,x]);}
 const corridor:FieldCorridor={id,region:region.id,width:W,height:H,halfWidth:corridorHalfWidth,bodyPadding,target:point(target),returnPoint:point(returnPoint),sources,runs,cells:mask.reduce((n,c)=>n+c,0)};
 // Validate complete continuous paths, not just endpoint reachability.
 for(const source of sources)for(let i=1;i<source.path.length;i++){
  const a=source.path[i-1],b=source.path[i],steps=Math.max(1,Math.ceil(distance(a,b)*4));
  for(let j=0;j<=steps;j++){const p={x:a.x+(b.x-a.x)*j/steps,y:a.y+(b.y-a.y)*j/steps};
   if(!walkable(region,p,bodyPadding))throw Error('Reference path crosses blocked terrain: '+id);}
 }
 if(!corridorContains(corridor,returnPoint))throw Error('Return point outside corridor: '+id);
 // Grid connectivity uses the same no-corner-cutting rule as navigation.
 const key=(p:Vec)=>Math.floor(p.y)*W+Math.floor(p.x),queue=[key(target)],seen=new Uint8Array(W*H),parent=new Int32Array(W*H).fill(-1);seen[queue[0]]=1;
 for(let at=0;at<queue.length;at++){const k=queue[at],x=k%W,y=Math.floor(k/W);
  for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
   const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=W||ny>=H)continue;
   const next=ny*W+nx;if(seen[next]||!mask[next]||dx&&dy&&(!mask[y*W+nx]||!mask[ny*W+x]))continue;seen[next]=1;parent[next]=k;queue.push(next);
  }
 }
 if([...sources.map(s=>s.point),returnPoint].some(p=>!seen[key(p)]))throw Error('Disconnected corridor: '+id);
 // findPath may straighten across a partially blocked tile whose centre is blocked.
 // Keep its geometry as provenance, but expose an executable cell-centre route
 // inside the validated whitelist; never whitelist the wall to fit a shortcut.
 for(const source of sources){
  const path=[point(source.point)];let k=key(source.point);
  for(;;){path.push({x:k%W+.5,y:Math.floor(k/W)+.5});if(k===key(target))break;k=parent[k];if(k<0)throw Error('Missing connected path: '+id);}
  path.push(point(target));source.path=path;
  for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],steps=Math.max(1,Math.ceil(distance(a,b)*4));
   for(let j=0;j<=steps;j++){const p={x:a.x+(b.x-a.x)*j/steps,y:a.y+(b.y-a.y)*j/steps};
    if(!walkable(region,p,bodyPadding)||!corridorContains(corridor,p))throw Error('Grid path escapes walkable corridor: '+id);}
  }
 }
 return corridor;
}
export async function generateFieldCorridors(gateId?:string){
 // Required: standalone content/index still contains legacy 64x64 islands until registered.
 await import('../packages/content/open-world/index.ts');
 const {worldTables}=await import('../packages/content/world-tables.ts'),{regionById,fieldRegionInfo}=await import('../packages/content/index.ts');
 const gates=worldTables.planeGates.filter(g=>!gateId||g.id===gateId);
 if(!gates.length)throw Error('No authored plane gate matched');
 const corridors=gates.map(g=>{
  const region=regionById(g.region),info=fieldRegionInfo(g.region);
  if(!info||info.qa||region.width!==512||region.height!==512)throw Error('Formal 512-grid required: '+g.region);
  const origins:Origin[]=[{id:g.region+':spawn',point:region.safe},...worldTables.waypoints.filter(w=>w.region===g.region&&w.kind==='landing').map(w=>({id:w.id,point:w}))];
  return {...buildFieldCorridor(region,g.id,origins,g,{x:g.returnX,y:g.returnY}),phase:{when:g.when??null,until:g.until??null,requires:g.requires??null},plane:g.plane,kind:g.kind};
 }).sort((a,b)=>a.id.localeCompare(b.id));
 const files=['config/json/world.json','packages/content/open-world/production.json','packages/simulation/navigation.ts','packages/simulation/navigation-grid.ts','tools/build-field-corridors.ts'];
 const sourceHashes=Object.fromEntries(await Promise.all(files.map(async file=>[file,createHash('sha256').update(await readFile(file)).digest('hex')])));
 return {schemaVersion:1,generator:'build-field-corridors/v1',sourceHashes,scope:'Authored plane gates only; geometry is not entry permission. Runtime phase/entry checks and freeze activation remain separate.',corridors};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename)){
 const arg=(name:string)=>process.argv.find(a=>a.startsWith('--'+name+'='))?.slice(name.length+3);
 const result=await generateFieldCorridors(arg('gate')),out=resolve(arg('out')??'packages/content/field-corridors.json');
 try{const old=JSON.parse(await readFile(out,'utf8'));if(old.generator!==result.generator)throw Error('Refusing unrelated output overwrite: '+out);}
 catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 await mkdir(dirname(out),{recursive:true});await writeFile(out,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({output:out,corridors:result.corridors.map(c=>({id:c.id,origins:c.sources.length,cells:c.cells,runs:c.runs.length})),runtimeActivated:false}));
}
