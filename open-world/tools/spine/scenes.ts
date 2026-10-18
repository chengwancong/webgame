import {benchSample,targets,type ResolvedPlayer} from './bench.ts';
import {scenarioParameters,spineScenes,officialRatios,median,type SpineAnchor,type SpineScene} from './math.ts';
import {referencePlayer} from './player.ts';
import {pacingProfiles} from '../pacing/profiles.ts';
import {pacingBuildTargets,pacingWeights} from '../../packages/content/pacing-targets.ts';
import {readJson,save,evidence,stamp} from './io.ts';
export function sceneSample(player:ResolvedPlayer,scene:SpineScene,seed:number,anchor:SpineAnchor){
 const params=scenarioParameters(anchor);
 if(scene==='safety'){const sample=benchSample(player,'AV',seed,anchor.r50*20);return {...sample,scene,build:player.id,score:sample.deathSeconds===null&&sample.value!==null?1/(1-sample.value+.02):null};}
 if(scene==='survival'){const sample=benchSample(player,'EHP',seed,anchor.r50*20,{linearPressure:true});return {...sample,scene,build:player.id,score:sample.deathSeconds??sample.seconds};}
 const spawns=targets(player.level,scene==='clear'?12:1);for(const spawn of spawns){spawn.hp=scene==='single'?params.single.hp:scene==='clear'?params.clear.hpEach:params.elite.hp;spawn.boss=scene==='single';spawn.elite=scene!=='clear';if(spawn.monster)spawn.monster.rank=scene==='single'?'boss':scene==='clear'?'normal':'elite';}
 const sample=benchSample(player,scene==='clear'?'dense':'D1',seed,anchor.r50*20,{spawns,seconds:params[scene].seconds,stopWhen:'clear'});
 return {...sample,scene,build:player.id,score:sample.clearSeconds!==null?1/sample.clearSeconds:null};
}
export async function measureScenes(output:string){
 const anchor=(await readJson('tools/spine/data/spine-anchor.json')).anchor as SpineAnchor,rows:any[]=[];
 for(const profile of pacingProfiles){const {player}=referencePlayer(profile.id);for(const seed of [41,42,43])for(const scene of spineScenes){const path=output+'/arms/scenes-'+profile.id+'-'+seed+'-'+scene+'.json';let row;try{row=await readJson(path);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;row=sceneSample(player,scene,seed,anchor);await save(path,row);}rows.push(row);}console.log('五场景完成 '+profile.id);}
 const failed=rows.filter(r=>r.score===null),ratios:any[]=failed.length?pacingProfiles.map(profile=>({build:profile.id,ratios:Object.fromEntries(spineScenes.map(scene=>{const samples=[41,42,43].map(seed=>{const group=rows.filter(r=>r.scene===scene&&r.seed===seed),own=group.find(r=>r.build===profile.id);return group.length!==8||group.some(r=>r.score===null)?null:own.score/median(group.map(r=>r.score));});return [scene,samples.some(v=>v===null)?null:median(samples as number[])];}))})):officialRatios(rows,pacingProfiles.map(p=>p.id),[41,42,43]);
 const matrix=ratios.map(row=>{const target=pacingBuildTargets.find(t=>t.id===row.build)!,cells=spineScenes.map(scene=>({scene,actual:row.ratios[scene],target:target[scene],error:row.ratios[scene]===null?null:row.ratios[scene]/target[scene]-1,passed:row.ratios[scene]!==null&&Math.abs(row.ratios[scene]/target[scene]-1)<=target.tolerance}));const budget=spineScenes.some(s=>row.ratios[s]===null)?null:spineScenes.reduce((n,s)=>n+row.ratios[s]*pacingWeights[s],0);return {...row,cells,budget,budgetPassed:budget!==null&&Math.abs(budget-1)<=.05,seconds:Object.fromEntries(spineScenes.map(s=>[s,median(rows.filter(r=>r.build===row.build&&r.scene===s).map(r=>r.seconds))]))};});
 const summary={...stamp(),samples:rows.length,anchor,matrix,failed:failed.map(r=>({build:r.build,scene:r.scene,seed:r.seed,failed:r.failed})),raw:await Promise.all(rows.map(r=>evidence(output+'/arms/scenes-'+r.build+'-'+r.seed+'-'+r.scene+'.json')))};
 await save(output+'/scenes-summary.json',summary);return {summary,rows};
}
