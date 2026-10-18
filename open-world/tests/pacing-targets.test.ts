import {it,expect} from 'vitest';
import {pacingTargets,pacingWeights,pacingSettings,pacingBuildTargets} from '../packages/content/pacing-targets.ts';
import {pacingTargetTablesSchema,pacingOverrideSchema,pacingScenes} from '../packages/contracts/pacing.ts';
it('loads the exported workbook and preserves the user scene weights and equal budgets',()=>{
 expect(pacingWeights).toEqual({single:.2,clear:.3,survival:.1,elite:.15,safety:.25});expect(pacingSettings.get('mainGoal')).toBe(240);expect(pacingBuildTargets).toHaveLength(8);
 for(const row of pacingBuildTargets){expect(Math.abs(pacingScenes.reduce((n,id)=>n+pacingWeights[id]*row[id],0)-1)).toBeLessThanOrEqual(.05);expect(row.profile?.skills.length).toBeGreaterThan(0);}
});
it('rejects contradictory workbook targets instead of deriving from invalid inputs',()=>{
 const bad=structuredClone(pacingTargets);bad.builds.find(r=>r.id==='burn')!.clear=.2;expect(()=>pacingTargetTablesSchema.parse(bad)).toThrow();
 const other=structuredClone(pacingTargets);other.settings.find(r=>r.id==='mainGoal')!.value=301;expect(()=>pacingTargetTablesSchema.parse(other)).toThrow();
});
it('limits the session trial to enemy pressure without accepting reward or progression writes',()=>{
 expect(pacingOverrideSchema.parse({monsterHp:.5,monsterAttack:1})).toEqual({monsterHp:.5,monsterAttack:1});
 expect(()=>pacingOverrideSchema.parse({monsterHp:1,monsterAttack:1,xp:2})).toThrow();
 expect(()=>pacingOverrideSchema.parse({monsterHp:0,monsterAttack:1})).toThrow();
});
