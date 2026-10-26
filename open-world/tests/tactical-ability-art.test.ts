import {describe,expect,it} from 'vitest';
import {tacticalAbilityArt} from '../apps/web/src/tactical/ability-art.ts';
import {skillArt} from '../apps/web/src/ui-assets.ts';
import {projectionToView} from '../apps/web/src/tactical/sandbox-wire.ts';
import {createTacticalEncounter,projectTacticalEncounter} from '../packages/simulation/tactical/encounter.ts';
import {tacticalBoards} from '../packages/content/tactical-content.ts';

const ids=['cut','whirl','ward','vortex_blade','throwing_knife','fan_of_knives','venom_needle','toxic_bomb'];

describe('tactical skill artwork uses the existing UI manifest',()=>{
 it('resolves all current sandbox skills to their own registered artwork',()=>{
  const paths=ids.map(id=>tacticalAbilityArt(id));
  expect(new Set(paths).size).toBe(ids.length);
  for(const [index,path] of paths.entries()){
   expect(path).toBe(skillArt(ids[index]));
   expect(path).toMatch(/^\/art\/ui-v2\/skill-handdrawn\/skill-[\w-]+\.png$/);
  }
 });
 it('leaves unknown IDs unassigned instead of guessing from labels or choosing a sword',()=>{
  for(const id of ['not-a-skill','回旋斩','../cut','cut" onerror="alert(1)'])expect(tacticalAbilityArt(id)).toBeNull();
 });
 it.each(['sword','hidden'] as const)('projects the real %s encounter skills without changing combat fields',heroId=>{
  const state=createTacticalEncounter({battleId:`art-${heroId}`,boardId:tacticalBoards[0].id,heroId,seed:37});
  const projection=projectTacticalEncounter(state),before=structuredClone(projection);
  const view=projectionToView(projection);
  expect(view.abilities.map(a=>a.id)).toEqual(projection.skills.map(a=>a.id));
  for(const skill of projection.skills){
   const shown=view.abilities.find(a=>a.id===skill.id)!;
   expect(shown.iconSrc).toBe(tacticalAbilityArt(skill.id));
   expect(shown.iconSrc).not.toBeNull();
   expect(shown.available).toBe(skill.available);
   expect(shown.reason).toBe(skill.reason??null);
  }
  expect(projection).toEqual(before);
 });
});
