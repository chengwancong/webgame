import {it,expect} from 'vitest';
import type {CharacterState,Stats} from '../packages/contracts/index.ts';
import {newStarseaState,recordStarseaKill} from '../packages/rules/starsea.ts';
import {worldNightPolicy,worldNightSpawns} from '../packages/rules/world-night.ts';
import {worldTables} from '../packages/content/world-tables.ts';
import {generateProductionIsland} from '../tools/build-production-islands.ts';
import {registerProducedWorld,type ProducedWorld} from '../packages/content/open-world/index.ts';
import {twoZoneIsland,catalogues} from './fixtures/production-island.ts';
import {World,distance} from '../packages/simulation/index.ts';
it('counts 80 kills independently per zone, appears beyond 36 cells, approaches the hero and restores the same invasion',()=>{
 const table=twoZoneIsland(),produced=generateProductionIsland(table,table.islands[0],catalogues),region=produced.region.id;
 registerProducedWorld(produced as unknown as ProducedWorld);const zoneLength=worldTables.zones.length;worldTables.zones.push(...table.zones);
 const s:CharacterState={id:crypto.randomUUID(),name:'分区星潮夜',revision:0,build:1,level:3,xp:0,gold:0,material:0,gear:[],equipment:{},skills:[],skillRanks:{},progress:{kills:0,regions:[],bosses:[],safe:region,tasks:[]},starsea:newStarseaState()},hero={x:220,y:256};
 try{
  for(let i=0;i<worldNightPolicy.killThreshold-1;i++){
   expect(recordStarseaKill(s,region,'night-count-a:'+i,false,hero,{x:220,y:230}).spawns).toBeUndefined();
   expect(recordStarseaKill(s,region,'night-count-b:'+i,false,hero,{x:350,y:230}).spawns).toBeUndefined();
  }
  expect(s.starsea!.tide?.[table.zones[0].id]).toBe(79);expect(s.starsea!.tide?.[table.zones[1].id]).toBe(79);
  const triggered=recordStarseaKill(s,region,'night-count-final',false,hero,{x:220,y:230}),spawns=triggered.spawns!;
  expect(spawns).toHaveLength(worldNightPolicy.count);expect(spawns.every(e=>distance(e,hero)>=36-1e-9)).toBe(true);expect(s.starsea!.tide?.[table.zones[1].id]).toBe(79);
  const stats:Stats={hp:1e9,attack:1,armor:1000,speed:6,mana:100,regen:0,effects:[]},w=new World(produced.region,stats,[],spawns,[],41);w.hero.position={...hero};w.setMode('manual');
  const before=w.enemies.map(e=>distance(e.position,hero));for(let i=0;i<180;i++)w.step();expect(w.enemies.some((e,i)=>distance(e.position,hero)<before[i]-5)).toBe(true);
  expect(World.restore(w.exportCheckpoint()).exportCheckpoint()).toEqual(w.exportCheckpoint());expect(JSON.parse(JSON.stringify(s)).starsea.night).toEqual(s.starsea!.night);
  const changed=worldNightSpawns(s,region,hero,2,{...worldNightPolicy,spawnDistance:40});expect(changed.every(e=>distance(e,hero)>=40-1e-9)).toBe(true);
 }finally{worldTables.zones.splice(zoneLength);}
});
