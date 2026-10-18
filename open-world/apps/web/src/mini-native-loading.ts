import type {AssetManager} from '@esotericsoftware/spine-webgl';
type Loader=Pick<AssetManager,'loadJsonAsync'|'loadTextureAtlasAsync'>;
/** Completion comes from I/O callbacks, so hidden tabs need no animation frames. */
export async function loadMiniNativeAssets(manager:Loader,runtime:{json:string;atlas:string},timeoutMs=20000){
 const pending=new Set([runtime.json,runtime.atlas]);let timer:ReturnType<typeof setTimeout>|undefined;
 const load=async(path:string,work:Promise<unknown>)=>{try{await work;pending.delete(path);}catch(error){throw new Error(`MiniFantasy resource failed: ${path}: ${String(error)}`);}};
 try{
  await Promise.race([
   Promise.all([load(runtime.json,manager.loadJsonAsync(runtime.json)),load(runtime.atlas,manager.loadTextureAtlasAsync(runtime.atlas))]),
   new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error(`MiniFantasy asset decode timeout: ${[...pending].join(', ')}`)),timeoutMs);}),
  ]);
 }finally{if(timer)clearTimeout(timer);}
}
