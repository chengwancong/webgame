import {it,expect} from 'vitest';
import {fieldMaps,fieldRegionIds} from '../packages/content/open-world/index.ts';
import {missingSceneArt} from '../apps/web/src/ui/minimap-scene.ts';
import type {StarseaMap} from '../apps/web/src/starsea-world-renderer.ts';

// Direction A (2026-10-11): the radar draws the scene's own ground, roads, cliff modules and decorations, so every one must resolve.
it('resolves every ground, road, edge and decoration of each field map to the runtime art the scene uses',()=>{
 let checked=0;for(const id of fieldRegionIds){const map=fieldMaps[id] as StarseaMap|undefined;if(!map?.decorations)continue;checked++;expect(missingSceneArt(map),id).toEqual([]);}
 expect(checked).toBeGreaterThanOrEqual(6);
});
