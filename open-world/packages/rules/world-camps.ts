import type {Spawn,Vec} from '../contracts/index.ts';
import type {WorldCamp,WorldTables} from '../contracts/open-world.ts';
import type {Region} from '../content/index.ts';
import {resolveMonsterSpawn} from './monster-stats.ts';
import {applyEliteAffixes,rollEliteAffixes} from './elite-affixes.ts';
import {walkable} from '../simulation/navigation.ts';
import {monsterContent,type MonsterContent} from '../content/monsters.ts';
import type {MonsterRole} from '../contracts/monsters.ts';

/** Camps whose centre lies in the observer's chunk or the `reach` chunks around it
 * (expansion plan §3.3: “玩家周围 2 个区块内营地”). Sorted for stable responses. */
export function campsNear(camps:readonly WorldCamp[],region:string,p:Vec,chunkCells:number,reach=2){
 const cx=Math.floor(p.x/chunkCells),cy=Math.floor(p.y/chunkCells);
 return camps.filter(c=>c.region===region&&Math.abs(Math.floor(c.x/chunkCells)-cx)<=reach&&Math.abs(Math.floor(c.y/chunkCells)-cy)<=reach).sort((a,b)=>a.id.localeCompare(b.id));
}

/** Level from the zone band and the camp's place in its zone: camps nearer the
 * island landing take the low end, the farthest the high end; elites +1. Never
 * scales with the player (AGENTS 怪物模型). */
export function campLevel(tables:Pick<WorldTables,'zones'|'camps'>,camp:WorldCamp,landing:Vec,rank:'normal'|'elite'|'rare'){
 const zone=tables.zones.find(z=>z.id===camp.zone);if(!zone)throw Error('Camp zone missing '+camp.id);
 const [low,high]=zone.levelBand,order=tables.camps.filter(c=>c.zone===camp.zone).map(c=>({c,d:Math.hypot(c.x-landing.x,c.y-landing.y)})).sort((a,b)=>a.d-b.d||a.c.id.localeCompare(b.c.id));
 const t=order.length>1?order.findIndex(o=>o.c.id===camp.id)/(order.length-1):0;
 return Math.round(low+(high-low)*t)+(rank==='elite'||rank==='rare'?1:0);
}

/** Largest-remainder allocation preserves the exact declared population. Pack
 * counts are template weights within each role, not an extra population. */
export function campMembers(camp:WorldCamp,content:MonsterContent=monsterContent){
 if(!camp.budget)return camp.pack.flatMap(p=>Array.from({length:p.count},()=>p));
 const budget=camp.budget,roles=Object.entries(budget.roles).filter(([,w])=>w!==undefined&&w>0) as [MonsterRole,number][],sum=roles.reduce((n,[,w])=>n+w,0);
 const allocations=roles.map(([role,w])=>({role,count:Math.floor(budget.count*w/sum),fraction:budget.count*w/sum%1}));
 let left=budget.count-allocations.reduce((n,a)=>n+a.count,0);for(const a of [...allocations].sort((a,b)=>b.fraction-a.fraction||a.role.localeCompare(b.role)))if(left-->0)a.count++;
 return allocations.flatMap(({role,count})=>{const templates=camp.pack.filter(p=>content.templates.find(t=>t.id===p.template)?.role===role).flatMap(p=>Array.from({length:p.count},()=>p));if(!templates.length)throw Error('群体预算缺少角色模板 '+camp.id+'/'+role);return Array.from({length:count},(_,i)=>templates[i%templates.length]);});
}

/** Frozen members of one camp cycle. IDs follow `{camp}:{cycle}:{index}`; members
 * stand on a ring inside the camp radius and must be walkable — no fallback. */
export function campSpawns(region:Region,tables:Pick<WorldTables,'zones'|'camps'>,camp:WorldCamp,cycle:number,difficulty={hp:1,attack:1,armor:1},affixes?:{range:readonly [number,number];seed:number}):Spawn[]{
 if(!Number.isInteger(cycle)||cycle<1)throw Error('Invalid camp cycle');
 const members=campMembers(camp);
 const spawns=members.map((p,i)=>{
  if(p.rank==='boss')throw Error('Field camps cannot hold bosses '+camp.id);
  let point:Vec|undefined;
  for(let n=0;n<24&&!point;n++){const angle=(i+n*.37)*2.399963,r=Math.min(camp.radius-.5,1.4+.35*(i%3)+.1*n),q={x:Math.round((camp.x+Math.cos(angle)*r)*10)/10,y:Math.round((camp.y+Math.sin(angle)*r)*10)/10};if(walkable(region,q,.55))point=q;}
  if(!point)throw Error('Camp member has no walkable place '+camp.id);
  const id=`${camp.id}:${cycle}:${i}`,spawn=resolveMonsterSpawn({id,template:p.template,level:campLevel(tables,camp,region.safe,p.rank),rank:p.rank,...point},undefined,{...difficulty,attack:difficulty.attack*(camp.budget?.attackScale??1)});
  // Elites carry the world tier's affix count, rolled from the frozen cycle seed.
  return affixes&&p.rank==='elite'?applyEliteAffixes(spawn,rollEliteAffixes(affixes.range,affixes.seed,id)):spawn;
 });
 if(camp.budget){const weights=spawns.map(s=>(camp.budget!.healthWeights?.[s.monster!.role??'normal']??monsterContent.roles[s.monster!.role??'normal'].hpShare)*monsterContent.ranks[s.monster!.rank].hp),total=weights.reduce((n,w)=>n+w,0),health=Math.round(camp.budget.health*difficulty.hp),distributable=health-spawns.length;if(distributable<0)throw Error('群体生命预算无法分配 '+camp.id);const values=weights.map(w=>1+Math.floor(distributable*w/total));let left=health-values.reduce((n,v)=>n+v,0);for(const i of weights.map((w,i)=>({i,f:distributable*w/total%1})).sort((a,b)=>b.f-a.f||a.i-b.i))if(left-->0)values[i.i]++;spawns.forEach((s,i)=>{s.hp=values[i];s.monster!.baseStats.hp=s.hp/difficulty.hp;});}
 return spawns;
}

/** `{camp}:{cycle}:{index}` → camp/cycle, or undefined for non-camp sources. */
export function campSource(id:string){const m=/^(.+):(\d+):(\d+)$/.exec(id);return m&&!/^(q|gate|night|activity):/.test(id)?{camp:m[1],cycle:Number(m[2])}:undefined;}

/** Server-side plausibility of a reported observer position. A position that
 * could not be reached since the last trusted one never triggers a refresh; it
 * is not rejected either (sampled anti-cheat, prefer false negatives). */
export function plausibleMove(last:{x:number;y:number;at:number}|undefined,p:Vec,now:number,speed:number){
 if(!last)return true;const seconds=Math.max(0,(now-last.at)/1000);
 return Math.hypot(p.x-last.x,p.y-last.y)<=speed*seconds*1.5+8;
}
