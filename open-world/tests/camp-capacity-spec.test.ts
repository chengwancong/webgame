import {it,expect} from 'vitest';
import {campForPopulation,actualCampCapacity} from '../tools/camp-capacity-spec.ts';
import {twoZoneIsland,catalogues} from './fixtures/production-island.ts';
import {generateProductionIsland} from '../tools/build-production-islands.ts';
import {campMembers} from '../packages/rules/world-camps.ts';
import {monsterContent} from '../packages/content/monsters.ts';
it('keeps12/20 requested targets and authored template weights without mutating the formal camp',()=>{const tables=twoZoneIsland(),camp=tables.camps[0],before=structuredClone(camp);for(const count of [12,20])expect(campMembers(campForPopulation(camp,count))).toHaveLength(count);expect(camp).toEqual(before);});
it('scales total authored group health with population to preserve per-member budget',()=>{const tables=twoZoneIsland(),normal=monsterContent.templates.find(t=>t.curve==='starsea'&&t.role==='normal'&&!t.bossKey)!,camp={...tables.camps[0],pack:[{...tables.camps[0].pack[0],template:normal.id}],budget:{count:4,health:400,roles:{normal:1}}};const scaled=campForPopulation(camp,20);expect(scaled.budget!.health/scaled.budget!.count).toBe(100);expect(camp.budget.count).toBe(4);expect(()=>campForPopulation(camp,0)).toThrow('positive');});
it('refuses a normal-only camp before actual swarm adoption instead of faking a successful retest',()=>{const tables=twoZoneIsland(),normal=monsterContent.templates.find(t=>t.curve==='starsea'&&t.role==='normal'&&!t.bossKey)!;tables.camps[0].pack[0].template=normal.id;const region=generateProductionIsland(tables,tables.islands[0],catalogues).region;expect(()=>actualCampCapacity(region,tables,tables.camps[0],20)).toThrow('adopt actual swarm');});
