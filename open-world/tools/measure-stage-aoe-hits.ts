// 数值来源已迁到 tools/spine；本文件保留历史探针，正式派生请使用 pnpm spine:check 与主干CLI。
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolveBuild} from '../packages/rules/index.ts';
import {versions} from '../packages/contracts/index.ts';
import {standard} from './standard-player-model.ts';
import {stageTimings,levelAtMinutes} from './world-stage-schedule.ts';
import {measureAoeHit} from './world-aoe-hit-probe.ts';
const seed=41,rows=[];
for(const stage of stageTimings){
 const points=[];for(const [phase,minutes]of [['beforeClear',stage.clear-.001],['clear',stage.clear],['midFarm',(stage.clear+stage.end)/2],['end',stage.end]] as const){
  const character=standard(Math.floor(levelAtMinutes(minutes)),new Set(),minutes),resolved=resolveBuild(character),primary=resolved.resolvedSkills.find(s=>['area','zone'].includes(s.kind));if(!primary)throw Error('No actual activated primary AOE at stage '+stage.index+'/'+phase);
  const measured=measureAoeHit(character,primary.id,seed);points.push({phase,minutes,...measured});
 }
 const clear=points.find(p=>p.phase==='clear')!,end=points.find(p=>p.phase==='end')!;rows.push({stage:stage.index,clearLevel:clear.level,endLevel:end.level,clearHit:clear.hitAoe,endHit:end.hitAoe,points});
}
const modelBytes=await readFile('.design/standard-player-20261005/model.json'),directory='docs/reviews/open-world-m2-m4/W3';await mkdir(directory,{recursive:true});
const report={versions:structuredClone(versions),generated:new Date().toISOString(),modelSha256:createHash('sha256').update(modelBytes).digest('hex'),seed,samples:rows.reduce((n,r)=>n+r.points.length,0),rows,limits:['Each clock constructs the actual integer-level expected character with the exact acquisition clock, then executes one primary direct noncritical hit. It does not interpolate across a gear/skill acquisition discontinuity.','The probe controls are identical to world-aoe-hit-probe: a nonattacking zero-armour target and direct critical permission disabled only in the private World.','This measures threshold inputs, not natural acquisition, pack kill rate or formal stage success.']};
await writeFile(directory+'/stage-aoe-hits.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({stages:rows.length,samples:report.samples,smallerFirstPacketAtKey:rows.filter(r=>r.points[0].hitAoe>r.clearHit).map(r=>({stage:r.stage,before:r.points[0].hitAoe,after:r.clearHit,meaning:'Packet size can fall when a real legendary changes one cast into multiple scheduled hits; this is not a power-loss claim.'})),flatFarm:rows.filter(r=>r.endHit<=r.clearHit).map(r=>r.stage)}));
