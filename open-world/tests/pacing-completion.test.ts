import {it,expect} from 'vitest';
import {pacingCompletion,pacingCompletionRequirements} from '../tools/pacing/completion.ts';
import {pacingBuild,pacingProfiles} from '../tools/pacing/profiles.ts';
import {pacingTargets} from '../packages/content/pacing-targets.ts';
import {progressionConfig} from '../packages/content/deep-progression.ts';
it('uses unlocked skills and actual point budget, and does not invent unknown collection history',()=>{
 const a=pacingBuild(pacingProfiles[0]),rows=pacingCompletion(a.state);expect(rows.find(r=>r.id==='skills')!.total).toBe(3);expect(rows.find(r=>r.id==='skills')!.fraction).toBe(1);
 expect(rows.find(r=>r.id==='talents')!.total).toBe(49);expect(rows.find(r=>r.id==='sets')!.fraction).toBeNull();expect(rows.some(r=>r.id==='augments')).toBe(false);
 expect(pacingCompletion(a.state,{acquiredSetIds:['set-staff-standard']}).find(r=>r.id==='sets')!.count).toBe(1);
});
it('derives per-line resource requirements without claiming unknown income or writing shared early costs',()=>{
 const rows=pacingCompletionRequirements(pacingTargets,progressionConfig);expect(rows).toHaveLength(pacingTargets.completion.length);expect(rows.every(r=>!r.automaticWrite)).toBe(true);expect(rows.some(r=>r.id==='augments')).toBe(false);
 expect(rows.find(r=>r.id==='skills')!.requiredGoldPerVirtualMinute).toBeGreaterThan(0);expect(rows.find(r=>r.id==='sets')!.requiredGoldPerVirtualMinute).toBeNull();
});
