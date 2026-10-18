import {it,expect} from 'vitest';
import {regionById} from '../packages/content/index.ts';
import '../packages/content/open-world/index.ts';
import {worldTables,worldZoneAt} from '../packages/content/world-tables.ts';
import {walkable} from '../packages/simulation/navigation.ts';
import {zoneGuide} from '../packages/rules/zone-guide.ts';

const region=regionById('ow-graybox-wind'),wp=(n:number)=>worldTables.waypoints.find(w=>w.id==='m0-wind-w'+n)!;

it('keeps a same-zone target, sends other-zone targets to an unlocked waypoint there, else to this zone exit',()=>{
 const hero={x:wp(1).x,y:wp(1).y},near={x:hero.x+6,y:hero.y,label:'目标'};
 expect(zoneGuide(region,hero,near,[])).toEqual(near);
 const far={x:wp(6).x+4,y:wp(6).y,label:'远处目标'};expect(worldZoneAt(region.id,far)!.id).toBe('m0-wind-z6');
 // Unlocked waypoint in the target zone wins: the nearest one to the target (w6, not w8).
 const travel=zoneGuide(region,hero,far,['m0-wind-w1','m0-wind-w8','m0-wind-w6']);expect(travel).toMatchObject({x:wp(6).x,y:wp(6).y});expect(travel.label).toContain('可传送：'+wp(6).name);
 // Nothing unlocked there: the first walkable point just outside zone 1 on the route.
 const exit=zoneGuide(region,hero,far,['m0-wind-w1']);
 expect(worldZoneAt(region.id,exit)?.id).not.toBe('m0-wind-z1');expect(walkable(region,exit)).toBe(true);
 const z1=worldZoneAt(region.id,hero)!.rect;expect(Math.min(Math.abs(exit.x-(z1.x+z1.w)),Math.abs(exit.y-(z1.y+z1.h)))).toBeLessThan(1.5);
 expect(exit.label.length).toBeLessThan(30);
});
