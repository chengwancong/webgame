// 数值来源已迁到 tools/spine；本文件保留历史探针，正式派生请使用 pnpm spine:check 与主干CLI。
import {writeFile,mkdir} from 'node:fs/promises';
import {dungeonContent} from '../packages/content/dungeons.ts';
import {regionById} from '../packages/content/index.ts';
import {World} from '../packages/simulation/index.ts';
import {dungeonSpawns} from '../packages/rules/dungeon-build.ts';
import {characterDungeonDefinition} from '../packages/rules/hardmode-dungeon.ts';
import {standard} from './standard-player-model.ts';
import {stageTimings} from './world-stage-schedule.ts';
import {resolveBuild} from '../packages/rules/index.ts';
import {versions} from '../packages/contracts/index.ts';
const seeds=[41,73,107],rows=[];
for(const timing of stageTimings){const source=dungeonContent.definitions.find(d=>timing.index>18?d.hardmode?.numericStage===timing.index:d.numericStage===timing.index);if(!source)throw Error('Missing authored stage '+timing.index);const definition=characterDungeonDefinition(source,timing.index>18),samples=[];
 for(const seed of seeds){const state=standard(Math.ceil(timing.level),new Set(),timing.clear-.001),build=resolveBuild(state);let elapsed=0,elites=0,kills=0,cleared=0,damageTaken=0,casts=0,previous:World|undefined;
  for(const [stage,id]of definition.stages.entries()){const region=regionById(id),spawns=dungeonSpawns(region.spawns,definition.policy,definition.policy.minTier,stage,[],undefined,'starsea'),w=new World(region,build.stats,build.resolvedSkills,spawns,[],seed+stage);if(previous){w.hero.hp=previous.hero.hp;w.hero.mana=previous.hero.mana;}w.setMode('auto');w.radius=Math.max(region.width,region.height);const initial=new Map(spawns.map(e=>[e.id,e]));
   while(w.enemies.some(e=>e.alive)&&w.hero.hp>0&&w.tick<180*30){w.step();for(const event of w.events){if(event.type==='hit_resolved'&&event.id===w.playerId)damageTaken+=event.amount??0;if(event.type==='cast_started'&&event.id===w.playerId)casts++;}for(const kill of w.kills.splice(0)){kills++;const e=initial.get(kill.source_id);if(e?.elite&&!e.boss)elites++;}}
   elapsed+=w.tick/30;previous=w;if(w.hero.hp<=0||w.enemies.some(e=>e.alive))break;cleared++;
  }
  samples.push({seed,seconds:elapsed,kills,elites,damageTaken,casts,clearedStages:cleared,completed:cleared===definition.stages.length,survived:previous!.hero.hp>0,requestedSkills:state.skills,skillRanks:state.skillRanks,build:build.stats});
 }
 const seconds=samples.reduce((n,s)=>n+s.seconds,0),elites=samples.reduce((n,s)=>n+s.elites,0);rows.push({stage:timing.index,dungeon:definition.id,elitePerMinute:seconds>0?elites/seconds*60:0,samples});console.log('Actual stage '+timing.index+' source rate '+rows.at(-1)!.elitePerMinute);
}
await mkdir('docs/reviews/open-world-m2-m4/W10',{recursive:true});await writeFile('docs/reviews/open-world-m2-m4/W10/key-source-basis.json',JSON.stringify({versions,seeds,rows,limits:['Actual authored rooms, monsters, obstacles and before-clear standard schedule; no player attribute grants beyond the declared standard acquisition design.','New stage Worlds preserve HP and mana; transport/loading time is excluded. Dead and timed-out routes stay in the frequency denominator.','This source frequency probe does not prove natural acquisition or PostgreSQL awards. Actual source settlement/replay/crafting are covered separately by the real PG player flows.']},null,2));
