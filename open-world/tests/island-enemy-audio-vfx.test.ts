import {test,expect} from 'vitest';
import {islandSkillPlan,islandMonsterSkills,islandBossProfiles} from '../packages/content/island-enemy-combat.ts';
import {monsterContent} from '../packages/content/monsters.ts';
test('four islands have authored themed skills, distinct dungeon pools and two phases',()=>{
 for(const island of islandSkillPlan.islands){const combinations=[];
  for(const [id,binding]of Object.entries(island.bindings)){const template=monsterContent.templates.find(t=>t.id===id)!;expect(template.skills).toEqual(binding.skillIds);expect(binding.skillIds.every((s:string)=>s.startsWith('island_'+island.key+'_'))).toBe(true);if('profile'in binding){const profile=islandBossProfiles[id];expect(profile.skills.length).toBeGreaterThanOrEqual(3);expect(new Set(profile.skills.map(s=>s.phase)).size).toBeGreaterThanOrEqual(2);expect(profile.skills.every(s=>s.windup>0&&s.warning)).toBe(true);combinations.push([...binding.skillIds].sort().join('|'));}else{expect(template.skills.length).toBeGreaterThanOrEqual(id.includes('elite')||id.includes('rare')?2:1);for(const s of template.skills)expect(islandMonsterSkills[s].windup).toBeGreaterThan(0);}}
  expect(new Set(combinations).size).toBe(3);
 }
});
