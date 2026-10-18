/** 对已应用的世界计划作一次独立复测，不回写数值、不修正候选。 */
import {dungeonContent} from '../../packages/content/dungeons.ts';
import {regionById} from '../../packages/content/index.ts';
import {monsterContent} from '../../packages/content/monsters.ts';
import {dungeonSpawns} from '../../packages/rules/dungeon-build.ts';
import {characterDungeonDefinition} from '../../packages/rules/hardmode-dungeon.ts';
import {pressure} from './world.ts';
import {readJson,save,stamp,evidence} from './io.ts';
const review=process.argv[2];if(!review)throw Error('需要评审目录');const sourcePath=review+'/S8/runtime-repair/world/world-summary.json',source=await readJson(sourcePath),tiers=await readJson('packages/content/world-tiers.json'),output=review+'/S8/runtime-repair/world/final-pressure',rows=[];
for(const row of source.measurements){
 const d=dungeonContent.definitions.find(d=>d.id===row.dungeon)!;if(!d)throw Error('副本身份缺失');const def=characterDungeonDefinition(d,row.hard,row.enteringTier),region=regionById(def.stages.at(-1)!),difficulty=def.worldTierScaling?tiers.tiers.find((t:any)=>t.tier===row.enteringTier).monster:{hp:1,attack:1},spawns=dungeonSpawns(region.spawns,def.policy,def.policy.minTier,def.stages.length-1,[],monsterContent,'starsea',difficulty),boss=spawns.find(s=>s.boss)!;
 const observed=pressure(region,spawns),path=output+'/arms/'+d.id+'-'+(row.hard?'hard':'normal')+'.json';await save(path,{...stamp(),seed:41,definition:def,region:region.id,spawns,observed});rows.push({dungeon:d.id,hard:row.hard,actors:spawns.length,hp:boss.hp,targetHp:row.desiredHp,hpError:boss.hp/row.desiredHp-1,rawDps:observed.rawDps,targetDps:row.desiredDps,dpsError:observed.rawDps/row.desiredDps-1,hpScale:def.policy.enemyScale.hp,attackScale:def.policy.enemyScale.attack,hpAtFloor:def.policy.enemyScale.hp===.05,attackAtFloor:def.policy.enemyScale.attack===.05,source:await evidence(path)});
}
await save(output+'-summary.json',{...stamp(),seed:41,source:await evidence(sourcePath),rows,recalibrated:false,maximumHpError:Math.max(...rows.map(r=>Math.abs(r.hpError))),maximumDpsError:Math.max(...rows.map(r=>Math.abs(r.dpsError)))});console.log(JSON.stringify({rooms:rows.length,maximumHpError:Math.max(...rows.map(r=>Math.abs(r.hpError))),maximumDpsError:Math.max(...rows.map(r=>Math.abs(r.dpsError)))}));
