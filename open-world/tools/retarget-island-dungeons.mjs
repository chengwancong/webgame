import {readFile,writeFile} from 'node:fs/promises';
const n=Number(process.argv[2]),island=['wind','mist','forge','frost','rift','dragon'][n-1];if(!island)throw Error('Island1–6 required');
const destination='ss-map-'+island;
for(const path of ['packages/content/field-dungeon-stages.json','packages/content/dungeons.json','packages/content/open-world/production.json']){
 const source=JSON.parse(await readFile(path,'utf8'));
 if(source.stages)for(const stage of source.stages)if(stage.artIsland===island)stage.island=destination;
 if(source.definitions)for(const definition of source.definitions)if(definition.id.startsWith('field-'+island+'-'))definition.area=destination;
 if(source.dungeons)for(const dungeon of source.dungeons)if(dungeon.spec.artIsland===island)dungeon.spec.island=destination;
 await writeFile(path,JSON.stringify(source,null,2)+'\n');
}
console.log(JSON.stringify({island,parent:destination,scope:'Owned authored/generated dungeon declarations only; no save mutation'}));
