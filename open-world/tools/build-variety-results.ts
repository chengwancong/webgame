import assert from 'node:assert/strict';
export const varietyScenarios=['clear','single','survival'] as const;
export type VarietyScenario=typeof varietyScenarios[number];
export type VarietyMeasurement={build:string;seed:number;scenario:VarietyScenario;score:number|null;casts:number;damage:number;failure:string|null;censored:boolean};
export type VarietyTarget={id:string;focus:VarietyScenario};
const median=(values:number[])=>{const sorted=[...values].sort((a,b)=>a-b),mid=Math.floor(sorted.length/2);return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;};

/** Analyse already executed measurements. Encounter and score definitions belong
 * to the benchmark, and must be supplied explicitly in its accompanying report.
 * Failed/missing samples cannot disappear from means or balance acceptance. */
export function assessBuildVariety(targets:VarietyTarget[],seeds:number[],samples:VarietyMeasurement[]){
 assert.equal(targets.length,17,'Expected all 17 target builds');assert.equal(new Set(targets.map(b=>b.id)).size,17,'Duplicate target build');
 assert(seeds.length>0&&new Set(seeds).size===seeds.length&&seeds.every(Number.isSafeInteger),'Invalid declared seeds');
 const targetsById=new Map(targets.map(p=>[p.id,p])),seen=new Set<string>();
 for(const row of samples){assert(targetsById.has(row.build),'Unknown executed build');assert(seeds.includes(row.seed),'Undeclared seed');assert(varietyScenarios.includes(row.scenario),'Unknown measured scenario');
  assert(row.score===null||Number.isFinite(row.score)&&row.score>=0,'Invalid measured score');assert(Number.isInteger(row.casts)&&row.casts>=0&&Number.isFinite(row.damage)&&row.damage>=0,'Invalid combat observations');
  const key=[row.build,row.seed,row.scenario].join(':');assert(!seen.has(key),'Duplicate executed sample');seen.add(key);
 }
 const missing=targets.flatMap(t=>seeds.flatMap(seed=>varietyScenarios.filter(scenario=>!seen.has([t.id,seed,scenario].join(':'))).map(scenario=>({build:t.id,seed,scenario}))));
 const failures=samples.filter(r=>r.failure||r.score===null||r.casts===0||r.damage===0).map(r=>({build:r.build,seed:r.seed,scenario:r.scenario,reason:r.failure??(r.score===null?'missing_score':r.casts===0?'no_cast':'no_damage')}));
 const means=targets.map(target=>({id:target.id,focus:target.focus,scores:Object.fromEntries(varietyScenarios.map(scenario=>{const group=samples.filter(s=>s.build===target.id&&s.scenario===scenario);return [scenario,group.length===seeds.length&&group.every(s=>s.score!==null&&!s.failure&&s.casts>0&&s.damage>0)?group.reduce((n,s)=>n+s.score!,0)/group.length:null];})) as Record<VarietyScenario,number|null>}));
 const medians=Object.fromEntries(varietyScenarios.map(scenario=>{const values=means.map(m=>m.scores[scenario]).filter((n):n is number=>n!==null);return [scenario,values.length===targets.length?median(values):null];})) as Record<VarietyScenario,number|null>;
 const cutoff=Object.fromEntries(varietyScenarios.map(scenario=>{const values=means.map(m=>m.scores[scenario]).filter((n):n is number=>n!==null).sort((a,b)=>b-a);return [scenario,values.length===targets.length?values[2]:null];})) as Record<VarietyScenario,number|null>;
 const rows=means.map(row=>{const ratios=Object.fromEntries(varietyScenarios.map(s=>[s,row.scores[s]!==null&&medians[s]!==null&&medians[s]!>0?row.scores[s]!/medians[s]!:null])) as Record<VarietyScenario,number|null>;
  const topThree=varietyScenarios.filter(s=>row.scores[s]!==null&&cutoff[s]!==null&&row.scores[s]!>=cutoff[s]!);
  const censored=samples.filter(s=>s.build===row.id&&s.scenario===row.focus&&s.censored).map(s=>s.seed),ratio=ratios[row.focus];
  return {...row,ratios,topThree,censoredFocusSeeds:censored,inBand:ratio!==null&&ratio>=.8&&ratio<=1.25&&censored.length===0};
 });
 const outsideBand=rows.filter(r=>!r.inBand).map(r=>({id:r.id,focus:r.focus,ratio:r.ratios[r.focus],censoredSeeds:r.censoredFocusSeeds})),dominatesAllThree=rows.filter(r=>r.topThree.length===3).map(r=>r.id);
 return {accepted:!missing.length&&!failures.length&&!outsideBand.length&&!dominatesAllThree.length,declaredSamples:targets.length*seeds.length*varietyScenarios.length,executedSamples:samples.length,missing,failures,medians,topThreeCutoffs:cutoff,rows,outsideBand,dominatesAllThree,tiePolicy:'At least the third-place score qualifies; tied leaders cannot be hidden by array order.',censorPolicy:'A censored focus score is a bound, so it cannot establish accepted balance.'};
}
