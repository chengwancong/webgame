import {it,expect} from 'vitest';
import {summarizePacingRows} from '../tools/pacing/measure.ts';
import {assessPacingMatrix,validationSeeds} from '../tools/pacing/validate.ts';
import {pacingProfiles} from '../tools/pacing/profiles.ts';
import {pacingScenes} from '../packages/contracts/pacing.ts';
it('默认三个种子，拒绝重复或无效种子',()=>{expect(validationSeeds([])).toEqual([41,42,43]);expect(validationSeeds(['--seeds=41'])).toEqual([41]);expect(()=>validationSeeds(['--seeds=41,41'])).toThrow();expect(()=>validationSeeds(['--seeds=x'])).toThrow();});
it('每种子归一、中位数抗离群，同时保留失败和零触发',()=>{
 const rows=pacingProfiles.flatMap((p,i)=>pacingScenes.flatMap(scene=>[41,42,43].map(seed=>({bd:p.id,seed,scene,variant:'full',score:i===0?(seed===43?100:2):1,failed:null,rules:{probe:{count:seed===43?0:2}},build:{stats:{rules:[{id:'probe',source:p.aspect}]}}}))));
 const summary=summarizePacingRows(rows,{single:.2,clear:.3,survival:.1,elite:.15,safety:.25}),first=summary.matrix[0];expect(first.ratios.single).toBe(2);expect(first.ranges.single.max).toBe(100);expect(first.mechanisms.probe.single.min).toBe(0);expect(assessPacingMatrix(summary.matrix)[0].mechanismPassed).toBe(false);expect(assessPacingMatrix(summary.matrix)[0].scenePassed).toBe(false);
 rows.find(r=>r.bd===pacingProfiles[0].id&&r.seed===42&&r.scene==='single')!.score=null as any;
 const failed=summarizePacingRows(rows,{single:1}).matrix[0];expect(failed.ratios.single).toBeNull();expect(failed.failures).toHaveLength(1);
});
it('区分场景中位数加权预算与逐种子预算的中位数',()=>{
 const rows=pacingProfiles.flatMap((p,i)=>pacingScenes.flatMap(scene=>[41,42,43].map(seed=>({bd:p.id,seed,scene,variant:'full',score:i===0&&(seed===41&&scene==='single'||seed===42&&scene==='clear')?10:1,failed:null,rules:{},build:{stats:{rules:[]}}}))));
 const result=summarizePacingRows(rows,{single:.5,clear:.5}).matrix[0];expect(result.budget).toBe(1);expect(result.budgetRange.median).toBe(5.5);expect(result.budgetRange.weightedSceneMedian).toBe(1);expect(result.budgetRange.min).toBe(1);expect(result.budgetRange.max).toBe(5.5);
});
