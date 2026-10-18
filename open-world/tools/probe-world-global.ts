// 数值来源已迁到 tools/spine；本文件保留历史探针，正式派生请使用 pnpm spine:check 与主干CLI。
import {mkdir,writeFile} from 'node:fs/promises';
import {dungeonContent} from '../packages/content/dungeons.ts';
import {regionById,settings} from '../packages/content/index.ts';
import {worldTables} from '../packages/content/world-tables.ts';
import {starseaIslands} from '../packages/content/starsea/index.ts';
import {characterDungeonDefinition} from '../packages/rules/hardmode-dungeon.ts';
import {standard} from './standard-player-model.ts';
import {stageTimings} from './world-stage-schedule.ts';
import {probeWall} from './wall-probe.ts';
import {probeFieldZone} from './field-zone-probe.ts';
const folder='docs/reviews/open-world-m2-m4/W10',seeds=Array.from({length:20},(_,i)=>41+i*32);await mkdir(folder,{recursive:true});
for(const zone of worldTables.zones.filter(z=>starseaIslands.includes(z.region))){const chapter=worldTables.islands.find(i=>i.region===zone.region)!.chapter,index=worldTables.zones.filter(z=>z.region===zone.region).indexOf(zone),stage=(chapter-1)*3+Math.min(3,Math.floor(index/2)+1),timing=stageTimings[stage-1],waypoint=worldTables.waypoints.find(w=>w.zone===zone.id)!;
 const report=probeFieldZone({region:regionById(zone.region),tables:worldTables,zone:zone.id,character:standard(Math.ceil((zone.levelBand[0]+zone.levelBand[1])/2),new Set(),timing.clear),seeds:[41],seconds:90,chunkCells:settings.chunkSize,start:waypoint});await writeFile(folder+'/field-'+zone.id+'.json',JSON.stringify(report,null,2));console.log('Field '+zone.id+' engaged '+report.summary.engagedShare);
}
for(const timing of stageTimings){const source=dungeonContent.definitions.find(d=>timing.index>18?d.hardmode?.numericStage===timing.index:d.numericStage===timing.index)!;if(!source)throw Error('Missing authored wall '+timing.index);const definition=characterDungeonDefinition(source,timing.index>18),report=probeWall({definition,region:regionById(definition.stages.at(-1)!),character:standard(Math.ceil(timing.level),new Set(),timing.clear),stage:timing.index,seed:41,seeds,samplesPerRatio:seeds.length,maxSeconds:240,worldLine:'starsea'});await writeFile(folder+'/wall-'+timing.index+'.json',JSON.stringify(report,null,2));console.log('Wall '+timing.index+' '+JSON.stringify(report.scenarios.map(s=>({rho:s.requestedRho,...s.summary,passes:s.passes}))));}
