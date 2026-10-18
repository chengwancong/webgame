import {it,expect} from 'vitest';
import {measureAoeHit} from '../tools/world-aoe-hit-probe.ts';
import {newStarseaState} from '../packages/rules/starsea.ts';
import type {CharacterState} from '../packages/contracts/index.ts';
import {makeGear} from '../packages/rules/index.ts';
const weapon=makeGear(0,crypto.randomUUID());
const character:CharacterState={id:crypto.randomUUID(),name:'受控群攻命中',revision:0,build:1,level:1,xp:0,gold:0,material:0,gear:[weapon],equipment:{weapon:weapon.id},skills:['whirl'],skillRanks:{whirl:1},progress:{kills:0,regions:[],bosses:[],safe:'town',tasks:[]},starsea:{...newStarseaState(),done:['ss-c01-t01']}};// 旋风斩在「落点求生」后找回（docs/progression-goal-plan.md §4）
it('measures the real active AOE first direct noncritical hit and responds to actual skill rank changes',()=>{const first=measureAoeHit(character,'whirl');expect(first.hitAoe).toBeGreaterThan(0);expect(first.requestedSkill).toBe(first.executedSkill);expect(first.controls.directCrit).toBe(false);const trained=structuredClone(character);trained.level=20;trained.skillRanks.whirl=3;const later=measureAoeHit(trained,'whirl');expect(later.skillRank).toBe(3);expect(later.hitAoe).toBeGreaterThan(first.hitAoe);});
it('does not silently filter an inactive skill or use a different skill as the requested AOE',()=>{const inactive=structuredClone(character);inactive.skills=[];expect(()=>measureAoeHit(inactive,'whirl')).toThrow('active');expect(()=>measureAoeHit(character,'cut')).toThrow('active');});
