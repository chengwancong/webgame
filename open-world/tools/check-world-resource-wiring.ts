import {existsSync,readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import '../packages/content/open-world/index.ts';
import {worldTables,dungeonArtEntrances} from '../packages/content/world-tables.ts';
import {regions,regionById} from '../packages/content/index.ts';
import {dungeonContent} from '../packages/content/dungeons.ts';
import {monsterContent} from '../packages/content/monsters.ts';
import {actorCatalog} from '../packages/asset-manifest/actors.ts';
import {runtimeResources} from '../packages/asset-manifest/runtime-resources.ts';
import {dungeonArtwork,destinationArtwork} from '../packages/asset-manifest/destination-artwork.ts';
import {destinationCatalog} from '../apps/web/src/travel-browser.ts';
import npcSource from '../config/json/npcs.json';
const fields=new Set(['resource','markerResource','activeResource','cooldownResource','startEffect','successEffect','failureEffect','openResource','backdrop','ground','groundResource','backdropResource','banner','ambient','prop','openedProp','artId','resourceId']);
export function checkResourceReferences(source:unknown,label:string,known:ReadonlySet<string>){
 const references:{path:string;id:string}[]=[];
 function visit(value:unknown,path:string){
  if(!value||typeof value!=='object')return;
  for(const [field,item] of Object.entries(value)){
   const at=path+'.'+field;
   if(fields.has(field)&&typeof item==='string'){
    // 交接允许采集点使用材料类别图标，由前端回退；其他世界资源仍须完整登记。
    if(field==='resource'&&(value as {kind?:string}).kind==='gather'&&/^item-material-(ore|plant)$/.test(item))continue;
    if(!known.has(item))throw Error('Unregistered world resource '+at+' = '+item);
    references.push({path:at,id:item});
   }else visit(item,at);
  }
 }
 visit(source,label);return references;
}
export function checkWorldResourceWiring({metadataOnly=false}:{metadataOnly?:boolean}={}){
 // Generated actor/atlas JSON belongs to the deploy-time asset bundle too.
 const available=(asset:string)=>metadataOnly||existsSync('apps/web/public'+asset.split('?')[0]);
 const known=new Set(runtimeResources.keys()),references=checkResourceReferences(worldTables,'world',known);
 const production=JSON.parse(readFileSync('packages/content/open-world/production.json','utf8'));
 references.push(...checkResourceReferences(production,'production',known));
 for(const file of readdirSync('packages/content/starsea/maps').filter(f=>f.endsWith('.json')))references.push(...checkResourceReferences(JSON.parse(readFileSync('packages/content/starsea/maps/'+file,'utf8')),'starsea/'+file,known));
 const artwork=dungeonContent.definitions.map(definition=>({id:definition.id,path:dungeonArtwork(definition,regionById(definition.area),dungeonArtEntrances)}));
 for(const destination of destinationCatalog())artwork.push({id:destination.region.id,path:destinationArtwork(destination.area)});
 for(const entry of artwork)if(!available(entry.path))throw Error('Missing dungeon illustration '+entry.id+' '+entry.path);
 const actors=[...monsterContent.templates.map(t=>({source:'monster:'+t.id,art:t.art})),...regions.flatMap(r=>r.spawns.map(s=>({source:r.id+'/'+s.id,art:s.art}))),...npcSource.npcs.filter(n=>n.campaign==='starsea').map(n=>({source:'npc:'+n.id,art:n.id}))];
 for(const actor of actors)if(!actorCatalog[actor.art])throw Error('Unregistered actor '+actor.source+' '+actor.art);
 for(const reference of references){
  const runtime=runtimeResources.get(reference.id)!.runtime as Record<string,unknown>;
  for(const key of ['file','image','atlas','sockets','profile'])if(typeof runtime[key]==='string'&&!available(runtime[key]))throw Error('Missing runtime dependency '+reference.id+' '+runtime[key]);
 }
 return {passed:true,islands:worldTables.islands.length,legacyIslands:regions.filter(r=>r.id.startsWith('ss-map-')&&!r.boss&&!r.rest).length,dungeons:dungeonContent.definitions.length,travelDestinations:destinationCatalog().length,resourceReferences:references.length,actorReferences:actors.length,artwork,references};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const report=checkWorldResourceWiring(),out=process.argv.find(a=>a.startsWith('--out='))?.slice(6);
 if(out){mkdirSync(resolve(out,'..'),{recursive:true});writeFileSync(out,JSON.stringify(report,null,2));}
 console.log(JSON.stringify({passed:report.passed,islands:report.islands,dungeons:report.dungeons,resourceReferences:report.resourceReferences,actorReferences:report.actorReferences}));
}
