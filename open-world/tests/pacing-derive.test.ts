import {createIdentityAspects} from '../tools/pacing/identity-content.ts';
import {deriveMechanismPlan} from '../tools/pacing/derive-model.ts';
import {it,expect} from 'vitest';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,dirname} from 'node:path';
import {applyPacingChanges,readAspectBasis} from '../tools/pacing/derive.ts';
import {newAspects} from '../packages/content/aspects.ts';
import {derivePacingPlan,pacingWritableFiles} from '../tools/pacing/derive-model.ts';
import {pacingTargets} from '../packages/content/pacing-targets.ts';
import {regionById} from '../packages/content/index.ts';
import {createMechanismAspects} from '../tools/pacing/mechanisms.ts';
import {mechanismKnobs,knobPath} from '../tools/pacing/derive-model.ts';
import inventory from '../docs/reviews/pacing-tool-20261010/P0/inventory-data.json';
import baseline from '../docs/reviews/pacing-tool-20261010/P0/bd-measurements.json';
it('显式输入目录优先读取本次参数快照，兼容旧相邻快照并拒绝空基线',async()=>{
 const root=await mkdtemp(resolve(tmpdir(),'pacing-basis-')),from='measurement',direct=resolve(root,from,'aspects-before.json'),parent=resolve(root,'aspects-before.json'),basis=pacingTargets.builds.filter(t=>t.profile).map(t=>structuredClone(newAspects.find(a=>a.id===t.profile!.aspect)!));await mkdir(resolve(root,from));
 try{await writeFile(parent,JSON.stringify(basis));const local=structuredClone(basis);local[0].description='本次快照';await writeFile(direct,JSON.stringify(local));expect(await readAspectBasis(root,from)).toEqual(local);await rm(direct);expect(await readAspectBasis(root,from)).toEqual(basis);await rm(parent);await expect(readAspectBasis(root,from)).rejects.toThrow('缺少机制参数快照');}
 finally{expect(root.startsWith(resolve(tmpdir(),'pacing-basis-'))).toBe(true);await rm(root,{recursive:true});}
});
it('仅推导显式机制旋钮，保持权重、掉落、经验和未声明内容',async()=>{
 const sources=Object.fromEntries(await Promise.all(pacingWritableFiles.map(async f=>[f,JSON.parse(await readFile(f,'utf8'))])));sources['packages/content/aspects.json']=createIdentityAspects(sources['packages/content/aspects.json']);
 const before=structuredClone(sources),targets=structuredClone(pacingTargets),plan=deriveMechanismPlan(targets,{matrix:targets.builds.filter(t=>t.profile).map(t=>({bd:t.id,anchorRatios:Object.fromEntries(['single','clear','survival','elite','safety'].map(scene=>[scene,{median:(t as any)[scene]*1.5}]))}))},baseline,sources,{knobs:mechanismKnobs.map(k=>({...k,basis:'measured:C3 测试夹具',marginal:{single:1,clear:1,elite:1}}))});
 expect(sources).toEqual(before);expect(targets).toEqual(pacingTargets);expect(plan.changes.length).toBeGreaterThan(0);
 expect(new Set(plan.changes.map(c=>c.file))).toEqual(new Set(['packages/content/aspects.json']));
 const allowed=mechanismKnobs.map(k=>knobPath(sources['packages/content/aspects.json'],k).join('.'));
 for(const c of plan.changes)if(typeof c.after==='number'){expect(allowed).toContain(c.path.join('.'));const k=mechanismKnobs[allowed.indexOf(c.path.join('.'))];expect(c.after).toBeGreaterThanOrEqual(k.min);expect(c.after).toBeLessThanOrEqual(k.max);expect(c.after/k.step).toBeCloseTo(Math.round(c.after/k.step));}
 for(const a of plan.next['packages/content/aspects.json'])expect(a.parts.rules.some((r:any)=>r.id.startsWith('pacing-'))).toBe(false);
});
it('defaults to no writes and rejects a stale change before any config is written',async()=>{
 const root=await mkdtemp(resolve(tmpdir(),'pacing-config-')),file='packages/content/progression-curve.json',path=resolve(root,file);await mkdir(dirname(path),{recursive:true});await writeFile(path,JSON.stringify({thresholds:[330]}));
 try{const change={file,path:['thresholds',0],before:330,after:240,reason:'test',scope:'level' as const};expect((await applyPacingChanges(root,[change])).applied).toBe(false);expect(JSON.parse(await readFile(path,'utf8')).thresholds[0]).toBe(330);
  await expect(applyPacingChanges(root,[{...change,before:999}],true)).rejects.toThrow('changed since derivation');expect(JSON.parse(await readFile(path,'utf8')).thresholds[0]).toBe(330);
  expect((await applyPacingChanges(root,[change],true)).applied).toBe(true);expect(JSON.parse(await readFile(path,'utf8')).thresholds[0]).toBe(240);
 }finally{await rm(root,{recursive:true});}
});
it('保留的身份参数按差量投影，目标已经达到时不会重复放大或削弱',async()=>{
 const sources=Object.fromEntries(await Promise.all(pacingWritableFiles.map(async f=>[f,JSON.parse(await readFile(f,'utf8'))])));sources['packages/content/aspects.json']=createIdentityAspects(sources['packages/content/aspects.json']);
 const matrix=pacingTargets.builds.filter(t=>t.profile).map(t=>({bd:t.id,anchorRatios:Object.fromEntries(['single','clear','survival','elite','safety'].map(scene=>[scene,{median:(t as any)[scene]}]))})),reference={versions:baseline.versions,matrix,rows:[],aspectsBefore:structuredClone(sources['packages/content/aspects.json'])};
 const plan=deriveMechanismPlan(pacingTargets,reference,reference,sources,{knobs:mechanismKnobs.map(k=>({...k,basis:'measured:C3 测试夹具',marginal:{single:1}}))});expect(plan.changes).toEqual([]);
});
