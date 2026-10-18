import {it,expect} from 'vitest';
import '../packages/content/open-world/index.ts';
import {FieldController} from '../apps/web/src/field-controller.ts';
import {World} from '../packages/simulation/index.ts';
import {regionById} from '../packages/content/index.ts';
import {worldTables} from '../packages/content/world-tables.ts';
import {resolveWorldPhase} from '../packages/rules/world-phase.ts';
import {newStarseaState} from '../packages/rules/starsea.ts';
import {worldProgressSchema} from '../packages/contracts/open-world.ts';
import type {Snapshot} from '../packages/contracts/index.ts';
it('zone banners use the same server-resolved phase as actual encounters, including same-revision character switches',()=>{
 const region='ss-map-dragon',points=worldTables.waypoints.filter(w=>w.region===region),first=points[0],last=points.find(p=>p.zone!==first.zone)!,stats={hp:100,attack:1,armor:0,speed:6,mana:30,regen:0,effects:[]},create=()=>new World(regionById(region),stats,[],[]);let world=create(),snapshot={id:crypto.randomUUID(),revision:1,level:50,starsea:newStarseaState(),world:worldProgressSchema.parse({})} as unknown as Snapshot;
 snapshot.starsea!.hardmode=true;snapshot.worldView=resolveWorldPhase(snapshot);const expected=snapshot.worldView.zones.find(z=>z.id===last.zone)!,banners:string[]=[];const controller=new FieldController({world:()=>world,snapshot:()=>snapshot,permit:()=>undefined,lease:()=>'',ready:()=>false,failed:e=>{throw e;},banner:t=>banners.push(t)});
 world.hero.position={x:first.x,y:first.y};controller.step(1);world.hero.position={x:last.x,y:last.y};controller.step(2);expect(banners.at(-1)).toBe(expected.name+' · Lv.'+expected.levelBand[0]+'–'+expected.levelBand[1]);
 snapshot={...snapshot,id:crypto.randomUUID(),starsea:{...snapshot.starsea!,hardmode:false}};snapshot.worldView=resolveWorldPhase(snapshot);world=create();world.hero.position={x:first.x,y:first.y};controller.step(3);world.hero.position={x:last.x,y:last.y};controller.step(4);const normal=snapshot.worldView.zones.find(z=>z.id===last.zone)!;expect(banners.at(-1)).toBe(normal.name+' · Lv.'+normal.levelBand[0]+'–'+normal.levelBand[1]);expect(normal.levelBand).not.toEqual(expected.levelBand);
});
