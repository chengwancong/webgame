import source from '../../config/json/world.json';
import {worldSchemas,type WorldTables} from '../contracts/open-world.ts';
import {z} from 'zod';
import type {Region} from './index.ts';
import {walkable,findPath} from '../simulation/navigation.ts';
const shape=Object.fromEntries(Object.entries(worldSchemas).map(([key,schema])=>[key,z.array(schema).default([])]));
export function loadWorldTables(raw:unknown):WorldTables{
 const data=z.object({source:z.string(),...shape}).strict().parse(raw) as WorldTables;
 const ids=new Set<string>(),zones=new Map(data.zones.map(z=>[z.id,z]));
 for(const [table,rows] of Object.entries(data))if(table!=='source')for(const item of rows as {id:string;region:string;_row:number;zone?:string}[]){
  const where=`${data.source}/${table} 第${item._row}行`;
  if(ids.has(item.id))throw Error(where+'：重复 ID '+item.id);ids.add(item.id);
  if(item.zone&&(!zones.has(item.zone)||zones.get(item.zone)!.region!==item.region))throw Error(where+'：分区引用不存在或不在同岛 '+item.zone);
 }
 for(const zone of data.zones){
  if(zone.levelBand[0]>zone.levelBand[1])throw Error('分区等级带倒置 '+zone.id);
  if(!data.waypoints.some(w=>w.zone===zone.id))throw Error('分区缺少传送点 '+zone.id);
  for(const other of data.zones)if(other!==zone&&other.region===zone.region&&zone.rect.x<other.rect.x+other.rect.w&&zone.rect.x+zone.rect.w>other.rect.x&&zone.rect.y<other.rect.y+other.rect.h&&zone.rect.y+zone.rect.h>other.rect.y)throw Error('分区重叠 '+zone.id+' '+other.id);
 }
 for(const camp of data.camps)for(const other of data.camps)if(other!==camp&&other.region===camp.region){const zone=zones.get(camp.zone)!,otherZone=zones.get(other.zone)!,minimum=Math.min(zone.levelBand[0],otherZone.levelBand[0])<=8?10:8;if(Math.hypot(camp.x-other.x,camp.y-other.y)<minimum)throw Error('营地间距不足 '+minimum+' 格 '+camp.id+' '+other.id);}
 for(const object of data.objects)if(object.kind==='gather'&&!object.material)throw Error('采集点缺少材料 '+object.id);
 return data;
}
/** Build-time validation, never a runtime fallback. Geometry and references are
 * explicit inputs to keep this loader independent of the region import graph. */
export function validateWorldGeometry(data:WorldTables,maps:Region[],refs:{templates:Set<string>;resources:Set<string>;dungeons:Set<string>;events:Set<string>;loot:Set<string>;conditions?:Set<string>}){
 for(const [table,rows]of Object.entries(data))if(table!=='source')for(const row of rows as {when?:string;until?:string}[])for(const condition of [row.when,row.until].filter(Boolean) as string[])if(!refs.conditions?.has(condition))throw Error('未知世界相位条件 '+condition);
 for(const island of data.islands){const map=maps.find(m=>m.id===island.region);if(!map||map.width!==512||map.height!==512)throw Error('正式岛缺少512地图 '+island.id);if(!refs.resources.has(island.backdrop))throw Error('未知岛屿背景资源 '+island.backdrop);}
 for(const road of data.roads){const map=maps.find(m=>m.id===road.region);if(!map)throw Error('道路未知地图 '+road.id);if(road.resource&&!refs.resources.has(road.resource))throw Error('未知道路资源 '+road.resource);for(const p of road.points)if(!walkable(map,p,.55))throw Error('道路落在碰撞体 '+road.id);}
 for(const gate of data.gates){const map=maps.find(m=>m.id===gate.map);if(!map?.landmarks?.some(p=>p.name===gate.landmark))throw Error('未知门地标 '+gate.id);if(gate.openWhen&&!refs.conditions?.has(gate.openWhen))throw Error('未知开门条件 '+gate.openWhen);if(gate.openedProp&&!refs.resources.has(gate.openedProp))throw Error('未知开门资源 '+gate.openedProp);if(!refs.resources.has(gate.prop))throw Error('未知门物件 '+gate.prop);for(const guard of gate.guards)if(!refs.templates.has(guard.template))throw Error('未知守门怪物 '+guard.template);}
 for(const zone of data.zones){const map=maps.find(m=>m.id===zone.region);if(!map)throw Error('未知世界地图 '+zone.region);
  if(zone.rect.x<0||zone.rect.y<0||zone.rect.x+zone.rect.w>map.width||zone.rect.y+zone.rect.h>map.height)throw Error('分区越界 '+zone.id);
  for(const resource of [zone.ground,zone.ambient,zone.music,zone.banner].filter(Boolean) as string[])if(!refs.resources.has(resource))throw Error('未知世界资源 '+resource);
 }
 for(const [table,rows] of Object.entries(data))if(!['source','islands','roads','zones','gates'].includes(table))for(const item of rows as any[]){
  const map=maps.find(m=>m.id===item.region);const zone=data.zones.find(z=>z.id===item.zone);if(!map||!zone)throw Error('世界物件未知地图或分区 '+item.id);
  const points=item.path??item.spots??[{x:item.x,y:item.y}];
  for(const p of points){if(p.x<zone.rect.x||p.x>=zone.rect.x+zone.rect.w||p.y<zone.rect.y||p.y>=zone.rect.y+zone.rect.h)throw Error('物件不在所属分区 '+item.id);
   if(!walkable(map,p,.55))throw Error('世界物件落在碰撞体 '+item.id);
   if(!findPath(map,map.safe,p,.55).length&&Math.hypot(map.safe.x-p.x,map.safe.y-p.y)>.1)throw Error('登陆点无法到达 '+item.id);
   if(['camps','dungeonEntrances','planeGates','events','chests','rares','patrols'].includes(table)&&Math.hypot(map.safe.x-p.x,map.safe.y-p.y)<=6+(item.radius??0))throw Error('世界玩法物件落在登陆安全区 '+item.id);
  }
  for(const template of [...(item.pack?.map((p:any)=>p.template)??[]),...(item.waves?.flatMap((w:any[])=>w.map(p=>p.template))??[]),...(item.template?[item.template]:[])])if(!refs.templates.has(template))throw Error('未知营地怪物 '+template);
  for(const [field,set] of [['resource',refs.resources],['markerResource',refs.resources],['activeResource',refs.resources],['cooldownResource',refs.resources],['startEffect',refs.resources],['successEffect',refs.resources],['failureEffect',refs.resources],['openResource',refs.resources],['clearedResource',refs.resources],['dungeon',refs.dungeons],['definition',refs.events],['loot',refs.loot]] as const)if(item[field]&&!set.has(item[field])&&!(item.kind==='gather'&&field==='resource'&&/^item-material-(ore|plant)$/.test(item[field])))throw Error('未知世界引用 '+item[field]);
 }
 for(const gate of data.planeGates){const map=maps.find(m=>m.id===gate.region)!,back={x:gate.returnX,y:gate.returnY};
  if(!walkable(map,back,.55))throw Error('位面出口回落点落在碰撞体 '+gate.id);
  if(Math.hypot(map.safe.x-back.x,map.safe.y-back.y)>.1&&!findPath(map,map.safe,back,.55).length)throw Error('位面出口回落点无法从登陆点到达 '+gate.id);
  for(const condition of [gate.fact,gate.requires].filter(Boolean) as string[])if(!refs.conditions?.has(condition))throw Error('未知位面入口条件 '+condition);
  for(const other of [...data.planeGates,...data.dungeonEntrances,...data.events])if(other!==gate&&other.region===gate.region&&Math.hypot(other.x-gate.x,other.y-gate.y)<6)throw Error('位面入口离其他入口太近 '+gate.id+' '+other.id);
 }
 return {zones:data.zones.length,camps:data.camps.length,waypoints:data.waypoints.length};
}
export const worldTables=loadWorldTables(source);
export function worldZoneAt(region:string,p:{x:number;y:number}){return worldTables.zones.find(z=>z.region===region&&p.x>=z.rect.x&&p.x<z.rect.x+z.rect.w&&p.y>=z.rect.y&&p.y<z.rect.y+z.rect.h);}
/** 副本面板插画的入口来源：野外地城入口与箱庭位面门（位面副本用门的资源作插画）。 */
export const dungeonArtEntrances=[...worldTables.dungeonEntrances,...worldTables.planeGates.map(g=>({dungeon:g.plane,resource:g.resource}))];
