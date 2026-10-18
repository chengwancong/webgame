import {monsterContent,type MonsterContent} from '../content/monsters.ts';
import type {Spawn} from '../contracts/index.ts';
import type {MonsterDifficulty,MonsterRank} from '../contracts/monsters.ts';
export function monsterLevelValues(curve:string,level:number,content:MonsterContent=monsterContent){
 const points=content.curves[curve];if(!points||!Number.isInteger(level)||level<points[0].level||level>points.at(-1)!.level)throw Error('Invalid monster level or curve');
 const end=points.find(p=>p.level>=level)!,start=points[Math.max(0,points.indexOf(end)-1)],ratio=end.level===start.level?0:(level-start.level)/(end.level-start.level);
 return {hp:start.hp+(end.hp-start.hp)*ratio,attack:start.attack+(end.attack-start.attack)*ratio,armor:start.armor+(end.armor-start.armor)*ratio};
}
export function resolveMonsterSpawn(placement:{id:string;template:string;level:number;rank:MonsterRank;x:number;y:number},content:MonsterContent=monsterContent,difficulty:MonsterDifficulty={hp:1,attack:1,armor:1}):Spawn{
 const t=content.templates.find(t=>t.id===placement.template),rank=content.ranks[placement.rank];if(!t||!rank)throw Error('Unknown monster template or rank');
 if(Object.values(difficulty).some(v=>!Number.isFinite(v)||v<=0))throw Error('Invalid monster difficulty');
 const at=monsterLevelValues(t.curve,placement.level,content),reference=monsterLevelValues(t.curve,t.referenceLevel,content);
 const baseStats={hp:t.base.hp*at.hp/reference.hp*rank.hp,attack:t.base.attack*at.attack/reference.attack*rank.attack,armor:t.base.armor*at.armor/reference.armor*rank.armor};
 if(Object.values(baseStats).some(v=>!Number.isFinite(v))||Object.entries(baseStats).some(([key,value])=>!Number.isSafeInteger(Math.round(value*difficulty[key as keyof MonsterDifficulty]))))throw Error('Monster attributes exceed supported precision');
 const role=content.roles[t.role],ai=structuredClone(t.ai);ai.speed*=role.speed;if(t.role==='swarm')ai.aggroRadius=content.roles.swarm.aggroRadius;
 return {id:placement.id,x:placement.x,y:placement.y,name:t.name,art:t.art,kind:t.role==='ranged'&&t.kind==='melee'?'ranged':t.kind,hp:Math.max(1,Math.round(baseStats.hp*difficulty.hp)),attack:Math.max(0,Math.round(baseStats.attack*difficulty.attack)),elite:placement.rank!=='normal',boss:placement.rank==='boss',monster:{version:1,template:t.id,level:placement.level,rank:placement.rank,role:t.role,baseStats,difficulty:{...difficulty},armor:Math.round(baseStats.armor*difficulty.armor),ai,skills:[...t.skills],bossKey:t.bossKey,...(t.bossProfile?{bossProfile:t.bossProfile}:{})}};
}
