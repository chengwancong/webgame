import {readFileSync} from 'node:fs';
import {generateProductionIsland,islandArtPool} from '../../tools/build-production-islands.ts';
import {loadWorldTables,validateWorldGeometry} from '../../packages/content/world-tables.ts';
import {worldTables} from '../../packages/content/world-tables.ts';
import {monsterContent} from '../../packages/content/monsters.ts';
import {campSpawns} from '../../packages/rules/world-camps.ts';
import {walkable,findPath} from '../../packages/simulation/navigation.ts';
import type {WorldTables} from '../../packages/contracts/open-world.ts';
export const catalogues=['open-world.v1.json','open-world-five.v1.json','starsea.v1.json'].map(n=>JSON.parse(readFileSync('packages/asset-manifest/'+n,'utf8')));
export function twoZoneIsland():WorldTables{
 const pool=(cat:string)=>islandArtPool(catalogues,'mist',cat),template=monsterContent.templates.find(t=>t.curve==='starsea'&&t.kind==='melee')!.id;
 return loadWorldTables({source:'test workbook',islands:[{_row:4,id:'fixture-island',region:'fixture-field',island:'ss-map-wind',artIsland:'mist',chapter:1,name:'配置测试岛',width:512,height:512,seed:37,landing:{x:112,y:256},landRadius:[225,225],rockCount:20,decorationsPerZone:20,backdrop:'ss-scene-sky'}],roads:[{_row:4,id:'fixture-road',region:'fixture-field',widthCells:3,points:[{x:112,y:256},{x:400,y:256}]}],zones:[0,1].map(i=>({_row:4+i,id:'fixture-zone-'+i,region:'fixture-field',name:'测试分区'+i,rect:{x:i*256,y:0,w:256,h:512},levelBand:[1,3],theme:'mist',ground:pool('ground')[i].id})),waypoints:[{_row:4,id:'fixture-waypoint-a',region:'fixture-field',zone:'fixture-zone-0',x:112,y:256,name:'登陆航标',resource:pool('landmark')[0].id,kind:'landing'},{_row:5,id:'fixture-waypoint-b',region:'fixture-field',zone:'fixture-zone-1',x:350,y:256,name:'前哨航标',resource:pool('landmark')[0].id,kind:'outpost'}],camps:[{_row:4,id:'fixture-camp',region:'fixture-field',zone:'fixture-zone-0',x:220,y:230,radius:4,pack:[{template,rank:'normal',count:4}],respawnSeconds:90}]});
}
