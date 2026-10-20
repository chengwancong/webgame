import {it,expect} from 'vitest';
import {skillCosts,skillCostsSchema} from '../packages/content/skill-costs.ts';
import {skillCatalog} from '../packages/content/index.ts';
import {prepareSpinePlan} from '../tools/spine/apply.ts';
import {resolvePlayer,standardState} from '../tools/spine/player.ts';
it('uses one source for the public and server-resolved throwing knife cost',()=>{
 const s=standardState(30,'hidden');s.skills=['throwing_knife'];s.skillRanks={throwing_knife:1};
 expect(skillCatalog.find(s=>s.id==='throwing_knife')!.cost).toBe(skillCosts.throwing_knife);
 expect(resolvePlayer('cost',s).build.skills[0].cost).toBe(skillCosts.throwing_knife);
});
it('allows only explicit nonnegative integer cost edits through the spine writer',()=>{
 const file='packages/content/skill-costs.json',sources={[file]:{throwing_knife:3}},schemas={[file]:skillCostsSchema};
 const change={file,path:['throwing_knife'],before:3,after:1,basis:'GROW-01 accepted'};
 expect(prepareSpinePlan(sources,[change],schemas)[file]).toEqual({throwing_knife:1});
 expect(sources[file].throwing_knife).toBe(3);
 for(const after of [-1,.5,NaN,'1'])expect(()=>prepareSpinePlan(sources,[{...change,after}],schemas)).toThrow();
 expect(()=>skillCostsSchema.parse({throwing_knife:1,unknown:1})).toThrow();
 expect(()=>prepareSpinePlan(sources,[{...change,before:2}],schemas)).toThrow();
});
