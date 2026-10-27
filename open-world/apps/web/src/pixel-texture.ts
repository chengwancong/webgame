/** Pixel mode state only. All source-image conversion was removed after PX9 coverage. */
export interface PixelRuntime{cellStage:number/*0=关*/;version:number;}
export const pixelRuntime:PixelRuntime={cellStage:0,version:0};

type PixelChangeListener=(runtime:PixelRuntime)=>void;
const listeners=new Set<PixelChangeListener>();

export function setPixelCell(cellStage:number):void{
  pixelRuntime.cellStage=cellStage;
  pixelRuntime.version++;
  for(const fn of listeners)fn(pixelRuntime);
}

/** 返回取消订阅函数 */
export function onPixelChange(fn:PixelChangeListener):()=>void{
  listeners.add(fn);
  return ()=>listeners.delete(fn);
}

