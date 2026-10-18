import {it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {pacingTargets} from '../packages/content/pacing-targets.ts';
import {pacingWritableFiles,mechanismKnobs,at,put} from '../tools/pacing/derive-model.ts';
import {calibratePacingPlan} from '../tools/pacing/calibrate-model.ts';
import {createMechanismAspects} from '../tools/pacing/mechanisms.ts';
it('显式修正偏离目标的经验需求，同时只调整已有身份机制参数',async()=>{
 const load=async(p:string)=>JSON.parse(await readFile(p,'utf8')),validation=await load('docs/reviews/pacing-mechanics-20261012/B4/validation/validation.json'),combat=await load('docs/reviews/pacing-mechanics-20261012/B4/validation/combat/bd-measurements.json'),sources=Object.fromEntries(await Promise.all(pacingWritableFiles.map(async f=>[f,await load(f)])));
 sources['packages/content/aspects.json']=createMechanismAspects(sources['packages/content/aspects.json']);const before=structuredClone(sources),plan=calibratePacingPlan(pacingTargets,validation,combat,sources,{recenter:true});expect(sources).toEqual(before);
 const levels=plan.changes.filter(c=>c.scope==='level');expect(levels).toHaveLength(49);for(const c of levels)expect(c.after).toBe(Math.max(1,Math.round(Number(c.before)*240/validation.virtualMinutes)));
 expect(plan.changes.some(c=>c.file.includes('stage-key')||c.path.includes('dropProbability'))).toBe(false);
 for(const a of plan.next['packages/content/aspects.json']){const old=before['packages/content/aspects.json'].find((r:any)=>r.id===a.id);expect(a.parts.rules.map((r:any)=>r.id)).toEqual(old.parts.rules.map((r:any)=>r.id));const allowed=structuredClone(old.parts);for(const k of mechanismKnobs.filter(k=>k.aspect===a.id&&k.kind==='parts'))put(allowed,k.path,at(a.parts,k.path));expect(a.parts.patches).toEqual(allowed.patches);expect(a.parts.rules.some((r:any)=>r.id.startsWith('pacing-'))).toBe(false);}
});
