import {randomInt} from 'node:crypto';
import type {CharacterState,Vec} from '../../../packages/contracts/index.ts';
import type {DungeonDefinition} from '../../../packages/contracts/dungeons.ts';
import type {HubDungeonPublic} from '../../../packages/contracts/hub-dungeons.ts';
import type {ExploreState} from '../../../packages/contracts/zhangjian.ts';
import type {Region} from '../../../packages/content/index.ts';
import {hubNodeById} from '../../../packages/content/hub-chart.ts';
import {hubExplore} from '../../../packages/content/zhangjian.ts';
import {cacheId,pickCacheCell,regionDoors} from '../../../packages/rules/zhangjian.ts';
import {ensureProgression} from '../../../packages/rules/deep-progression.ts';
import {requireHub,type HubState} from '../../../packages/rules/hub-state.ts';
import {distance,walkable,findPath,World} from '../../../packages/simulation/index.ts';
import type {FrozenCraftingLoot} from './crafting-loot.ts';
import {awardExplorePets} from './zhangjian-state.ts';

type Prop={id:string;kind:'cache'|'door';x:number;y:number;door?:string;key?:string;room?:Vec;guards?:string[];openedBy?:string[];claimedBy?:string[]};
export type HubExploreRun={players:Record<string,ExploreState>;stages:Record<number,Prop[]>;fallbacks:string[];rewards?:Record<string,string[]>};
const lineDistance=(p:Vec,a:Vec,b:Vec)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return distance(p,{x:a.x+t*dx,y:a.y+t*dy});};
/** Fixed node seed and stable scan order. Reachability is checked before accepting a cell. */
export function prepareExplore(r:Region,d:DungeonDefinition,stage:number,run:HubExploreRun){
 if(run.stages[stage])return;const node=hubNodeById.get(d.hub!.node)!;const props:Prop[]=[],cells:Vec[]=[];
 for(let y=2;y<r.height-2;y++)for(let x=2;x<r.width-2;x++){const p={x:x+.5,y:y+.5};if(walkable(r,p))cells.push(p);}
 const route=[r.safe,...r.landmarks.filter(l=>['clue','objective','npc','beacon'].includes(l.kind)),r.portal];
 const off=(p:Vec)=>Math.min(...route.slice(1).map((b,i)=>lineDistance(p,route[i],b)));
 const reachable=(p:Vec)=>distance(p,r.safe)<1||findPath(r,r.safe,p).length>0;
 const choose=(lo:number,hi:number)=>{const list=cells.filter(p=>off(p)>=lo&&off(p)<=hi);while(list.length){const p=pickCacheCell(node.id,list)!;if(reachable(p))return p;list.splice(list.indexOf(p),1);}return undefined;};
 if(stage===0&&node.kind!=='gate'){
  let p=choose(...hubExplore.cache.offPath);if(!p){p=choose(3,10);run.fallbacks.push(node.id+':D-Z4:'+(p?'3-10':'no-cache'));}
  if(p)props.push({id:'hub-cache-'+node.id,kind:'cache',...p});
 }
 if(stage===d.stages.length-1)for(const door of regionDoors(node.region).filter(x=>x.node===node.id)){
  const candidate=cells.filter(p=>off(p)>=2&&off(p)<=5).sort((a,b)=>distance(a,r.portal)-distance(b,r.portal)).find(reachable)??cells.find(reachable);
  requireHub(candidate,'HUB_EXPLORE_MAP','锁门缺少可到达的位置。');
  const room=cells.filter(p=>distance(p,candidate)>5&&distance(p,r.portal)>5&&[-1,0,1].every(dx=>[-1,0,1].every(dy=>walkable(r,{x:p.x+dx,y:p.y+dy})))).sort((a,b)=>distance(b,r.safe)-distance(a,r.safe)).find(reachable)??candidate;
  props.push({id:'hub-door-'+door.id,kind:'door',...candidate,key:door.key,door:door.id,room});run.fallbacks.push(node.id+':D-Z5:portal-room');
 }
 run.stages[stage]=props;
}
export function explorePublic(w:World|undefined,run:HubExploreRun|undefined,stage:number,player?:string):HubDungeonPublic['explore']{
 if(!w||!run)return;const id=player??[...w.players.keys()][0],progress=run.players[id]??{caches:[],doors:[],keys:[]},actor=w.players.get(id);
 const props=(run.stages[stage]??[]).map(p=>{
  const isDoor=p.kind==='door',opened=isDoor?progress.doors.includes(p.door!):p.door?Boolean(p.claimedBy?.includes(id)):progress.caches.includes(cacheId(p.id.slice('hub-cache-'.length)));
  const state=isDoor?(opened?'open':'locked'):opened?'opened':actor&&distance(actor.hero.position,p)<=hubExplore.cache.revealRadius?'glint':'hidden';
  return {id:p.id,kind:p.kind,x:p.x,y:p.y,state,...(p.key?{key:p.key,keyName:hubExplore.keys[p.key as keyof typeof hubExplore.keys]?.name??p.key}:{})};
 });return {props:props as NonNullable<HubDungeonPublic['explore']>['props']};
}
export function exploreLoot(s:CharacterState,h:HubState,nodeId:string,kind:'cache'|'door',frozen:FrozenCraftingLoot,rng={float:()=>randomInt(1000000)/1000000,int:randomInt}){
 const node=hubNodeById.get(nodeId)!,p=ensureProgression(s),pool=frozen.materials.filter(m=>m.island==='ss-map-'+node.region&&m.tier===(kind==='cache'?'T1':'T2'));
 requireHub(pool.length,'HUB_EXPLORE_LOOT','本航区探索材料尚未配置。');const material=pool[rng.int(0,pool.length)],amount=kind==='cache'?hubExplore.cache.loot.t1:hubExplore.door.loot.t2;
 requireHub((p.materials[material.id]??0)+amount<=material.stack,'CRAFT_MATERIAL','材料堆叠已满，整理后再开。');p.materials[material.id]=(p.materials[material.id]??0)+amount;
 const recipes:string[]=[];if(kind==='cache'&&rng.float()<hubExplore.cache.loot.patternChance){const candidates=frozen.recipes.filter(r=>r.island==='ss-map-'+node.region&&!p.recipes.includes(r.id));if(candidates.length){const id=candidates[rng.int(0,candidates.length)].id;p.recipes.push(id);recipes.push(id);}}
 const gold=kind==='door'?hubExplore.door.loot.gold:0;s.gold+=gold;const rewards:string[]=[];awardExplorePets(s,h,rewards);return {gold,xp:0,material:0,materials:{[material.id]:amount},recipes,rewards};
}
/** Lifetime first-open gate; caller owns character lock and transaction. */
export function claimExploreCache(s:CharacterState,h:HubState,nodeId:string,frozen:FrozenCraftingLoot){h.explore??={caches:[],doors:[],keys:[]};const id=cacheId(nodeId);if(h.explore.caches.includes(id))return;h.explore.caches.push(id);return exploreLoot(s,h,nodeId,'cache',frozen);}
export function unlockExploreDoor(s:CharacterState,h:HubState,nodeId:string,doorId:string,rewards:string[]=[]){
 const node=hubNodeById.get(nodeId)!,door=regionDoors(node.region).find(d=>d.id===doorId&&d.node===nodeId);requireHub(door,'HUB_DOOR','锁门不属于当前节点。');h.explore??={caches:[],doors:[],keys:[]};
 if(h.explore.doors.includes(doorId))return false;const key=hubExplore.keys[door.key];requireHub(h.explore.keys.includes(door.key),'HUB_DOOR_KEY','需要 '+(key?.name??door.key)+'（来自 '+(key?.from??'后续航区')+' 关口）');h.explore.doors.push(doorId);awardExplorePets(s,h,rewards);return true;
}
