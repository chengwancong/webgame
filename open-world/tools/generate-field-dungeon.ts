import {dungeonChestSchema} from '../packages/contracts/dungeon-chests.ts';
import {z} from 'zod';
import {islandArtPool} from './island-art-pool.ts';
import {resolveMonsterSpawn} from '../packages/rules/monster-stats.ts';
import {monsterRankSchema} from '../packages/contracts/monsters.ts';
import {NavigationGrid} from '../packages/simulation/navigation-grid.ts';
import type {Region} from '../packages/content/index.ts';
const id=z.string().min(1),point=z.object({x:z.number().finite(),y:z.number().finite()}).strict();
export const fieldDungeonStageSchema=z.object({id:id.regex(/^ss-dg-/),name:id,island:id,artIsland:id,chapter:z.number().int().min(1).max(6),stage:z.number().int().min(1).max(3),seed:z.number().int(),level:z.number().int().positive(),safe:point,portal:point,pack:z.array(z.object({template:id,rank:monsterRankSchema,count:z.number().int().positive(),center:point,radius:z.number().positive()}).strict()).min(1),boss:z.boolean(),chests:z.array(dungeonChestSchema).default([]),rockCount:z.number().int().nonnegative().default(8),backdrop:id}).strict();
export function generateFieldDungeonStage(raw:unknown,catalogues:Parameters<typeof islandArtPool>[0]){
 const spec=fieldDungeonStageSchema.parse(raw),width=48,height=48,obstacles:Region['obstacles']=[{x:0,y:0,w:48,h:1},{x:0,y:47,w:48,h:1},{x:0,y:0,w:1,h:48},{x:47,y:0,w:1,h:48}],nature=islandArtPool(catalogues,spec.artIsland,'nature'),ground=islandArtPool(catalogues,spec.artIsland,'ground'),boundary=islandArtPool(catalogues,spec.artIsland,'boundary'),roads=islandArtPool(catalogues,spec.artIsland,'road');if(!nature.length||!ground.length||!boundary.length||!roads.length)throw Error('地城缺少本岛正式资源 '+spec.id);
 let state=spec.seed>>>0;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const decorations:{id:string;resourceId:string;x:number;y:number;displayWidth:number;depthMode:string}[]=[];
 for(let i=0;i<spec.rockCount;i++){const at={x:4+Math.floor(random()*40),y:4+Math.floor(random()*40)};if([spec.safe,spec.portal,...spec.chests,...spec.pack.map(p=>p.center)].some(p=>Math.hypot(p.x-at.x,p.y-at.y)<7))continue;const resource=nature[i%nature.length];obstacles.push({x:at.x-.4,y:at.y-.4,w:.8,h:.8});decorations.push({id:spec.id+':terrain:'+i,resourceId:resource.id,...at,displayWidth:resource.runtime.displayWidth??90,depthMode:'y'});}
 const grid=new NavigationGrid(width,height,obstacles,.55),spawns=spec.pack.flatMap((pack,p)=>Array.from({length:pack.count},(_,i)=>{let at;for(let j=0;j<24;j++){const angle=(i+j*.37)*2.399963,candidate={x:pack.center.x+Math.cos(angle)*pack.radius,y:pack.center.y+Math.sin(angle)*pack.radius};if(grid.walkable(candidate)&&grid.path(spec.safe,candidate).length){at=candidate;break;}}if(!at)throw Error('地城敌人不可达 '+spec.id);return resolveMonsterSpawn({id:spec.id+':'+p+':'+i,template:pack.template,rank:pack.rank,level:spec.level,...at});}));
 if(!grid.walkable(spec.safe)||!grid.walkable(spec.portal)||!grid.path(spec.safe,spec.portal).length)throw Error('地城起终点不可达 '+spec.id);if(spec.boss&&!spawns.some(s=>s.boss)||!spec.boss&&spawns.some(s=>s.boss))throw Error('地城首领阶段与配置不符 '+spec.id);
 for(const chest of spec.chests)if(!grid.walkable(chest)||!grid.path(spec.safe,chest).length)throw Error('地城宝箱不可达 '+chest.id);
 const region:Region={keyChests:spec.chests,id:spec.id,name:spec.name,subtitle:'野外地城',width,height,theme:spec.artIsland,safe:spec.safe,portal:spec.portal,boss:spec.boss,auto:true,obstacles,spawns,landmarks:[]};
 const path=grid.path(spec.safe,spec.portal).map(p=>[p.x,p.y] as [number,number]),map={id:spec.id,name:spec.name,width,height,groundResource:ground[0].id,backdropResource:spec.backdrop,landmarks:[],roads:[{resource:roads[0].id,widthCells:3,points:path}],decorations,boundary:{resourceId:boundary[0].id,stepCells:4,thicknessCells:2}};
 return {region,map,spec,report:{id:spec.id,width,height,level:spec.level,enemies:spawns.length,bosses:spawns.filter(s=>s.boss).length,reachable:true}};
}
