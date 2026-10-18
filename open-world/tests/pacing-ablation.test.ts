import {it,expect} from 'vitest';
import {pacingProfiles,pacingBuild} from '../tools/pacing/profiles.ts';
import {resolveBuild} from '../packages/rules/index.ts';
import {collectBuildParts} from '../packages/rules/build-parts.ts';
it('ablates only core/four-piece effects, preserving items, ranks, two-piece benefits and weapon permission',()=>{
 for(const profile of pacingProfiles){const a=pacingBuild(profile),before=structuredClone(a.state),normal=collectBuildParts(a.state),selected=collectBuildParts(a.state,{withoutAspects:[profile.aspect],withoutFourSets:[profile.four]}),build=resolveBuild(a.state,{withoutAspects:[profile.aspect],withoutFourSets:[profile.four]});
  expect(build.resolvedSkills.map(s=>s.id)).toEqual(profile.skills);expect(a.state).toEqual(before);
  expect(selected.unified.stats.filter(s=>s.source.endsWith(':2'))).toEqual(normal.unified.stats.filter(s=>s.source.endsWith(':2')));
  expect(selected.unified.atoms.filter(s=>s.source===profile.four)).toEqual([]);
  expect(selected.sources.find(s=>s.source===profile.aspect)?.parts.rules).toEqual([]);
 }
});
