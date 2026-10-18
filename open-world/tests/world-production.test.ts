import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {generateProductionIsland,islandArtPool} from '../tools/build-production-islands.ts';
import {loadWorldTables,validateWorldGeometry} from '../packages/content/world-tables.ts';
import {monsterContent} from '../packages/content/monsters.ts';
import {campSpawns} from '../packages/rules/world-camps.ts';
import {walkable,findPath} from '../packages/simulation/navigation.ts';
import type {WorldTables} from '../packages/contracts/open-world.ts';
import {catalogues,twoZoneIsland} from './fixtures/production-island.ts';
it('generates deterministic production geometry from region rows and catalogue categories, not the graybox seed',()=>{
 const tables=twoZoneIsland(),result=generateProductionIsland(tables,tables.islands[0],catalogues);expect(result.meta.production).toBe(true);expect(result.report.walkableRatio).toBeGreaterThanOrEqual(.55);expect(result.report.walkableRatio).toBeLessThanOrEqual(.65);expect(result).toEqual(generateProductionIsland(tables,tables.islands[0],catalogues));
 expect(result.map.decorations.every(d=>catalogues.some(c=>c.assets.some((a:any)=>a.id===d.resourceId)))).toBe(true);expect(result.map.groundZones.map(z=>z.resource)).toEqual(tables.zones.map(z=>z.ground));expect(result.report.camps).toBe(1);expect(result.report.monsterPositions).toBe(4);
 const refs={templates:new Set(monsterContent.templates.map(t=>t.id)),resources:new Set<string>(catalogues.flatMap(c=>c.assets.map((a:any)=>a.id))),dungeons:new Set<string>(),events:new Set<string>(),loot:new Set<string>()};expect(()=>validateWorldGeometry(tables,[result.region],refs)).not.toThrow();
 for(const p of [...tables.camps,...tables.waypoints])expect(walkable(result.region,p,.55)&&findPath(result.region,result.region.safe,p,.55).length>0||p.id===tables.waypoints[0].id).toBe(true);
});
it('a workbook rectangle, road and camp-pack edit changes generated geometry and actual frozen members',()=>{
 const tables=twoZoneIsland(),original=generateProductionIsland(tables,tables.islands[0],catalogues),changed=structuredClone(tables);changed.zones[0].rect.w=240;changed.zones[1].rect.x=240;changed.zones[1].rect.w=272;changed.camps[0].pack[0].count=6;changed.roads[0].points[1].y=280;const next=generateProductionIsland(loadWorldTables(changed),changed.islands[0],catalogues);
 expect(next.map.groundZones).not.toEqual(original.map.groundZones);expect(next.map.roads).not.toEqual(original.map.roads);expect(next.map.decorations).not.toEqual(original.map.decorations);expect(campSpawns(next.region,changed,changed.camps[0],1)).toHaveLength(6);expect(campSpawns(original.region,tables,tables.camps[0],1)).toHaveLength(4);
});
it('fails before publication for unsafe landing, impossible coastline ratio, missing island art and unreachable world points',()=>{
 for(const edit of [(t:WorldTables)=>t.islands[0].landing={x:0,y:0},(t:WorldTables)=>t.islands[0].landRadius=[150,150],(t:WorldTables)=>t.islands[0].artIsland='unregistered-theme',(t:WorldTables)=>t.camps[0].x=0]){const t=twoZoneIsland();edit(t);expect(()=>generateProductionIsland(t,t.islands[0],catalogues)).toThrow();}
});
