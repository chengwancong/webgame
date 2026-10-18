import {it,expect} from 'vitest';
import {probeFieldZone} from '../tools/field-zone-probe.ts';
import {twoZoneIsland,catalogues} from './fixtures/production-island.ts';
import {generateProductionIsland} from '../tools/build-production-islands.ts';
import {standard} from '../tools/standard-player-model.ts';
function fixture(){const tables=twoZoneIsland(),region=generateProductionIsland(tables,tables.islands[0],catalogues).region;return {tables,region,zone:tables.zones[0].id,character:standard(5),seeds:[41],seconds:20,chunkCells:32,start:{x:212,y:230}};}
it('traverses and fights actual authored camps, preserving the original character and the same checkpoint result',()=>{
 const input=fixture(),before=structuredClone(input.character),first=probeFieldZone(input),resumed=probeFieldZone({...input,restoreAtSeconds:1});
 expect(first.requestedSkills).toEqual(first.executedSkills);expect(first.samples[0].zoneKills).toBeGreaterThan(0);expect(first.summary.normalTtkSamples).toBe(first.samples[0].zoneKills);expect(first.summary.kills).toBe(first.samples[0].zoneKills);expect(first.samples[0].incoming).toBeGreaterThanOrEqual(0);expect(resumed.samples[0].checkpointRestored).toBe(true);expect({...resumed.samples[0],checkpointRestored:false}).toEqual(first.samples[0]);expect(input.character).toEqual(before);
});
it('changes the actual target count with the authored pack and records unfinished camps in short runs',()=>{
 const input=fixture();input.tables.camps[0].pack[0].count=2;const fewer=probeFieldZone(input);expect(fewer.summary.kills).toBe(2);
 const short=probeFieldZone({...fixture(),seconds:1});expect(short.summary.completed).toBe(0);expect(short.samples[0].completed).toBe(false);expect(short.samples[0].camps[0].clearSeconds).toBeNull();expect(short.summary.samples).toBe(1);
});
it('rejects an empty zone or a mismatched requested skill instead of issuing a successful report',()=>{
 expect(()=>probeFieldZone({...fixture(),zone:'missing-zone'})).toThrow('authored');const input=fixture();input.character.skills=['not-active'];expect(()=>probeFieldZone(input)).toThrow('Requested and executed');
});
