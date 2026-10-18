/** Prints each plane stage as ASCII (rock/floor/path/pillar, S safe, P portal, m/E/B enemies, C chest) for layout review.
 * `SEED=n` prints the random run layout for that seed instead of the authored one. */
import {buildPlaneStage,planeStageSpecs} from '../packages/content/plane-scenes.ts';
import {generatePlaneStage} from '../packages/content/plane-layouts.ts';
for(const authored of planeStageSpecs.filter(s=>!process.argv[2]||s.id.includes(process.argv[2]))){
 const {region,map,spec}=process.env.SEED?generatePlaneStage(authored.id,Number(process.env.SEED)):buildPlaneStage(authored,undefined,{spawns:!process.env.NO_SPAWNS}),rows=Array.from({length:map.height},(_,y)=>map.cells.slice(y*map.width,(y+1)*map.width).split(''));
 const mark=(p:{x:number;y:number},c:string)=>{rows[Math.floor(p.y)][Math.floor(p.x)]=c;};
 for(const p of spec.pack)mark(p.center,'*');for(const s of region.spawns)mark(s,s.boss?'B':s.elite?'E':'m');for(const c of spec.chests)mark(c,'C');mark(region.safe,'S');mark(region.portal,'P');
 const counts=map.pieces.reduce<Record<string,number>>((n,p)=>(n[p.part]=(n[p.part]??0)+1,n),{});
 console.log(`\n${spec.id} ${spec.name} obstacles=${region.obstacles.length} spawns=${region.spawns.length} floor=${[...map.cells].filter(c=>c==='.'||c===',').length}`);console.log(JSON.stringify(counts));
 console.log(rows.map(r=>r.join('').replaceAll('#',' ')).join('\n'));
}
