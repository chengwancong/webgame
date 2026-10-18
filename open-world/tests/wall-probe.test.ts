import {it,expect} from 'vitest';
import {regionById} from '../packages/content/index.ts';
import {dungeonContent} from '../packages/content/dungeons.ts';
import {standard} from '../tools/standard-player-model.ts';
import {probeWall,measureWallBasis,wallSpawns,summarizeWallSamples,type WallProbeInput} from '../tools/wall-probe.ts';
import {sampleCombatBuild} from '../tools/build-variety-benchmark.ts';
import {resolveBuild} from '../packages/rules/index.ts';
function fixture():WallProbeInput{
 const original=structuredClone(dungeonContent.definitions.find(d=>d.policy.party.max===1&&!d.story&&d.mode==='realtime')!);
 const region=structuredClone(regionById('meadow-boss'));region.width=64;region.height=64;region.obstacles=[];region.landmarks=[];region.safe={x:30,y:30};
 const boss=region.spawns.find(s=>s.boss)!;region.spawns=[{...boss,x:32,y:30}];
 original.stages=[region.id];original.policy.monsterLevel=4;original.policy.enemyScale={hp:1,attack:1,hpPerStage:0,attackPerStage:0};original.policy.timeLimitSeconds=120;original.numericStage=1;
 return {definition:original,region,character:standard(4),stage:1,seed:41,seeds:[41,73],samplesPerRatio:2,maxSeconds:2,worldLine:'campaign',measurementSeconds:5};
}
it('walks from the declared distant entrance through real World input before auto combat',()=>{
 const input=fixture();input.region.safe={x:8,y:30};input.maxSeconds=15;
 const report=probeWall(input);expect(report.scenarios.every(s=>s.samples.every(sample=>sample.validationFailure!=='no_cast'))).toBe(true);
});
it('measures actual boss hits and consumes changed declared difficulty without changing the authored definition',()=>{
 const input=fixture(),first=measureWallBasis(input),changed=structuredClone(input);changed.definition.policy.enemyScale.hp=3;changed.definition.policy.enemyScale.attack=2;
 const second=measureWallBasis(changed);expect(first.rawDps).toBeGreaterThan(0);expect(first.hits).toBeGreaterThan(0);expect(second.bossHp).toBe(wallSpawns(changed)[0].hp);expect(Math.abs(second.bossHp-first.bossHp*3)).toBeLessThanOrEqual(1);expect(second.rawDps).toBeGreaterThan(first.rawDps);expect(input.definition.policy.enemyScale.hp).toBe(1);expect(wallSpawns(input)[0].monster!.level).toBe(4);
});
it('runs all requested rho/seed pairs with the same real build and keeps short-budget failures in the denominator',()=>{
 const input=fixture(),before=structuredClone(input.character),report=probeWall(input);
 expect(report.scenarios.map(s=>s.requestedRho)).toEqual([.8,.85,1,1.2]);
 expect(report.reference.measurement.requested).toEqual(report.reference.measurement.executed);
 for(const scenario of report.scenarios){expect(scenario.samples.map(s=>s.seed)).toEqual([41,73]);expect(scenario.summary.samples).toBe(2);expect(scenario.summary.wins+scenario.summary.deaths+scenario.summary.timeouts).toBe(2);expect(scenario.observedRho).toBeCloseTo(scenario.requestedRho,2);expect(scenario.targets[0].attack).toBe(report.basis.bossAttack);}
 expect(input.character).toEqual(before);expect(report.scenarios.some(s=>s.summary.timeouts+s.summary.deaths>0)).toBe(true);
});
it('refuses mismatched samples, undeclared stage or silently filtered skills',()=>{
 expect(()=>measureWallBasis({...fixture(),samplesPerRatio:20})).toThrow('distinct');expect(()=>measureWallBasis({...fixture(),stage:2})).toThrow('declared');
 const input=fixture();input.character.skills=['not-active'];expect(()=>probeWall(input)).toThrow('Requested and executed');
 const summary=summarizeWallSamples([{success:true,seconds:1,death:false,timeout:false,validationFailure:null},{success:false,seconds:2,death:true,timeout:false,validationFailure:null},{success:false,seconds:2,death:false,timeout:true,validationFailure:'no_cast'}]);expect(summary.winRate).toBe(1/3);expect(summary.invalid).toBe(1);
});
it('uses the server final-stage boss goal while preserving living adds, and keeps the original all-target goal available',()=>{
 const input=fixture(),resolved=resolveBuild(input.character),boss=wallSpawns(input)[0],add={...structuredClone(boss),id:'surviving-add',boss:false,elite:false,hp:1e12,x:50,y:50};boss.hp=1;
 const request={requestedSkills:input.character.skills,skillRanks:input.character.skillRanks,build:{stats:resolved.stats,skills:resolved.resolvedSkills},region:input.region,spawns:[boss,add],seed:41,maxTicks:90,mode:'auto' as const,stopWhen:'clear' as const};
 const final=sampleCombatBuild({...request,goal:'final_boss'}),all=sampleCombatBuild(request);expect(final.clearSeconds).not.toBeNull();expect(final.remaining.some(e=>e.id===add.id)).toBe(true);expect(all.clearSeconds).toBeNull();
});
