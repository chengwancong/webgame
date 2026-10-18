import {z} from 'zod';
import source from '../content/world-night.json';
import type {CharacterState,Vec} from '../contracts/index.ts';
import {regionById,fieldRegionInfo} from '../content/index.ts';
import {worldZoneAt} from '../content/world-tables.ts';
import {starseaCampaign,starseaIslands,placementLevel} from '../content/starsea/index.ts';
import {resolveMonsterSpawn} from './monster-stats.ts';
import {walkable,findPath} from '../simulation/navigation.ts';
export const worldNightPolicy=z.object({killThreshold:z.number().int().positive(),spawnDistance:z.number().positive(),maxSpawnDistance:z.number().positive(),count:z.number().int().positive(),eliteCount:z.number().int().nonnegative()}).strict().refine(p=>p.eliteCount<=p.count&&p.maxSpawnDistance>=p.spawnDistance).parse(source);
export function nightZone(region:string,position:Vec){return fieldRegionInfo(region)?worldZoneAt(region,position):undefined;}
/** All positions are real reachable points beyond the declared distance. The
 * frozen invasion AI notices its owner immediately and walks toward the hero. */
export function worldNightSpawns(s:CharacterState,region:string,hero:Vec,cycle:number,policy=worldNightPolicy){
 const map=regionById(region),island=fieldRegionInfo(region)?.island??region,chapter=starseaIslands.indexOf(island)+1,zone=nightZone(region,hero);
 const pool=starseaCampaign.monsters.filter(t=>t.chapter.includes(chapter));
 return Array.from({length:policy.count},(_,i)=>{
  let at:Vec|undefined;for(let ring=policy.spawnDistance;ring<=policy.maxSpawnDistance&&!at;ring+=2)for(let n=0;n<32;n++){const angle=(n+i*7+cycle)*Math.PI/16,p={x:hero.x+Math.cos(angle)*ring,y:hero.y+Math.sin(angle)*ring};if(walkable(map,p,.6)&&findPath(map,p,hero,.6).length){at=p;break;}}
  if(!at)throw Error('星潮夜没有距玩家足够远的可达出现点 '+region);
  const rank=i<policy.eliteCount?'elite' as const:'normal' as const,templates=pool.filter(t=>t.rank===rank),template=templates[i%templates.length];if(!template)throw Error('星潮夜缺少本岛模板 '+island);
  const spawn=resolveMonsterSpawn({id:`night:${region}:${cycle}:${i}`,template:template.id,rank,level:zone?zone.levelBand[1]:placementLevel(chapter,1,rank,Boolean(s.starsea?.hardmode)),...at});
  spawn.monster!.ai.aggroRadius=policy.maxSpawnDistance+2;return spawn;
 });
}
