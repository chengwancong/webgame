import type {WorldCamp,WorldTables} from '../packages/contracts/open-world.ts';
import type {Region} from '../packages/content/index.ts';
import {monsterContent} from '../packages/content/monsters.ts';
import {campMembers,campSpawns} from '../packages/rules/world-camps.ts';
import {walkable} from '../packages/simulation/index.ts';
/** A capacity comparison keeps the requested population fixed. It preserves
 * authored template/role weights and aggregate health per member, rather than
 * replacing the actual camp with a homogeneous low-HP target set. */
export function campForPopulation(camp:WorldCamp,count:number):WorldCamp{
 if(!Number.isInteger(count)||count<1)throw Error('Capacity population must be a positive integer');
 const next=structuredClone(camp),original=campMembers(camp).length;if(!original)throw Error('Authored camp has no executable members');
 if(next.budget){next.budget.health=Math.round(next.budget.health*count/original);next.budget.count=count;return next;}
 const total=next.pack.reduce((n,p)=>n+p.count,0),allocated=next.pack.map((p,i)=>({i,count:Math.floor(p.count*count/total),fraction:p.count*count/total%1}));
 let left=count-allocated.reduce((n,p)=>n+p.count,0);for(const p of [...allocated].sort((a,b)=>b.fraction-a.fraction||a.i-b.i))if(left-->0)p.count++;
 next.pack=next.pack.flatMap((p,i)=>allocated[i].count?[{...p,count:allocated[i].count}]:[]);return next;
}
export function actualCampCapacity(region:Region,tables:WorldTables,camp:WorldCamp,count:number){
 if(camp.region!==region.id)throw Error('Capacity camp belongs to another actual region');
 const members=campMembers(camp);if(!members.some(m=>monsterContent.templates.find(t=>t.id===m.template)?.role==='swarm'))throw Error('Wait for the main integration to adopt actual swarm templates in the authored camp');
 const scaled=campForPopulation(camp,count),spawns=campSpawns(region,tables,scaled,1);if(spawns.length!==count)throw Error('Capacity population differs from requested target count');
 let start;
 for(const radius of [camp.radius+4,camp.radius+6])for(let n=0;n<16&&!start;n++){const point={x:camp.x+Math.cos(n*Math.PI/8)*radius,y:camp.y+Math.sin(n*Math.PI/8)*radius};if(walkable(region,point,1))start=point;}
 if(!start)throw Error('No actual walkable camp measurement start');
 return {region:{...structuredClone(region),safe:start,spawns:[]},spawns,authored:structuredClone(camp),scaled,start,roles:Object.fromEntries(['swarm','normal','ranged'].map(role=>[role,spawns.filter(s=>s.monster?.role===role).length]))};
}
