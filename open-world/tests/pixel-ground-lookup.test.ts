import {it,expect,vi} from 'vitest';
const assets=vi.hoisted(()=>new Map<string,{kind:string;file:string}>());
vi.mock('../apps/web/src/pixel-assets.ts',()=>({pixelAsset:(key:string)=>assets.get(key),loadPixelImage:vi.fn()}));
import {pixelTerrainKey} from '../apps/web/src/pixel-ground.ts';
it('keeps plaza and road banks separate when the original game shares one texture file',()=>{
 assets.clear();const file='/art/starsea/scenes/textures/road.png';
 assets.set(file,{kind:'tiles',file:'/art-pixel/shared.png'});
 assets.set('ss-scene-ground-port',{kind:'tiles',file:'/art-pixel/plaza.png'});
 assets.set('ss-scene-road',{kind:'tiles',file:'/art-pixel/road.png'});
 expect(pixelTerrainKey(file,'ss-scene-ground-port')).toBe('ss-scene-ground-port');
 expect(pixelTerrainKey(file,'ss-scene-road')).toBe('ss-scene-road');
});
it('retains source-file and biome lookup for resources without a dedicated semantic bank',()=>{
 assets.clear();assets.set('/art/stone.png',{kind:'tiles',file:'/art-pixel/stone.png'});
 expect(pixelTerrainKey('/art/stone.png','unknown-ground')).toBe('/art/stone.png');
 expect(pixelTerrainKey('/art/missing.png','frost-wall')).toBe('terrain:frost:wall');
});
