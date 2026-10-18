import pictures from './travel.json';
import {runtimeResources} from './runtime-resources.ts';
type Area={id:string;theme:string};
type Entrance={dungeon:string;resource:string};
export function destinationArtwork(area:Area){
 const assets=pictures.assets as Record<string,{path:string;sha256:string}>;
 const asset=assets[area.id]??assets[area.theme];
 if(!asset)throw Error('缺少地区插画：'+area.id);
 return asset.path+'?v='+asset.sha256.slice(0,12);
}
export function dungeonArtwork(definition:{id:string;area:string},area:Area,entrances:readonly Entrance[]){
 const entrance=entrances.find(item=>item.dungeon===definition.id);
 if(!entrance)return destinationArtwork(area);
 const runtime=runtimeResources.get(entrance.resource)?.runtime as {file?:string}|undefined;
 if(!runtime?.file)throw Error('地城入口插画资源未登记：'+entrance.resource);
 return runtime.file;
}
