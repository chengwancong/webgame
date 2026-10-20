import {it,expect} from 'vitest';
import {starseaMap,starseaCampaign} from '../packages/content/starsea/index.ts';
import {starseaTaskSteps} from '../packages/rules/starsea.ts';
import {stepsByTask,taskById} from '../packages/content/task-tables.ts';
import {worldZoneAt} from '../packages/content/world-tables.ts';
import {regionById} from '../packages/content/index.ts';
import {World,walkable} from '../packages/simulation/index.ts';

it('guides each dragon defense stage to its own authored node without changing the encounter budget',()=>{
 const chapter=starseaCampaign.chapters.find(c=>c.id==='ss-c06')!;
 const steps=starseaTaskSteps(chapter,chapter.tasks.findIndex(t=>t.id==='ss-c06-t04'));
 const map=starseaMap('ss-map-dragon');
 expect(steps).toHaveLength(3);
 for(const [i,step] of steps.entries()){
  const node=map.landmarks.find(l=>l.id===`device-${i+1}`)!;
  expect(step.points[0]).toMatchObject({x:node.x,y:node.y});
  expect(worldZoneAt(map.id,step.points[0])?.id).toBe('ow-dragon-z5');
  expect(step.size).toBe(3);expect(step.enemies).toEqual(['ss-mon-dusk-blade','ss-mon-dusk-weaver']);
 }
 expect(stepsByTask.get('ss-c06-t04')?.map(s=>s.op)).toEqual(['defend','defend','defend']);
});
it('describes the final return task without inventing a separate bridge switch objective',()=>{
 expect(stepsByTask.get('ss-c06-t06')?.map(s=>s.op)).toEqual(['talk']);
 expect(taskById.get('ss-c06-t06')?.goal).toBe('击败维洛后，回拾星港向澄确认复航与平民安置。');
});
it('walks from the dragon safe point through all three defense nodes without crossing static collision',()=>{
 const map=starseaMap('ss-map-dragon'),region=regionById(map.id);
 // Movement-only fixture: no enemies, combat claims, teleport between nodes or natural progression claim.
 const world=new World(region,{hp:500,attack:20,armor:40,speed:6,mana:100,regen:0,effects:[]},[],[]);
 world.hero.position={...region.safe};world.setMode('semi');
 for(let n=1;n<=3;n++){
  const target=map.landmarks.find(l=>l.id==='device-'+n)!;
  world.go({x:target.x,y:target.y});
  for(let tick=0;tick<30*300&&Math.hypot(world.hero.position.x-target.x,world.hero.position.y-target.y)>.6;tick++){
   world.step();expect(walkable(region,world.hero.position),`device-${n}: ${JSON.stringify(world.hero.position)}`).toBe(true);
  }
  expect(Math.hypot(world.hero.position.x-target.x,world.hero.position.y-target.y),`device-${n} not reached`).toBeLessThanOrEqual(.6);
 }
});
