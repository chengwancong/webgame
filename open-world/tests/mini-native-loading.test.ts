import {afterEach,describe,expect,it,vi} from 'vitest';
import {loadMiniNativeAssets} from '../apps/web/src/mini-native-loading.ts';
const runtime={json:'/Character.json',atlas:'/Character.atlas'};
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
describe('native asset completion without animation frames',()=>{
 it('finishes in a background tab whose animation frames never run',async()=>{
  const raf=vi.fn();vi.stubGlobal('requestAnimationFrame',raf);
  const manager={loadJsonAsync:vi.fn(async()=>({skeleton:{}})),loadTextureAtlasAsync:vi.fn(async()=>({pages:[]}))};
  await expect(loadMiniNativeAssets(manager,runtime)).resolves.toBeUndefined();expect(raf).not.toHaveBeenCalled();
 });
 it('reports the exact stalled resource and clears its watchdog',async()=>{
  vi.useFakeTimers();const manager={loadJsonAsync:vi.fn(async()=>({})),loadTextureAtlasAsync:vi.fn(()=>new Promise<never>(()=>{}))};
  const result=expect(loadMiniNativeAssets(manager,runtime,50)).rejects.toThrow('MiniFantasy asset decode timeout: /Character.atlas');await vi.advanceTimersByTimeAsync(50);await result;expect(vi.getTimerCount()).toBe(0);
 });
 it('keeps failure details and allows a fresh attempt to succeed',async()=>{
  vi.useFakeTimers();const manager={loadJsonAsync:vi.fn(async()=>({})),loadTextureAtlasAsync:vi.fn().mockRejectedValueOnce('HTTP 404').mockResolvedValue({pages:[]})};
  await expect(loadMiniNativeAssets(manager,runtime)).rejects.toThrow('/Character.atlas: HTTP 404');expect(vi.getTimerCount()).toBe(0);await expect(loadMiniNativeAssets(manager,runtime)).resolves.toBeUndefined();expect(vi.getTimerCount()).toBe(0);
 });
});
