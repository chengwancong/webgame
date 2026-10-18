import type {Region} from '../../../packages/content/index.ts';
import type {Vec} from '../../../packages/contracts/index.ts';
import {findPath} from '../../../packages/simulation/navigation.ts';
const cache=new WeakMap<Region,{key:string;paths:Vec[][]}>();
/** The world ground and minimap use the same navigation-derived visible roads. */
export function mapRoads(region:Region){
 const key=JSON.stringify([region.width,region.height,region.safe,region.portal,region.bossPortal,region.landmarks,region.obstacles]);
 const previous=cache.get(region);if(previous?.key===key)return previous.paths;
 const points=[region.portal,...region.landmarks.filter(l=>l.kind!=='portal'),...(region.bossPortal?[region.bossPortal]:[])];
 const paths=points.map(p=>[region.safe,...findPath(region,region.safe,p)]).filter(p=>p.length>1);
 cache.set(region,{key,paths});return paths;
}
