import '../packages/content/open-world/index.ts';
import {mkdir,writeFile} from 'node:fs/promises';
import {worldTables} from '../packages/content/world-tables.ts';
import {regionById,settings} from '../packages/content/index.ts';
import {standard} from './standard-player-model.ts';
import {stageTimings} from './world-stage-schedule.ts';
import {probeFieldZone} from './field-zone-probe.ts';
const n=Number(process.argv[2]),island=worldTables.islands.find(i=>i.chapter===n);if(!island)throw Error('An authored chapter is required');
const region=regionById(island.region),zones=worldTables.zones.filter(z=>z.region===island.region),rows=[];
for(const [i,zone]of zones.entries()){
 const stage=(n-1)*3+Math.min(3,Math.floor(i/2)+1),clock=stageTimings[stage-1].clear,character=standard(Math.ceil((zone.levelBand[0]+zone.levelBand[1])/2),new Set(),clock),waypoint=worldTables.waypoints.find(w=>w.zone===zone.id)!;
 const report=probeFieldZone({region,tables:worldTables,zone:zone.id,character,seeds:[41],seconds:90,chunkCells:settings.chunkSize,start:{x:waypoint.x,y:waypoint.y}});rows.push({stage,clock,start:'Registered zone waypoint',report});
}
const directory='docs/reviews/open-world-m2-m4/W'+(n+3),output=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??directory+'/field-efficiency.json';await mkdir(directory,{recursive:true});
const acceptance=rows.map(r=>{const actual=r.report.summary.engagedShare,target=.5,gap=Math.max(0,(target-actual)/target);return {zone:r.report.zone.id,survived:r.report.summary.deaths===0,actual,target,relativeGap:gap,engagementPassed:actual>=target||gap<=.05,decision:actual>=target?'threshold met':gap<=.05?'2026-10-07 user tolerance: within5%, accepted':'outside user tolerance'};});
await writeFile(output,JSON.stringify({chapter:n,region:island.region,seed:41,samplesPerZone:1,seconds:90,source:'Actual authored camps and World from the zone waypoint; actual standard build at the declared stage-clear clock.',acceptance,rows},null,2)+'\n');console.log(JSON.stringify({chapter:n,output,acceptance,zones:rows.map(r=>({zone:r.report.zone.id,...r.report.summary}))}));
