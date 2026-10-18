import {it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {pacingTargets} from '../packages/content/pacing-targets.ts';
import {calibratePacingPlan} from '../tools/pacing/calibrate-model.ts';
import {pacingWritableFiles,mechanismKnobs,knobPath,at} from '../tools/pacing/derive-model.ts';
import {createIdentityAspects} from '../tools/pacing/identity-content.ts';
it('一次修正保持通过构筑，仅改变失败构筑的声明旋钮且正确限幅',async()=>{
 const sources=Object.fromEntries(await Promise.all(pacingWritableFiles.map(async f=>[f,JSON.parse(await readFile(f,'utf8'))])));sources['packages/content/aspects.json']=createIdentityAspects(sources['packages/content/aspects.json']);const before=structuredClone(sources),matrix=pacingTargets.builds.filter(r=>r.profile).map((t,i)=>({bd:t.id,ratios:{single:t.single,clear:t.clear*(i===0?.5:1),survival:t.survival,elite:t.elite,safety:t.safety},scenePassed:i!==0,budgetPassed:i!==0,mechanismPassed:true,failures:[]})),measured=matrix.map(r=>({...r,anchorRatios:Object.fromEntries(Object.entries(r.ratios).map(([s,v])=>[s,{median:v}]))})),plan=calibratePacingPlan(pacingTargets,{versions:{rules:'测试'},matrix:measured},{rows:[]},sources,{knobs:mechanismKnobs.map(k=>({...k,basis:'measured:C3 测试夹具',marginal:{clear:1}}))});
 expect(sources).toEqual(before);for(const k of mechanismKnobs.filter(k=>k.bd!=='burn')){const p=knobPath(sources['packages/content/aspects.json'],k);expect(at(plan.next['packages/content/aspects.json'],p)).toEqual(at(sources['packages/content/aspects.json'],p));}
 expect(plan.changes.some(c=>typeof c.after==='number'&&Number(c.after)>Number(c.before))).toBe(true);expect(plan.predictions.bd.filter(p=>p.unchanged)).toHaveLength(7);
});
