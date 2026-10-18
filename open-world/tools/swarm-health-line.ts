import type {MonsterContent} from '../packages/content/monsters.ts';
import {resolveMonsterContent} from '../packages/content/monsters.ts';
import {monsterLevelValues} from '../packages/rules/monster-stats.ts';
export type SwarmMeasureRow={level:number;full:{hitAoe:number}};
export type SwarmFlowStage={index:number;level:number;F:number|null;end:number};
export type NumericTimeline={level:number;minutes:number}[];
export type StageAoeHit={stage:number;clearHit:number;endHit:number;clearLevel:number;endLevel:number};
function primaryHit(rows:readonly SwarmMeasureRow[],level:number){const a=Math.floor(level),b=Math.min(60,a+1),low=rows.find(r=>r.level===a)!,high=rows.find(r=>r.level===b)!;return Math.exp(Math.log(low.full.hitAoe)*(1-(level-a))+Math.log(high.full.hitAoe)*(level-a));}
function levelAt(timeline:NumericTimeline,minutes:number){const end=timeline.find(p=>p.minutes>=minutes);if(!end)return 60;const i=timeline.indexOf(end),start=timeline[Math.max(0,i-1)];return Math.min(60,start.level+(end.level-start.level)*(minutes-start.minutes)/(end.minutes-start.minutes||1));}
/** One-shot lines consume real noncritical primary hits. They are distinct from
 * the normal-creature curve and the group-budget role weighting. */
export function deriveSwarmLines(content:MonsterContent,rows:readonly SwarmMeasureRow[],stages:readonly SwarmFlowStage[],timeline:NumericTimeline,phaseHits?:readonly StageAoeHit[]){
 if(rows.length!==60||rows.some((r,i)=>r.level!==i+1||!Number.isFinite(r.full.hitAoe)||r.full.hitAoe<=0)||stages.length!==24||stages.some((s,i)=>s.index!==i+1||!Number.isFinite(s.level)||s.level<1||s.level>60||!Number.isFinite(s.end)||s.F!==null&&(!Number.isFinite(s.F)||s.F<0))||timeline.length<61||timeline.some((p,i)=>p.level!==i+1||!Number.isFinite(p.minutes)||i>0&&p.minutes<=timeline[i-1].minutes))throw Error('Swarm lines require complete measured hits,24 stages and the numeric owner timeline');
 if(phaseHits&&(phaseHits.length!==24||phaseHits.some((r,i)=>r.stage!==i+1||![r.clearHit,r.endHit,r.clearLevel,r.endLevel].every(v=>Number.isFinite(v)&&v>0))))throw Error('Stage one-shot lines require all24 exact-clock primary-hit measurements');
 const authoredLines=stages.map(stage=>{
  const actual=phaseHits?.find(r=>r.stage===stage.index),hit=actual?.clearHit??primaryHit(rows,stage.level),endLevel=actual?.endLevel??levelAt(timeline,stage.end),endHit=actual?.endHit??primaryHit(rows,endLevel);
  // The terminal stage has no following wall/F. Use its measured local primary
  // hit growth, placing the threshold at the geometric halfway point.
  const farmLogGrowth=stage.F??Math.max(0,2*Math.log(endHit/hit)),hp=hit*Math.exp(farmLogGrowth/4);
  return {stage:stage.index,clearLevel:stage.level,measuredCharacterClearLevel:actual?.clearLevel??null,endLevel,hitSource:actual?'actual stage clock':'interpolated level model',hitAtClear:hit,hitAtEnd:endHit,farmLogGrowth,farmLogSource:stage.F===null?'terminal-stage measured local primary-hit growth':'numeric-flow F',hp};
 });
 // User decision2026-10-07: one-shot priority, suffix minimum. This creates
 // one nondecreasing declaration, never a pair of competing thresholds.
 let minimum=Infinity;const lines=authoredLines.map(line=>({...line}));for(let i=lines.length-1;i>=0;i--){minimum=Math.min(minimum,lines[i].hp);lines[i].hp=minimum;}
 const next=structuredClone(content),normal=next.curves.starsea;if(!normal||normal.length!==60)throw Error('Derive the complete normal curve before swarm lines');
 const previousSwarm=next.curves['starsea-swarm']?structuredClone(next):undefined;
 const projection:{level:number;stage:number;hp:number}[]=[];
 next.curves['starsea-swarm']=normal.map(p=>{const line=[...lines].reverse().find(s=>s.clearLevel<=p.level)??lines[0];projection.push({level:p.level,stage:line.stage,hp:line.hp});return {...p,hp:line.hp};});
 const changed=[];
 for(const template of next.templates.filter(t=>t.role==='swarm'&&(t.curve==='starsea'||t.curve==='starsea-swarm'))){
  const before={curve:template.curve,base:{...template.base}};
  if(template.curve==='starsea-swarm'&&previousSwarm){const previous=monsterLevelValues(template.curve,template.referenceLevel,previousSwarm),current=monsterLevelValues(template.curve,template.referenceLevel,next);template.base.attack*=current.attack/previous.attack;}
  template.curve='starsea-swarm';template.base.hp=monsterLevelValues(template.curve,template.referenceLevel,next).hp;template.base.armor=0;
  changed.push({template:template.id,before,after:{curve:template.curve,base:{...template.base}}});
 }
 resolveMonsterContent(next);return {content:next,lines,projection,changed,decision:'User decision2026-10-07: one-shot priority; each stage swarm HP is the minimum one-shot line from that stage through the final stage (suffix minimum), producing one nondecreasing curve.',limits:['Primary hits are separate actual zero-armour noncritical measurements. Swarm templates explicitly use zero armour; no damage multiplier is introduced.','Fixed authored camp budgets consume this same suffix-minimum line. Acceptance is one fixed-seed pack/wall pass after formal adoption; a failed pass gets one documented tuning pass.']};
}
