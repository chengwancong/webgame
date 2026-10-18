import graybox from './ow-graybox-wind.json';
import production from './production.json';
import {monsterContent} from '../monsters.ts';
import islandBindings from '../island-enemy-bindings.json';
import {registerFieldRegion,registerDungeonRegion,regions,settings,type Region} from '../index.ts';
import {worldTables} from '../world-tables.ts';
import {buildPlaneStage,planeStageSpecs,type PlaneMap} from '../plane-scenes.ts';
import {registerStarseaFieldMap,starseaRelics,starseaRegions,type StarseaMapSource} from '../starsea/index.ts';

/** Field regions with camp-cycle spawning. The M0 graybox is a QA-only stand-in
 * for 风栖岛 until the formal 512 map is integrated (M2); it never opens for
 * players and its economy follows the island it stands in for. */
const region:Region={...(graybox.region as unknown as Region),spawns:[],sprint:true,calmRegen:.03,aggroRadius:8,roam:true};
registerFieldRegion(region,{island:'ss-map-wind',qa:true,chunkCells:settings.chunkSize});
for(const camp of worldTables.camps.filter(c=>c.region===region.id))if(!worldTables.zones.some(z=>z.id===camp.zone&&z.region===region.id))throw Error('Field camp outside region zones '+camp.id);
/** Render-only map data (ground, roads, decorations); typed by the web renderer. */
export const fieldMaps:Record<string,unknown>={[region.id]:graybox.map};
export const fieldRegionIds=[region.id];
export type ProducedWorld={meta:{production:true;island:string;chapter?:number};region:Region;map:{id:string;name?:string;landmarks?:{id:string;x:number;y:number}[];roads?:{points:[number,number][]}[];decorations?:unknown[]}};
/** The generator emits content, not a QA switch. Access/economy still resolve
 * through the authored parent island; the same camp API serves both formats. */
export function registerProducedWorld(world:ProducedWorld){
 if(!world.meta.production||world.map.id!==world.region.id||world.region.width!==512||world.region.height!==512)throw Error('Invalid production island '+world.region.id);
 const replacing=world.region.id===world.meta.island;
 if(replacing&&!worldTables.islands.some(i=>i.region===world.region.id&&i.island===world.meta.island))throw Error('Formal replacement has no authored island row '+world.region.id);
 registerFieldRegion(world.region,{island:world.meta.island,qa:false,chunkCells:settings.chunkSize},replacing);
 if(replacing){const declaration=worldTables.islands.find(i=>i.region===world.region.id)!;registerStarseaFieldMap({id:world.region.id,name:world.region.name,kind:'island',chapter:declaration.chapter,width:512,height:512,theme:{key:declaration.artIsland,description:world.region.subtitle},safe:[{id:'landing',...world.region.safe,w:8,h:8}],obstacles:world.region.obstacles,landmarks:world.map.landmarks??[],spawns:[],roads:world.map.roads??[],decorations:[]} as StarseaMapSource);}
 fieldMaps[world.region.id]=world.map;if(!fieldRegionIds.includes(world.region.id))fieldRegionIds.push(world.region.id);
 if(replacing){const at=starseaRegions.findIndex(r=>r.id===world.region.id);if(at>=0)starseaRegions[at]=world.region;}
 if(replacing){for(let i=starseaRelics.length-1;i>=0;i--)if(starseaRelics[i].map===world.region.id)starseaRelics.splice(i,1);for(const object of worldTables.objects.filter(o=>o.region===world.region.id&&(o.kind==='life'||o.kind==='core')))starseaRelics.push({id:object.id,map:object.region,kind:object.kind as 'life'|'core',name:object.name,x:object.x,y:object.y});}
}
for(const world of production.islands as unknown as ProducedWorld[])registerProducedWorld(world);
/** Fixed encounter regions retain authored spawns; they never enter camp-cycle
 * registration. Dungeon admission and rewards remain owned by DungeonService. */
export function registerProducedDungeon(world:{spec:{island:string};region:Region;map:{id:string}}){
 const r=world.region;if(world.map.id!==r.id||r.width!==48||r.height!==48||regions.some(p=>p.id===r.id))throw Error('Invalid field dungeon stage '+r.id);
 for(const spawn of r.spawns)if(spawn.monster&&spawn.monster.template in islandBindings.templates){const template=monsterContent.templates.find(t=>t.id===spawn.monster!.template)!;spawn.monster.skills=[...template.skills];spawn.monster.bossKey=template.bossKey;}
 registerDungeonRegion(r,world.spec.island);fieldMaps[r.id]=world.map;
}
for(const world of ((production as unknown as {dungeons?:{spec:{island:string};region:Region;map:{id:string}}[]}).dungeons??[]))registerProducedDungeon(world);
/** Plane scenes (箱庭位面): carved 64×64 stages, entered through plane gates and
 * run by DungeonService like any field dungeon. Presentation reads planeMaps. */
export const planeMaps:Record<string,PlaneMap>={};
for(const spec of planeStageSpecs){const {region,map}=buildPlaneStage(spec);if(regions.some(r=>r.id===region.id))throw Error('Duplicate plane stage '+region.id);registerDungeonRegion(region,spec.island);planeMaps[region.id]=map;}
