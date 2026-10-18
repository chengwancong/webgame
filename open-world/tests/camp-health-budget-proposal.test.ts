// numeric-spine S7：同步最终整数投影；比例/速度专用夹具避开最小生命和防作弊固定下限。
import {it,expect} from 'vitest';
import {twoZoneIsland} from './fixtures/production-island.ts';
import {proposeCampHealth} from '../tools/camp-health-budget-proposal.ts';
import {campMembers} from '../packages/rules/world-camps.ts';
it('retains actual population and template/rank declarations while creating a fixed stage role budget',()=>{const camp=twoZoneIsland().camps[0],before=structuredClone(camp),result=proposeCampHealth(camp,{swarm:100,normal:300,ranged:240});expect(campMembers(result.proposed)).toHaveLength(campMembers(camp).length);expect(result.proposed.pack).toEqual(camp.pack);expect(result.proposed.budget!.health).toBe(60);expect(camp).toEqual(before);});
it('rejects an invalid measured health target instead of lowering population',()=>{expect(()=>proposeCampHealth(twoZoneIsland().camps[0],{swarm:0,normal:300,ranged:240})).toThrow('positive');});
