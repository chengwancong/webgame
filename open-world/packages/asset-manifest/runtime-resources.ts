import legacy from './starsea.v1.json';
import {openWorldRuntimeAssets} from './open-world-assets.ts';
/** Shared by browser loading and Node validation; includes every island. */
export const runtimeResources=new Map([...legacy.assets,...openWorldRuntimeAssets].map(asset=>[asset.id,asset]));
