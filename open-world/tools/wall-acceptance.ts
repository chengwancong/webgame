type Scenario={requestedRho:number;observedRho:number;threshold:number|null;summary:{invalid:number;winRate:number;meanWinSeconds:number|null};passes:boolean|null};
/** Acceptance of existing real World samples. The user permits a relative
 * threshold gap within5%; speed uses paired measured time, never an assumed70s. */
export function wallAcceptance(scenarios:Scenario[]){
 for(const scenario of scenarios){const required=scenario.threshold,gap=required?Math.max(0,(required-scenario.summary.winRate)/required):null;scenario.passes=required===null?null:scenario.summary.invalid===0&&Math.abs(scenario.observedRho/scenario.requestedRho-1)<=.05&&gap!==null&&gap<=.05;}
 const base=scenarios.find(s=>s.requestedRho===1)?.summary.meanWinSeconds;
 return scenarios.filter(s=>s.requestedRho===1.2).map(s=>{const actual=s.summary.meanWinSeconds,target=base==null?null:base*.83,gap=target&&actual!==null?Math.max(0,(actual-target)/target):null;return {rho:s.requestedRho,baselineSeconds:base??null,actualSeconds:actual,targetSeconds:target,relativeGap:gap,passes:gap!==null&&gap<=.05,decision:gap===null?'no valid paired wins':gap<=.05?'actual paired baseline, including user5% tolerance':'outside tolerance'};});
}
