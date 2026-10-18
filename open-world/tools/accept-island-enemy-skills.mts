import '../packages/content/open-world/index.ts';
import {writeFile} from 'node:fs/promises';
import {regionById} from '../packages/content/index.ts';
import {worldTables} from '../packages/content/world-tables.ts';
import {islandSkillPlan} from '../packages/content/island-enemy-combat.ts';
import {probeFieldZone} from './field-zone-probe.ts';
import {standard} from './standard-player-model.ts';
import {resolveBuild} from '../packages/rules/index.ts';
import {resolveMonsterSpawn} from '../packages/rules/monster-stats.ts';
import {World,walkable} from '../packages/simulation/index.ts';
const rows=[];
for(const island of islandSkillPlan.islands){
 const region=regionById(island.region),zone=worldTables.zones.find(z=>z.region===region.id)!,level=[6,12,19,25][island.chapter-1],character=standard(level),build=resolveBuild(character);
 const field=probeFieldZone({region,tables:worldTables,zone:zone.id,character,seeds:[41],seconds:40,chunkCells:16});
 const bossId=Object.keys(island.bindings).find(id=>id.includes('boss'))!,spawn=resolveMonsterSpawn({id:'accept-boss',template:bossId,level,rank:'boss',x:12,y:10});
 // One adjacent, stationary defensive sample: real build, no extra HP or healing.
 const arena={...structuredClone(region),width:32,height:32,safe:{x:10,y:10},portal:{x:2,y:2},obstacles:[],landmarks:[],spawns:[spawn]},world=new World(arena,build.stats,[],[spawn],[],41);world.setMode('manual');
 let incoming=0,casts=0;const warned=new Set<string>(),unwarned:string[]=[];
 for(let n=0;n<island.targetTtd.boss*30&&world.hero.hp>0;n++){world.step();for(const e of world.events){if(e.type==='danger_started'&&e.skill){warned.add(e.skill);casts++;}if(e.type==='hit_resolved'&&e.id===world.playerId){incoming+=e.amount??0;if(e.skill?.startsWith('island_')&&!warned.has(e.skill))unwarned.push(e.skill);}}}
 const boss={seconds:world.tick/30,alive:world.hero.hp>0,incoming,casts,unwarned,ttdLowerBound:world.tick/30};
 rows.push({island:island.key,seed:41,level,field:field.summary,boss,pass:field.summary.deaths===0&&boss.alive&&casts>0&&unwarned.length===0});
}
await writeFile('docs/island-enemy-skills-acceptance.json',JSON.stringify({rows,controls:'one fixed seed per island; real field-zone probe + one stationary actual-build boss sample; no HP rescaling; no capacity scan'},null,2)+'\n');
console.log(JSON.stringify(rows));if(rows.some(r=>!r.pass))process.exitCode=1;
